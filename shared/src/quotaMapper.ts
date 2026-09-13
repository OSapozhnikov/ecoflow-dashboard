/**
 * Shared Ecoflow quota → device status mapper.
 * Explicit Delta 3 / Delta Pro keys; /10 only for documented 0.1 W fields.
 * Smart Plug: 2_1.switchSta / 2_1.watts (0.1 W) / volt / temp (or nested param without prefix).
 */

export type MappedDeviceStatus = 'charging' | 'discharging' | 'standby';

/** Normalized Smart Plug telemetry (watts already converted from 0.1 W). */
export interface MappedPlugTelemetry {
  switchSta: boolean;
  watts: number;
  volt?: number;
  temp?: number;
}

export interface MappedQuota {
  batteryLevel: number;
  chargeRate: number;
  dischargeRate: number;
  status: MappedDeviceStatus;
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

export interface MapQuotaOptions {
  /**
   * MQTT `consWatt`: positive = charge, negative = discharge (already in W).
   * Takes priority over watt field lookup when non-zero.
   */
  consWatt?: number;
  /**
   * MQTT `watts` / similar output power already in W (not 0.1 W).
   * Used as discharge fallback when no OUTPUT field matched and consWatt is not discharging.
   * Ignored when the payload is detected as a Smart Plug (plug watts use /10).
   */
  watts?: number;
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
  let switchSta = false;
  for (const key of PLUG_SWITCH_KEYS) {
    const raw = findFirstValue(sources, key);
    const parsed = toSwitchSta(raw);
    if (parsed !== undefined) {
      switchSta = parsed;
      matched.switchSta = key;
      break;
    }
  }

  let watts = 0;
  for (const field of PLUG_WATT_FIELDS) {
    // Prefer prefixed key; only use bare `watts` after plug shape is confirmed by caller
    const raw = findFirst(sources, field.key);
    if (raw !== undefined) {
      watts = Math.max(0, field.isTenthWatt ? raw / 10 : raw);
      matched.plugWatts = field.key;
      break;
    }
  }
  watts = Math.max(0, round1(watts));

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
    switchSta,
    watts,
    ...(volt !== undefined ? { volt } : {}),
    ...(temp !== undefined ? { temp } : {}),
  };
}

/**
 * Map raw quota / MQTT payload fields into normalized watts and SOC.
 * Smart Plug payloads also populate `plug` (switch + W/V/temp).
 */
export function mapQuotaData(
  data: Record<string, unknown> | Record<string, unknown>[],
  options: MapQuotaOptions = {}
): MappedQuota {
  const sources = Array.isArray(data) ? data.filter(Boolean) : [data];
  const matched: MappedQuota['matched'] = {};

  const isPlug = detectPlugQuota(sources);
  if (isPlug) {
    const plug = mapPlugTelemetry(sources, matched);
    // Plug has no battery — keep battery fields at zero; status from relay/load
    const status: MappedDeviceStatus =
      plug.switchSta && plug.watts > 0 ? 'discharging' : 'standby';
    return {
      batteryLevel: 0,
      chargeRate: 0,
      dischargeRate: 0,
      status,
      plug,
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

  return {
    batteryLevel,
    chargeRate,
    dischargeRate,
    status,
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
  volt?: number;
  temp?: number;
} {
  if (mapped.plug) {
    return {
      batteryLevel: 0,
      chargeRate: 0,
      dischargeRate: 0,
      status: mapped.status,
      isPlug: true,
      switchSta: mapped.plug.switchSta,
      plugWatts: mapped.plug.watts,
      ...(mapped.plug.volt !== undefined ? { volt: mapped.plug.volt } : {}),
      ...(mapped.plug.temp !== undefined ? { temp: mapped.plug.temp } : {}),
    };
  }

  return {
    batteryLevel: mapped.batteryLevel,
    chargeRate: mapped.chargeRate,
    dischargeRate: mapped.dischargeRate,
    status: mapped.status,
  };
}
