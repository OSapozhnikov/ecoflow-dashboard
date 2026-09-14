/**
 * Shared Ecoflow quota → device status mapper.
 * Explicit Delta 3 / Delta Pro keys; /10 only for documented 0.1 W fields.
 * Smart Plug: 2_1.switchSta / 2_1.watts (0.1 W) / volt / temp (or nested param without prefix).
 */

import { PLUG_POWER_CONFIG } from './constants';

export type MappedDeviceStatus = 'charging' | 'discharging' | 'standby';

/** Normalized Smart Plug telemetry (watts already converted from 0.1 W). */
export interface MappedPlugTelemetry {
  /** Present only when a switchSta key was in this payload (do not invent false). */
  switchSta?: boolean;
  /** Present only when a watts key was in this payload (do not invent 0). */
  watts?: number;
  /** True when watts exceeds PLUG_POWER_CONFIG.ANOMALY_WATTS after conversion */
  wattsAnomalous?: boolean;
  volt?: number;
  temp?: number;
}

export interface MappedQuota {
  batteryLevel: number;
  chargeRate: number;
  dischargeRate: number;
  status: MappedDeviceStatus;
  remainingChargeMin?: number;
  remainingDischargeMin?: number;
  /** Present when quota looks like a Smart Plug heartbeat */
  plug?: MappedPlugTelemetry;
  /** Which source keys won (for debugging / tests) */
  matched: {
    soc?: string;
    charge?: string;
    discharge?: string;
    switchSta?: string;
    plugWatts?: string;
    volt?: string;
    temp?: string;
    remainingCharge?: string;
    remainingDischarge?: string;
  };
}

/** Watt field with unit metadata */
export interface WattFieldSpec {
  key: string;
  /** When true, raw API value is in 0.1 W units → convert with /10 */
  isTenthWatt: boolean;
}

/**
 * SOC keys — Delta 3 (`cmsBattSoc`), Delta Pro (`bmsMaster.soc`), aliases.
 * Order = priority.
 */
export const SOC_KEYS: readonly string[] = [
  'cmsBattSoc',
  'cms_batt_soc',
  'bmsMaster.soc',
  'soc',
  'bpSoc',
  'powerBatterySoc',
  'powerBatterySOC',
  'batteryLevel',
  'battery',
  'batteryPercent',
  'batterySoc',
  'batterySOC',
  'socLevel',
  'socPercent',
] as const;

/**
 * Charge / input power fields.
 * Delta 3 `powInSumW` is whole W. Pro `bmsMaster.inputWatts` / bare `inputWatts` are 0.1 W.
 */
export const INPUT_WATT_FIELDS: readonly WattFieldSpec[] = [
  { key: 'powInSumW', isTenthWatt: false },
  { key: 'pow_in_sum_w', isTenthWatt: false },
  { key: 'bmsMaster.inputWatts', isTenthWatt: true },
  { key: 'inputWatts', isTenthWatt: true },
  { key: 'pd.wattsInSum', isTenthWatt: false },
  { key: 'chargePower', isTenthWatt: false },
  { key: 'chargeRate', isTenthWatt: false },
  { key: 'inputPower', isTenthWatt: false },
  { key: 'inPower', isTenthWatt: false },
  { key: 'inWatts', isTenthWatt: false },
  { key: 'inPutWatts', isTenthWatt: false },
  { key: 'pvInputPower', isTenthWatt: false },
  { key: 'acInputPower', isTenthWatt: false },
  { key: 'chargeWatts', isTenthWatt: false },
  { key: 'inPwr', isTenthWatt: false },
] as const;

/**
 * Discharge / output power fields.
 * Delta 3 `powOutSumW` is whole W. Pro `bmsMaster.outputWatts` / bare `outputWatts` are 0.1 W.
 */
export const OUTPUT_WATT_FIELDS: readonly WattFieldSpec[] = [
  { key: 'powOutSumW', isTenthWatt: false },
  { key: 'pow_out_sum_w', isTenthWatt: false },
  { key: 'bmsMaster.outputWatts', isTenthWatt: true },
  { key: 'outputWatts', isTenthWatt: true },
  { key: 'pd.wattsOutSum', isTenthWatt: false },
  { key: 'dischargePower', isTenthWatt: false },
  { key: 'dischargeRate', isTenthWatt: false },
  { key: 'outputPower', isTenthWatt: false },
  { key: 'outPower', isTenthWatt: false },
  { key: 'outWatts', isTenthWatt: false },
  { key: 'outPutWatts', isTenthWatt: false },
  { key: 'acOutputPower', isTenthWatt: false },
  { key: 'dischargeWatts', isTenthWatt: false },
  { key: 'outPwr', isTenthWatt: false },
  { key: 'powerAC', isTenthWatt: false },
  { key: 'powerACSYS', isTenthWatt: false },
] as const;

/** Delta 3 charge/discharge state when both watt fields are 0: 0 idle, 1 discharging, 2 charging */
export const CHG_DSG_STATE_KEYS: readonly string[] = [
  'cmsChgDsgState',
  'cms_chg_dsg_state',
] as const;

/**
 * Smart Plug relay + telemetry keys.
 * REST uses `2_1.*`; MQTT heartbeat often nests bare names under `param`.
 */
export const PLUG_SWITCH_KEYS: readonly string[] = ['2_1.switchSta', 'switchSta'] as const;

/** Plug power — documented as 0.1 W units */
export const PLUG_WATT_FIELDS: readonly WattFieldSpec[] = [
  { key: '2_1.watts', isTenthWatt: true },
  { key: 'watts', isTenthWatt: true },
] as const;

export const PLUG_VOLT_KEYS: readonly string[] = ['2_1.volt', 'volt'] as const;
export const PLUG_TEMP_KEYS: readonly string[] = ['2_1.temp', 'temp'] as const;

/** Delta 3 remaining charge/discharge time (minutes) */
export const REMAINING_CHARGE_KEYS: readonly string[] = [
  'cmsChgRemTime',
  'cms_chg_rem_time',
] as const;

export const REMAINING_DISCHARGE_KEYS: readonly string[] = [
  'cmsDsgRemTime',
  'cms_dsg_rem_time',
] as const;

export interface MapQuotaOptions {
  /**
   * MQTT `consWatt`: positive = charge, negative = discharge.
   * Station path: already whole W. Smart Plug fallback: 0.1 W units (same as
   * `watts` / `2_1.watts`) — mapQuotaData applies /10 for plugs only.
   * Takes priority over watt field lookup when non-zero (stations).
   */
  consWatt?: number;
  /**
   * MQTT `watts` / similar output power already in W (not 0.1 W).
   * Used as discharge fallback when no OUTPUT field matched and consWatt is not discharging.
   * Ignored when the payload is detected as a Smart Plug (plug watts use /10).
   */
  watts?: number;
  /**
   * Force Smart Plug mapping (e.g. SN prefix HW52) even when this message
   * lacks `switchSta` / `2_1.watts` — still reads bare `watts` as 0.1 W.
   */
  forcePlug?: boolean;
  /** Device serial — used by contract engine to resolve a DeviceContract. */
  sn?: string;
  /** Product / model label — secondary contract match when SN is unknown. */
  productName?: string;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

/**
 * Resolve a value by exact key, flat dotted key (`bmsMaster.soc`), or nested path.
 */
export function getFieldRaw(
  data: Record<string, unknown>,
  key: string,
  deep = true
): number | undefined {
  if (key in data) {
    const direct = toNumber(data[key]);
    if (direct !== undefined) {
      return direct;
    }
  }

  // Flat REST keys that contain dots as part of the name are already handled above.
  // Nested object path (MQTT): bmsMaster.soc → data.bmsMaster.soc
  if (key.includes('.')) {
    const parts = key.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in (current as object)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        current = undefined;
        break;
      }
    }
    const nested = toNumber(current);
    if (nested !== undefined) {
      return nested;
    }

    // Suffix match on flat keys: "xxx.soc" when looking for "soc"
    const leaf = parts[parts.length - 1];
    for (const [quotaKey, value] of Object.entries(data)) {
      if (quotaKey === key || quotaKey.endsWith(`.${leaf}`) || quotaKey.endsWith(`.${key}`)) {
        const n = toNumber(value);
        if (n !== undefined) {
          return n;
        }
      }
    }
  }

  if (deep) {
    for (const value of Object.values(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const found = getFieldRaw(value as Record<string, unknown>, key, true);
        if (found !== undefined) {
          return found;
        }
      }
    }
  }

  return undefined;
}

function findFirst(
  sources: Record<string, unknown>[],
  key: string
): number | undefined {
  for (const source of sources) {
    const value = getFieldRaw(source, key, true);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Convert Ecoflow Smart Plug tenth-watt raw value to whole watts.
 * Raw 11270 → 1127 W (missing /10 previously showed ~11270 W in the UI).
 */
export function scalePlugTenthWatts(raw: number): {
  watts: number;
  anomalous: boolean;
} {
  const watts = Math.max(
    0,
    round1(Math.abs(raw) / PLUG_POWER_CONFIG.TENTH_WATT_DIVISOR)
  );
  return {
    watts,
    anomalous: watts > PLUG_POWER_CONFIG.ANOMALY_WATTS,
  };
}

function clampSoc(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function toSwitchSta(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'on') return true;
    if (lower === 'false' || lower === '0' || lower === 'off') return false;
    const n = parseFloat(value);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      return n !== 0;
    }
  }
  return undefined;
}

/**
 * Resolve a non-numeric field (e.g. switchSta as bool/string) by exact, dotted, or nested path.
 */
export function getFieldValue(
  data: Record<string, unknown>,
  key: string,
  deep = true
): unknown {
  if (key in data) {
    return data[key];
  }

  if (key.includes('.')) {
    const parts = key.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in (current as object)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) {
      return current;
    }

    const leaf = parts[parts.length - 1];
    for (const [quotaKey, value] of Object.entries(data)) {
      if (quotaKey === key || quotaKey.endsWith(`.${leaf}`) || quotaKey.endsWith(`.${key}`)) {
        return value;
      }
    }
  }

  if (deep) {
    for (const value of Object.values(data)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const found = getFieldValue(value as Record<string, unknown>, key, true);
        if (found !== undefined) {
          return found;
        }
      }
    }
  }

  return undefined;
}

function findFirstValue(
  sources: Record<string, unknown>[],
  key: string
): unknown {
  for (const source of sources) {
    const value = getFieldValue(source, key, true);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

/**
 * Detect Smart Plug quota shape (REST `2_1.*` or MQTT bare switchSta / 2_1.watts).
 */
export function detectPlugQuota(sources: Record<string, unknown>[]): boolean {
  for (const key of PLUG_SWITCH_KEYS) {
    if (findFirstValue(sources, key) !== undefined) {
      return true;
    }
  }
  // Prefixed plug watts only — bare `watts` alone is too ambiguous (stations use it too)
  if (findFirst(sources, '2_1.watts') !== undefined) {
    return true;
  }
  return false;
}

function mapPlugTelemetry(
  sources: Record<string, unknown>[],
  matched: MappedQuota['matched']
): MappedPlugTelemetry {
  // Docs: switchSta 0/false = off, 1/true = on. Omit when absent — never invent Off.
  let switchSta: boolean | undefined;
  for (const key of PLUG_SWITCH_KEYS) {
    const raw = findFirstValue(sources, key);
    const parsed = toSwitchSta(raw);
    if (parsed !== undefined) {
      switchSta = parsed;
      matched.switchSta = key;
      break;
    }
  }

  // Docs: 2_1.watts / param.watts in 0.1 W. Omit when absent — never invent 0 W.
  let watts: number | undefined;
  let wattsAnomalous: boolean | undefined;
  for (const field of PLUG_WATT_FIELDS) {
    // Prefer prefixed key; only use bare `watts` after plug shape is confirmed by caller
    const raw = findFirst(sources, field.key);
    if (raw !== undefined) {
      if (field.isTenthWatt) {
        const scaled = scalePlugTenthWatts(raw);
        watts = scaled.watts;
        wattsAnomalous = scaled.anomalous;
      } else {
        watts = Math.max(0, round1(raw));
        wattsAnomalous = watts > PLUG_POWER_CONFIG.ANOMALY_WATTS;
      }
      matched.plugWatts = field.key;
      break;
    }
  }

  let volt: number | undefined;
  for (const key of PLUG_VOLT_KEYS) {
    const raw = findFirst(sources, key);
    if (raw !== undefined) {
      volt = raw;
      matched.volt = key;
      break;
    }
  }

  let temp: number | undefined;
  for (const key of PLUG_TEMP_KEYS) {
    const raw = findFirst(sources, key);
    if (raw !== undefined) {
      temp = raw;
      matched.temp = key;
      break;
    }
  }

  return {
    ...(switchSta !== undefined ? { switchSta } : {}),
    ...(watts !== undefined ? { watts } : {}),
    ...(wattsAnomalous ? { wattsAnomalous: true } : {}),
    ...(volt !== undefined ? { volt } : {}),
    ...(temp !== undefined ? { temp } : {}),
  };
}

/**
 * Hardcoded key-list mapper (legacy / fallback when no DeviceContract matches).
 * Prefer {@link mapQuotaData} from `./mapQuotaData` which tries the contract engine first.
 */
export function mapQuotaDataHardcoded(
  data: Record<string, unknown> | Record<string, unknown>[],
  options: MapQuotaOptions = {}
): MappedQuota {
  const sources = Array.isArray(data) ? data.filter(Boolean) : [data];
  const matched: MappedQuota['matched'] = {};

  const isPlug = detectPlugQuota(sources) || Boolean(options.forcePlug);
  if (isPlug) {
    const plug = mapPlugTelemetry(sources, matched);
    let plugWatts = plug.watts;
    let plugWattsAnomalous = plug.wattsAnomalous;

    // Pre-refactor UI showed MQTT `options.watts` via dischargeRate. Restore that
    // into plugWatts when PLUG_WATT_FIELDS missed (partial / oddly keyed payloads).
    if (plugWatts === undefined) {
      const { consWatt, watts: optsWatts } = options;
      if (typeof optsWatts === 'number') {
        // Same unit as PLUG_WATT_FIELDS: Ecoflow plug watts are 0.1 W
        const scaled = scalePlugTenthWatts(optsWatts);
        plugWatts = scaled.watts;
        plugWattsAnomalous = scaled.anomalous;
        matched.plugWatts = 'options.watts';
      } else if (typeof consWatt === 'number' && consWatt !== 0) {
        // Plug MQTT consWatt uses the same 0.1 W units as `watts` (unlike
        // station consWatt, which is already whole W). Without /10 the UI
        // spikes ~10× (e.g. raw 11270 → false 11270 W instead of 1127 W).
        const scaled = scalePlugTenthWatts(consWatt);
        plugWatts = scaled.watts;
        plugWattsAnomalous = scaled.anomalous;
        matched.plugWatts = 'consWatt';
      } else {
        for (const field of OUTPUT_WATT_FIELDS) {
          const raw = findFirst(sources, field.key);
          if (raw !== undefined) {
            if (field.isTenthWatt) {
              const scaled = scalePlugTenthWatts(raw);
              plugWatts = scaled.watts;
              plugWattsAnomalous = scaled.anomalous;
            } else {
              plugWatts = Math.max(0, round1(raw));
              plugWattsAnomalous = plugWatts > PLUG_POWER_CONFIG.ANOMALY_WATTS;
            }
            matched.plugWatts = field.key;
            break;
          }
        }
        if (plugWatts === undefined) {
          for (const field of INPUT_WATT_FIELDS) {
            const raw = findFirst(sources, field.key);
            if (raw !== undefined) {
              if (field.isTenthWatt) {
                const scaled = scalePlugTenthWatts(raw);
                plugWatts = scaled.watts;
                plugWattsAnomalous = scaled.anomalous;
              } else {
                plugWatts = Math.max(0, round1(raw));
                plugWattsAnomalous = plugWatts > PLUG_POWER_CONFIG.ANOMALY_WATTS;
              }
              matched.plugWatts = field.key;
              break;
            }
          }
        }
      }
    }

    const plugResolved: MappedPlugTelemetry = {
      ...plug,
      ...(plugWatts !== undefined ? { watts: plugWatts } : {}),
      ...(plugWattsAnomalous ? { wattsAnomalous: true } : {}),
    };

    // Plug has no battery — keep battery fields at zero; status from relay/load
    const status: MappedDeviceStatus =
      plugResolved.switchSta === true &&
      typeof plugResolved.watts === 'number' &&
      plugResolved.watts > 0
        ? 'discharging'
        : 'standby';
    return {
      batteryLevel: 0,
      chargeRate: 0,
      dischargeRate: 0,
      status,
      plug: plugResolved,
      matched,
    };
  }

  let batteryLevel = 0;
  for (const key of SOC_KEYS) {
    const raw = findFirst(sources, key);
    if (raw !== undefined) {
      batteryLevel = clampSoc(raw);
      matched.soc = key;
      break;
    }
  }

  let chargeRate = 0;
  let dischargeRate = 0;

  const { consWatt, watts } = options;

  if (typeof consWatt === 'number' && consWatt !== 0) {
    if (consWatt > 0) {
      chargeRate = Math.max(0, consWatt);
      matched.charge = 'consWatt';
    } else {
      dischargeRate = Math.max(0, Math.abs(consWatt));
      matched.discharge = 'consWatt';
    }
  }

  if (chargeRate === 0) {
    for (const field of INPUT_WATT_FIELDS) {
      const raw = findFirst(sources, field.key);
      if (raw !== undefined && raw !== 0) {
        chargeRate = Math.max(0, field.isTenthWatt ? raw / 10 : raw);
        matched.charge = field.key;
        break;
      }
    }
  }

  if (dischargeRate === 0) {
    for (const field of OUTPUT_WATT_FIELDS) {
      const raw = findFirst(sources, field.key);
      if (raw !== undefined && raw !== 0) {
        dischargeRate = Math.max(0, field.isTenthWatt ? raw / 10 : raw);
        matched.discharge = field.key;
        break;
      }
    }
  }

  if (dischargeRate === 0 && typeof watts === 'number' && watts > 0) {
    dischargeRate = watts;
    matched.discharge = 'watts';
  }

  chargeRate = Math.max(0, round1(chargeRate));
  dischargeRate = Math.max(0, round1(dischargeRate));

  let status: MappedDeviceStatus = 'standby';
  if (chargeRate > 0) {
    status = 'charging';
  } else if (dischargeRate > 0) {
    status = 'discharging';
  } else {
    // Delta 3: cmsChgDsgState when both W are 0 (0 idle, 1 discharging, 2 charging)
    for (const key of CHG_DSG_STATE_KEYS) {
      const raw = findFirst(sources, key);
      if (raw === undefined) {
        continue;
      }
      if (raw === 2) {
        status = 'charging';
      } else if (raw === 1) {
        status = 'discharging';
      }
      break;
    }
  }

  let remainingChargeMin: number | undefined;
  for (const key of REMAINING_CHARGE_KEYS) {
    const raw = findFirst(sources, key);
    if (raw !== undefined && raw >= 0) {
      remainingChargeMin = Math.round(raw);
      matched.remainingCharge = key;
      break;
    }
  }

  let remainingDischargeMin: number | undefined;
  for (const key of REMAINING_DISCHARGE_KEYS) {
    const raw = findFirst(sources, key);
    if (raw !== undefined && raw >= 0) {
      remainingDischargeMin = Math.round(raw);
      matched.remainingDischarge = key;
      break;
    }
  }

  return {
    batteryLevel,
    chargeRate,
    dischargeRate,
    status,
    ...(remainingChargeMin !== undefined ? { remainingChargeMin } : {}),
    ...(remainingDischargeMin !== undefined ? { remainingDischargeMin } : {}),
    matched,
  };
}

/**
 * Flatten mapped quota into status fields used by MQTT cache / REST responses.
 * Plug payloads set `isPlug` + switch/power and leave battery at 0.
 */
export function toDeviceStatusFields(mapped: MappedQuota): {
  batteryLevel: number;
  chargeRate: number;
  dischargeRate: number;
  status: MappedDeviceStatus;
  isPlug?: boolean;
  switchSta?: boolean;
  plugWatts?: number;
  plugWattsAnomalous?: boolean;
  volt?: number;
  temp?: number;
  remainingChargeMin?: number;
  remainingDischargeMin?: number;
} {
  if (mapped.plug) {
    return {
      batteryLevel: 0,
      chargeRate: 0,
      dischargeRate: 0,
      status: mapped.status,
      isPlug: true,
      ...(mapped.plug.switchSta !== undefined ? { switchSta: mapped.plug.switchSta } : {}),
      ...(mapped.plug.watts !== undefined ? { plugWatts: mapped.plug.watts } : {}),
      ...(mapped.plug.wattsAnomalous ? { plugWattsAnomalous: true } : {}),
      ...(mapped.plug.volt !== undefined ? { volt: mapped.plug.volt } : {}),
      ...(mapped.plug.temp !== undefined ? { temp: mapped.plug.temp } : {}),
    };
  }

  return {
    batteryLevel: mapped.batteryLevel,
    chargeRate: mapped.chargeRate,
    dischargeRate: mapped.dischargeRate,
    status: mapped.status,
    ...(mapped.remainingChargeMin !== undefined
      ? { remainingChargeMin: mapped.remainingChargeMin }
      : {}),
    ...(mapped.remainingDischargeMin !== undefined
      ? { remainingDischargeMin: mapped.remainingDischargeMin }
      : {}),
  };
}
