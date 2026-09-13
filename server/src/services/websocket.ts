/**
 * WebSocket Service for real-time updates to frontend
 * Broadcasts device status updates from MQTT/REST to connected clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { mqttService, DeviceStatusUpdate } from './mqtt';
import { getConfig } from '../config/env';
import { logger } from '../utils/logger';
import {
  websocketConnectionsTotal,
  websocketConnectionsActive,
  websocketMessagesTotal,
  errorsTotal,
} from '../utils/metrics';

export interface WebSocketMessage {
  type: 'status' | 'connection' | 'error' | 'ping' | 'pong';
  data?: unknown;
  timestamp?: number;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private config = getConfig();

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    if (!this.config.websocket?.enabled) {
      logger.warn('⚠️  WebSocket is disabled.');
      return;
    }

    const path = this.config.websocket.path || '/ws';
    
    this.wss = new WebSocketServer({
      server,
      path,
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    // Listen to MQTT service events
    mqttService.on('status', (update: DeviceStatusUpdate) => {
      this.broadcastStatus(update);
    });

    mqttService.on('error', () => {
      this.broadcast({
        type: 'error',
        data: { message: 'MQTT connection error. Falling back to REST API.' },
        timestamp: Date.now(),
      });
    });

    mqttService.on('fallback', (reason: string) => {
      this.broadcast({
        type: 'connection',
        data: { 
          status: 'fallback',
          reason,
          message: 'MQTT unavailable. Using REST API fallback.' 
        },
        timestamp: Date.now(),
      });
    });

    logger.info(`✅ WebSocket server initialized on path: ${path}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    
    // Update metrics
    websocketConnectionsTotal.inc({ action: 'connect' });
    websocketConnectionsActive.set(this.clients.size);
    
    logger.info(`📡 New WebSocket client connected`, { totalClients: this.clients.size });

    // Send initial connection status
    const connectionStatus = mqttService.getConnectionStatus();
    this.send(ws, {
      type: 'connection',
      data: {
        status: connectionStatus.usingMQTT ? 'mqtt' : 'rest',
        ...connectionStatus,
      },
      timestamp: Date.now(),
    });

    // Handle ping/pong for keepalive
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString()) as WebSocketMessage;
        
        if (data.type === 'ping') {
          this.send(ws, {
            type: 'pong',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        // Ignore invalid messages
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      websocketConnectionsTotal.inc({ action: 'disconnect' });
      websocketConnectionsActive.set(this.clients.size);
      logger.info(`📡 WebSocket client disconnected`, { totalClients: this.clients.size });
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error('❌ WebSocket error:', { error: error.message });
      this.clients.delete(ws);
      websocketConnectionsActive.set(this.clients.size);
      errorsTotal.inc({ type: 'websocket_error', source: 'websocket' });
    });
  }

  /**
   * Broadcast status update to all connected clients
   */
  private broadcastStatus(update: DeviceStatusUpdate): void {
    this.broadcast({
      type: 'status',
      data: update,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    // Record metrics
    websocketMessagesTotal.inc({ type: message.type });
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          logger.error('❌ Error sending WebSocket message:', { error });
          this.clients.delete(client);
          websocketConnectionsActive.set(this.clients.size);
        }
      }
    });
  }

  /**
   * Send message to specific client
   */
  private send(client: WebSocket, message: WebSocketMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        logger.error('❌ Error sending WebSocket message:', { error });
      }
    }
  }

  /**
   * Get connected clients count
   */
  getClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.wss) {
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}

// Export class for factory pattern
export { WebSocketService };

// Singleton instance (for backward compatibility)
export const websocketService = new WebSocketService();

