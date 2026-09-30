/**
 * Settings + locations JSON persistence under DATA_DIR.
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { HISTORY_CONFIG, BATTERY_CONFIG, PLUG_POWER_CONFIG } from '@ecoflow/shared';
import { getDataDir } from './dataDir';
import { logger } from '../utils/logger';

export const SettingsSchema = z.object({
  telegram: z
    .object({
      botToken: z.string().default(''),
      chatId: z.string().default(''),
    })
    .default({ botToken: '', chatId: '' }),
  thresholds: z
    .object({
      lowSocPercent: z.number().min(0).max(100).default(BATTERY_CONFIG.LOW_BATTERY_THRESHOLD),
      offlineAfterMinutes: z.number().positive().default(15),
      plugWattsAnomalyMax: z.number().positive().default(PLUG_POWER_CONFIG.ANOMALY_WATTS),
    })
    .default({
      lowSocPercent: BATTERY_CONFIG.LOW_BATTERY_THRESHOLD,
      offlineAfterMinutes: 15,
      plugWattsAnomalyMax: PLUG_POWER_CONFIG.ANOMALY_WATTS,
    }),
  retention: z
    .object({
      rawDays: z.number().int().positive().default(HISTORY_CONFIG.RAW_RETENTION_DAYS),
      aggregateMonths: z
        .number()
        .int()
        .positive()
        .default(HISTORY_CONFIG.AGGREGATE_RETENTION_MONTHS),
    })
    .default({
      rawDays: HISTORY_CONFIG.RAW_RETENTION_DAYS,
      aggregateMonths: HISTORY_CONFIG.AGGREGATE_RETENTION_MONTHS,
    }),
  /** Serial numbers excluded from MQTT/REST monitoring, history, and alerts */
  disabledDeviceIds: z.array(z.string()).default([]),
});

export type AppSettings = z.infer<typeof SettingsSchema>;

export function isDeviceDisabled(deviceSn: string): boolean {
  if (!deviceSn) return false;
  return readSettings().disabledDeviceIds.includes(deviceSn);
}

export const LocationsSchema = z.object({
  locations: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        deviceIds: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

export type LocationsFile = z.infer<typeof LocationsSchema>;

const DEFAULT_SETTINGS: AppSettings = SettingsSchema.parse({});
const DEFAULT_LOCATIONS: LocationsFile = LocationsSchema.parse({ locations: [] });

function settingsPath(): string {
  return path.join(getDataDir(), 'settings.json');
}

function locationsPath(): string {
  return path.join(getDataDir(), 'locations.json');
}

function readJsonFile<T>(filePath: string, fallback: T, parse: (raw: unknown) => T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parse(raw);
  } catch (err) {
    const error = err as Error;
    logger.warn(`Failed to read ${filePath}: ${error.message}`);
    return fallback;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

export function readSettings(): AppSettings {
  return readJsonFile(settingsPath(), DEFAULT_SETTINGS, (raw) =>
    SettingsSchema.parse(raw)
  );
}

export function writeSettings(partial: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const merged = SettingsSchema.parse({
    telegram: { ...current.telegram, ...partial.telegram },
    thresholds: { ...current.thresholds, ...partial.thresholds },
    retention: { ...current.retention, ...partial.retention },
    disabledDeviceIds:
      partial.disabledDeviceIds !== undefined
        ? partial.disabledDeviceIds
        : current.disabledDeviceIds,
  });
  writeJsonFile(settingsPath(), merged);
  return merged;
}

export function readLocations(): LocationsFile {
  return readJsonFile(locationsPath(), DEFAULT_LOCATIONS, (raw) =>
    LocationsSchema.parse(raw)
  );
}

export function writeLocations(data: LocationsFile): LocationsFile {
  const parsed = LocationsSchema.parse(data);
  writeJsonFile(locationsPath(), parsed);
  return parsed;
}
