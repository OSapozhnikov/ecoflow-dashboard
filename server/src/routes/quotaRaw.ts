/**
 * Lab: raw Ecoflow quota/all + last MQTT quota payload
 */

import { Router, Request, Response } from 'express';
import {
  mapQuotaData,
  toDeviceStatusFields,
  resolveDeviceFamily,
  isSmartPlugFamily,
} from '@ecoflow/shared';
import { ecoflowService } from '../services/ecoflow';
import { mqttService } from '../services/mqtt';
import { logger } from '../utils/logger';

const router = Router();

router.get(
  '/:deviceId/quota/raw',
  async (req: Request<{ deviceId: string }>, res: Response): Promise<void> => {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({
        error: { message: 'Device ID is required', code: 'MISSING_DEVICE_ID' },
      });
      return;
    }

    try {
      const rest = await ecoflowService.getRawQuotaAll(deviceId);
      const mqttRaw = mqttService.getLastRawQuota(deviceId);

      let matched: Record<string, string | undefined> | undefined;
      let normalized: ReturnType<typeof toDeviceStatusFields> | undefined;

      if (rest.ok && rest.data && typeof rest.data === 'object' && !Array.isArray(rest.data)) {
        const forcePlug = isSmartPlugFamily(resolveDeviceFamily({ sn: deviceId }));
        const mapped = mapQuotaData(rest.data as Record<string, unknown>, {
          forcePlug,
          sn: deviceId,
        });
        matched = mapped.matched;
        normalized = toDeviceStatusFields(mapped);
      }

      res.json({
        deviceId,
        fetchedAt: Date.now(),
        rest: {
          ok: rest.ok,
          code: rest.code,
          message: rest.message,
          data: rest.data,
          raw: rest.raw,
        },
        mqtt: mqttRaw
          ? {
              timestamp: mqttRaw.timestamp,
              topic: mqttRaw.topic,
              /** Single last MQTT message (often only a few power fields). */
              last: mqttRaw.payload,
              /**
               * Deep-merged fields from all quota/get_reply messages since server start.
               * Prefer this when REST quota/all fails (e.g. 8521) and MQTT is partial.
               */
              merged: mqttRaw.merged,
              messageCount: mqttRaw.messageCount,
            }
          : null,
        ...(matched ? { matched } : {}),
        ...(normalized ? { normalized } : {}),
      });
    } catch (err) {
      const error = err as Error;
      logger.warn(`quota/raw failed for ${deviceId}: ${error.message}`);
      res.status(502).json({
        error: {
          message: error.message || 'Failed to fetch raw quota',
          code: 'QUOTA_RAW_FETCH_ERROR',
        },
      });
    }
  }
);

export default router;
