/**
 * Metrics middleware for Express
 */

import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../utils/metrics';

/**
 * Middleware to collect HTTP request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const route = req.route?.path || req.path || 'unknown';

  // Override res.end to capture response time and status
  const originalEnd = res.end.bind(res);
  
  // Type-safe override of res.end
  res.end = function (
    chunk?: unknown,
    encodingOrCb?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: statusCode,
      },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: statusCode,
    });

    // Call original end with proper arguments
    if (typeof encodingOrCb === 'function') {
      // res.end(chunk, cb)
      return originalEnd(chunk, encodingOrCb);
    } else if (encodingOrCb && cb) {
      // res.end(chunk, encoding, cb)
      return originalEnd(chunk, encodingOrCb, cb);
    } else if (chunk !== undefined) {
      // res.end(chunk)
      return originalEnd(chunk, encodingOrCb as BufferEncoding);
    } else {
      // res.end()
      return originalEnd();
    }
  } as typeof res.end;

  next();
}

