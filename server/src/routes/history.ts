/**
 * Device history routes
 */

import { Router, Request, Response } from 'express';
import { getHistory, getMonthlyHistory } from '../services/historyService';

const router = Router();

router.get(
  '/:deviceId/history/monthly',
  (req: Request<{ deviceId: string }>, res: Response): void => {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({
        error: { message: 'Device ID is required', code: 'MISSING_DEVICE_ID' },
      });
      return;
    }

    const months = getMonthlyHistory(deviceId).map((row) => ({
      month: row.month,
      avg_soc: row.avg_soc,
      energy_in_wh: row.energy_in_wh,
      energy_out_wh: row.energy_out_wh,
    }));
    res.json({ deviceId, months });
  }
);

router.get(
  '/:deviceId/history',
  (req: Request<{ deviceId: string }>, res: Response): void => {
    const { deviceId } = req.params;
    if (!deviceId) {
      res.status(400).json({
        error: { message: 'Device ID is required', code: 'MISSING_DEVICE_ID' },
      });
      return;
    }

    const now = Date.now();
    const from = Number(req.query.from) || now - 30 * 24 * 60 * 60 * 1000;
    const to = Number(req.query.to) || now;

    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      res.status(400).json({
        error: { message: 'Invalid from/to range', code: 'INVALID_RANGE' },
      });
      return;
    }

    const samples = getHistory(deviceId, from, to);
    res.json({ deviceId, from, to, samples });
  }
);

export default router;
