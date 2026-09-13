/**
 * Integration tests for devices routes
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import devicesRouter from '../devices';
import { ecoflowService } from '../../services/ecoflow';

// Mock services
vi.mock('../../services/ecoflow', () => ({
  ecoflowService: {
    getDevices: vi.fn(),
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

// Mock metrics
vi.mock('../../utils/metrics', () => ({
  apiRequestDuration: {
    observe: vi.fn(),
  },
  apiRequestTotal: {
    inc: vi.fn(),
  },
}));

describe('Devices Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/devices', devicesRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/devices', () => {
    it('should return devices list', async () => {
      const mockDevices = {
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

      vi.mocked(ecoflowService.getDevices).mockResolvedValue(mockDevices);

      const response = await request(app)
        .get('/api/devices')
        .expect(200);

      expect(response.body).toEqual(mockDevices);
      expect(ecoflowService.getDevices).toHaveBeenCalledTimes(1);
    });

    it('should handle empty devices list', async () => {
      const mockDevices = {
        devices: [],
        total: 0,
      };

      vi.mocked(ecoflowService.getDevices).mockResolvedValue(mockDevices);

      const response = await request(app)
        .get('/api/devices')
        .expect(200);

      expect(response.body.devices).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to fetch devices');
      vi.mocked(ecoflowService.getDevices).mockRejectedValue(error);

      const response = await request(app)
        .get('/api/devices')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Failed to fetch devices');
      expect(response.body.error.code).toBe('DEVICE_FETCH_ERROR');
    });

    it('should handle API errors', async () => {
      const { EcoflowAPIError } = await import('../../errors/EcoflowError');
      const error = new EcoflowAPIError('API Error', 'ERROR_CODE', 500);
      vi.mocked(ecoflowService.getDevices).mockRejectedValue(error);

      const response = await request(app)
        .get('/api/devices')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('API Error');
    });
  });
});

