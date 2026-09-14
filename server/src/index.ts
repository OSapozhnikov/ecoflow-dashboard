/**
 * Application entry point
 */

import 'dotenv/config';
import { createApp } from './app';
import { getConfig } from './config/env';
import { websocketService } from './services/websocket';
import { mqttService } from './services/mqtt';
import { ensureDataDir } from './services/dataDir';
import { loadContracts } from './services/contractStore';
import { initHistoryDb, closeHistoryDb } from './services/historyDb';
import { startHistoryJobs, stopHistoryJobs } from './services/historyService';
import { startAlertService } from './services/alertService';
import { logger } from './utils/logger';
import { SERVER_CONFIG } from './constants';

// Validate environment variables
try {
  getConfig();
} catch (error) {
  logger.error('Configuration error:', error);
  process.exit(1);
}

const app = createApp();
const config = getConfig();

const PORT = config.port;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📡 Environment: ${config.nodeEnv}`);
  logger.info(`🌐 CORS origin: ${config.cors.origin}`);
  logger.info(`🔗 API Base URL: ${config.ecoflow.apiBaseUrl}`);
  logger.info(`📁 DATA_DIR: ${config.dataDir}`);

  try {
    ensureDataDir();
    loadContracts();
    initHistoryDb();
    startHistoryJobs();
    startAlertService();
  } catch (err) {
    logger.error('Failed to initialize data services:', err);
  }

  if (config.ecoflow.mqtt?.enabled) {
    logger.info(`🔌 MQTT: ${config.ecoflow.mqtt.brokerUrl}`);
  } else {
    logger.warn(`⚠️  MQTT: Disabled (using REST API only)`);
  }

  if (config.websocket?.enabled) {
    logger.info(`📡 WebSocket: Enabled on path ${config.websocket.path}`);
  }
});

// Initialize WebSocket server
websocketService.initialize(server);

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');

  stopHistoryJobs();
  closeHistoryDb();

  // Close WebSocket server
  websocketService.close();

  // Disconnect MQTT
  mqttService.disconnect();

  // Close HTTP server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, SERVER_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT);
};

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  shutdown();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  shutdown();
});
