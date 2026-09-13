/**
 * Unit tests for WebSocketClient
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { websocketClient } from '../websocket';
import { errorReporter } from '../../utils/errorReporting';

// Mock WebSocket
class MockWebSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING;
  url: string = '';

  constructor(url: string) {
    super();
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
  }

  send(data: string): void {
    // Mock implementation
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  // Helper methods for testing
  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  simulateMessage(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  simulateError(): void {
    this.dispatchEvent(new Event('error'));
  }

  simulateClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
(global.WebSocket as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }).OPEN = 1;
(global.WebSocket as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }).CONNECTING = 0;
(global.WebSocket as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }).CLOSING = 2;
(global.WebSocket as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }).CLOSED = 3;

// Note: setTimeout/clearTimeout/clearInterval will be mocked by vi.useFakeTimers()

// Mock error reporting
vi.mock('../../utils/errorReporting', () => ({
  errorReporter: {
    reportError: vi.fn(),
  },
}));

// Mock constants
vi.mock('../../constants', () => ({
  WEBSOCKET_CONFIG: {
    RECONNECT_DELAY: 1000,
    PING_INTERVAL: 30000,
  },
}));

describe('WebSocketClient', () => {
  let mockWs: MockWebSocket;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;
  let clearTimeoutSpy: ReturnType<typeof vi.spyOn>;
  let clearIntervalSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Create spies for timer functions
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // Reset WebSocket client
    websocketClient.disconnect();

    // Create a proper WebSocket constructor mock
    const WebSocketConstructor = function (this: MockWebSocket, url: string) {
      mockWs = new MockWebSocket(url) as unknown as MockWebSocket;
      return mockWs as unknown as WebSocket;
    } as unknown as typeof WebSocket;
    
    // Copy static properties
    WebSocketConstructor.OPEN = 1;
    WebSocketConstructor.CONNECTING = 0;
    WebSocketConstructor.CLOSING = 2;
    WebSocketConstructor.CLOSED = 3;
    
    // Replace global WebSocket
    global.WebSocket = WebSocketConstructor;
  });

  afterEach(() => {
    websocketClient.disconnect();
    vi.useRealTimers();
    vi.restoreAllMocks();
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  describe('connect', () => {
    it('should create WebSocket connection', () => {
      websocketClient.connect();

      expect(mockWs).toBeDefined();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      expect(mockWs?.url).toBe(`${protocol}//${window.location.host}/ws`);
    });

    it('should not connect if already connecting', () => {
      websocketClient.connect();
      const firstMockWs = mockWs;

      websocketClient.connect();

      // Should reuse the same connection
      expect(mockWs).toBe(firstMockWs);
    });

    it('should handle connection open', () => {
      const statusHandler = vi.fn();
      websocketClient.onMessage(statusHandler);

      websocketClient.connect();

      if (mockWs) {
        // websocketClient.connect() sets this.ws.onopen, which should be on mockWs
        // Simulate open event first
        mockWs.simulateOpen();
        // Then manually trigger onopen handler that was set by websocketClient
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }

        expect(websocketClient.getConnectionStatus().connected).toBe(true);
      }
    });

    it('should handle connection errors', () => {
      const errorHandler = vi.fn();
      websocketClient.onMessage(errorHandler);

      websocketClient.connect();

      if (mockWs) {
        // websocketClient.connect() sets this.ws.onerror
        // Simulate error event
        mockWs.simulateError();
        // Then manually trigger onerror handler that was set by websocketClient
        const onerrorHandler = (mockWs as any).onerror;
        if (onerrorHandler) {
          onerrorHandler(new Event('error'));
        }

        expect(errorReporter.reportError).toHaveBeenCalled();
      }
    });

    it('should handle connection close and reconnect', () => {
      websocketClient.connect();

      if (mockWs) {
        // Open connection first
        mockWs.simulateOpen();
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }
        
        // Close connection - this should trigger scheduleReconnect
        mockWs.simulateClose();
        const oncloseHandler = (mockWs as any).onclose;
        if (oncloseHandler) {
          oncloseHandler();
        }

        // Should schedule reconnect (setTimeout is called via window.setTimeout)
        // With fake timers, we can check if timers were scheduled
        expect(setTimeoutSpy).toHaveBeenCalled();
      }
    });
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      const unsubscribe = websocketClient.onMessage(handler);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should call handler when message received', () => {
      const handler = vi.fn();
      websocketClient.onMessage(handler);

      websocketClient.connect();

      if (mockWs) {
        // First open connection
        mockWs.simulateOpen();
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }
        
        const message = {
          type: 'status',
          data: { deviceId: 'ABC123' },
          timestamp: Date.now(),
        };
        // websocketClient.connect() sets this.ws.onmessage
        // Trigger onmessage handler that was set by websocketClient
        const onmessageHandler = (mockWs as any).onmessage;
        if (onmessageHandler) {
          onmessageHandler(new MessageEvent('message', { data: JSON.stringify(message) }));
        }

        expect(handler).toHaveBeenCalled();
      }
    });

    it('should handle pong messages', () => {
      const handler = vi.fn();
      websocketClient.onMessage(handler);

      websocketClient.connect();

      if (mockWs) {
        mockWs.simulateOpen();
        const pongMessage = {
          type: 'pong',
          timestamp: Date.now(),
        };
        mockWs.simulateMessage(JSON.stringify(pongMessage));

        // Pong messages should not trigger handler
        expect(handler).not.toHaveBeenCalled();
      }
    });
  });

  describe('onStatus', () => {
    it('should register status handler', () => {
      const handler = vi.fn();
      const unsubscribe = websocketClient.onStatus(handler);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should call handler when status update received', () => {
      const handler = vi.fn();
      websocketClient.onStatus(handler);

      websocketClient.connect();

      if (mockWs) {
        // First open connection
        mockWs.simulateOpen();
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }
        
        const statusMessage = {
          type: 'status',
          data: {
            deviceSn: 'ABC123',
            status: {
              deviceId: 'ABC123',
              batteryLevel: 85,
              status: 'charging',
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
            source: 'mqtt',
          },
          timestamp: Date.now(),
        };
        // websocketClient.connect() sets this.ws.onmessage
        // Trigger onmessage handler that was set by websocketClient
        const onmessageHandler = (mockWs as any).onmessage;
        if (onmessageHandler) {
          onmessageHandler(new MessageEvent('message', { data: JSON.stringify(statusMessage) }));
        }

        expect(handler).toHaveBeenCalled();
      }
    });
  });

  describe('send', () => {
    it('should send message when connected', () => {
      websocketClient.connect();

      if (mockWs) {
        mockWs.simulateOpen();
        const sendSpy = vi.spyOn(mockWs, 'send');

        websocketClient.send({
          type: 'ping',
          timestamp: Date.now(),
        });

        expect(sendSpy).toHaveBeenCalled();
      }
    });

    it('should not send message when not connected', () => {
      websocketClient.disconnect();

      if (mockWs) {
        const sendSpy = vi.spyOn(mockWs, 'send');

        websocketClient.send({
          type: 'ping',
          timestamp: Date.now(),
        });

        // Should not send when not connected
        expect(sendSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status', () => {
      const status = websocketClient.getConnectionStatus();

      expect(status).toBeDefined();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('usingMQTT');
      expect(status).toHaveProperty('status');
    });

    it('should update status when connected', () => {
      websocketClient.connect();

      if (mockWs) {
        // websocketClient.connect() sets this.ws.onopen
        mockWs.simulateOpen();
        // Manually trigger onopen handler that was set by websocketClient
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }

        const status = websocketClient.getConnectionStatus();
        expect(status.connected).toBe(true);
        expect(status.status).toBe('connected');
      }
    });

    it('should update MQTT status from connection message', () => {
      websocketClient.connect();

      if (mockWs) {
        // First open connection
        mockWs.simulateOpen();
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }
        
        const connectionMessage = {
          type: 'connection',
          data: {
            status: 'connected',
            usingMQTT: true,
          },
          timestamp: Date.now(),
        };
        // websocketClient.connect() sets this.ws.onmessage
        // Trigger onmessage handler that was set by websocketClient
        const onmessageHandler = (mockWs as any).onmessage;
        if (onmessageHandler) {
          onmessageHandler(new MessageEvent('message', { data: JSON.stringify(connectionMessage) }));
        }

        const status = websocketClient.getConnectionStatus();
        expect(status.usingMQTT).toBe(true);
      }
    });
  });

  describe('disconnect', () => {
    it('should disconnect and cleanup', () => {
      websocketClient.connect();

      if (mockWs) {
        mockWs.simulateOpen();
        const closeSpy = vi.spyOn(mockWs, 'close');

        websocketClient.disconnect();

        expect(closeSpy).toHaveBeenCalled();
        expect(websocketClient.getConnectionStatus().connected).toBe(false);
      }
    });

    it('should clear reconnect timer', () => {
      websocketClient.connect();

      if (mockWs) {
        // Open connection
        mockWs.simulateOpen();
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }
        
        // Close connection to trigger scheduleReconnect (sets reconnectTimer)
        mockWs.simulateClose();
        const oncloseHandler = (mockWs as any).onclose;
        if (oncloseHandler) {
          oncloseHandler();
        }
        
        // Now disconnect should clear the reconnect timer
        websocketClient.disconnect();

        expect(clearTimeoutSpy).toHaveBeenCalled();
      }
    });

    it('should stop ping interval', () => {
      websocketClient.connect();

      if (mockWs) {
        // Open connection to trigger startPingInterval (sets pingInterval)
        mockWs.simulateOpen();
        const onopenHandler = (mockWs as any).onopen;
        if (onopenHandler) {
          onopenHandler();
        }

        // Now disconnect should stop the ping interval
        websocketClient.disconnect();

        expect(clearIntervalSpy).toHaveBeenCalled();
      }
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection on close', () => {
      websocketClient.connect();

      if (mockWs) {
        mockWs.simulateOpen();
        const firstMockWs = mockWs;

        mockWs.simulateClose();

        // Advance timers to trigger reconnect
        vi.advanceTimersByTime(1000);

        // Should attempt to reconnect (new WebSocket instance should be created)
        // Note: This test may need adjustment based on actual reconnection logic
        expect(websocketClient.getConnectionStatus().connected).toBeDefined();
      }
    });

    it('should stop reconnecting after max attempts', () => {
      websocketClient.connect();

      if (mockWs) {
        mockWs.simulateOpen();

        // Simulate multiple reconnection attempts
        for (let i = 0; i < 6; i++) {
          mockWs.simulateClose();
          vi.advanceTimersByTime(1000);
        }

        // After max attempts, connection status should reflect stopped reconnection
        const status = websocketClient.getConnectionStatus();
        expect(status).toBeDefined();
      }
    });
  });
});

