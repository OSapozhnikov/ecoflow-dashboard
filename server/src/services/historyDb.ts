/**
 * History SQLite using Node 22 `node:sqlite` DatabaseSync (no better-sqlite3).
 */

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { getDataDir } from './dataDir';
import { logger } from '../utils/logger';

export interface HistorySampleRow {
  device_id: string;
  ts: number;
  battery_level: number | null;
  charge_w: number | null;
  discharge_w: number | null;
  plug_w: number | null;
  online: number | null;
  source: string | null;
}

export interface DailyAggRow {
  device_id: string;
  day: string;
  avg_soc: number | null;
  energy_in_wh: number | null;
  energy_out_wh: number | null;
  sample_count: number | null;
}

export interface MonthlyAggRow {
  device_id: string;
  month: string;
  avg_soc: number | null;
  energy_in_wh: number | null;
  energy_out_wh: number | null;
}

let db: DatabaseSync | null = null;

export function getHistoryDbPath(): string {
  return path.join(getDataDir(), 'ecoflow.sqlite');
}

export function initHistoryDb(dbPath?: string): DatabaseSync {
  if (db) {
    return db;
  }
  const filePath = dbPath ?? getHistoryDbPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  db = new DatabaseSync(filePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      device_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      battery_level REAL,
      charge_w REAL,
      discharge_w REAL,
      plug_w REAL,
      online INTEGER,
      source TEXT,
      PRIMARY KEY (device_id, ts)
    );
    CREATE INDEX IF NOT EXISTS idx_samples_device_ts ON samples (device_id, ts);

    CREATE TABLE IF NOT EXISTS daily_agg (
      device_id TEXT NOT NULL,
      day TEXT NOT NULL,
      avg_soc REAL,
      energy_in_wh REAL,
      energy_out_wh REAL,
      sample_count INTEGER,
      PRIMARY KEY (device_id, day)
    );

    CREATE TABLE IF NOT EXISTS monthly_agg (
      device_id TEXT NOT NULL,
      month TEXT NOT NULL,
      avg_soc REAL,
      energy_in_wh REAL,
      energy_out_wh REAL,
      PRIMARY KEY (device_id, month)
    );
  `);
  logger.info(`History DB ready: ${filePath}`);
  return db;
}

export function getHistoryDb(): DatabaseSync {
  if (!db) {
    return initHistoryDb();
  }
  return db;
}

/** Close DB (tests). */
export function closeHistoryDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function insertSample(row: HistorySampleRow): void {
  try {
    const database = getHistoryDb();
    database
      .prepare(
        `INSERT OR REPLACE INTO samples
          (device_id, ts, battery_level, charge_w, discharge_w, plug_w, online, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.device_id,
        row.ts,
        row.battery_level,
        row.charge_w,
        row.discharge_w,
        row.plug_w,
        row.online,
        row.source
      );
  } catch {
    // Re-open once if another test/process closed the singleton
    closeHistoryDb();
    const database = initHistoryDb();
    database
      .prepare(
        `INSERT OR REPLACE INTO samples
          (device_id, ts, battery_level, charge_w, discharge_w, plug_w, online, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.device_id,
        row.ts,
        row.battery_level,
        row.charge_w,
        row.discharge_w,
        row.plug_w,
        row.online,
        row.source
      );
  }
}

export function querySamples(
  deviceId: string,
  from: number,
  to: number
): HistorySampleRow[] {
  const database = getHistoryDb();
  const rows = database
    .prepare(
      `SELECT device_id, ts, battery_level, charge_w, discharge_w, plug_w, online, source
       FROM samples
       WHERE device_id = ? AND ts >= ? AND ts <= ?
       ORDER BY ts ASC`
    )
    .all(deviceId, from, to) as unknown as HistorySampleRow[];
  return rows;
}

export function deleteSamplesOlderThan(cutoffTs: number): number {
  const database = getHistoryDb();
  const result = database.prepare(`DELETE FROM samples WHERE ts < ?`).run(cutoffTs);
  return Number(result.changes ?? 0);
}

export function upsertDailyAgg(row: DailyAggRow): void {
  getHistoryDb()
    .prepare(
      `INSERT INTO daily_agg (device_id, day, avg_soc, energy_in_wh, energy_out_wh, sample_count)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(device_id, day) DO UPDATE SET
         avg_soc = excluded.avg_soc,
         energy_in_wh = excluded.energy_in_wh,
         energy_out_wh = excluded.energy_out_wh,
         sample_count = excluded.sample_count`
    )
    .run(
      row.device_id,
      row.day,
      row.avg_soc,
      row.energy_in_wh,
      row.energy_out_wh,
      row.sample_count
    );
}

export function upsertMonthlyAgg(row: MonthlyAggRow): void {
  getHistoryDb()
    .prepare(
      `INSERT INTO monthly_agg (device_id, month, avg_soc, energy_in_wh, energy_out_wh)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id, month) DO UPDATE SET
         avg_soc = excluded.avg_soc,
         energy_in_wh = excluded.energy_in_wh,
         energy_out_wh = excluded.energy_out_wh`
    )
    .run(
      row.device_id,
      row.month,
      row.avg_soc,
      row.energy_in_wh,
      row.energy_out_wh
    );
}

export function queryMonthlyAgg(deviceId: string): MonthlyAggRow[] {
  return getHistoryDb()
    .prepare(
      `SELECT device_id, month, avg_soc, energy_in_wh, energy_out_wh
       FROM monthly_agg
       WHERE device_id = ?
       ORDER BY month ASC`
    )
    .all(deviceId) as unknown as MonthlyAggRow[];
}

export function listSampleDeviceIds(): string[] {
  const rows = getHistoryDb()
    .prepare(`SELECT DISTINCT device_id FROM samples`)
    .all() as unknown as Array<{ device_id: string }>;
  return rows.map((r) => r.device_id);
}

export function querySamplesForDay(deviceId: string, dayStart: number, dayEnd: number): HistorySampleRow[] {
  return querySamples(deviceId, dayStart, dayEnd);
}
