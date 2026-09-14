/**
 * Declarative device contract engine.
 * Contracts mirror quotaMapper field tables for known SN/product families.
 * mapQuotaData prefers a resolved contract when one matches; otherwise falls back
 * to the hardcoded key lists.
 */

import { z } from 'zod';
import { PLUG_POWER_CONFIG } from './constants';
import {
  getFieldRaw,
  getFieldValue,
  scalePlugTenthWatts,
  extractPortsAndLimits,
  type MappedDeviceStatus,
  type MappedPlugTelemetry,
  type MappedQuota,
  type MapQuotaOptions,
} from './quotaMapper';

import delta3MaxPlus from './contracts/delta3-max-plus.json';
import delta3Plus from './contracts/delta3-plus.json';
import smartPlug from './contracts/smart-plug.json';

export const ContractFieldTargetSchema = z.enum([
  'soc',
  'charge',
  'discharge',
  'switchSta',
  'plugWatts',
  'volt',
  'temp',
  'runTime',
  'remainingCharge',
  'remainingDischarge',
  'chgDsgState',
  'acIn',
  'pv',
  'pv2',
  'dc12v',
  'typec1',
  'typec2',
  'typec3',
  'qcusb1',
  'qcusb2',
  'maxChargeSoc',
  'minDischargeSoc',
  'backupReserveSoc',
  'energyBackupEn',
]);

export type ContractFieldTarget = z.infer<typeof ContractFieldTargetSchema>;

export const ContractFieldSchema = z.object({
  path: z.string().min(1),
  target: ContractFieldTargetSchema,
  /** Multiplier applied to raw numeric value (e.g. 0.1 for tenth-watt fields). */
  scale: z.number().finite().optional(),
});

export type ContractField = z.infer<typeof ContractFieldSchema>;

export const DeviceContractCapabilitiesSchema = z.object({
  battery: z.boolean().optional(),
  plug: z.boolean().optional(),
  remainingTime: z.boolean().optional(),
  ports: z.boolean().optional(),
  limits: z.boolean().optional(),
});

export const DeviceContractSchema = z.object({
  id: z.string().min(1),
  match: z.object({
    snPrefixes: z.array(z.string()).default([]),
    productSubstrings: z.array(z.string()).default([]),
  }),
  capabilities: DeviceContractCapabilitiesSchema.default({}),
  fields: z.array(ContractFieldSchema).min(1),
});

export type DeviceContract = z.infer<typeof DeviceContractSchema>;

export interface ResolveContractInput {
  sn?: string | null;
  productName?: string | null;
}

let registeredContracts: DeviceContract[] = [];

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Replace the in-memory contract registry (restart-only; no hot reload).
 */
export function registerContracts(contracts: DeviceContract[]): void {
  registeredContracts = contracts.map((c) => DeviceContractSchema.parse(c));
}

/** Current registered contracts (copy). */
export function getRegisteredContracts(): DeviceContract[] {
  return [...registeredContracts];
}

export function getBuiltinContracts(): DeviceContract[] {
  return [
    DeviceContractSchema.parse(delta3MaxPlus),
    DeviceContractSchema.parse(delta3Plus),
    DeviceContractSchema.parse(smartPlug),
  ];
}

/**
 * Resolve the best matching contract. Priority: SN prefix → product substring.
 * First match wins within each stage (registration order).
 */
export function resolveContract(input: ResolveContractInput): DeviceContract | undefined {
  const sn = (input.sn ?? '').trim().toUpperCase();
  if (sn) {
    for (const contract of registeredContracts) {
      for (const prefix of contract.match.snPrefixes) {
        if (prefix && sn.startsWith(prefix.toUpperCase())) {
          return contract;
        }
      }
    }
  }

  const product = normalize(input.productName);
  if (product) {
    for (const contract of registeredContracts) {
      for (const substr of contract.match.productSubstrings) {
        if (substr && product.includes(normalize(substr))) {
          return contract;
        }
      }
    }
  }

  return undefined;
}

function findFirstRaw(
  sources: Record<string, unknown>[],
  path: string
): number | undefined {
  for (const source of sources) {
    const value = getFieldRaw(source, path, true);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function findFirstValue(
  sources: Record<string, unknown>[],
  path: string
): unknown {
  for (const source of sources) {
    const value = getFieldValue(source, path, true);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampSoc(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function applyScale(raw: number, scale: number | undefined): number {
  if (scale === undefined || scale === 1) {
    return raw;
  }
  return raw * scale;
}

function firstFieldOfTarget(
  contract: DeviceContract,
  target: ContractFieldTarget,
  sources: Record<string, unknown>[]
): { field: ContractField; raw: number } | undefined {
  for (const field of contract.fields) {
    if (field.target !== target) continue;
    const raw = findFirstRaw(sources, field.path);
    if (raw !== undefined) {
      return { field, raw };
    }
  }
  return undefined;
}

function mapPlugWithContract(
  contract: DeviceContract,
  sources: Record<string, unknown>[],
  options: MapQuotaOptions
): MappedQuota {
  const matched: MappedQuota['matched'] = {};
  const plug: MappedPlugTelemetry = {};

  for (const field of contract.fields) {
    if (field.target === 'switchSta' && plug.switchSta === undefined) {
      const raw = findFirstValue(sources, field.path);
      const parsed = toSwitchSta(raw);
      if (parsed !== undefined) {
        plug.switchSta = parsed;
        matched.switchSta = field.path;
      }
      continue;
    }

    if (field.target === 'plugWatts' && plug.watts === undefined) {
      const raw = findFirstRaw(sources, field.path);
      if (raw === undefined) continue;
      const scale = field.scale ?? 1;
      // Tenth-watt fields use shared scaler (anomaly detection + abs)
      if (scale === 0.1 || scale === 1 / PLUG_POWER_CONFIG.TENTH_WATT_DIVISOR) {
        const scaled = scalePlugTenthWatts(raw);
        plug.watts = scaled.watts;
        if (scaled.anomalous) plug.wattsAnomalous = true;
      } else {
        const watts = Math.max(0, round1(applyScale(raw, scale)));
        plug.watts = watts;
        if (watts > PLUG_POWER_CONFIG.ANOMALY_WATTS) plug.wattsAnomalous = true;
      }
      matched.plugWatts = field.path;
      continue;
    }

    if (field.target === 'volt' && plug.volt === undefined) {
      const raw = findFirstRaw(sources, field.path);
      if (raw !== undefined) {
        plug.volt = raw;
        matched.volt = field.path;
      }
      continue;
    }

    if (field.target === 'temp' && plug.temp === undefined) {
      const raw = findFirstRaw(sources, field.path);
      if (raw !== undefined) {
        plug.temp = raw;
        matched.temp = field.path;
      }
      continue;
    }

    if (field.target === 'runTime' && plug.runTimeSec === undefined) {
      const raw = findFirstRaw(sources, field.path);
      if (raw !== undefined && raw >= 0) {
        plug.runTimeSec = Math.round(raw);
        matched.runTime = field.path;
      }
    }
  }

  // Fallbacks mirroring mapQuotaData plug path (options.watts / consWatt as 0.1 W)
  if (plug.watts === undefined) {
    const { consWatt, watts: optsWatts } = options;
    if (typeof optsWatts === 'number') {
      const scaled = scalePlugTenthWatts(optsWatts);
      plug.watts = scaled.watts;
      if (scaled.anomalous) plug.wattsAnomalous = true;
      matched.plugWatts = 'options.watts';
    } else if (typeof consWatt === 'number' && consWatt !== 0) {
      const scaled = scalePlugTenthWatts(consWatt);
      plug.watts = scaled.watts;
      if (scaled.anomalous) plug.wattsAnomalous = true;
      matched.plugWatts = 'consWatt';
    }
  }

  const status: MappedDeviceStatus =
    plug.switchSta === true && typeof plug.watts === 'number' && plug.watts > 0
      ? 'discharging'
      : 'standby';

  return {
    batteryLevel: 0,
    chargeRate: 0,
    dischargeRate: 0,
    status,
    plug,
    matched,
  };
}

function mapStationWithContract(
  contract: DeviceContract,
  sources: Record<string, unknown>[],
  options: MapQuotaOptions
): MappedQuota {
  const matched: MappedQuota['matched'] = {};

  let batteryLevel = 0;
  const socHit = firstFieldOfTarget(contract, 'soc', sources);
  if (socHit) {
    batteryLevel = clampSoc(applyScale(socHit.raw, socHit.field.scale));
    matched.soc = socHit.field.path;
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
    const hit = firstFieldOfTarget(contract, 'charge', sources);
    if (hit && hit.raw !== 0) {
      chargeRate = Math.max(0, applyScale(hit.raw, hit.field.scale));
      matched.charge = hit.field.path;
    }
  }

  if (dischargeRate === 0) {
    const hit = firstFieldOfTarget(contract, 'discharge', sources);
    if (hit && hit.raw !== 0) {
      dischargeRate = Math.max(0, applyScale(hit.raw, hit.field.scale));
      matched.discharge = hit.field.path;
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
    const stateHit = firstFieldOfTarget(contract, 'chgDsgState', sources);
    if (stateHit) {
      if (stateHit.raw === 2) status = 'charging';
      else if (stateHit.raw === 1) status = 'discharging';
    }
  }

  let remainingChargeMin: number | undefined;
  let remainingDischargeMin: number | undefined;

  if (contract.capabilities.remainingTime !== false) {
    const chg = firstFieldOfTarget(contract, 'remainingCharge', sources);
    if (chg && chg.raw >= 0) {
      remainingChargeMin = Math.round(applyScale(chg.raw, chg.field.scale));
      matched.remainingCharge = chg.field.path;
    }
    const dsg = firstFieldOfTarget(contract, 'remainingDischarge', sources);
    if (dsg && dsg.raw >= 0) {
      remainingDischargeMin = Math.round(applyScale(dsg.raw, dsg.field.scale));
      matched.remainingDischarge = dsg.field.path;
    }
  }

  // Ports / limits: always extract from known Delta 3 keys when present
  // (list paths + scalars). Contract scalar targets remain for documentation.
  const { ports, limits } =
    contract.capabilities.ports === false && contract.capabilities.limits === false
      ? {}
      : extractPortsAndLimits(sources, matched);

  return {
    batteryLevel,
    chargeRate,
    dischargeRate,
    status,
    ...(remainingChargeMin !== undefined ? { remainingChargeMin } : {}),
    ...(remainingDischargeMin !== undefined ? { remainingDischargeMin } : {}),
    ...(ports ? { ports } : {}),
    ...(limits ? { limits } : {}),
    matched,
  };
}

/**
 * Map quota/MQTT sources using a device contract's field list and capabilities.
 */
export function mapPayloadWithContract(
  contract: DeviceContract,
  sources: Record<string, unknown> | Record<string, unknown>[],
  options: MapQuotaOptions = {}
): MappedQuota {
  const list = Array.isArray(sources) ? sources.filter(Boolean) : [sources];
  const isPlug =
    Boolean(contract.capabilities.plug) || Boolean(options.forcePlug);

  if (isPlug) {
    return mapPlugWithContract(contract, list, options);
  }
  return mapStationWithContract(contract, list, options);
}

// Built-in contracts registered at module load so resolveContract always hits known families.
registerContracts(getBuiltinContracts());
