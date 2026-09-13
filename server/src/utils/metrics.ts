/**
 * Prometheus metrics for monitoring
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// HTTP Request Metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// API Metrics
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['endpoint', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const apiRequestTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['endpoint', 'status_code'],
  registers: [register],
});

// MQTT Metrics
export const mqttMessagesTotal = new Counter({
  name: 'mqtt_messages_total',
  help: 'Total number of MQTT messages received',
  labelNames: ['topic', 'status'],
  registers: [register],
});

export const mqttConnectionStatus = new Gauge({
  name: 'mqtt_connection_status',
  help: 'MQTT connection status (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const mqttMessageProcessingDuration = new Histogram({
  name: 'mqtt_message_processing_duration_seconds',
  help: 'Duration of MQTT message processing in seconds',
  labelNames: ['topic'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// WebSocket Metrics
export const websocketConnectionsTotal = new Counter({
  name: 'websocket_connections_total',
  help: 'Total number of WebSocket connections',
  labelNames: ['action'], // 'connect' or 'disconnect'
  registers: [register],
});

export const websocketConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const websocketMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages sent',
  labelNames: ['type'],
  registers: [register],
});

// Device Status Metrics
export const deviceStatusUpdatesTotal = new Counter({
  name: 'device_status_updates_total',
  help: 'Total number of device status updates',
  labelNames: ['device_id', 'source'], // 'mqtt' or 'rest'
  registers: [register],
});

export const deviceStatusCacheSize = new Gauge({
  name: 'device_status_cache_size',
  help: 'Number of devices in status cache',
  registers: [register],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'source'], // 'api', 'mqtt', 'websocket', etc.
  registers: [register],
});

// Rate Limiting Metrics
export const rateLimitHitsTotal = new Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint'],
  registers: [register],
});

