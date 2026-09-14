/**
 * Unit tests for shared contract engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeviceContractSchema,
  getBuiltinContracts,
  mapPayloadWithContract,
  mapQuotaData,
  registerContracts,
  resolveContract,
  toDeviceStatusFields,
} from '@ecoflow/shared';

describe('contractEngine', () => {
  beforeEach(() => {
    registerContracts(getBuiltinContracts());
  });

  it('parses builtin contracts with DeviceContractSchema', () => {
    const builtins = getBuiltinContracts();
    expect(builtins.map((c) => c.id).sort()).toEqual([
      'delta3-max-plus',
      'delta3-plus',
      'smart-plug',
    ]);
    for (const c of builtins) {
      expect(() => DeviceContractSchema.parse(c)).not.toThrow();
    }
  });

  it('resolves contracts by SN prefix', () => {
    expect(resolveContract({ sn: 'D3M1ABCDEF' })?.id).toBe('delta3-max-plus');
    expect(resolveContract({ sn: 'P351XYZ' })?.id).toBe('delta3-plus');
    expect(resolveContract({ sn: 'HW52PLUG01' })?.id).toBe('smart-plug');
    expect(resolveContract({ sn: 'UNKNOWN123' })).toBeUndefined();
  });

  it('resolves by product substring when SN missing', () => {
    expect(
      resolveContract({ productName: 'EcoFlow DELTA 3 Max Plus' })?.id
    ).toBe('delta3-max-plus');
    expect(resolveContract({ productName: 'Smart Plug' })?.id).toBe('smart-plug');
  });

  it('maps Delta 3 Max Plus fixture via contract', () => {
    const contract = resolveContract({ sn: 'D3M1TEST001' });
    expect(contract).toBeDefined();
    const mapped = mapPayloadWithContract(contract!, {
      cmsBattSoc: 67,
      powInSumW: 120,
      powOutSumW: 0,
      cmsChgDsgState: 2,
      cmsChgRemTime: 90,
      cmsDsgRemTime: 200,
    });

    expect(mapped.batteryLevel).toBe(67);
    expect(mapped.chargeRate).toBe(120);
    expect(mapped.dischargeRate).toBe(0);
    expect(mapped.status).toBe('charging');
    expect(mapped.remainingChargeMin).toBe(90);
    expect(mapped.remainingDischargeMin).toBe(200);
    expect(mapped.matched.soc).toBe('cmsBattSoc');
    expect(mapped.matched.charge).toBe('powInSumW');
  });

  it('maps Smart Plug fixture via contract with /10 watts', () => {
    const contract = resolveContract({ sn: 'HW52BATHROOM' });
    const mapped = mapPayloadWithContract(contract!, {
      '2_1.switchSta': 1,
      '2_1.watts': 11400,
      '2_1.volt': 230,
    });

    expect(mapped.plug?.switchSta).toBe(true);
    expect(mapped.plug?.watts).toBe(1140);
    expect(mapped.plug?.volt).toBe(230);
    expect(mapped.status).toBe('discharging');
    expect(toDeviceStatusFields(mapped).plugWatts).toBe(1140);
  });

  it('mapQuotaData uses contract when sn is provided', () => {
    const result = mapQuotaData(
      { cmsBattSoc: 50, powInSumW: 0, powOutSumW: 300 },
      { sn: 'P351DEVICE' }
    );
    expect(result.batteryLevel).toBe(50);
    expect(result.dischargeRate).toBe(300);
    expect(result.matched.discharge).toBe('powOutSumW');
  });

  it('mapQuotaData falls back to hardcoded for unknown SN', () => {
    const result = mapQuotaData({
      'bmsMaster.soc': '80',
      'bmsMaster.inputWatts': '100', // 10 W
    });
    expect(result.batteryLevel).toBe(80);
    expect(result.chargeRate).toBe(10);
    expect(result.matched.soc).toBe('bmsMaster.soc');
  });
});
