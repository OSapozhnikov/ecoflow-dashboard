/**
 * Unit tests for shared quota mapper (fixtures, no live API)
 */

import { describe, it, expect } from 'vitest';
import {
  mapQuotaData,
  toDeviceStatusFields,
  SOC_KEYS,
  INPUT_WATT_FIELDS,
  OUTPUT_WATT_FIELDS,
  CHG_DSG_STATE_KEYS,
} from '@ecoflow/shared';

/** Shared Delta 3 heartbeat shape (Max Plus / Max / Plus until live Plus dump differs) */
const delta3HeartbeatFixture = {
  cmsBattSoc: 67,
  powInSumW: 120,
  powOutSumW: 0,
  cmsChgDsgState: 2,
};

describe('mapQuotaData', () => {
  it('maps Delta Pro flat REST quota with 0.1W BMS fields', () => {
    const fixture = {
      'bmsMaster.soc': '85',
      'bmsMaster.inputWatts': '500', // 50.0 W
      'bmsMaster.outputWatts': '0',
    };

    const result = mapQuotaData(fixture);

    expect(result.batteryLevel).toBe(85);
    expect(result.chargeRate).toBe(50);
    expect(result.dischargeRate).toBe(0);
    expect(result.status).toBe('charging');
    expect(result.matched.soc).toBe('bmsMaster.soc');
    expect(result.matched.charge).toBe('bmsMaster.inputWatts');
  });

  it('applies /10 only to documented 0.1W output fields', () => {
    const fixture = {
      'bmsMaster.soc': '40',
      'bmsMaster.inputWatts': '0',
      'bmsMaster.outputWatts': '1234', // 123.4 W
    };

    const result = mapQuotaData(fixture);

    expect(result.dischargeRate).toBe(123.4);
    expect(result.status).toBe('discharging');
    expect(result.matched.discharge).toBe('bmsMaster.outputWatts');
  });

  it('does not divide watt aliases that are already in W', () => {
    const fixture = {
      soc: 60,
      chargePower: 200,
      dischargePower: 150,
    };

    const result = mapQuotaData(fixture);

    expect(result.batteryLevel).toBe(60);
    expect(result.chargeRate).toBe(200);
    expect(result.dischargeRate).toBe(150);
    expect(result.status).toBe('charging');
    expect(result.matched.charge).toBe('chargePower');
  });

  it('maps Delta 3 / nested bmsMaster object', () => {
    const fixture = {
      bmsMaster: {
        soc: 72,
        inputWatts: 100, // 10 W
        outputWatts: 0,
      },
    };

    const result = mapQuotaData(fixture);

    expect(result.batteryLevel).toBe(72);
    expect(result.chargeRate).toBe(10);
    expect(result.status).toBe('charging');
    expect(result.matched.soc).toBe('bmsMaster.soc');
  });

  it('maps Delta 3 Max Plus heartbeat without /10', () => {
    const result = mapQuotaData(delta3HeartbeatFixture);

    expect(result.batteryLevel).toBe(67);
    expect(result.chargeRate).toBe(120);
    expect(result.dischargeRate).toBe(0);
    expect(result.status).toBe('charging');
    expect(result.matched.soc).toBe('cmsBattSoc');
    expect(result.matched.charge).toBe('powInSumW');
  });

  it('maps Delta 3 Max snake_case keys as whole watts', () => {
    const fixture = {
      cms_batt_soc: 41,
      pow_in_sum_w: 0,
      pow_out_sum_w: 350,
      cms_chg_dsg_state: 1,
    };

    const result = mapQuotaData(fixture);

    expect(result.batteryLevel).toBe(41);
    expect(result.chargeRate).toBe(0);
    expect(result.dischargeRate).toBe(350);
    expect(result.status).toBe('discharging');
    expect(result.matched.soc).toBe('cms_batt_soc');
    expect(result.matched.discharge).toBe('pow_out_sum_w');
  });

  it('maps Delta 3 Plus (P351) with same Max Plus heartbeat keys', () => {
    // Plus uses the same family keys until a live dump proves otherwise
    const result = mapQuotaData({ ...delta3HeartbeatFixture });

    expect(result.batteryLevel).toBe(67);
    expect(result.chargeRate).toBe(120);
    expect(result.matched.soc).toBe('cmsBattSoc');
    expect(result.matched.charge).toBe('powInSumW');
  });

  it('uses cmsChgDsgState when both watt fields are zero', () => {
    const charging = mapQuotaData({
      cmsBattSoc: 50,
      powInSumW: 0,
      powOutSumW: 0,
      cmsChgDsgState: 2,
    });
    expect(charging.status).toBe('charging');
    expect(charging.chargeRate).toBe(0);
    expect(charging.dischargeRate).toBe(0);

    const discharging = mapQuotaData({
      cmsBattSoc: 50,
      powInSumW: 0,
      powOutSumW: 0,
      cmsChgDsgState: 1,
    });
    expect(discharging.status).toBe('discharging');

    const idle = mapQuotaData({
      cmsBattSoc: 50,
      powInSumW: 0,
      powOutSumW: 0,
      cmsChgDsgState: 0,
    });
    expect(idle.status).toBe('standby');
  });

  it('prefers consWatt (already W) over 0.1W fields for MQTT', () => {
    const fixture = {
      params: { soc: 55, consWatt: -320 },
    };

    const result = mapQuotaData([fixture, fixture.params], {
      consWatt: -320,
    });

    expect(result.batteryLevel).toBe(55);
    expect(result.dischargeRate).toBe(320);
    expect(result.chargeRate).toBe(0);
    expect(result.status).toBe('discharging');
    expect(result.matched.discharge).toBe('consWatt');
  });

  it('uses watts option as whole-watt discharge fallback', () => {
    const result = mapQuotaData({ soc: 10 }, { watts: 88 });

    expect(result.dischargeRate).toBe(88);
    expect(result.status).toBe('discharging');
    expect(result.matched.discharge).toBe('watts');
  });

  it('returns standby when all power is zero', () => {
    const result = mapQuotaData({
      'bmsMaster.soc': '50',
      'bmsMaster.inputWatts': '0',
      'bmsMaster.outputWatts': '0',
    });

    expect(result.status).toBe('standby');
    expect(result.chargeRate).toBe(0);
    expect(result.dischargeRate).toBe(0);
  });

  it('exposes explicit Delta Pro / Delta 3 key lists', () => {
    expect(SOC_KEYS[0]).toBe('cmsBattSoc');
    expect(SOC_KEYS).toContain('cms_batt_soc');
    expect(SOC_KEYS).toContain('bmsMaster.soc');
    expect(SOC_KEYS).toContain('bpSoc');
    expect(INPUT_WATT_FIELDS[0]).toEqual({ key: 'powInSumW', isTenthWatt: false });
    expect(OUTPUT_WATT_FIELDS[0]).toEqual({ key: 'powOutSumW', isTenthWatt: false });
    expect(INPUT_WATT_FIELDS.some((f) => f.key === 'bmsMaster.inputWatts' && f.isTenthWatt)).toBe(
      true
    );
    expect(OUTPUT_WATT_FIELDS.some((f) => f.key === 'bmsMaster.outputWatts' && f.isTenthWatt)).toBe(
      true
    );
    expect(INPUT_WATT_FIELDS.some((f) => f.key === 'chargePower' && !f.isTenthWatt)).toBe(true);
    expect(CHG_DSG_STATE_KEYS).toContain('cmsChgDsgState');
  });

  it('maps Smart Plug REST 2_1 fields with watts /10', () => {
    const result = mapQuotaData({
      '2_1.switchSta': 1,
      '2_1.watts': 1234, // 123.4 W
      '2_1.volt': 230,
      '2_1.temp': 28,
    });

    expect(result.plug).toEqual({
      switchSta: true,
      watts: 123.4,
      volt: 230,
      temp: 28,
    });
    expect(result.batteryLevel).toBe(0);
    expect(result.chargeRate).toBe(0);
    expect(result.dischargeRate).toBe(0);
    expect(result.status).toBe('discharging');
    expect(result.matched.switchSta).toBe('2_1.switchSta');
    expect(result.matched.plugWatts).toBe('2_1.watts');
    expect(toDeviceStatusFields(result)).toMatchObject({
      isPlug: true,
      switchSta: true,
      plugWatts: 123.4,
      volt: 230,
      temp: 28,
      batteryLevel: 0,
    });
  });

  it('maps Smart Plug MQTT nested param without 2_1. prefix (Bathroom HW52)', () => {
    const param = {
      switchSta: 0,
      watts: 500, // 50.0 W
      volt: 229,
      temp: 31,
    };
    const result = mapQuotaData([param], { watts: 500 });

    expect(result.plug).toBeDefined();
    expect(result.plug!.switchSta).toBe(false);
    expect(result.plug!.watts).toBe(50);
    expect(result.plug!.volt).toBe(229);
    expect(result.plug!.temp).toBe(31);
    expect(result.matched.switchSta).toBe('switchSta');
    expect(result.matched.plugWatts).toBe('watts');
    // Must not treat options.watts as station discharge
    expect(result.dischargeRate).toBe(0);
    expect(result.status).toBe('standby');
  });

  it('does not treat bare station watts option as plug without switchSta', () => {
    const result = mapQuotaData({ soc: 10 }, { watts: 88 });
    expect(result.plug).toBeUndefined();
    expect(result.dischargeRate).toBe(88);
  });
});
