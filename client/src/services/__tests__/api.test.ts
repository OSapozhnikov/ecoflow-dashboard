/**
 * Unit tests for ApiClient
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios BEFORE importing apiClient
// Create mocks inside factory function to avoid hoisting issues
vi.mock('axios', () => {
  // Create mocks inside factory - they will be hoisted correctly
  const mockGetFn = vi.fn();
  const mockAxiosInstanceFn = {
    get: mockGetFn,
  };
  const mockAxiosCreateFn = vi.fn(() => mockAxiosInstanceFn);
  
  // Store in global scope for use in tests
  (globalThis as any).__mockGet = mockGetFn;
  (globalThis as any).__mockAxiosCreate = mockAxiosCreateFn;
  
  return {
    default: {
      create: mockAxiosCreateFn,
    },
    create: mockAxiosCreateFn,
  };
});

// Mock error reporting
vi.mock('../../utils/errorReporting', () => ({
  errorReporter: {
    reportError: vi.fn(),
  },
}));

// Mock constants
vi.mock('../../constants', () => ({
  RATE_LIMIT_CONFIG: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 60000,
  },
}));

// Import apiClient after mocks are set up
import { apiClient } from '../api';

// Get mocks from global scope (set by vi.mock factory)
const mockGet = (globalThis as any).__mockGet as ReturnType<typeof vi.fn>;
const mockAxiosCreate = (globalThis as any).__mockAxiosCreate as ReturnType<typeof vi.fn>;

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (mockGet) mockGet.mockClear();
    if (mockAxiosCreate) mockAxiosCreate.mockClear();
    
    // Reset rate limiter
    (apiClient as unknown as { rateLimiter: { reset: () => void } }).rateLimiter?.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDevices', () => {
    it('should return devices list when API call succeeds', async () => {
      const mockResponse = {
        devices: [
          {
            sn: 'ABC123',
            deviceName: 'Test Device',
            deviceType: 'Delta Pro',
            online: 1,
          },
        ],
        total: 1,
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await apiClient.getDevices();

      expect(result).toBeDefined();
      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
      expect(result.devices.length).toBe(1);
      expect(mockGet).toHaveBeenCalledWith('/api/devices');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('should handle array response format', async () => {
      const mockResponse = [
        {
          sn: 'ABC123',
          deviceName: 'Test Device',
        },
      ];

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await apiClient.getDevices();

      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
    });

    it('should handle nested data response format', async () => {
      const mockResponse = {
        data: {
          devices: [
            {
              sn: 'ABC123',
              deviceName: 'Test Device',
            },
          ],
          total: 1,
        },
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await apiClient.getDevices();

      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
        response: undefined,
        config: { url: '/api/devices', method: 'get' },
      };

      mockGet.mockRejectedValue(networkError);

      await expect(apiClient.getDevices()).rejects.toThrow('Cannot connect to backend server');
    });

    it('should handle API error responses', async () => {
      const errorResponse = {
        response: {
          status: 500,
          data: {
            error: {
              message: 'Internal server error',
              code: 'SERVER_ERROR',
            },
          },
        },
        config: { url: '/api/devices', method: 'get' },
      };

      mockGet.mockRejectedValue(errorResponse);

      await expect(apiClient.getDevices()).rejects.toThrow('Internal server error');
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests to exceed rate limit
      const mockResponse = {
        devices: [],
        total: 0,
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await apiClient.getDevices();
      }

      // Next request should be rate limited
      await expect(apiClient.getDevices()).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle empty devices list', async () => {
      const mockResponse = {
        devices: [],
        total: 0,
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await apiClient.getDevices();

      expect(result.devices).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getDeviceStatus', () => {
    it('should return device status when API call succeeds', async () => {
      const mockResponse = {
        deviceId: 'ABC123',
        data: {
          deviceId: 'ABC123',
          batteryLevel: 85,
          chargeRate: 100,
          dischargeRate: 0,
          status: 'charging',
          timestamp: Date.now(),
        },
        source: 'mqtt',
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await apiClient.getDeviceStatus('ABC123');

      expect(result).toBeDefined();
      expect(result.deviceId).toBe('ABC123');
      expect(result.data).toBeDefined();
      expect(result.data.batteryLevel).toBe(85);
      expect(mockGet).toHaveBeenCalledWith('/api/devices/ABC123/status');
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ERR_NETWORK',
        message: 'Network Error',
        response: undefined,
        config: { url: '/api/devices/ABC123/status', method: 'get' },
      };

      mockGet.mockRejectedValue(networkError);

      await expect(apiClient.getDeviceStatus('ABC123')).rejects.toThrow('Cannot connect to backend server');
    });

    it('should handle API error responses', async () => {
      const errorResponse = {
        response: {
          status: 404,
          data: {
            error: {
              message: 'Device not found',
              code: 'NOT_FOUND',
            },
          },
        },
        config: { url: '/api/devices/ABC123/status', method: 'get' },
      };

      mockGet.mockRejectedValue(errorResponse);

      await expect(apiClient.getDeviceStatus('ABC123')).rejects.toThrow('Device not found');
    });

    it('should handle invalid response format', async () => {
      const invalidResponse = {
        deviceId: 'ABC123',
        // Missing data field
      };

      mockGet.mockResolvedValue({
        data: invalidResponse,
        status: 200,
      });

      const result = await apiClient.getDeviceStatus('ABC123');

      expect(result.deviceId).toBe('ABC123');
      expect(result.data).toBeDefined();
      expect(result.data.batteryLevel).toBe(0);
      expect(result.source).toBe('error');
    });

    it('should handle rate limiting', async () => {
      const mockResponse = {
        deviceId: 'ABC123',
        data: {
          deviceId: 'ABC123',
          batteryLevel: 50,
          status: 'standby',
          timestamp: Date.now(),
        },
      };

      mockGet.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        await apiClient.getDeviceStatus('ABC123');
      }

      // Next request should be rate limited
      await expect(apiClient.getDeviceStatus('ABC123')).rejects.toThrow('Rate limit exceeded');
    });
  });
});

