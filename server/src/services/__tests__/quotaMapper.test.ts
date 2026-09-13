/**
 * Unit tests for shared quota mapper (fixtures, no live API)
 */

import { describe, it, expect } from 'vitest';
import {
  mapQuotaData,
  SOC_KEYS,
  INPUT_WATT_FIELDS,
  OUTPUT_WATT_FIELDS,
} from '@ecoflow/shared';

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
    expect(SOC_KEYS).toContain('bmsMaster.soc');
    expect(SOC_KEYS).toContain('bpSoc');
    expect(INPUT_WATT_FIELDS.some((f) => f.key === 'bmsMaster.inputWatts' && f.isTenthWatt)).toBe(
      true
    );
    expect(OUTPUT_WATT_FIELDS.some((f) => f.key === 'bmsMaster.outputWatts' && f.isTenthWatt)).toBe(
      true
    );
    expect(INPUT_WATT_FIELDS.some((f) => f.key === 'chargePower' && !f.isTenthWatt)).toBe(true);
  });
});
