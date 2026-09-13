/**
 * MQTT Service for Ecoflow devices
 * Primary solution: Real-time device status updates via MQTT
 */

import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { EventEmitter } from 'events';
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

export interface DeviceStatusUpdate {
  deviceSn: string;
  status: EcoflowDeviceStatus;
  timestamp: number;
  source: 'mqtt' | 'rest';
}

/**
 * MQTT Service - Primary solution for device status
 */
class MQTTService extends EventEmitter {
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

      if (!deviceSn) {
        logger.warn('⚠️  Could not extract device SN from topic:', { topic });
        mqttMessagesTotal.inc({ topic, status: 'missing_device_sn' });
        return;
      }


      // Parse device status from MQTT message
      const status = this.parseDeviceStatus(data, deviceSn);
      
      if (status) {
        const update: DeviceStatusUpdate = {
          deviceSn,
          status,
          timestamp: Date.now(),
          source: 'mqtt',
        };

        // Cache the status
        this.statusCache.set(deviceSn, update);
        
        // Update cache size metric
        deviceStatusCacheSize.set(this.statusCache.size);

        // Record successful message processing
        const duration = (Date.now() - start) / 1000;
        mqttMessageProcessingDuration.observe({ topic }, duration);
        mqttMessagesTotal.inc({ topic, status: 'success' });

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
   * Parse device status from MQTT message
   * According to official documentation, MQTT messages contain params object
   * Structure: { id, version, operateType, from, params: { ... } }
   * Also handles different message formats from Ecoflow devices
   */
  private parseDeviceStatus(data: unknown, deviceSn: string): EcoflowDeviceStatus | null {
    try {
      if (typeof data !== 'object' || data === null) {
        return null;
      }

      const obj = data as Record<string, unknown>;

      // According to documentation, MQTT messages have structure:
      // Request: { id, version, operateType, from, params: { ... } }
      // Reply: { id, version, operateType, code, message, data: { ... } }
      // But some devices send: { cmdId, cmdFunc, addr, params: { ... } }
      let params: Record<string, unknown> | null = null;
      let dataField: Record<string, unknown> | null = null;

      // Check for 'data' field first (reply messages)
      if ('data' in obj && typeof obj.data === 'object' && obj.data !== null) {
        dataField = obj.data as Record<string, unknown>;
      }

      // Check for 'params' field (request/report messages)
      if ('params' in obj && typeof obj.params === 'object' && obj.params !== null) {
        params = obj.params as Record<string, unknown>;
      }

      // If neither params nor data, try to use obj directly
      if (!params && !dataField) {
        params = obj;
      }

      // Combine params and data for searching (data takes priority in replies)
      const searchData: Record<string, unknown> = dataField 
        ? { ...params, ...dataField } // Merge params and data, data overrides
        : (params || obj);

      // Deep search for battery and power data in nested structures
      // Also handles dot notation like "pcsAPhase.actPwr"
      const deepSearch = (obj: Record<string, unknown>, keys: string[]): number | null => {
        for (const key of keys) {
          // Direct access
          if (key in obj && typeof obj[key] === 'number') {
            return obj[key] as number;
          }
          
          // Handle dot notation (e.g., "pcsAPhase.actPwr")
          if (key.includes('.')) {
            const parts = key.split('.');
            let current: unknown = obj;
            for (const part of parts) {
              if (typeof current === 'object' && current !== null && part in current) {
                current = (current as Record<string, unknown>)[part];
              } else {
                current = null;
                break;
              }
            }
            if (typeof current === 'number') {
              return current;
            }
          }
          
          // Search in nested objects
          for (const [, v] of Object.entries(obj)) {
            if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
              const nested = deepSearch(v as Record<string, unknown>, keys);
              if (nested !== null) return nested;
            }
          }
        }
        return null;
      };

      // Extract battery level (SOC - State of Charge)
      // Based on hassio-ecoflow-cloud: Power Battery SOC, bpSoc
      // Try multiple possible field names and locations using deep search
      // Also check for nested structures and different naming conventions
      const socKeys = [
        'soc', 'batteryLevel', 'battery', 'batteryPercent', 'socLevel', 
        'remainCap', 'remainingCapacity', 'cap', 'capacity',
        'bpSoc', // Power Ocean format
        'powerBatterySoc', 'powerBatterySOC', // Home Assistant format
        'batterySoc', 'batterySOC', // Alternative formats
        'socPercent', 'batteryPercent', // Percent formats
      ];
      
      // Try deep search first (handles nested structures and dot notation)
      // Search in: data field (replies), params field, and obj directly
      let batteryLevel = 
        deepSearch(searchData, socKeys) || 
        deepSearch(dataField || {}, socKeys) ||
        deepSearch(params || {}, socKeys) || 
        deepSearch(obj, socKeys);
      
      // If deep search didn't find it, try direct access
      // Priority: data field (replies) > params > obj
      if (batteryLevel === null || batteryLevel === undefined) {
        batteryLevel = 
          (dataField?.soc as number) ||
          (dataField?.bpSoc as number) || // Power Ocean
          (dataField?.batteryLevel as number) ||
          (dataField?.battery as number) ||
          (dataField?.batteryPercent as number) ||
          (dataField?.batterySoc as number) ||
          (dataField?.batterySOC as number) ||
          (params?.soc as number) || 
          (params?.bpSoc as number) || // Power Ocean
          (params?.batteryLevel as number) || 
          (params?.battery as number) || 
          (params?.batteryPercent as number) ||
          (params?.socLevel as number) ||
          (params?.remainCap as number) ||
          (params?.batterySoc as number) ||
          (params?.batterySOC as number) ||
          (obj.soc as number) ||
          (obj.bpSoc as number) ||
          (obj.batteryLevel as number) ||
          (obj.battery as number) ||
          (obj.batteryPercent as number) ||
          (obj.batterySoc as number) ||
          (obj.batterySOC as number) ||
          0;
      }
      
      // Ensure batteryLevel is a number
      batteryLevel = typeof batteryLevel === 'number' ? batteryLevel : 0;

      // Extract charge/discharge rates (in watts)
      // Based on real MQTT messages: consWatt (negative = discharge, positive = charge), watts (output power)
      // Also try multiple possible field names using deep search
      const chargeKeys = [
        'chargePower', 'chargeRate', 'inputPower', 'inWatts', 'inPutWatts', 
        'pvInputPower', 'acInputPower', 'inputWatts', 'inPower', 'chargeWatts',
        'inPwr', 'inPwrWatts', // Alternative formats
        'pcsAPhase.actPwr', 'pcsBPhase.actPwr', 'pcsCPhase.actPwr', // Power Ocean phases
        'mpptPv1.pwr', 'mpptPv2.pwr', // Solar input
        'powerBattery', // Battery power (can be charge or discharge)
      ];
      
      // consWatt: negative = discharge, positive = charge
      // If consWatt is positive, it means charging
      // Check in data field (replies), params, and obj
      const consWatt = 
        (dataField?.consWatt as number) ||
        (params?.consWatt as number) || 
        (obj.consWatt as number) || 
        0;
      
      const chargeRate = 
        (consWatt > 0 ? consWatt : 0) || // If consWatt is positive, it's charge rate
        deepSearch(searchData, chargeKeys) ||
        deepSearch(dataField || {}, chargeKeys) ||
        deepSearch(params || {}, chargeKeys) ||
        deepSearch(obj, chargeKeys) ||
        (dataField?.chargePower as number) ||
        (dataField?.inputPower as number) ||
        (dataField?.inPower as number) ||
        (params?.chargePower as number) || 
        (params?.chargeRate as number) || 
        (params?.inputPower as number) ||
        (params?.inPower as number) || // Home Assistant format
        (params?.inWatts as number) ||
        (params?.inPutWatts as number) ||
        (params?.pvInputPower as number) ||
        (params?.acInputPower as number) ||
        (obj.chargePower as number) ||
        (obj.inputPower as number) ||
        (obj.inPower as number) ||
        0;

      const dischargeKeys = [
        'dischargePower', 'dischargeRate', 'outputPower', 'outWatts', 
        'outPutWatts', 'acOutputPower', 'outputWatts', 'outPower', 'dischargeWatts',
        'outPwr', 'outPwrWatts', // Alternative formats
        'powerAC', 'powerACSYS', // AC output power
      ];
      
      // consWatt: negative = discharge, watts = output power
      // If consWatt is negative, use abs(consWatt) as discharge rate
      // Also try watts field (output power)
      // Check in data field (replies), params, and obj
      const watts = 
        (dataField?.watts as number) ||
        (params?.watts as number) || 
        (obj.watts as number) || 
        0;
      
      const dischargeRateRaw = 
        (consWatt < 0 ? Math.abs(consWatt) : 0) || // If consWatt is negative, it's discharge rate
        watts || // watts is output power (discharge)
        deepSearch(searchData, dischargeKeys) ||
        deepSearch(dataField || {}, dischargeKeys) ||
        deepSearch(params || {}, dischargeKeys) ||
        deepSearch(obj, dischargeKeys) ||
        (dataField?.dischargePower as number) ||
        (dataField?.outputPower as number) ||
        (dataField?.outPower as number) ||
        (params?.dischargePower as number) || 
        (params?.dischargeRate as number) || 
        (params?.outputPower as number) ||
        (params?.outPower as number) || // Home Assistant format
        (params?.outWatts as number) ||
        (params?.outPutWatts as number) ||
        (params?.acOutputPower as number) ||
        (obj.dischargePower as number) ||
        (obj.outputPower as number) ||
        (obj.outPower as number) ||
        0;
      
      // Discharge rate needs to be divided by 10 (convert from 0.1W units to W)
      const dischargeRate = typeof dischargeRateRaw === 'number' ? dischargeRateRaw / 10 : 0;

      // Determine status based on charge/discharge rates
      // consWatt: negative = discharging, positive = charging, zero = standby
      let status: 'charging' | 'discharging' | 'standby' = 'standby';
      if (consWatt > 0 || chargeRate > 0) {
        status = 'charging';
      } else if (consWatt < 0 || dischargeRate > 0) {
        status = 'discharging';
      }

      // Log parsed values for debugging MQTT data
      logger.debug(`🔍 Parsed values for ${deviceSn}:`, {
        batteryLevel,
        chargeRate,
        dischargeRate,
        status,
        hasDataField: !!dataField,
        hasParams: !!params,
        dataKeys: dataField ? Object.keys(dataField) : [],
        paramsKeys: params ? Object.keys(params) : [],
        objKeys: Object.keys(obj),
      });

      // Always return status if we have any data, even if batteryLevel is 0
      // This allows us to show partial data while waiting for complete information
      const hasData = (dataField && Object.keys(dataField).length > 0) || 
                     (params && Object.keys(params).length > 0) || 
                     Object.keys(obj).length > 0;
      
      if (hasData) {
        // Create status object
        const statusData = {
          deviceId: deviceSn,
          batteryLevel: Math.max(0, Math.min(100, batteryLevel)), // Clamp to 0-100
          chargeRate: Math.max(0, chargeRate),
          dischargeRate: Math.max(0, Math.round(dischargeRate * 10) / 10), // Round to 1 decimal place
          status,
          timestamp: Date.now(),
          // Include all raw params for debugging and future use
          ...params,
        };

        // Validate with zod schema
        const parseResult = safeParseEcoflowDeviceStatus(statusData);
        if (parseResult.success) {
          return parseResult.data;
        } else {
          // Log validation errors but still return data (with warning)
          logger.warn(`⚠️  MQTT status validation failed for ${deviceSn}:`, {
            errors: parseResult.error.issues,
          });
          // Return unvalidated data but log warning
          if (batteryLevel === 0 && chargeRate === 0 && dischargeRate === 0) {
            logger.warn(`⚠️  No battery/charge data found for ${deviceSn}. Full structure:`, {
              data: dataField,
              params: params,
              obj: obj,
              dataKeys: dataField ? Object.keys(dataField) : [],
              paramsKeys: params ? Object.keys(params) : [],
              objKeys: Object.keys(obj),
            });
          }
          return statusData;
        }
      }

      return null;
    } catch (error) {
      const err = error as Error;
      logger.error('Error parsing device status:', { error: err.message, stack: err.stack });
      // Don't throw error here, just return null to allow fallback to REST
      // But log it for debugging
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

