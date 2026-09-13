/**
 * Shared constants for Ecoflow Delta 3 Monitor
 */

/**
 * API Configuration
 */
export const API_CONFIG = {
  TIMEOUT: 15_000, // 15 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1_000, // 1 second
} as const;

/**
 * Refetch Intervals (in milliseconds)
 */
export const REFETCH_INTERVALS = {
  DEVICES: 10_000, // 10 seconds
  DEVICE_STATUS: 5_000, // 5 seconds
  DEVICE_STATUS_WS: 10_000, // 10 seconds when WebSocket connected
} as const;

/**
 * Reconnection Configuration
 */
export const RECONNECT_CONFIG = {
  MQTT: {
    DELAY: 5_000, // 5 seconds
    MAX_ATTEMPTS: 5,
  },
  WEBSOCKET: {
    DELAY: 5_000, // 5 seconds
    MAX_ATTEMPTS: 5,
  },
} as const;

/**
 * WebSocket Configuration
 */
export const WEBSOCKET_CONFIG = {
  PING_INTERVAL: 30_000, // 30 seconds
  RECONNECT_DELAY: 5_000, // 5 seconds
} as const;

/**
 * MQTT Configuration
 */
export const MQTT_CONFIG = {
  KEEPALIVE: 60, // seconds
  CONNECT_TIMEOUT: 10_000, // 10 seconds
  CERTIFICATION_CACHE_HOURS: 23, // Cache certification for 23 hours
} as const;

/**
 * Battery Configuration
 */
export const BATTERY_CONFIG = {
  MIN_LEVEL: 0,
  MAX_LEVEL: 100,
  LOW_BATTERY_THRESHOLD: 20, // Alert when battery < 20%
} as const;

/**
 * Rate Limiting
 */
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100, // 100 requests per window
} as const;

/**
 * Health Check
 */
export const HEALTH_CHECK = {
  INTERVAL: 30_000, // 30 seconds
  TIMEOUT: 3_000, // 3 seconds
  START_PERIOD: 5_000, // 5 seconds
} as const;

