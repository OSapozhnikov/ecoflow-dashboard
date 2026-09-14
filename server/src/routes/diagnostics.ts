/**
 * Device diagnostics — list membership, MQTT, family, last REST error
 */

import { Router, Request, Response } from 'express';
import { resolveDeviceFamily } from '@ecoflow/shared';
import { getConfig } from '../config/env';
import { ecoflowService } from '../services/ecoflow';
import { mqttService } from '../services/mqtt';
import { logger } from '../utils/logger';

const router = Router();

router.get(
  '/:deviceId/diagnostics',
  async (req: Request<{ deviceId: string }>, res: Response): Promise<void> => {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({
        error: { message: 'Device ID is required', code: 'MISSING_DEVICE_ID' },
      });
      return;
    }

    const config = getConfig();
    const conn = mqttService.getConnectionStatus();
    const cached = mqttService.getCachedStatus(deviceId);
    const lastErr = ecoflowService.getLastDeviceError(deviceId);

    let inDeviceList = false;
    let online: boolean | undefined;
    let productName: string | undefined;
    let deviceType: string | undefined;

    try {
      const list = await ecoflowService.getDevices();
      const device = list.devices.find(
        (d) => d.sn === deviceId || d.deviceId === deviceId || d.deviceSn === deviceId
      );
      if (device) {
        inDeviceList = true;
        online = device.online;
        productName = device.productName;
        deviceType = device.deviceType;
      }
    } catch (err) {
      logger.warn(`Diagnostics: failed to fetch device list for ${deviceId}`, {
        error: (err as Error).message,
      });
    }

    const family = resolveDeviceFamily({
      sn: deviceId,
      productName,
      deviceType,
    });

    res.json({
      deviceId,
      inDeviceList,
      online,
      productName,
      deviceType,
      family,
      mqtt: {
        enabled: Boolean(config.ecoflow.mqtt?.enabled),
        connected: conn.connected,
        subscribed: mqttService.getSubscribedDevices().includes(deviceId),
        lastMqttTimestamp: cached?.timestamp ?? null,
        hasCachedStatus: Boolean(cached),
      },
      status: {
        source: cached?.source,
        timestamp: cached?.timestamp,
        lastRestCode: lastErr?.code ?? null,
        lastError: lastErr?.message ?? null,
      },
    });
  }
);

export default router;
