import { describe, it, expect } from 'vitest';
import { formatRunTimeHours } from '../formatRunTimeHours';

describe('formatRunTimeHours', () => {
  it('formats live Bathroom fixture seconds as hours', () => {
    expect(formatRunTimeHours(80946)).toBe('22.5 h');
  });

  it('formats whole hours', () => {
    expect(formatRunTimeHours(7200)).toBe('2 h');
  });

  it('returns null for missing or invalid', () => {
    expect(formatRunTimeHours(undefined)).toBeNull();
    expect(formatRunTimeHours(null)).toBeNull();
    expect(formatRunTimeHours(-1)).toBeNull();
  });
});
