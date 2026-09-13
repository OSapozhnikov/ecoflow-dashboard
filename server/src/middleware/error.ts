/**
 * Error handling middleware
 * Uses global error handler from utils/errorHandler
 */

import { Request, Response, NextFunction } from 'express';
import { globalErrorHandler, AppError } from '../utils/errorHandler';

// Re-export for backward compatibility
export type { AppError };

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  globalErrorHandler(err, req, res, next);
}

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  res.status(404).json({
    error: {
      message: `Route ${req.originalUrl} not found`,
      code: 'NOT_FOUND',
    },
  });
}

