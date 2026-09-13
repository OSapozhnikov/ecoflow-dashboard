/**
 * Service Factory for Dependency Injection
 * Allows easier testing and dependency management
 */

import { getConfig } from '../config/env';
import { EcoflowService } from '../services/ecoflow';
import { MQTTService } from '../services/mqtt';
import { WebSocketService } from '../services/websocket';
import type { Config } from '../config/env';

/**
 * Service factory interface
 */
export interface ServiceFactory {
  createEcoflowService(): EcoflowService;
  createMQTTService(): MQTTService;
  createWebSocketService(): WebSocketService;
  getConfig(): Config;
}

/**
 * Default service factory implementation
 */
class DefaultServiceFactory implements ServiceFactory {
  private ecoflowService: EcoflowService | null = null;
  private mqttService: MQTTService | null = null;
  private websocketService: WebSocketService | null = null;

  createEcoflowService(): EcoflowService {
    if (!this.ecoflowService) {
      this.ecoflowService = new EcoflowService();
    }
    return this.ecoflowService;
  }

  createMQTTService(): MQTTService {
    if (!this.mqttService) {
      this.mqttService = new MQTTService();
    }
    return this.mqttService;
  }

  createWebSocketService(): WebSocketService {
    if (!this.websocketService) {
      this.websocketService = new WebSocketService();
    }
    return this.websocketService;
  }

  getConfig(): Config {
    return getConfig();
  }
}

// Export singleton factory instance
export const serviceFactory = new DefaultServiceFactory();

// Export factory class for testing
export { DefaultServiceFactory };

