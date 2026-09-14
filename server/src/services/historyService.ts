/**
 * History recording, retention, and energy rollups.
 */

import { HISTORY_CONFIG } from '@ecoflow/shared';
import type { EcoflowDeviceStatus } from '../types/ecoflow';
import {
  deleteSamplesOlderThan,
  initHistoryDb,
  insertSample,
  listSampleDeviceIds,
  queryMonthlyAgg,
  querySamples,
  querySamplesForDay,
  upsertDailyAgg,
  upsertMonthlyAgg,
  type HistorySampleRow,
} from './historyDb';
import { readSettings } from './dataFiles';
import { mqttService, type DeviceStatusUpdate } from './mqtt';
import { logger } from '../utils/logger';

export interface RecordSampleInput {
  deviceId: string;
  status: EcoflowDeviceStatus;
  online?: boolean;
  source?: string;
  ts?: number;
}

let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let retentionTimer: ReturnType<typeof setInterval> | null = null;
let rollupTimer: ReturnType<typeof setInterval> | null = null;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function monthKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 7);
}

export function recordSample(input: RecordSampleInput): void {
  const ts = input.ts ?? Date.now();
  const s = input.status;
  const isPlug = Boolean(s.isPlug);

  insertSample({
    device_id: input.deviceId,
    ts,
    battery_level: isPlug ? null : (s.batteryLevel ?? null),
    charge_w: isPlug ? null : (s.chargeRate ?? null),
    discharge_w: isPlug ? null : (s.dischargeRate ?? null),
    plug_w: isPlug
      ? (typeof s.plugWatts === 'number' ? s.plugWatts : null)
      : null,
    online:
      typeof input.online === 'boolean'
        ? input.online
          ? 1
          : 0
        : typeof s.online === 'boolean'
          ? s.online
            ? 1
            : 0
          : null,
    source: input.source ?? null,
  });
}

export function recordSampleFromUpdate(update: DeviceStatusUpdate): void {
  recordSample({
    deviceId: update.deviceSn,
    status: update.status,
    online:
      typeof update.status.online === 'boolean'
        ? update.status.online
        : undefined,
    source: update.source,
    ts: update.timestamp,
  });
}

export function getHistory(
  deviceId: string,
  from: number,
  to: number
): HistorySampleRow[] {
  return querySamples(deviceId, from, to);
}

export function getMonthlyHistory(deviceId: string) {
  return queryMonthlyAgg(deviceId);
}

export function runRetention(rawDays?: number): number {
  const days = rawDays ?? readSettings().retention.rawDays ?? HISTORY_CONFIG.RAW_RETENTION_DAYS;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const deleted = deleteSamplesOlderThan(cutoff);
  if (deleted > 0) {
    logger.info(`History retention: deleted ${deleted} sample(s) older than ${days}d`);
  }
  return deleted;
}

/**
 * Estimate Wh from consecutive samples: W * dt_hours.
 */
function estimateEnergyWh(samples: HistorySampleRow[]): {
  energyIn: number;
  energyOut: number;
  avgSoc: number | null;
  count: number;
} {
  let energyIn = 0;
  let energyOut = 0;
  let socSum = 0;
  let socCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const cur = samples[i];
    if (typeof cur.battery_level === 'number') {
      socSum += cur.battery_level;
      socCount++;
    }
    if (i === 0) continue;
    const prev = samples[i - 1];
    const dtMs = Math.max(0, cur.ts - prev.ts);
    // Cap gap at 10 minutes to avoid huge spikes after downtime
    const dtHours = Math.min(dtMs, 10 * 60 * 1000) / 3_600_000;
    const charge = prev.charge_w ?? 0;
    const discharge = prev.discharge_w ?? 0;
    const plug = prev.plug_w ?? 0;
    energyIn += Math.max(0, charge) * dtHours;
    energyOut += Math.max(0, discharge || plug) * dtHours;
  }

  return {
    energyIn,
    energyOut,
    avgSoc: socCount > 0 ? socSum / socCount : null,
    count: samples.length,
  };
}

export function runDailyRollup(forDay?: string): void {
  const day = forDay ?? dayKey(Date.now() - 60_000);
  const dayStart = Date.parse(`${day}T00:00:00.000Z`);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
  if (Number.isNaN(dayStart)) {
    return;
  }

  const deviceIds = listSampleDeviceIds();
  for (const deviceId of deviceIds) {
    const samples = querySamplesForDay(deviceId, dayStart, dayEnd);
    if (samples.length === 0) continue;
    const { energyIn, energyOut, avgSoc, count } = estimateEnergyWh(samples);
    upsertDailyAgg({
      device_id: deviceId,
      day,
      avg_soc: avgSoc,
      energy_in_wh: Math.round(energyIn * 100) / 100,
      energy_out_wh: Math.round(energyOut * 100) / 100,
      sample_count: count,
    });
  }
  logger.debug(`Daily rollup complete for ${day} (${deviceIds.length} device(s))`);
}

export function runMonthlyRollup(forMonth?: string): void {
  const month = forMonth ?? monthKey(Date.now());
  const monthStart = Date.parse(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(monthStart)) {
    return;
  }
  // Approximate month end: +32 days then clamp to next month start - 1
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthEnd = nextMonth.getTime() - 1;

  const deviceIds = listSampleDeviceIds();
  for (const deviceId of deviceIds) {
    const samples = querySamples(deviceId, monthStart, monthEnd);
    if (samples.length === 0) continue;
    const { energyIn, energyOut, avgSoc } = estimateEnergyWh(samples);
    upsertMonthlyAgg({
      device_id: deviceId,
      month,
      avg_soc: avgSoc,
      energy_in_wh: Math.round(energyIn * 100) / 100,
      energy_out_wh: Math.round(energyOut * 100) / 100,
    });
  }
  logger.debug(`Monthly rollup complete for ${month}`);
}

function snapshotCachedStatuses(): void {
  try {
    mqttService.forEachCachedStatus((update) => {
      recordSampleFromUpdate(update);
    });
  } catch (err) {
    const error = err as Error;
    logger.warn(`History snapshot failed: ${error.message}`);
  }
}

export function startHistoryJobs(): void {
  initHistoryDb();

  if (snapshotTimer) clearInterval(snapshotTimer);
  if (retentionTimer) clearInterval(retentionTimer);
  if (rollupTimer) clearInterval(rollupTimer);

  snapshotTimer = setInterval(
    snapshotCachedStatuses,
    HISTORY_CONFIG.SNAPSHOT_INTERVAL_MS
  );
  retentionTimer = setInterval(() => {
    try {
      runRetention();
    } catch (err) {
      logger.warn(`Retention job failed: ${(err as Error).message}`);
    }
  }, 60 * 60 * 1000);

  rollupTimer = setInterval(
    () => {
      try {
        runDailyRollup();
        runMonthlyRollup();
      } catch (err) {
        logger.warn(`Rollup job failed: ${(err as Error).message}`);
      }
    },
    6 * 60 * 60 * 1000
  );

  // Unref so jobs don't keep process alive in tests if someone forgets stop
  snapshotTimer.unref?.();
  retentionTimer.unref?.();
  rollupTimer.unref?.();

  logger.info('History jobs started (snapshot 60s, retention 1h, rollup 6h)');
}

export function stopHistoryJobs(): void {
  if (snapshotTimer) clearInterval(snapshotTimer);
  if (retentionTimer) clearInterval(retentionTimer);
  if (rollupTimer) clearInterval(rollupTimer);
  snapshotTimer = null;
  retentionTimer = null;
  rollupTimer = null;
}
