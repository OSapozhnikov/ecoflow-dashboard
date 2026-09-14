/**
 * Unit tests for remaining-time and source display helpers
 */

import { describe, it, expect } from 'vitest';
import { formatRemainingMinutes } from '../formatRemainingTime';
import { resolveSourceDisplay, sourceDisplayLabel } from '../statusSource';

describe('formatRemainingMinutes', () => {
  it('formats minutes under an hour', () => {
    expect(formatRemainingMinutes(45)).toBe('45m');
  });

  it('formats exact hours', () => {
    expect(formatRemainingMinutes(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatRemainingMinutes(90)).toBe('1h 30m');
  });

  it('returns null for invalid', () => {
    expect(formatRemainingMinutes(undefined)).toBeNull();
    expect(formatRemainingMinutes(-1)).toBeNull();
  });
});

describe('resolveSourceDisplay', () => {
  it('marks recent mqtt as live', () => {
    const now = 1_000_000;
    expect(resolveSourceDisplay('mqtt', now - 10_000, now)).toBe('mqtt-live');
    expect(sourceDisplayLabel('mqtt-live')).toBe('MQTT live');
  });

  it('marks old mqtt as stale', () => {
    const now = 1_000_000;
    expect(resolveSourceDisplay('mqtt', now - 120_000, now)).toBe('mqtt-stale');
  });

  it('labels rest', () => {
    expect(resolveSourceDisplay('rest', Date.now())).toBe('rest');
    expect(sourceDisplayLabel('rest')).toBe('REST');
  });
});
