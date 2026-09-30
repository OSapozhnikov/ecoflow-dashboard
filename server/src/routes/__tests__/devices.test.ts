/**
 * Integration tests for devices routes
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import devicesRouter from '../devices';
import { ecoflowService } from '../../services/ecoflow';
import { mqttService } from '../../services/mqtt';
import { readSettings, writeSettings } from '../../services/dataFiles';

// Mock services
vi.mock('../../services/ecoflow', () => ({
  ecoflowService: {
    getDevices: vi.fn(),
  },
}));

vi.mock('../../services/mqtt', () => ({
  mqttService: {
    subscribeToDevice: vi.fn(),
    unsubscribeFromDevice: vi.fn(),
    clearCachedStatus: vi.fn(),
  },
}));

vi.mock('../../services/dataFiles', () => ({
  readSettings: vi.fn(() => ({
    telegram: { botToken: '', chatId: '' },
    thresholds: { lowSocPercent: 20, offlineAfterMinutes: 15, plugWattsAnomalyMax: 4000 },
    retention: { rawDays: 30, aggregateMonths: 13 },
    disabledDeviceIds: [],
  })),
  writeSettings: vi.fn((partial) => ({
    telegram: { botToken: '', chatId: '' },
    thresholds: { lowSocPercent: 20, offlineAfterMinutes: 15, plugWattsAnomalyMax: 4000 },
    retention: { rawDays: 30, aggregateMonths: 13 },
    disabledDeviceIds: partial.disabledDeviceIds ?? [],
  })),
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
    vi.mocked(readSettings).mockReturnValue({
      telegram: { botToken: '', chatId: '' },
      thresholds: { lowSocPercent: 20, offlineAfterMinutes: 15, plugWattsAnomalyMax: 4000 },
      retention: { rawDays: 30, aggregateMonths: 13 },
      disabledDeviceIds: [],
    });
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

      vi.mocked(ecoflowService.getDevices).mockResolvedValue(mockDevices as never);

      const response = await request(app).get('/api/devices').expect(200);

      expect(response.body.devices).toHaveLength(1);
      expect(response.body.devices[0].sn).toBe('ABC123');
    });

    it('should handle empty devices list', async () => {
      vi.mocked(ecoflowService.getDevices).mockResolvedValue({
        devices: [],
        total: 0,
      } as never);

      const response = await request(app).get('/api/devices').expect(200);

      expect(response.body.devices).toEqual([]);
    });

    it('should handle errors', async () => {
      vi.mocked(ecoflowService.getDevices).mockRejectedValue(new Error('Failed to fetch devices'));

      const response = await request(app).get('/api/devices').expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Failed to fetch devices');
      expect(response.body.error.code).toBe('DEVICE_FETCH_ERROR');
    });

    it('should handle API errors', async () => {
      const { EcoflowAPIError } = await import('../../errors/EcoflowError');
      const error = new EcoflowAPIError('API Error', 'ERROR_CODE', 500);
      vi.mocked(ecoflowService.getDevices).mockRejectedValue(error);

      const response = await request(app).get('/api/devices').expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('API Error');
    });
  });

  describe('PUT /api/devices/:deviceId/monitoring', () => {
    it('pauses monitoring and unsubscribes MQTT', async () => {
      const response = await request(app)
        .put('/api/devices/HW52X/monitoring')
        .send({ enabled: false })
        .expect(200);

      expect(response.body).toEqual({ deviceId: 'HW52X', enabled: false });
      expect(writeSettings).toHaveBeenCalledWith({
        disabledDeviceIds: ['HW52X'],
      });
      expect(mqttService.unsubscribeFromDevice).toHaveBeenCalledWith('HW52X');
      expect(mqttService.clearCachedStatus).toHaveBeenCalledWith('HW52X');
    });

    it('resumes monitoring and subscribes MQTT', async () => {
      vi.mocked(readSettings).mockReturnValue({
        telegram: { botToken: '', chatId: '' },
        thresholds: { lowSocPercent: 20, offlineAfterMinutes: 15, plugWattsAnomalyMax: 4000 },
        retention: { rawDays: 30, aggregateMonths: 13 },
        disabledDeviceIds: ['HW52X'],
      });

      const response = await request(app)
        .put('/api/devices/HW52X/monitoring')
        .send({ enabled: true })
        .expect(200);

      expect(response.body.enabled).toBe(true);
      expect(writeSettings).toHaveBeenCalledWith({ disabledDeviceIds: [] });
      expect(mqttService.subscribeToDevice).toHaveBeenCalledWith('HW52X');
    });

    it('rejects missing enabled boolean', async () => {
      const response = await request(app)
        .put('/api/devices/HW52X/monitoring')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_BODY');
    });
  });
});
