/**
 * Locations JSON — GET/PUT /api/locations
 */

import { Router, Request, Response } from 'express';
import { readLocations, writeLocations, LocationsSchema } from '../services/dataFiles';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json(readLocations());
});

router.put('/', (req: Request, res: Response) => {
  try {
    const parsed = LocationsSchema.parse(req.body ?? { locations: [] });
    const saved = writeLocations(parsed);
    res.json(saved);
  } catch (err) {
    const error = err as Error;
    logger.warn('Invalid locations update', { error: error.message });
    res.status(400).json({
      error: { message: error.message, code: 'INVALID_LOCATIONS' },
    });
  }
});

export default router;
