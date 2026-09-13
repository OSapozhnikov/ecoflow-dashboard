/**
 * Device family detection from SN prefix, product name, or quota shape.
 * Used by UI to branch power-station vs Smart Plug presentation.
 */

export type DeviceFamily =
  | 'delta3MaxPlus'
  | 'delta3Plus'
  | 'delta3Max'
  | 'smartPlug'
  | 'powerStation'
  | 'unknown';

export interface ResolveDeviceFamilyInput {
  sn?: string | null;
  productName?: string | null;
  deviceType?: string | null;
  /** Raw quota / MQTT params (optional shape fallback) */
  quota?: Record<string, unknown> | null;
}

const SN_PREFIX_FAMILIES: ReadonlyArray<{ prefix: string; family: DeviceFamily }> = [
  { prefix: 'D3M1', family: 'delta3MaxPlus' },
  { prefix: 'P351', family: 'delta3Plus' },
  { prefix: 'D3N1', family: 'delta3Max' },
  { prefix: 'HW52', family: 'smartPlug' },
];

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function familyFromProductLabel(label: string): DeviceFamily | undefined {
  if (!label) return undefined;
  if (label.includes('smart plug') || label.includes('smartplug')) {
    return 'smartPlug';
  }
  // More specific names before shorter ones
  if (label.includes('delta 3 max plus') || label.includes('delta3 max plus')) {
    return 'delta3MaxPlus';
  }
  if (label.includes('delta 3 plus') || label.includes('delta3 plus')) {
    return 'delta3Plus';
  }
  if (label.includes('delta 3 max') || label.includes('delta3 max')) {
    return 'delta3Max';
  }
  if (label.includes('delta pro') || label.includes('power station')) {
    return 'powerStation';
  }
  return undefined;
}

function hasKeyOrNested(quota: Record<string, unknown>, key: string): boolean {
  if (key in quota) return true;
  if (key.includes('.')) {
    const parts = key.split('.');
    let current: unknown = quota;
    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in (current as object)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined) return true;
  }
  // Flat REST keys and deep nested objects
  for (const [k, v] of Object.entries(quota)) {
    if (k === key || k.endsWith(`.${key.split('.').pop()}`)) return true;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      if (hasKeyOrNested(v as Record<string, unknown>, key)) return true;
    }
  }
  return false;
}

/**
 * Infer family from quota vocabulary when SN/product are missing or ambiguous.
 */
export function familyFromQuotaShape(quota: Record<string, unknown>): DeviceFamily | undefined {
  const plugHints = ['2_1.switchSta', '2_1.watts', 'switchSta'];
  if (plugHints.some((k) => hasKeyOrNested(quota, k))) {
    // Prefer plug when 2_1 / switchSta present even if unrelated keys exist
    return 'smartPlug';
  }
  if (
    hasKeyOrNested(quota, 'cmsBattSoc') ||
    hasKeyOrNested(quota, 'cms_batt_soc') ||
    hasKeyOrNested(quota, 'powInSumW') ||
    hasKeyOrNested(quota, 'powOutSumW')
  ) {
    return 'powerStation';
  }
  if (hasKeyOrNested(quota, 'bmsMaster.soc') || hasKeyOrNested(quota, 'bmsMaster')) {
    return 'powerStation';
  }
  return undefined;
}

/**
 * Resolve device family. Priority: SN prefix → product/device type → quota shape.
 */
export function resolveDeviceFamily(input: ResolveDeviceFamilyInput): DeviceFamily {
  const sn = (input.sn ?? '').trim().toUpperCase();
  for (const { prefix, family } of SN_PREFIX_FAMILIES) {
    if (sn.startsWith(prefix)) {
      return family;
    }
  }

  const fromProduct =
    familyFromProductLabel(normalizeLabel(input.productName)) ??
    familyFromProductLabel(normalizeLabel(input.deviceType));
  if (fromProduct) {
    return fromProduct;
  }

  if (input.quota && typeof input.quota === 'object') {
    const fromQuota = familyFromQuotaShape(input.quota);
    if (fromQuota) {
      return fromQuota;
    }
  }

  return 'unknown';
}

export function isSmartPlugFamily(family: DeviceFamily): boolean {
  return family === 'smartPlug';
}

/** Power stations share battery SOC / in-out W UI (Max, Plus, Max Plus, Pro, generic). */
export function isPowerStationFamily(family: DeviceFamily): boolean {
  return (
    family === 'delta3MaxPlus' ||
    family === 'delta3Plus' ||
    family === 'delta3Max' ||
    family === 'powerStation'
  );
}

const FAMILY_DISPLAY_LABELS: Record<DeviceFamily, string | undefined> = {
  delta3MaxPlus: 'DELTA 3 Max Plus',
  delta3Plus: 'Delta 3 Plus',
  delta3Max: 'Delta 3 Max',
  smartPlug: 'Smart Plug',
  powerStation: 'Power Station',
  unknown: undefined,
};

/** Human-readable model label for a resolved family (SN-prefix fallback when API omits productName). */
export function deviceFamilyLabel(family: DeviceFamily): string | undefined {
  return FAMILY_DISPLAY_LABELS[family];
}
