/**
 * Global error handler utilities
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { errorsTotal } from './metrics';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  code: string,
  _statusCode: number = 500,
  details?: unknown
): { error: { message: string; code: string; details?: unknown } } {
  const errorResponse: { error: { message: string; code: string; details?: unknown } } = {
    error: {
      message,
      code,
    },
  };

  if (details) {
    errorResponse.error.details = details;
  }

  return errorResponse;
}

/**
 * Global error handler middleware
 */
export function globalErrorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  // Log error with context
  const logContext = {
    message: err.message,
    statusCode,
    code,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  if (statusCode >= 500) {
    logger.error('Server error:', logContext);
  } else {
    logger.warn('Client error:', logContext);
  }

  // Record error metrics
  errorsTotal.inc({
    type: code,
    source: 'api',
  });

  // Send error response
  res.status(statusCode).json(createErrorResponse(message, code));
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create operational error (expected errors)
 */
export class OperationalError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400, code: string = 'OPERATIONAL_ERROR') {
    super(message);
    this.name = 'OperationalError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create validation error
 */
export class ValidationError extends OperationalError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    if (details) {
      (this as unknown as { details: unknown }).details = details;
    }
  }
}

/**
 * Create not found error
 */
export class NotFoundError extends OperationalError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

