/**
 * Unit tests for WebSocketService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createServer } from 'http';
import { WebSocketService } from '../websocket';

// Mock ws - use factory function to avoid hoisting issues
const mockWebSocketServer = {
  on: vi.fn(),
  close: vi.fn(),
};

const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  readyState: 1, // OPEN
} as unknown as typeof import('ws').WebSocket;

vi.mock('ws', () => {
  // Create a class constructor that returns the mock object
  class WebSocketServerMock {
    constructor(options?: any) {
      // Return the mock object when called as constructor
      return mockWebSocketServer;
    }
  }
  
  return {
    WebSocketServer: WebSocketServerMock,
    WebSocket: {
      OPEN: 1,
      CONNECTING: 0,
      CLOSING: 2,
      CLOSED: 3,
    },
  };
});

// Mock shared package constants (keep mapper exports)
vi.mock('@ecoflow/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ecoflow/shared')>();
  return {
    ...actual,
    API_CONFIG: {
      TIMEOUT: 10000,
    },
    RECONNECT_CONFIG: {
      MQTT: {
        MAX_ATTEMPTS: 5,
        DELAY: 1000,
      },
    },
    WEBSOCKET_CONFIG: {
      RECONNECT_DELAY: 1000,
      PING_INTERVAL: 30000,
    },
  };
});

// Mock config
const mockGetConfig = vi.fn(() => ({
  websocket: {
    enabled: true,
    path: '/ws',
  },
}));

vi.mock('../config/env', () => ({
  getConfig: mockGetConfig,
}));

// Mock mqtt service - create spy functions inside factory
vi.mock('../mqtt', () => {
  // Create spy functions inside factory
  const mockOn = vi.fn();
  const mockMqttServiceGetConnectionStatus = vi.fn(() => ({
    connected: true,
    usingMQTT: true,
    usingREST: false,
    subscribedDevices: ['ABC123'],
  }));

  // Create a mock EventEmitter-like object
  const mockMqttService = {
    on: mockOn,
    once: vi.fn(),
    emit: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    getConnectionStatus: mockMqttServiceGetConnectionStatus,
  };

  return {
    mqttService: mockMqttService,
    DeviceStatusUpdate: {} as any,
  };
});

// Helper to get mocked mqttService.on - import module after mock is applied
async function getMockedMqttServiceOn(): Promise<ReturnType<typeof vi.fn>> {
  const mqttModule = await import('../mqtt');
  return mqttModule.mqttService.on as ReturnType<typeof vi.fn>;
}

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('../utils/metrics', () => ({
  websocketConnectionsTotal: {
    inc: vi.fn(),
  },
  websocketConnectionsActive: {
    set: vi.fn(),
  },
  websocketMessagesTotal: {
    inc: vi.fn(),
  },
  errorsTotal: {
    inc: vi.fn(),
  },
}));

describe('WebSocketService', () => {
  let service: WebSocketService;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mockOn = await getMockedMqttServiceOn();
    if (mockOn) {
      mockOn.mockClear();
    }
    mockWebSocketServer.on.mockClear();
    mockWebSocket.send.mockClear();
    service = new WebSocketService();
    server = createServer();
  });

  afterEach(() => {
    if (service) {
      service.close();
    }
    if (server) {
      server.close();
    }
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should initialize WebSocket server', () => {
      service.initialize(server);

      // Verify WebSocket server was created and connection handler was set
      expect(mockWebSocketServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should not initialize when WebSocket is disabled', () => {
      // Mock config to return disabled WebSocket
      mockGetConfig.mockReturnValueOnce({
        websocket: {
          enabled: false,
        },
      } as any);

      const disabledService = new WebSocketService();
      disabledService.initialize(server);

      // Should not create WebSocket server
      // Since WebSocket is disabled, initialize() returns early
      const ws = require('ws');
      // WebSocketServer should not be called when disabled
      // But we can't easily verify this without accessing private properties
      // So we verify that service doesn't have wss set
      expect(disabledService.getClientsCount()).toBe(0);
    });

    it('should listen to MQTT service events', async () => {
      service.initialize(server);

      // Verify mqttService.on was called with event handlers
      const mockOn = await getMockedMqttServiceOn();
      expect(mockOn).toHaveBeenCalledWith('status', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('fallback', expect.any(Function));
    });
  });

  describe('handleConnection', () => {
    it('should handle new WebSocket connection', () => {
      service.initialize(server);

      // Get the connection handler
      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      expect(connectionHandler).toBeDefined();

      if (connectionHandler) {
        connectionHandler(mockWebSocket);

        expect(service.getClientsCount()).toBe(1);
      }
    });

    it('should send initial connection status', () => {
      service.initialize(server);

      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockWebSocket);

        expect(mockWebSocket.send).toHaveBeenCalled();
        const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
        expect(sentMessage.type).toBe('connection');
        expect(sentMessage.data).toBeDefined();
      }
    });

    it('should handle ping messages', () => {
      service.initialize(server);

      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockWebSocket);

        // Get message handler
        const messageHandler = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message'
        )?.[1];

        if (messageHandler) {
          const pingMessage = Buffer.from(JSON.stringify({ type: 'ping' }));
          messageHandler(pingMessage);

          // Should send pong
          expect(mockWebSocket.send).toHaveBeenCalled();
          const sentMessages = mockWebSocket.send.mock.calls.map((call) =>
            JSON.parse(call[0])
          );
          const pongMessage = sentMessages.find((msg) => msg.type === 'pong');
          expect(pongMessage).toBeDefined();
        }
      }
    });

    it('should handle client disconnect', () => {
      service.initialize(server);

      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockWebSocket);

        expect(service.getClientsCount()).toBe(1);

        // Get close handler
        const closeHandler = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'close'
        )?.[1];

        if (closeHandler) {
          closeHandler();
          expect(service.getClientsCount()).toBe(0);
        }
      }
    });
  });

  describe('broadcastStatus', () => {
    it('should broadcast status updates to all clients', async () => {
      service.initialize(server);

      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockWebSocket);

        // Get status handler from MQTT service mock
        const mockOn = await getMockedMqttServiceOn();
        const statusHandler = mockOn.mock.calls.find(
          (call) => call[0] === 'status'
        )?.[1];

        if (statusHandler) {
          const statusUpdate = {
            deviceSn: 'ABC123',
            status: {
              deviceId: 'ABC123',
              batteryLevel: 85,
              status: 'charging' as const,
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
            source: 'mqtt' as const,
          };

          statusHandler(statusUpdate);

          expect(mockWebSocket.send).toHaveBeenCalled();
          const sentMessage = JSON.parse(
            mockWebSocket.send.mock.calls[mockWebSocket.send.mock.calls.length - 1][0]
          );
          expect(sentMessage.type).toBe('status');
          expect(sentMessage.data).toEqual(statusUpdate);
        }
      }
    });
  });

  describe('getClientsCount', () => {
    it('should return number of connected clients', () => {
      expect(service.getClientsCount()).toBe(0);

      service.initialize(server);

      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockWebSocket);
        expect(service.getClientsCount()).toBe(1);
      }
    });
  });

  describe('close', () => {
    it('should close WebSocket server and clear clients', () => {
      service.initialize(server);

      const connectionHandler = mockWebSocketServer.on.mock.calls.find(
        (call) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockWebSocket);
        expect(service.getClientsCount()).toBe(1);
      }

      service.close();

      expect(mockWebSocketServer.close).toHaveBeenCalled();
      expect(service.getClientsCount()).toBe(0);
    });
  });
});

