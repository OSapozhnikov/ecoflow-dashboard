/**
 * Device routes
 * @swagger
 * tags:
 *   - name: Devices
 *     description: Операції з пристроями
 */

import { Router, Request, Response } from 'express';
import { ecoflowService } from '../services/ecoflow';
import { mqttService } from '../services/mqtt';
import { readSettings, writeSettings } from '../services/dataFiles';
import { logger } from '../utils/logger';
import { apiRequestDuration, apiRequestTotal } from '../utils/metrics';

const router = Router();

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Отримати список всіх пристроїв
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: Список пристроїв успішно отримано
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceListResponse'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 */
router.get('/', async (_req: Request, res: Response) => {
  const start = Date.now();
  const endpoint = '/api/devices';

  try {
    const response = await ecoflowService.getDevices();

    logger.debug('Devices API Response:', { deviceCount: response.devices.length });

    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode.toString();

    apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
    apiRequestTotal.inc({ endpoint, status_code: statusCode });

    res.json(response);
  } catch (error) {
    const err = error as Error;

    logger.error('Error fetching devices:', { error: err.message, stack: err.stack });

    const duration = (Date.now() - start) / 1000;
    const statusCode = '500';

    apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
    apiRequestTotal.inc({ endpoint, status_code: statusCode });

    res.status(500).json({
      error: {
        message: err.message || 'Failed to fetch devices',
        code: 'DEVICE_FETCH_ERROR',
      },
    });
  }
});

/**
 * Pause or resume monitoring for a device (MQTT/REST/history/alerts).
 */
router.put(
  '/:deviceId/monitoring',
  (req: Request<{ deviceId: string }>, res: Response): void => {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({
        error: { message: 'Device ID is required', code: 'MISSING_DEVICE_ID' },
      });
      return;
    }

    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        error: {
          message: 'Body must include enabled: boolean',
          code: 'INVALID_BODY',
        },
      });
      return;
    }

    const current = readSettings();
    const set = new Set(current.disabledDeviceIds);
    if (enabled) {
      set.delete(deviceId);
    } else {
      set.add(deviceId);
    }
    writeSettings({ disabledDeviceIds: [...set] });

    if (enabled) {
      mqttService.subscribeToDevice(deviceId);
    } else {
      mqttService.unsubscribeFromDevice(deviceId);
      mqttService.clearCachedStatus(deviceId);
    }

    logger.info(
      enabled
        ? `▶️  Monitoring resumed for ${deviceId}`
        : `⏸️  Monitoring paused for ${deviceId}`
    );

    res.json({ deviceId, enabled });
  }
);

export default router;
