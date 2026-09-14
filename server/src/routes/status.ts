/**
 * Device status routes
 * Primary solution: MQTT for real-time updates
 * Fallback to REST API if MQTT data not available
 * @swagger
 * tags:
 *   - name: Status
 *     description: Статус пристроїв
 */

import { Router, Request, Response } from 'express';
import { mqttService } from '../services/mqtt';
import { ecoflowService } from '../services/ecoflow';
import { restStatusCache } from '../services/restStatusCache';
import { evaluateStatus } from '../services/alertService';
import { recordSample } from '../services/historyService';
import { apiRequestDuration, apiRequestTotal, deviceStatusUpdatesTotal } from '../utils/metrics';

const router = Router();

/**
 * @swagger
 * /api/devices/{deviceId}/status:
 *   get:
 *     summary: Отримати статус пристрою
 *     tags: [Status]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID пристрою (serial number)
 *         example: ABC123456789
 *     responses:
 *       200:
 *         description: Статус пристрою успішно отримано
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceStatusResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *       429:
 *         $ref: '#/components/responses/RateLimitExceeded'
 */
router.get('/:deviceId/status', async (req: Request<{ deviceId: string }>, res: Response): Promise<void> => {
  const start = Date.now();
  const endpoint = '/api/devices/:deviceId/status';
  const { deviceId } = req.params;

  try {
    if (!deviceId) {
      const statusCode = '400';
      const duration = (Date.now() - start) / 1000;
      apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
      apiRequestTotal.inc({ endpoint, status_code: statusCode });

      res.status(400).json({
        error: {
          message: 'Device ID is required',
          code: 'MISSING_DEVICE_ID',
        },
      });
      return;
    }

    // Try MQTT first
    const mqttStatus = await mqttService.getDeviceStatus(deviceId);
    
    if (mqttStatus) {
      // Record metrics
      const duration = (Date.now() - start) / 1000;
      const statusCode = res.statusCode.toString();
      apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
      apiRequestTotal.inc({ endpoint, status_code: statusCode });
      deviceStatusUpdatesTotal.inc({ device_id: deviceId, source: 'mqtt' });

      try {
        evaluateStatus(
          deviceId,
          mqttStatus.status,
          mqttStatus.status.online as boolean | undefined
        );
      } catch {
        // Alerts must not fail the status response
      }

      // Return MQTT status
      res.json({
        deviceId,
        data: mqttStatus.status,
        source: mqttStatus.source,
        timestamp: mqttStatus.timestamp,
      });
      return;
    }

    // Fallback to REST API if MQTT data not available.
    // TTL + in-flight fan-in reuse recent successful quota/all for the same SN
    // so multiple DeviceCards do not each hammer Ecoflow when MQTT is down.
    try {
      const { response: restResponse, cacheHit } = await restStatusCache.getOrFetch(
        deviceId,
        () => ecoflowService.getDeviceStatus(deviceId)
      );

      // Subscribe to MQTT for future updates (if MQTT is enabled and connected)
      if (mqttService.isMQTTConnected()) {
        mqttService.subscribeToDevice(deviceId);
      }

      // Record metrics
      const duration = (Date.now() - start) / 1000;
      const statusCode = res.statusCode.toString();
      apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
      apiRequestTotal.inc({ endpoint, status_code: statusCode });
      deviceStatusUpdatesTotal.inc({
        device_id: deviceId,
        source: cacheHit ? 'rest-cache' : 'rest',
      });

      if (restResponse.data) {
        try {
          evaluateStatus(
            deviceId,
            restResponse.data,
            restResponse.data.online as boolean | undefined
          );
        } catch {
          // Alerts must not fail the status response
        }
        if (!cacheHit) {
          try {
            recordSample({
              deviceId,
              status: restResponse.data,
              source: 'rest',
            });
          } catch {
            // History must not fail the status response
          }
        }
      }

      res.json({
        ...restResponse,
        source: 'rest',
        timestamp: cacheHit
          ? (restResponse.data?.timestamp ?? Date.now())
          : Date.now(),
      });
    } catch (restError) {
      const err = restError as Error & { code?: string; name?: string };

      try {
        evaluateStatus(deviceId, null, false);
      } catch {
        // ignore
      }

      // Record error metrics — honest failure, no invented SOC
      const duration = (Date.now() - start) / 1000;
      const statusCode = '502';
      apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
      apiRequestTotal.inc({ endpoint, status_code: statusCode });

      // Prefer typed EcoflowAPIError message (e.g. clarified "signature is wrong")
      res.status(502).json({
        error: {
          message: err.message || 'Failed to fetch device status',
          code: 'STATUS_FETCH_ERROR',
          ...(err.name === 'EcoflowAPIError' && err.code
            ? { ecoflowCode: err.code }
            : {}),
        },
      });
    }
  } catch (error) {
    const err = error as Error;
    const duration = (Date.now() - start) / 1000;
    const statusCode = '500';
    apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
    apiRequestTotal.inc({ endpoint, status_code: statusCode });

    res.status(500).json({
      error: {
        message: err.message || 'Failed to fetch device status',
        code: 'STATUS_FETCH_ERROR',
      },
    });
  }
});

/**
 * @swagger
 * /api/devices/connection-status:
 *   get:
 *     summary: Отримати статус MQTT/REST з'єднання
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Статус з'єднання успішно отримано
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConnectionStatus'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/connection-status', (_req: Request, res: Response): void => {
  const status = mqttService.getConnectionStatus();
  res.json(status);
});

export default router;

