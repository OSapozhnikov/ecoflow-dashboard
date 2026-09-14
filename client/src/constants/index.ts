/**
 * Client-side constants
 */

import {
  REFETCH_INTERVALS,
  WEBSOCKET_CONFIG,
  BATTERY_CONFIG,
} from '@ecoflow/shared';

// Re-export shared constants
export {
  REFETCH_INTERVALS,
  WEBSOCKET_CONFIG,
  BATTERY_CONFIG,
};

/**
 * Client-specific constants
 */
export const CLIENT_CONFIG = {
  /** Empty = same-origin; override via VITE_API_BASE_URL */
  DEFAULT_API_URL: '',
  REQUEST_TIMEOUT: 10_000, // 10 seconds
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Maximum number of requests per window (client-side guard for Ecoflow-bound calls)
  MAX_REQUESTS: 30,
  // Time window in milliseconds (1 minute)
  WINDOW_MS: 60_000,
  // Debounce delay for API calls (milliseconds)
  DEBOUNCE_DELAY: 300,
  // Throttle delay for API calls (milliseconds)
  THROTTLE_DELAY: 1000,
} as const;
