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

  it('maps ports and limits for D3M1 live-style fixture', () => {
    const mapped = mapQuotaData(
      {
        cmsBattSoc: 89,
        powInSumW: 246,
        powOutSumW: 241,
        powGetAcIn: 246,
        powGetAcOutList: { powGetAcOutItem: [-241, 0, 0, 0, 0] },
        powGetPv: 0,
        powGetPv2: 0,
        powGet12v: 0,
        powGetTypec1: 0,
        cmsMaxChgSoc: 90,
        cmsMinDsgSoc: 0,
        backupReverseSoc: 50,
        energyBackupEn: false,
        cmsChgRemTime: 12927,
        cmsDsgRemTime: 14101,
      },
      { sn: 'D3M1ZE1A9H990313' }
    );

    expect(mapped.ports?.acInW).toBe(246);
    expect(mapped.ports?.acOutW).toBe(241);
    expect(mapped.ports?.acOutLinesW?.[0]).toBe(241);
    expect(mapped.ports?.pvW).toBe(0);
    expect(mapped.limits?.maxChargeSoc).toBe(90);
    expect(mapped.limits?.minDischargeSoc).toBe(0);
    expect(mapped.limits?.backupReserveSoc).toBe(50);
    expect(mapped.limits?.energyBackupEnabled).toBe(false);

    const fields = toDeviceStatusFields(mapped);
    expect(fields.ports?.acOutW).toBe(241);
    expect(fields.limits?.maxChargeSoc).toBe(90);
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

  it('maps HW52 live merge watts/volt/runTime via contract', () => {
    const contract = resolveContract({ sn: 'HW52ZDH59G8D4764' });
    const mapped = mapPayloadWithContract(contract!, {
      runTime: 80946,
      volt: 229,
      watts: 20,
      consWatt: -20,
      current: 494,
    });

    expect(mapped.plug?.watts).toBe(2);
    expect(mapped.plug?.volt).toBe(229);
    expect(mapped.plug?.runTimeSec).toBe(80946);
    expect(mapped.matched.runTime).toBe('runTime');
    const fields = toDeviceStatusFields(mapped);
    expect(fields.plugWatts).toBe(2);
    expect(fields.runTimeSec).toBe(80946);
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
