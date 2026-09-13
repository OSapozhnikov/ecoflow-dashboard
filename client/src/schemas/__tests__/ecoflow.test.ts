/**
 * Unit tests for client schemas
 */

import { describe, it, expect } from 'vitest';
import {
  DeviceSchema,
  DeviceStatusSchema,
  safeParseDevice,
  safeParseDeviceStatus,
} from '../ecoflow';

describe('Client Schemas', () => {
  describe('DeviceSchema', () => {
    it('should validate correct device object', () => {
      const device = {
        sn: 'TEST123',
        deviceName: 'Test Device',
        online: true,
      };

      const result = safeParseDevice(device);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sn).toBe('TEST123');
      }
    });

    it('should transform online number to boolean', () => {
      const device = {
        sn: 'TEST123',
        deviceName: 'Test Device',
        online: 1,
      };

      const result = safeParseDevice(device);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.online).toBe(true);
      }
    });
  });

  describe('DeviceStatusSchema', () => {
    it('should validate correct status object', () => {
      const status = {
        deviceId: 'TEST123',
        batteryLevel: 85,
        status: 'charging' as const,
        timestamp: Date.now(),
      };

      const result = safeParseDeviceStatus(status);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batteryLevel).toBe(85);
      }
    });
  });
});

