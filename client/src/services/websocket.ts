/**
 * WebSocket Client for real-time updates from backend
 * Falls back to polling if WebSocket is unavailable
 */

import { WEBSOCKET_CONFIG } from '../constants';
import { errorReporter } from '../utils/errorReporting';

export interface WebSocketMessage {
  type: 'status' | 'connection' | 'error' | 'ping' | 'pong';
  data?: unknown;
  timestamp?: number;
}

export interface DeviceStatusUpdate {
  deviceSn: string;
  status: {
    deviceId: string;
    batteryLevel: number;
    chargeRate?: number;
    dischargeRate?: number;
    status: 'charging' | 'discharging' | 'standby';
    timestamp: number;
  };
  timestamp: number;
  source: 'mqtt' | 'rest';
}

type MessageHandler = (message: WebSocketMessage) => void;
type StatusHandler = (update: DeviceStatusUpdate) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = WEBSOCKET_CONFIG.RECONNECT_DELAY;
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private isConnecting = false;
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private usingMQTT = false;

  constructor() {
    // Auto-connect on instantiation
    this.connect();
  }

  /**
   * Get WebSocket URL
   */
  private getWebSocketUrl(): string {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    
    // Convert HTTP to WebSocket protocol
    const wsUrl = apiBaseUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');
    
    return `${wsUrl}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.connectionStatus = 'connecting';

    try {
      const url = this.getWebSocketUrl();
      
      if (import.meta.env.DEV) {
        console.log('🔌 Connecting to WebSocket:', url);
      }

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        
        if (import.meta.env.DEV) {
          console.log('✅ WebSocket connected');
        }

        // Start ping interval (keepalive)
        this.startPingInterval();

        // Notify handlers
        this.notifyHandlers({
          type: 'connection',
          data: { status: 'connected' },
          timestamp: Date.now(),
        });
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          // Handle pong
          if (message.type === 'pong') {
            return;
          }

          // Handle status updates
          if (message.type === 'status' && message.data) {
            const update = message.data as DeviceStatusUpdate;
            this.statusHandlers.forEach((handler) => handler(update));
          }

          // Handle connection status updates
          if (message.type === 'connection' && message.data) {
            const data = message.data as { status?: string; usingMQTT?: boolean };
            if (data.usingMQTT !== undefined) {
              this.usingMQTT = data.usingMQTT;
            }
          }

          // Notify all message handlers
          this.notifyHandlers(message);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          // Report error to error reporting service
          errorReporter.reportError(err, {
            component: 'WebSocketClient',
            action: 'parse_message',
          });
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error: Event) => {
        this.isConnecting = false;
        
        // Report error to error reporting service
        errorReporter.reportError(
          new Error('WebSocket connection error'),
          {
            component: 'WebSocketClient',
            action: 'connection_error',
            errorType: error.type,
          }
        );
        
        console.error('❌ WebSocket error:', error);
        
        this.notifyHandlers({
          type: 'error',
          data: { message: 'WebSocket connection error' },
          timestamp: Date.now(),
        });
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.connectionStatus = 'disconnected';
        this.stopPingInterval();
        
        if (import.meta.env.DEV) {
          console.log('🔌 WebSocket disconnected');
        }

        // Attempt to reconnect
        this.scheduleReconnect();
      };

    } catch (error) {
      this.isConnecting = false;
      console.error('❌ Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (import.meta.env.DEV) {
        console.log('⚠️  Max reconnection attempts reached. WebSocket unavailable.');
      }
      return;
    }

    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (import.meta.env.DEV) {
        console.log(`🔄 Reconnecting WebSocket... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      }
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Start ping interval for keepalive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: Date.now(),
        });
      }
    }, WEBSOCKET_CONFIG.PING_INTERVAL);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️  WebSocket not connected. Cannot send message.');
    }
  }

  /**
   * Subscribe to all messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to status updates
   */
  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  /**
   * Notify all handlers
   */
  private notifyHandlers(message: WebSocketMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('❌ Error in message handler:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    usingMQTT: boolean;
    status: 'connected' | 'disconnected' | 'connecting';
  } {
    return {
      connected: this.connectionStatus === 'connected',
      usingMQTT: this.usingMQTT,
      status: this.connectionStatus,
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Stop ping interval
    this.stopPingInterval();
    
    // Close WebSocket connection
    if (this.ws) {
      // Remove all event listeners before closing
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      
      // Close connection
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    
    // Clear all handlers
    this.messageHandlers.clear();
    this.statusHandlers.clear();
    this.connectionStatus = 'disconnected';
    this.isConnecting = false;
  }
}

// Singleton instance
export const websocketClient = new WebSocketClient();

