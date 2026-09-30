/**
 * Settings persistence — disabledDeviceIds / isDeviceDisabled
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('disabledDeviceIds settings', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecoflow-settings-'));
    vi.resetModules();
    vi.doMock('../dataDir', () => ({
      getDataDir: () => tmpDir,
    }));
  });

  afterEach(() => {
    vi.doUnmock('../dataDir');
    vi.resetModules();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists disabledDeviceIds and isDeviceDisabled reads them', async () => {
    const {
      writeSettings,
      readSettings,
      isDeviceDisabled,
      SettingsSchema,
    } = await import('../dataFiles');

    expect(SettingsSchema.parse({}).disabledDeviceIds).toEqual([]);
    expect(isDeviceDisabled('HW52X')).toBe(false);

    writeSettings({ disabledDeviceIds: ['HW52X', 'D3M1Y'] });
    expect(readSettings().disabledDeviceIds).toEqual(['HW52X', 'D3M1Y']);
    expect(isDeviceDisabled('HW52X')).toBe(true);
    expect(isDeviceDisabled('OTHER')).toBe(false);

    writeSettings({ disabledDeviceIds: ['D3M1Y'] });
    expect(isDeviceDisabled('HW52X')).toBe(false);
    expect(isDeviceDisabled('D3M1Y')).toBe(true);
  });
});
