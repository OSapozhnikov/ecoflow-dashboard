/**
 * Rate limiting middleware
 *
 * Home-lab / Docker note: browser → Nginx → Express means Express often sees a
 * single Docker network IP. A tight global limit (100/15m) blocks the whole UI.
 * Defaults skip private/loopback IPs and use a higher ceiling when limiting.
 */

import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { RATE_LIMIT } from '../constants';
import { getConfig } from '../config/env';
import { rateLimitHitsTotal } from '../utils/metrics';

const config = getConfig();
const isDevelopment = config.nodeEnv === 'development';
const isTest = config.nodeEnv === 'test';

function isPrivateOrLoopbackIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/, '').toLowerCase();
  if (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost' ||
    normalized === '0:0:0:0:0:0:0:1'
  ) {
    return true;
  }
  // IPv4 private + link-local
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
  if (/^169\.254\./.test(normalized)) return true;
  // IPv6 ULA / link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80:')) return true;
  return false;
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '';
}

/**
 * Max requests per window. Env RATE_LIMIT_MAX overrides.
 */
const maxRequests =
  typeof config.rateLimit.max === 'number'
    ? config.rateLimit.max
    : isTest
      ? 10_000
      : RATE_LIMIT.MAX_REQUESTS;

const windowMs = config.rateLimit.windowMs ?? RATE_LIMIT.WINDOW_MS;

export const apiLimiter = rateLimit({
  windowMs,
  max: maxRequests,
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (isTest) return true;
    if (config.rateLimit.enabled === false) return true;

    const ip = clientIp(req);
    // Default for LAN / Docker Compose: do not throttle private networks
    if (config.rateLimit.skipPrivate !== false && isPrivateOrLoopbackIp(ip)) {
      return true;
    }
    if (isDevelopment && isPrivateOrLoopbackIp(ip)) {
      return true;
    }
    return false;
  },
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
