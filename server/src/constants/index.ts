/**
 * Server-side constants
 */

import {
  API_CONFIG,
  RECONNECT_CONFIG,
  WEBSOCKET_CONFIG,
  MQTT_CONFIG,
  RATE_LIMIT,
  HEALTH_CHECK,
} from '@ecoflow/shared';

// Re-export shared constants
export {
  API_CONFIG,
  RECONNECT_CONFIG,
  WEBSOCKET_CONFIG,
  MQTT_CONFIG,
  RATE_LIMIT,
  HEALTH_CHECK,
};

/**
 * Server-specific constants
 */
export const SERVER_CONFIG = {
  DEFAULT_PORT: 5000,
  GRACEFUL_SHUTDOWN_TIMEOUT: 10_000, // 10 seconds
} as const;
