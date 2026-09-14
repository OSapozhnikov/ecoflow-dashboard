/**
 * Lab: GET /api/devices/:deviceId/quota/raw
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import quotaRawRouter from '../quotaRaw';
import { mqttService } from '../../services/mqtt';
import { ecoflowService } from '../../services/ecoflow';

vi.mock('../../services/mqtt', () => ({
  mqttService: {
    getLastRawQuota: vi.fn(),
  },
}));

vi.mock('../../services/ecoflow', () => ({
  ecoflowService: {
    getRawQuotaAll: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Quota raw route', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/devices', quotaRawRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns rest.data and matched keys on success', async () => {
    vi.mocked(ecoflowService.getRawQuotaAll).mockResolvedValue({
      ok: true,
      code: '0',
      message: 'Success',
      data: { cmsBattSoc: 88, powInSumW: 227 },
      raw: { code: '0', data: { cmsBattSoc: 88, powInSumW: 227 } },
    });
    vi.mocked(mqttService.getLastRawQuota).mockReturnValue(undefined);

    const res = await request(app).get('/api/devices/D3M1TEST/quota/raw');

    expect(res.status).toBe(200);
    expect(res.body.deviceId).toBe('D3M1TEST');
    expect(res.body.rest.ok).toBe(true);
    expect(res.body.rest.data).toMatchObject({ cmsBattSoc: 88 });
    expect(res.body.mqtt).toBeNull();
    expect(res.body.matched?.soc).toBe('cmsBattSoc');
    expect(res.body.normalized?.batteryLevel).toBe(88);
  });

  it('returns rest.ok false for 8521 with raw visible', async () => {
    vi.mocked(ecoflowService.getRawQuotaAll).mockResolvedValue({
      ok: false,
      code: '8521',
      message: 'signature is wrong',
      data: null,
      raw: { code: '8521', message: 'signature is wrong' },
    });
    vi.mocked(mqttService.getLastRawQuota).mockReturnValue(undefined);

    const res = await request(app).get('/api/devices/P351TEST/quota/raw');

    expect(res.status).toBe(200);
    expect(res.body.rest.ok).toBe(false);
    expect(res.body.rest.code).toBe('8521');
    expect(res.body.rest.raw).toMatchObject({ code: '8521' });
    expect(res.body.matched).toBeUndefined();
  });

  it('includes mqtt last + merged when cached', async () => {
    vi.mocked(ecoflowService.getRawQuotaAll).mockResolvedValue({
      ok: true,
      code: '0',
      data: { watts: 100 },
      raw: { code: '0', data: { watts: 100 } },
    });
    vi.mocked(mqttService.getLastRawQuota).mockReturnValue({
      timestamp: 123,
      topic: '/open/acc/HW52X/quota',
      payload: { param: { watts: 1000 } },
      merged: { watts: 1000, switchSta: true },
      messageCount: 2,
    });

    const res = await request(app).get('/api/devices/HW52X/quota/raw');

    expect(res.status).toBe(200);
    expect(res.body.mqtt).toEqual({
      timestamp: 123,
      topic: '/open/acc/HW52X/quota',
      last: { param: { watts: 1000 } },
      merged: { watts: 1000, switchSta: true },
      messageCount: 2,
    });
  });
});
