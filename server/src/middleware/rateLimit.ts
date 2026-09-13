/**
 * Rate limiting middleware
 */

import rateLimit from 'express-rate-limit';
import { RATE_LIMIT } from '../constants';
import { getConfig } from '../config/env';
import { rateLimitHitsTotal } from '../utils/metrics';

const config = getConfig();

// More lenient rate limiting for development
const isDevelopment = config.nodeEnv === 'development';

export const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: isDevelopment ? RATE_LIMIT.MAX_REQUESTS * 10 : RATE_LIMIT.MAX_REQUESTS, // 1000 requests in dev, 100 in production
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for localhost in development
  skip: (req) => {
    if (isDevelopment) {
      const ip = req.ip || req.socket.remoteAddress || '';
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('::ffff:127.0.0.1');
    }
    return false;
  },
  // Handler for rate limit exceeded
  handler: (req, res) => {
    const endpoint = req.route?.path || req.path || 'unknown';
    rateLimitHitsTotal.inc({ endpoint });
    res.status(429).json({
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    });
  },
});

