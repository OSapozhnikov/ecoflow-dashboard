/**
 * Unit tests for EcoflowService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { AxiosInstance } from 'axios';
import { EcoflowAPIError, EcoflowValidationError, EcoflowNetworkError } from '../../errors/EcoflowError';

// Mock axios before importing the service
const mockRequest = vi.fn();
const mockAxiosCreate = vi.fn(() => ({
  request: mockRequest,
} as unknown as AxiosInstance));

vi.mock('axios', () => ({
  default: {
    create: mockAxiosCreate,
  },
}));

// Mock config
vi.mock('../../config/env', () => ({
  getConfig: vi.fn(() => ({
    ecoflow: {
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      apiBaseUrl: 'https://api.ecoflow.com',
    },
  })),
}));

// Mock constants
vi.mock('../../constants', () => ({
  API_CONFIG: {
    TIMEOUT: 10000,
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('EcoflowError Classes', () => {
  describe('EcoflowAPIError', () => {
    it('should create error with correct properties', () => {
      const error = new EcoflowAPIError('API Error', 'ERROR_CODE', 500);
      
      expect(error).toBeInstanceOf(EcoflowAPIError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('API Error');
      expect(error.code).toBe('ERROR_CODE');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('EcoflowAPIError');
    });

    it('should create error without status code', () => {
      const error = new EcoflowAPIError('API Error', 'ERROR_CODE');
      
      expect(error.statusCode).toBeUndefined();
    });
  });

  describe('EcoflowValidationError', () => {
    it('should create validation error with validation issues', () => {
      const validationErrors = [{ path: ['devices'], message: 'Invalid format' }];
      const error = new EcoflowValidationError('Validation failed', validationErrors);
      
      expect(error).toBeInstanceOf(EcoflowValidationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.validationErrors).toEqual(validationErrors);
      expect(error.name).toBe('EcoflowValidationError');
    });
  });

  describe('EcoflowNetworkError', () => {
    it('should create network error', () => {
      const networkError = new Error('Network error');
      const error = new EcoflowNetworkError('Connection failed', networkError);
      
      expect(error).toBeInstanceOf(EcoflowNetworkError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.networkError).toBe(networkError);
      expect(error.name).toBe('EcoflowNetworkError');
    });
  });
});

describe('EcoflowService', () => {
  let ecoflowService: typeof import('../ecoflow').ecoflowService;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequest.mockClear();
    mockAxiosCreate.mockClear();
    
    // Import service after mocks are set up
    const module = await import('../ecoflow');
    ecoflowService = module.ecoflowService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDevices', () => {
    it('should return devices list when API call succeeds', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: [
          {
            sn: 'ABC123',
            deviceName: 'Test Device',
            deviceType: 'Delta Pro',
            online: 1,
          },
        ],
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getDevices();

      expect(result).toBeDefined();
      expect(result.devices).toBeDefined();
      expect(Array.isArray(result.devices)).toBe(true);
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should handle API error response', async () => {
      const mockErrorResponse = {
        code: '1001',
        message: 'Invalid signature',
      };

      mockRequest.mockResolvedValue({
        data: mockErrorResponse,
        status: 200,
      });

      await expect(ecoflowService.getDevices()).rejects.toThrow(EcoflowAPIError);
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.ecoflow.com',
      };

      mockRequest.mockRejectedValue(networkError);

      await expect(ecoflowService.getDevices()).rejects.toThrow(EcoflowNetworkError);
    });

    it('should handle validation errors', async () => {
      // When validation fails, service returns empty array with warning
      // This is the actual behavior from the service code
      const invalidResponse = {
        code: '0',
        message: 'Success',
        data: 'invalid data', // Invalid format
      };

      mockRequest.mockResolvedValue({
        data: invalidResponse,
        status: 200,
      });

      // Service handles invalid data by returning empty array
      const result = await ecoflowService.getDevices();
      expect(result.devices).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle empty devices array', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: [],
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getDevices();

      expect(result.devices).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getDeviceStatus', () => {
    it('should return device status when API call succeeds', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: {
          'bmsMaster.soc': '85',
          'bmsMaster.inputWatts': '100',
          'bmsMaster.outputWatts': '0',
        },
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getDeviceStatus('ABC123');

      expect(result).toBeDefined();
      expect(result.deviceId).toBe('ABC123');
      expect(result.data).toBeDefined();
      expect(result.data.batteryLevel).toBeGreaterThanOrEqual(0);
      expect(result.data.batteryLevel).toBeLessThanOrEqual(100);
    });

    it('should handle charging status', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: {
          'bmsMaster.soc': '50',
          'bmsMaster.inputWatts': '500',
          'bmsMaster.outputWatts': '0',
        },
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getDeviceStatus('ABC123');

      expect(result.data.status).toBe('charging');
      expect(result.data.chargeRate).toBeGreaterThan(0);
    });

    it('should handle discharging status', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: {
          'bmsMaster.soc': '50',
          'bmsMaster.inputWatts': '0',
          'bmsMaster.outputWatts': '1000',
        },
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getDeviceStatus('ABC123');

      expect(result.data.status).toBe('discharging');
      expect(result.data.dischargeRate).toBeGreaterThan(0);
    });

    it('should handle standby status', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: {
          'bmsMaster.soc': '50',
          'bmsMaster.inputWatts': '0',
          'bmsMaster.outputWatts': '0',
        },
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getDeviceStatus('ABC123');

      expect(result.data.status).toBe('standby');
    });

    it('should handle API error response', async () => {
      const mockErrorResponse = {
        code: '1001',
        message: 'Device not found',
      };

      mockRequest.mockResolvedValue({
        data: mockErrorResponse,
        status: 200,
      });

      await expect(ecoflowService.getDeviceStatus('INVALID')).rejects.toThrow(EcoflowAPIError);
    });

    it('should clarify misleading signature-is-wrong and log canonical signing string', async () => {
      const { logger } = await import('../../utils/logger');
      const tauSn = 'P351ZEH4PGCC0498';

      mockRequest.mockResolvedValue({
        data: {
          code: '13007',
          message: 'signature is wrong',
        },
        status: 200,
      });

      await expect(ecoflowService.getDeviceStatus(tauSn)).rejects.toMatchObject({
        name: 'EcoflowAPIError',
        code: '13007',
        message: expect.stringContaining('not a global HMAC failure'),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Ecoflow quota/all rejected',
        expect.objectContaining({
          sn: tauSn,
          apiCode: '13007',
          message: 'signature is wrong',
          canonicalSigningString: expect.stringMatching(
            /accessKey=.*&nonce=.*&sn=P351ZEH4PGCC0498&timestamp=/
          ),
          apiBaseUrl: 'https://api.ecoflow.com',
          endpoint: '/iot-open/sign/device/quota/all',
        })
      );

      // Canonical string must never include the secret key
      const warnCall = vi.mocked(logger.warn).mock.calls.find(
        (call) => call[0] === 'Ecoflow quota/all rejected'
      );
      const logged = JSON.stringify(warnCall?.[1] ?? {});
      expect(logged).not.toContain('test-secret-key');
      expect(logged).not.toMatch(/secretKey/i);
    });

    it('should keep plain Ecoflow API error message for non-signature rejects', async () => {
      mockRequest.mockResolvedValue({
        data: {
          code: '400',
          message: 'Device offline',
        },
        status: 200,
      });

      await expect(ecoflowService.getDeviceStatus('D3M1ZE1A9H990313')).rejects.toMatchObject({
        name: 'EcoflowAPIError',
        message: 'Ecoflow API error: Device offline',
        code: '400',
      });
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      mockRequest.mockRejectedValue(networkError);

      await expect(ecoflowService.getDeviceStatus('ABC123')).rejects.toThrow(EcoflowNetworkError);
    });
  });

  describe('getRawQuotaAll', () => {
    it('returns ok envelope with raw data without throwing', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: {
          cmsBattSoc: 88,
          powInSumW: 227,
        },
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getRawQuotaAll('D3M1ZE1A9H998313');

      expect(result.ok).toBe(true);
      expect(result.code).toBe('0');
      expect(result.data).toEqual(mockResponse.data);
      expect(result.raw).toEqual(mockResponse);
    });

    it('returns ok:false for vendor 8521 without throwing', async () => {
      const mockResponse = {
        code: '8521',
        message: 'signature is wrong',
        data: null,
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getRawQuotaAll('P351ZEH4PGCC0498');

      expect(result.ok).toBe(false);
      expect(result.code).toBe('8521');
      expect(result.message).toBe('signature is wrong');
      expect(result.raw).toEqual(mockResponse);
    });
  });

  describe('getMQTTCertification', () => {
    it('should return MQTT certification when API call succeeds', async () => {
      const mockResponse = {
        code: '0',
        message: 'Success',
        data: {
          certificateAccount: 'test-account',
          certificatePassword: 'test-password',
          url: 'mqtt.ecoflow.com',
          port: '1883', // Port is string in schema
          protocol: 'mqtt' as const,
        },
      };

      mockRequest.mockResolvedValue({
        data: mockResponse,
        status: 200,
      });

      const result = await ecoflowService.getMQTTCertification();

      expect(result).toBeDefined();
      expect(result.code).toBe('0');
      expect(result.data).toBeDefined();
      expect(result.data.certificateAccount).toBe('test-account');
      expect(result.data.url).toBe('mqtt.ecoflow.com');
    });

    it('should handle API error response', async () => {
      // When API returns error code, it first tries to parse as certification response
      // If validation fails, it throws validation error
      // If validation succeeds but code is not '0', it throws API error
      const mockErrorResponse = {
        code: '1001',
        message: 'Invalid credentials',
        data: null, // Missing data causes validation error
      };

      mockRequest.mockResolvedValue({
        data: mockErrorResponse,
        status: 200,
      });

      // Service throws validation error because data is missing
      await expect(ecoflowService.getMQTTCertification()).rejects.toThrow(EcoflowValidationError);
    });

    it('should handle validation errors', async () => {
      const invalidResponse = {
        code: '0',
        message: 'Success',
        data: null,
      };

      mockRequest.mockResolvedValue({
        data: invalidResponse,
        status: 200,
      });

      await expect(ecoflowService.getMQTTCertification()).rejects.toThrow(EcoflowValidationError);
    });
  });
});

