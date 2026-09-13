/**
 * Unit tests for formatDeviceStatusError
 */

import { describe, it, expect } from 'vitest';
import { formatDeviceStatusError } from '../formatDeviceStatusError';

describe('formatDeviceStatusError', () => {
  it('shortens signature-is-wrong quota rejects and keeps vendor code', () => {
    const raw =
      'Ecoflow rejected quota/all for SN P351ZEH4PGCC0498 with "signature is wrong". ' +
      'This often means the SN is unsupported, offline, or not entitled on this account/region ' +
      '(not a global HMAC failure). Compare logs with a working SN (e.g. Taurus D3M1…). ' +
      'Vendor code: 8521.';

    expect(formatDeviceStatusError(raw)).toBe(
      'Status unavailable (unsupported, offline, or not entitled). Vendor code: 8521.'
    );
  });

  it('passes through unrelated errors', () => {
    expect(formatDeviceStatusError('Failed to fetch device status')).toBe(
      'Failed to fetch device status'
    );
  });

  it('handles empty input', () => {
    expect(formatDeviceStatusError('')).toBe('Status unavailable');
    expect(formatDeviceStatusError(null)).toBe('Status unavailable');
  });
});
