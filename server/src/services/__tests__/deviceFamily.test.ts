/**
 * Unit tests for device family detection
 */

import { describe, it, expect } from 'vitest';
import {
  resolveDeviceFamily,
  familyFromQuotaShape,
  isSmartPlugFamily,
  isPowerStationFamily,
  deviceFamilyLabel,
} from '@ecoflow/shared';

describe('resolveDeviceFamily', () => {
  it('maps D3M1… to delta3MaxPlus', () => {
    expect(resolveDeviceFamily({ sn: 'D3M1ZE1A9H990313' })).toBe('delta3MaxPlus');
  });

  it('maps P351… to delta3Plus', () => {
    expect(resolveDeviceFamily({ sn: 'P351ZEH4PGCC0498' })).toBe('delta3Plus');
  });

  it('maps D3N1… to delta3Max', () => {
    expect(resolveDeviceFamily({ sn: 'D3N1ABCDEF123456' })).toBe('delta3Max');
  });

  it('maps HW52… (Bathroom) to smartPlug', () => {
    expect(resolveDeviceFamily({ sn: 'HW52DH596BD4764' })).toBe('smartPlug');
  });

  it('uses productName when SN prefix is unknown', () => {
    expect(
      resolveDeviceFamily({ sn: 'XXXX123', productName: 'DELTA 3 Max Plus' })
    ).toBe('delta3MaxPlus');
    expect(resolveDeviceFamily({ sn: 'XXXX123', productName: 'Smart Plug' })).toBe('smartPlug');
    expect(resolveDeviceFamily({ sn: 'XXXX123', productName: 'Delta 3 Plus' })).toBe('delta3Plus');
  });

  it('falls back to quota shape', () => {
    expect(
      resolveDeviceFamily({
        sn: 'UNKNOWN',
        quota: { '2_1.switchSta': 1, '2_1.watts': 120 },
      })
    ).toBe('smartPlug');
    expect(
      resolveDeviceFamily({
        sn: 'UNKNOWN',
        quota: { cmsBattSoc: 50, powInSumW: 10 },
      })
    ).toBe('powerStation');
    expect(
      resolveDeviceFamily({
        sn: 'UNKNOWN',
        quota: { 'bmsMaster.soc': 80 },
      })
    ).toBe('powerStation');
  });

  it('returns unknown when nothing matches', () => {
    expect(resolveDeviceFamily({ sn: 'ZZZZ999' })).toBe('unknown');
  });

  it('SN prefix wins over productName', () => {
    expect(
      resolveDeviceFamily({
        sn: 'HW52DH596BD4764',
        productName: 'DELTA 3 Max Plus',
      })
    ).toBe('smartPlug');
  });
});

describe('familyFromQuotaShape', () => {
  it('detects nested MQTT plug param', () => {
    expect(familyFromQuotaShape({ switchSta: 1, watts: 50, volt: 230 })).toBe('smartPlug');
  });
});

describe('family helpers', () => {
  it('classifies plug vs power station', () => {
    expect(isSmartPlugFamily('smartPlug')).toBe(true);
    expect(isSmartPlugFamily('delta3Plus')).toBe(false);
    expect(isPowerStationFamily('delta3MaxPlus')).toBe(true);
    expect(isPowerStationFamily('delta3Plus')).toBe(true);
    expect(isPowerStationFamily('smartPlug')).toBe(false);
  });

  it('maps family to display labels', () => {
    expect(deviceFamilyLabel('delta3MaxPlus')).toBe('DELTA 3 Max Plus');
    expect(deviceFamilyLabel('delta3Plus')).toBe('Delta 3 Plus');
    expect(deviceFamilyLabel('delta3Max')).toBe('Delta 3 Max');
    expect(deviceFamilyLabel('smartPlug')).toBe('Smart Plug');
    expect(deviceFamilyLabel('powerStation')).toBe('Power Station');
    expect(deviceFamilyLabel('unknown')).toBeUndefined();
  });
});
