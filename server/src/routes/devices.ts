/**
 * Device routes
 * @swagger
 * tags:
 *   - name: Devices
 *     description: Операції з пристроями
 */

import { Router, Request, Response } from 'express';
import { ecoflowService } from '../services/ecoflow';
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

    // Record metrics
    apiRequestDuration.observe({ endpoint, status_code: statusCode }, duration);
    apiRequestTotal.inc({ endpoint, status_code: statusCode });
    
    res.json(response);
  } catch (error) {
    const err = error as Error;
    
    logger.error('Error fetching devices:', { error: err.message, stack: err.stack });
    
    const duration = (Date.now() - start) / 1000;
    const statusCode = '500';

    // Record error metrics
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

export default router;

