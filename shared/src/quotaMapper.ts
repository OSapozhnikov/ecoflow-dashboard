/**
 * Shared Ecoflow quota → device status mapper.
 * Explicit Delta 3 / Delta Pro keys; /10 only for documented 0.1 W fields.
 */

export type MappedDeviceStatus = 'charging' | 'discharging' | 'standby';

export interface MappedQuota {
  batteryLevel: number;
  chargeRate: number;
  dischargeRate: number;
  status: MappedDeviceStatus;
  /** Which source keys won (for debugging / tests) */
  matched: {
    soc?: string;
    charge?: string;
    discharge?: string;
  };
}

/** Watt field with unit metadata */
export interface WattFieldSpec {
  key: string;
  /** When true, raw API value is in 0.1 W units → convert with /10 */
  isTenthWatt: boolean;
}

/**
 * SOC keys — Delta Pro (`bmsMaster.soc`), Delta 3 / Power Ocean (`soc`, `bpSoc`), aliases.
 * Order = priority.
 */
export const SOC_KEYS: readonly string[] = [
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
 * Ecoflow Open API docs: `bmsMaster.inputWatts` / bare `inputWatts` are 0.1 W.
 * Other aliases are treated as whole watts.
 */
export const INPUT_WATT_FIELDS: readonly WattFieldSpec[] = [
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
 * Ecoflow Open API docs: `bmsMaster.outputWatts` / bare `outputWatts` are 0.1 W.
 */
export const OUTPUT_WATT_FIELDS: readonly WattFieldSpec[] = [
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

export interface MapQuotaOptions {
  /**
   * MQTT `consWatt`: positive = charge, negative = discharge (already in W).
   * Takes priority over watt field lookup when non-zero.
   */
  consWatt?: number;
  /**
   * MQTT `watts` / similar output power already in W (not 0.1 W).
   * Used as discharge fallback when no OUTPUT field matched and consWatt is not discharging.
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

/**
 * Map raw quota / MQTT payload fields into normalized watts and SOC.
 */
export function mapQuotaData(
  data: Record<string, unknown> | Record<string, unknown>[],
  options: MapQuotaOptions = {}
): MappedQuota {
  const sources = Array.isArray(data) ? data.filter(Boolean) : [data];
  const matched: MappedQuota['matched'] = {};

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
  }

  return {
    batteryLevel,
    chargeRate,
    dischargeRate,
    status,
    matched,
  };
}
