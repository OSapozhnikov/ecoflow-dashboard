/**
 * Client-side constants
 */

// Use relative path for better compatibility
import {
  REFETCH_INTERVALS,
  WEBSOCKET_CONFIG,
  BATTERY_CONFIG,
} from '../../shared/src/constants';

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
  DEFAULT_API_URL: 'http://localhost:5000',
  REQUEST_TIMEOUT: 10_000, // 10 seconds
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Maximum number of requests per window
  MAX_REQUESTS: 10,
  // Time window in milliseconds (1 minute)
  WINDOW_MS: 60_000,
  // Debounce delay for API calls (milliseconds)
  DEBOUNCE_DELAY: 300,
  // Throttle delay for API calls (milliseconds)
  THROTTLE_DELAY: 1000,
} as const;

