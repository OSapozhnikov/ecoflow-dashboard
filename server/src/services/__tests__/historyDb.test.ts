/**
 * History DB tests with a temporary SQLite file (node:sqlite).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeHistoryDb,
  initHistoryDb,
  insertSample,
  querySamples,
  deleteSamplesOlderThan,
  upsertDailyAgg,
  upsertMonthlyAgg,
  queryMonthlyAgg,
} from '../historyDb';
import { recordSample, runRetention, getHistory } from '../historyService';

describe('historyDb', () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    closeHistoryDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecoflow-hist-'));
    dbPath = path.join(tmpDir, 'ecoflow.sqlite');
    initHistoryDb(dbPath);
  });

  afterEach(() => {
    closeHistoryDb();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows may briefly lock the sqlite file
    }
  });

  it('inserts and queries samples', () => {
    const ts = Date.now();
    insertSample({
      device_id: 'D3M1TEST',
      ts,
      battery_level: 55,
      charge_w: 100,
      discharge_w: 0,
      plug_w: null,
      online: 1,
      source: 'mqtt',
    });

    const rows = querySamples('D3M1TEST', ts - 1000, ts + 1000);
    expect(rows).toHaveLength(1);
    expect(rows[0].battery_level).toBe(55);
    expect(rows[0].charge_w).toBe(100);
    expect(rows[0].source).toBe('mqtt');
  });

  it('deletes old samples for retention', () => {
    const oldTs = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const newTs = Date.now();
    insertSample({
      device_id: 'X',
      ts: oldTs,
      battery_level: 10,
      charge_w: 0,
      discharge_w: 0,
      plug_w: null,
      online: 1,
      source: 'mqtt',
    });
    insertSample({
      device_id: 'X',
      ts: newTs,
      battery_level: 20,
      charge_w: 0,
      discharge_w: 0,
      plug_w: null,
      online: 1,
      source: 'mqtt',
    });

    const deleted = deleteSamplesOlderThan(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(deleted).toBe(1);
    expect(querySamples('X', 0, Date.now() + 1)).toHaveLength(1);
  });

  it('upserts daily and monthly aggregates', () => {
    upsertDailyAgg({
      device_id: 'D3M1TEST',
      day: '2026-09-01',
      avg_soc: 60,
      energy_in_wh: 1200,
      energy_out_wh: 800,
      sample_count: 100,
    });
    upsertMonthlyAgg({
      device_id: 'D3M1TEST',
      month: '2026-09',
      avg_soc: 58,
      energy_in_wh: 30000,
      energy_out_wh: 20000,
    });

    const months = queryMonthlyAgg('D3M1TEST');
    expect(months).toHaveLength(1);
    expect(months[0].month).toBe('2026-09');
    expect(months[0].energy_in_wh).toBe(30000);
  });

  it('recordSample + getHistory round-trip', () => {
    const ts = Date.now();
    recordSample({
      deviceId: 'HW52PLUG',
      ts,
      source: 'mqtt',
      status: {
        deviceId: 'HW52PLUG',
        batteryLevel: 0,
        status: 'discharging',
        timestamp: ts,
        isPlug: true,
        plugWatts: 220,
      },
    });

    const samples = getHistory('HW52PLUG', ts - 10, ts + 10);
    expect(samples).toHaveLength(1);
    expect(samples[0].plug_w).toBe(220);
    expect(samples[0].battery_level).toBeNull();
  });

  it('runRetention uses default raw days against open db', () => {
    const oldTs = Date.now() - 40 * 24 * 60 * 60 * 1000;
    insertSample({
      device_id: 'Y',
      ts: oldTs,
      battery_level: 1,
      charge_w: null,
      discharge_w: null,
      plug_w: null,
      online: null,
      source: null,
    });
    // Avoid reading settings.json from real DATA_DIR — call delete via runRetention
    // which may use settings; still deletes 40d-old with default 30d
    const deleted = runRetention(30);
    expect(deleted).toBeGreaterThanOrEqual(1);
  });
});
