/**
 * MQTT Service for Ecoflow devices
 * Primary solution: Real-time device status updates via MQTT
 */

import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { EventEmitter } from 'events';
import {
  mapQuotaData,
  toDeviceStatusFields,
  resolveDeviceFamily,
  isSmartPlugFamily,
} from '@ecoflow/shared';
import { getConfig } from '../config/env';
import { ecoflowService } from './ecoflow';
import type { EcoflowDeviceStatus, EcoflowMQTTCertification } from '../types/ecoflow';
import { safeParseEcoflowDeviceStatus } from '../schemas/ecoflow';
import { logger } from '../utils/logger';
import { RECONNECT_CONFIG, MQTT_CONFIG } from '../constants';
import {
  mqttMessagesTotal,
  mqttConnectionStatus,
  mqttMessageProcessingDuration,
  deviceStatusCacheSize,
  errorsTotal,
} from '../utils/metrics';
import { recordSampleFromUpdate } from './historyService';
import { evaluateStatus } from './alertService';

export interface DeviceStatusUpdate {
  deviceSn: string;
  status: EcoflowDeviceStatus;
  timestamp: number;
  source: 'mqtt' | 'rest';
}

/**
 * MQTT Service - Primary solution for device status
 */
export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private config = getConfig();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = RECONNECT_CONFIG.MQTT.MAX_ATTEMPTS;
  private reconnectDelay = RECONNECT_CONFIG.MQTT.DELAY;
  private subscribedDevices = new Set<string>();
  private statusCache = new Map<string, DeviceStatusUpdate>();
  private fallbackToRest = false;
  private mqttCertification: EcoflowMQTTCertification | null = null;
  private certificationExpiry: number = 0; // Timestamp when certification expires (24 hours)
  private lastSuccessAt: number | null = null;

  constructor() {
    super();
    
    // Try to connect if MQTT is enabled
    if (this.config.ecoflow.mqtt?.enabled) {
      this.initializeMQTT();
    } else {
      logger.warn('⚠️  MQTT is disabled. Using REST API only.');
      this.fallbackToRest = true;
    }
  }

  /**
   * Initialize MQTT by getting certification first
   */
  private async initializeMQTT(): Promise<void> {
    try {
      await this.fetchMQTTCertification();
      this.connect();
    } catch (error) {
      const err = error as Error;
      logger.error('❌ Failed to initialize MQTT:', { error: err.message });
      this.fallbackToRest = true;
      this.emit('error', err);
    }
  }

  /**
   * Fetch MQTT certification from Ecoflow API
   * According to official documentation: GET /iot-open/sign/certification
   */
  private async fetchMQTTCertification(): Promise<void> {
    // Check if we have valid cached certification (valid for 23 hours)
    const now = Date.now();
    if (this.mqttCertification && this.certificationExpiry > now) {
      logger.debug('✅ Using cached MQTT certification');
      return;
    }

    logger.info('📡 Fetching MQTT certification from Ecoflow API...');

    try {
      const response = await ecoflowService.getMQTTCertification();
      
      if (response.code !== '0') {
        throw new Error(`Failed to get MQTT certification: ${response.message || 'Unknown error'}`);
      }

      this.mqttCertification = response.data;
      // Cache certification for configured hours (API might expire after 24 hours)
      const cacheHours = MQTT_CONFIG.CERTIFICATION_CACHE_HOURS;
      this.certificationExpiry = now + (cacheHours * 60 * 60 * 1000);

      logger.info('✅ MQTT certification received:', {
        url: this.mqttCertification.url,
        port: this.mqttCertification.port,
        protocol: this.mqttCertification.protocol,
        certificateAccount: this.mqttCertification.certificateAccount.substring(0, 10) + '...',
      });
    } catch (error) {
      const err = error as Error;
      logger.error('❌ Error fetching MQTT certification:', { error: err.message });
      throw err;
    }
  }

  /**
   * Connect to MQTT broker using certification from API
   */
  private connect(): void {
    if (!this.config.ecoflow.mqtt?.enabled) {
      return;
    }

    // Must have certification from API
    if (!this.mqttCertification) {
      logger.error('❌ MQTT certification not available. Cannot connect.');
      this.fallbackToRest = true;
      return;
    }

    const mqttConfig = this.config.ecoflow.mqtt;
    const cert = this.mqttCertification;

    // Build broker URL from certification
    // protocol can be 'mqtt' or 'mqtts'
    const protocol = cert.protocol === 'mqtts' ? 'mqtts' : 'mqtt';
    const brokerUrl = `${protocol}://${cert.url}:${cert.port}`;

    // Use certificateAccount and certificatePassword from API
    const options: IClientOptions = {
      clientId: mqttConfig.clientId || `ecoflow-monitor-${Date.now()}`,
      username: cert.certificateAccount,
      password: cert.certificatePassword,
      clean: true,
      reconnectPeriod: this.reconnectDelay,
      connectTimeout: MQTT_CONFIG.CONNECT_TIMEOUT,
      keepalive: MQTT_CONFIG.KEEPALIVE,
    };

    // For mqtts (TLS), we might need additional options
    if (cert.protocol === 'mqtts') {
      // MQTT.js will automatically use TLS for mqtts:// URLs
      // If needed, we can add rejectUnauthorized: false for self-signed certs
      // but it's better to use proper certificates
    }

    logger.debug('🔌 Connecting to MQTT broker:', {
      brokerUrl,
      clientId: options.clientId,
      username: options.username?.substring(0, 10) + '...',
      hasPassword: !!options.password,
      protocol: cert.protocol,
      port: cert.port,
    });

    try {
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', async () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.fallbackToRest = false;
        mqttConnectionStatus.set(1);
        logger.info('✅ MQTT connected successfully');
        
        // Subscribe to all devices automatically
        try {
          const devicesResponse = await ecoflowService.getDevices();
          const devices = devicesResponse.devices || [];
          
          if (devices.length > 0) {
            logger.info(`📡 Subscribing to ${devices.length} device(s)...`);
            devices.forEach((device) => {
              this.subscribeToDevice(device.sn);
            });
          } else {
            logger.warn('⚠️  No devices found to subscribe to');
          }
        } catch (error) {
          const err = error as Error;
          logger.error('❌ Failed to fetch devices for auto-subscription:', { error: err.message });
          // Still resubscribe to previously subscribed devices as fallback
          this.subscribedDevices.forEach((deviceSn) => {
            this.subscribeToDevice(deviceSn);
          });
        }
      });

      this.client.on('message', (topic: string, message: Buffer) => {
        this.handleMessage(topic, message);
      });

      this.client.on('error', (error: Error) => {
        logger.error('❌ MQTT error:', { error: error.message });
        this.isConnected = false;
        mqttConnectionStatus.set(0);
        errorsTotal.inc({ type: 'mqtt_connection_error', source: 'mqtt' });
        this.emit('error', error);
      });

      this.client.on('close', () => {
        logger.info('🔌 MQTT connection closed');
        this.isConnected = false;
        mqttConnectionStatus.set(0);
        this.emit('disconnect');
      });

      this.client.on('offline', () => {
        logger.warn('⚠️  MQTT client went offline');
        this.isConnected = false;
        mqttConnectionStatus.set(0);
        this.fallbackToRest = true;
        this.emit('offline');
      });

      this.client.on('reconnect', async () => {
        this.reconnectAttempts++;
        logger.info(`🔄 MQTT reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        // Refresh certification if expired
        const now = Date.now();
        if (!this.mqttCertification || this.certificationExpiry <= now) {
          try {
            await this.fetchMQTTCertification();
            // Reconnect with new certification
            if (this.client) {
              this.client.end();
            }
            this.connect();
            return;
            } catch (error) {
              logger.error('❌ Failed to refresh MQTT certification during reconnect:', { error });
            }
          }
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.warn('⚠️  Max reconnection attempts reached. Falling back to REST API.');
            this.fallbackToRest = true;
            this.emit('fallback', 'max_reconnect_attempts');
          }
        });

    } catch (error) {
      const err = error as Error;
      logger.error('❌ Failed to create MQTT client:', { error: err.message });
      this.fallbackToRest = true;
      this.emit('error', err);
    }
  }

  /**
   * Subscribe to device status updates
   * According to official documentation:
   * - /open/${certificateAccount}/${sn}/quota (device → app)
   * - /open/${certificateAccount}/${sn}/status (device → app)
   */
  subscribeToDevice(deviceSn: string): void {
    if (!this.config.ecoflow.mqtt?.enabled) {
      return;
    }

    this.subscribedDevices.add(deviceSn);

    if (!this.isConnected || !this.client) {
      logger.debug(`⏳ MQTT not connected. Will subscribe to ${deviceSn} when connected.`);
      return;
    }

    // Must have certification to build correct topics
    if (!this.mqttCertification) {
      logger.error('❌ Cannot subscribe: MQTT certification not available');
      return;
    }

    const certificateAccount = this.mqttCertification.certificateAccount;

    // Topics according to official documentation
    const topics = [
      `/open/${certificateAccount}/${deviceSn}/quota`,      // Device quota reports (device → app)
      `/open/${certificateAccount}/${deviceSn}/status`,     // Device status reports (device → app)
      // Note: get_reply subscription may fail, but responses can come on quota/status topics
      // `/open/${certificateAccount}/${deviceSn}/get_reply`,  // Reply to get requests (device → app)
    ];

    topics.forEach((topic) => {
      this.client!.subscribe(topic, (err: Error | null) => {
        if (err) {
          logger.error(`❌ Failed to subscribe to ${topic}:`, { error: err.message });
        } else {
          logger.debug(`✅ Subscribed to MQTT topic: ${topic}`);
        }
      });
    });
  }

  /**
   * Unsubscribe from device status updates
   */
  unsubscribeFromDevice(deviceSn: string): void {
    this.subscribedDevices.delete(deviceSn);

    if (!this.isConnected || !this.client || !this.mqttCertification) {
      return;
    }

    const certificateAccount = this.mqttCertification.certificateAccount;

    const topics = [
      `/open/${certificateAccount}/${deviceSn}/quota`,
      `/open/${certificateAccount}/${deviceSn}/status`,
    ];

    topics.forEach((topic) => {
      this.client!.unsubscribe(topic);
    });
  }

  /**
   * Handle incoming MQTT messages
   */
  private handleMessage(topic: string, message: Buffer): void {
    const start = Date.now();
    try {
      // Safe JSON parsing with error handling
      let data: unknown;
      try {
        data = JSON.parse(message.toString());
      } catch (parseError) {
        const err = parseError as Error;
        logger.error('❌ Failed to parse MQTT message as JSON:', {
          error: err.message,
          topic,
          messagePreview: message.toString().substring(0, 200),
        });
        mqttMessagesTotal.inc({ topic, status: 'parse_error' });
        errorsTotal.inc({ type: 'mqtt_parse_error', source: 'mqtt' });
        return;
      }
      
      // Log full message for debugging (debug level)
      logger.debug('📨 MQTT message received:', {
        topic,
        message: data,
      });

      // Extract device SN from topic
      // Topics format: /open/${certificateAccount}/${sn}/quota, /open/${certificateAccount}/${sn}/status, or /open/${certificateAccount}/${sn}/get_reply
      const parts = topic.split('/').filter(p => p); // Remove empty strings
      // Expected: ['open', certificateAccount, deviceSn, 'quota'|'status'|'get_reply']
      if (parts.length < 4 || parts[0] !== 'open') {
        logger.warn('⚠️  Unexpected topic format:', { topic });
        mqttMessagesTotal.inc({ topic, status: 'invalid_topic' });
        return;
      }
      
      const deviceSn = parts[2]; // Third part is device SN
      const topicKind = parts[parts.length - 1]; // quota | status | get_reply

      if (!deviceSn) {
        logger.warn('⚠️  Could not extract device SN from topic:', { topic });
        mqttMessagesTotal.inc({ topic, status: 'missing_device_sn' });
        return;
      }

      // /status carries online/presence only — never overwrite SOC/W with mapper zeros
      if (topicKind === 'status') {
        this.handlePresenceMessage(deviceSn, data, topic, start);
        return;
      }

      // Smart Plug also publishes schedule (2_2), time/meta, wifiRssi-only on /quota —
      // never wipe watts / seed empty plug status with those.
      if (this.isSmartPlugNonTelemetryQuota(data, deviceSn)) {
        logger.debug(`⏭️  Skipping Smart Plug non-telemetry quota for ${deviceSn}`);
        mqttMessagesTotal.inc({ topic, status: 'skipped_nontel' });
        const duration = (Date.now() - start) / 1000;
        mqttMessageProcessingDuration.observe({ topic }, duration);
        return;
      }

      // /quota and get_reply: map telemetry into status cache
      const previous = this.statusCache.get(deviceSn);
      const status = this.parseDeviceStatus(data, deviceSn, previous?.status);
      
      if (status) {
        const update: DeviceStatusUpdate = {
          deviceSn,
          status,
          timestamp: Date.now(),
          source: 'mqtt',
        };

        // Cache the status
        this.statusCache.set(deviceSn, update);
        this.lastSuccessAt = update.timestamp;
        
        // Update cache size metric
        deviceStatusCacheSize.set(this.statusCache.size);

        // Record successful message processing
        const duration = (Date.now() - start) / 1000;
        mqttMessageProcessingDuration.observe({ topic }, duration);
        mqttMessagesTotal.inc({ topic, status: 'success' });

        this.afterStatusCached(update);

        // Emit event for WebSocket/other listeners
        this.emit('status', update);
      } else {
        mqttMessagesTotal.inc({ topic, status: 'parse_failed' });
      }
    } catch (error) {
      const err = error as Error;
      logger.error('❌ Error parsing MQTT message:', {
        error: err.message,
        topic,
        message: message.toString(),
      });
      mqttMessagesTotal.inc({ topic, status: 'error' });
      errorsTotal.inc({ type: 'mqtt_processing_error', source: 'mqtt' });
    }
  }

  /**
   * Handle MQTT /status presence updates without wiping quota-derived SOC/W.
   * Payload shape: { params|param: { status: 0|1 } }
   */
  private handlePresenceMessage(
    deviceSn: string,
    data: unknown,
    topic: string,
    start: number
  ): void {
    const online = this.extractOnlinePresence(data);
    if (online === undefined) {
      logger.debug(`⚠️  Could not extract presence from /status for ${deviceSn}`, { data });
      mqttMessagesTotal.inc({ topic, status: 'parse_failed' });
      return;
    }

    const cached = this.statusCache.get(deviceSn);
    if (!cached) {
      // No quota yet — do not seed cache with 0% / 0 W
      logger.debug(`📡 Presence-only update for ${deviceSn} (no quota cache yet)`, { online });
      const duration = (Date.now() - start) / 1000;
      mqttMessageProcessingDuration.observe({ topic }, duration);
      mqttMessagesTotal.inc({ topic, status: 'success' });
      return;
    }

    const now = Date.now();
    const update: DeviceStatusUpdate = {
      deviceSn,
      timestamp: now,
      source: 'mqtt',
      status: {
        ...cached.status,
        online,
        timestamp: now,
      },
    };

    this.statusCache.set(deviceSn, update);
    this.lastSuccessAt = now;
    deviceStatusCacheSize.set(this.statusCache.size);

    const duration = (Date.now() - start) / 1000;
    mqttMessageProcessingDuration.observe({ topic }, duration);
    mqttMessagesTotal.inc({ topic, status: 'success' });
    this.afterStatusCached(update);
    this.emit('status', update);
  }

  /**
   * History + alerts after a successful status cache write.
   */
  private afterStatusCached(update: DeviceStatusUpdate): void {
    try {
      recordSampleFromUpdate(update);
    } catch (err) {
      logger.warn(`Failed to record history sample for ${update.deviceSn}:`, {
        error: (err as Error).message,
      });
    }
    try {
      evaluateStatus(update.deviceSn, update.status, update.status.online as boolean | undefined);
    } catch (err) {
      logger.warn(`Failed to evaluate alerts for ${update.deviceSn}:`, {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Smart Plug docs publish heartbeat(2_1) with watts/switchSta, plus non-telemetry
   * /quota shapes that must not replace the status cache:
   * - task(2_2) schedules under `param.taskN` / `2_2.*`
   * - time/meta-only (dstTime, utcTime, timeZone, runTime, …) with no plug keys
   * - wifi/lan/brightness heartbeats without watts (would seed empty forcePlug status)
   * - for known HW52 SN: any message lacking plug telemetry keys
   */
  private isSmartPlugNonTelemetryQuota(data: unknown, deviceSn?: string): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;
    const envelopeKeys = new Set([
      'id',
      'version',
      'operateType',
      'from',
      'method',
      'cmdId',
      'cmdFunc',
      'params',
      'param',
      'data',
      'code',
      'message',
      'topic',
    ]);
    const plugKeys = new Set([
      'switchSta',
      'watts',
      '2_1.switchSta',
      '2_1.watts',
      'volt',
      '2_1.volt',
      'current',
      '2_1.current',
      'temp',
      '2_1.temp',
      // Pre-refactor / station-shaped aliases sometimes appear on plug MQTT
      'consWatt',
      'outputWatts',
      'outWatts',
      'outPutWatts',
      'dischargeRate',
      'dischargePower',
    ]);
    // Docs/smart-plug: runTime & clock fields are not power telemetry
    const timeMetaKeys = new Set([
      'dstTime',
      'utcTime',
      'timeZone',
      'timezone',
      'runTime',
      'localTime',
      'sysTime',
      'parentWifiRssi',
      'wifiRssi',
      'rssi',
      'lanState',
      'brightness',
    ]);

    const paramBags: Record<string, unknown>[] = [];
    for (const key of ['param', 'params', 'data'] as const) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        paramBags.push(value as Record<string, unknown>);
      }
    }
    // Include top-level non-envelope keys (some devices omit param wrapper)
    const topLevelParams: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!envelopeKeys.has(key)) {
        topLevelParams[key] = value;
      }
    }
    if (Object.keys(topLevelParams).length > 0) {
      paramBags.push(topLevelParams);
    }
    // Always scan the raw object for cmdId / nested detection too
    const bags: Record<string, unknown>[] = [obj, ...paramBags];

    let hasPlugTelemetry = false;
    let hasTask = false;
    const contentKeys = new Set<string>();

    for (const bag of bags) {
      for (const key of Object.keys(bag)) {
        if (envelopeKeys.has(key)) {
          continue;
        }
        contentKeys.add(key);
        if (plugKeys.has(key) || key.startsWith('2_1.')) {
          hasPlugTelemetry = true;
        }
        if (/^task\d+$/i.test(key) || key.startsWith('2_2.') || key === 'task') {
          hasTask = true;
        }
      }
    }

    // Known Smart Plug SN (HW52…): never seed/overwrite cache without plug power keys.
    // Live Bathroom logs often show only dstTime/utcTime/parentWifiRssi — those used to
    // create forcePlug empty status → UI "Power unavailable" while MQTT stayed green.
    if (
      deviceSn &&
      isSmartPlugFamily(resolveDeviceFamily({ sn: deviceSn })) &&
      !hasPlugTelemetry
    ) {
      return true;
    }

    // Docs: task report uses cmdId 2; heartbeat uses cmdId 1
    const cmdId = obj.cmdId;
    if (cmdId === 2 && !hasPlugTelemetry) {
      return true;
    }

    if (hasTask && !hasPlugTelemetry) {
      return true;
    }

    // Time/meta-only params (no watts/switchSta/…) — skip entirely so we never
    // seed forcePlug empty status or overwrite a good heartbeat.
    if (!hasPlugTelemetry && contentKeys.size > 0) {
      let onlyTimeMeta = true;
      let hasTimeMeta = false;
      for (const key of contentKeys) {
        if (timeMetaKeys.has(key)) {
          hasTimeMeta = true;
        } else {
          onlyTimeMeta = false;
          break;
        }
      }
      if (onlyTimeMeta && hasTimeMeta) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract online flag from MQTT /status payload wrappers.
   */
  private extractOnlinePresence(data: unknown): boolean | undefined {
    if (typeof data !== 'object' || data === null) {
      return undefined;
    }

    const obj = data as Record<string, unknown>;
    const wrappers: Record<string, unknown>[] = [obj];

    for (const key of ['params', 'param', 'data'] as const) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        wrappers.push(value as Record<string, unknown>);
      }
    }

    for (const wrapper of wrappers) {
      if ('status' in wrapper) {
        const s = wrapper.status;
        if (typeof s === 'number') {
          return s === 1;
        }
        if (typeof s === 'boolean') {
          return s;
        }
      }
      if ('online' in wrapper) {
        const o = wrapper.online;
        if (typeof o === 'number') {
          return o === 1;
        }
        if (typeof o === 'boolean') {
          return o;
        }
      }
    }

    return undefined;
  }

  /**
   * Parse device status from MQTT message
   * According to official documentation, MQTT messages contain params object
   * Structure: { id, version, operateType, from, params: { ... } }
   * Also accepts singular `param` wrapper (Smart Plug / some heartbeats).
   * Also handles different message formats from Ecoflow devices
   *
   * Delta 3 /quota heartbeats are often partial (e.g. only powInSumW). When SOC
   * is absent from this message, preserve previous batteryLevel instead of
   * defaulting to 0% (mapQuotaData unmatched → batteryLevel 0).
   */
  private parseDeviceStatus(
    data: unknown,
    deviceSn: string,
    previousStatus?: EcoflowDeviceStatus
  ): EcoflowDeviceStatus | null {
    try {
      if (typeof data !== 'object' || data === null) {
        return null;
      }

      const obj = data as Record<string, unknown>;

      let params: Record<string, unknown> | null = null;
      let dataField: Record<string, unknown> | null = null;

      if ('data' in obj && typeof obj.data === 'object' && obj.data !== null) {
        dataField = obj.data as Record<string, unknown>;
      }

      if ('params' in obj && typeof obj.params === 'object' && obj.params !== null) {
        params = obj.params as Record<string, unknown>;
      } else if ('param' in obj && typeof obj.param === 'object' && obj.param !== null) {
        // Singular wrapper used by some device heartbeats (e.g. Smart Plug)
        params = obj.param as Record<string, unknown>;
      }

      if (!params && !dataField) {
        params = obj;
      }

      const searchData: Record<string, unknown> = dataField
        ? { ...(params || {}), ...dataField }
        : (params || obj);

      const sources: Record<string, unknown>[] = [searchData];
      if (dataField) sources.push(dataField);
      if (params) sources.push(params);
      sources.push(obj);

      const consWattRaw =
        (dataField?.consWatt as number | undefined) ??
        (params?.consWatt as number | undefined) ??
        (obj.consWatt as number | undefined);
      const wattsRaw =
        (dataField?.watts as number | undefined) ??
        (params?.watts as number | undefined) ??
        (obj.watts as number | undefined);

      // HW52… / Smart Plug: force plug mapping so bare MQTT `watts` (0.1 W) is used
      const forcePlug = isSmartPlugFamily(resolveDeviceFamily({ sn: deviceSn }));

      const mapped = mapQuotaData(sources, {
        consWatt: typeof consWattRaw === 'number' ? consWattRaw : undefined,
        watts: typeof wattsRaw === 'number' ? wattsRaw : undefined,
        forcePlug,
        sn: deviceSn,
      });
      const statusFields = toDeviceStatusFields(mapped);

      // Non-plug fragment after a plug heartbeat: keep last switch/watts
      if (
        !statusFields.isPlug &&
        previousStatus?.isPlug &&
        (typeof previousStatus.plugWatts === 'number' ||
          typeof previousStatus.switchSta === 'boolean')
      ) {
        logger.debug(
          `🔌 Preserving prior Smart Plug telemetry for ${deviceSn} (message lacked plug keys)`
        );
        return {
          ...previousStatus,
          timestamp: Date.now(),
        };
      }

      // Partial plug heartbeats often omit switchSta or watts — merge last known
      // values instead of inventing Off / 0 W (docs: only present keys are authoritative).
      let preservedPlugFields = false;
      if (statusFields.isPlug && previousStatus?.isPlug) {
        if (
          typeof statusFields.switchSta !== 'boolean' &&
          typeof previousStatus.switchSta === 'boolean'
        ) {
          statusFields.switchSta = previousStatus.switchSta;
          preservedPlugFields = true;
        }
        if (
          typeof statusFields.plugWatts !== 'number' &&
          typeof previousStatus.plugWatts === 'number'
        ) {
          statusFields.plugWatts = previousStatus.plugWatts;
          preservedPlugFields = true;
        }
        if (typeof statusFields.volt !== 'number' && typeof previousStatus.volt === 'number') {
          statusFields.volt = previousStatus.volt;
          preservedPlugFields = true;
        }
        if (typeof statusFields.temp !== 'number' && typeof previousStatus.temp === 'number') {
          statusFields.temp = previousStatus.temp;
          preservedPlugFields = true;
        }
        if (preservedPlugFields) {
          statusFields.status =
            statusFields.switchSta === true &&
            typeof statusFields.plugWatts === 'number' &&
            statusFields.plugWatts > 0
              ? 'discharging'
              : 'standby';
          logger.debug(
            `🔌 Merged prior Smart Plug fields for ${deviceSn} (partial quota)`
          );
        }
      }

      // Partial MQTT quota: watts without SOC → keep last known SOC
      const preservedSoc =
        !statusFields.isPlug &&
        !mapped.matched.soc &&
        previousStatus &&
        !previousStatus.isPlug &&
        typeof previousStatus.batteryLevel === 'number';
      if (preservedSoc) {
        statusFields.batteryLevel = previousStatus.batteryLevel;
      }

      const topKeys = Object.keys(searchData).slice(0, 40);
      const parseMeta = {
        batteryLevel: statusFields.batteryLevel,
        chargeRate: statusFields.chargeRate,
        dischargeRate: statusFields.dischargeRate,
        status: statusFields.status,
        isPlug: statusFields.isPlug,
        plugWatts: statusFields.plugWatts,
        switchSta: statusFields.switchSta,
        matched: mapped.matched,
        forcePlug,
        preservedSoc,
        preservedPlugFields,
        topKeys,
        hasDataField: !!dataField,
        hasParams: !!params,
      };

      // Warn when a real/partial plug heartbeat still lacks watts; otherwise debug.
      // Include FULL params key sample so nested/alias watt fields are visible in logs.
      if (forcePlug && typeof statusFields.plugWatts !== 'number') {
        const hasPartialPlug =
          typeof statusFields.switchSta === 'boolean' ||
          typeof statusFields.volt === 'number' ||
          typeof statusFields.temp === 'number' ||
          Boolean(
            mapped.matched.switchSta || mapped.matched.volt || mapped.matched.temp
          );
        const fullParamsSample = {
          searchDataKeys: Object.keys(searchData),
          searchData: searchData,
          paramsKeys: params ? Object.keys(params) : [],
          params: params,
          dataFieldKeys: dataField ? Object.keys(dataField) : [],
          dataField: dataField,
        };
        const line =
          `🔌 Smart Plug parse missing plugWatts for ${deviceSn}: ` +
          JSON.stringify({ ...parseMeta, fullParamsSample });
        if (hasPartialPlug) {
          logger.warn(line);
        } else {
          logger.debug(line);
        }
      } else {
        // Dev printf logger drops meta objects — embed payload in message string
        logger.debug(`🔍 Parsed values for ${deviceSn}: ` + JSON.stringify(parseMeta));
      }

      const hasData =
        (dataField && Object.keys(dataField).length > 0) ||
        (params && Object.keys(params).length > 0) ||
        Object.keys(obj).length > 0;

      if (!hasData) {
        return null;
      }

      // Spread raw params first; normalized plug/station fields win afterward.
      // Drop raw `watts` / ambiguous keys so UI never confuses 0.1 W raw with plugWatts.
      const rawParams = { ...(params || {}) } as Record<string, unknown>;
      if (statusFields.isPlug) {
        delete rawParams.watts;
        // Prefer normalized boolean; remove raw so number 0/1 cannot leak past omit
        if (typeof statusFields.switchSta === 'boolean') {
          delete rawParams.switchSta;
        }
      }
      const statusData = {
        deviceId: deviceSn,
        timestamp: Date.now(),
        ...rawParams,
        ...statusFields,
      };

      const parseResult = safeParseEcoflowDeviceStatus(statusData);
      if (parseResult.success) {
        return parseResult.data;
      }

      logger.warn(`⚠️  MQTT status validation failed for ${deviceSn}:`, {
        errors: parseResult.error.issues,
      });

      if (
        !statusFields.isPlug &&
        statusFields.batteryLevel === 0 &&
        statusFields.chargeRate === 0 &&
        statusFields.dischargeRate === 0
      ) {
        logger.warn(`⚠️  No battery/charge data found for ${deviceSn}. Full structure:`, {
          data: dataField,
          params: params,
          obj: obj,
        });
      }
      return statusData;
    } catch (error) {
      const err = error as Error;
      logger.error('Error parsing device status:', { error: err.message, stack: err.stack });
      return null;
    }
  }


  /**
   * Get device status via MQTT only
   * Primary solution: MQTT for real-time data
   * Uses cached data from automatic MQTT messages (no GET requests - devices don't respond)
   */
  async getDeviceStatus(deviceSn: string): Promise<DeviceStatusUpdate | null> {
    // Check cache first - data comes automatically via MQTT subscriptions
    const cached = this.statusCache.get(deviceSn);
    if (cached) {
      // Return cached data regardless of age (it's updated automatically via MQTT)
      const age = Math.round((Date.now() - cached.timestamp) / 1000);
      logger.debug(`📦 Returning cached MQTT data for ${deviceSn}`, { age: `${age}s` });
      return cached;
    }

    // No cached data available yet - wait for automatic MQTT messages
    // Ensure we're subscribed to receive updates
    if (this.isConnected && !this.fallbackToRest) {
      this.subscribeToDevice(deviceSn);
    }

    return null;
  }

  /**
   * Check if MQTT is connected
   */
  isMQTTConnected(): boolean {
    return this.isConnected && !this.fallbackToRest;
  }

  /** Timestamp of last successfully parsed MQTT device status (ms), or null */
  getLastSuccessAt(): number | null {
    return this.lastSuccessAt;
  }

  /** Cached status update for a device SN, if any. */
  getCachedStatus(sn: string): DeviceStatusUpdate | undefined {
    return this.statusCache.get(sn);
  }

  /** Serial numbers currently marked for MQTT subscription. */
  getSubscribedDevices(): string[] {
    return Array.from(this.subscribedDevices);
  }

  /** Iterate all cached status updates (history snapshot job). */
  forEachCachedStatus(cb: (update: DeviceStatusUpdate) => void): void {
    for (const update of this.statusCache.values()) {
      cb(update);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    usingMQTT: boolean;
    usingREST: boolean;
    subscribedDevices: string[];
  } {
    return {
      connected: this.isConnected,
      usingMQTT: this.isConnected && !this.fallbackToRest,
      usingREST: this.fallbackToRest || !this.isConnected,
      subscribedDevices: Array.from(this.subscribedDevices),
    };
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
    // Always clear state, even if client doesn't exist
    this.isConnected = false;
    this.subscribedDevices.clear();
    this.statusCache.clear();
  }
}

// Singleton instance
export const mqttService = new MQTTService();

