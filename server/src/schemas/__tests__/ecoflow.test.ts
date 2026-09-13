/**
 * Unit tests for Ecoflow schemas
 */

import { describe, it, expect } from 'vitest';
import {
  EcoflowDeviceSchema,
  EcoflowDeviceStatusSchema,
  safeParseEcoflowDevice,
  safeParseEcoflowDeviceStatus,
} from '../ecoflow';

describe('Ecoflow Schemas', () => {
  describe('EcoflowDeviceSchema', () => {
    it('should validate correct device object', () => {
      const device = {
        sn: 'TEST123',
        deviceName: 'Test Device',
        deviceType: 'Delta 3',
        online: 1,
      };

      const result = safeParseEcoflowDevice(device);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sn).toBe('TEST123');
        expect(result.data.online).toBe(true); // Should be transformed to boolean
      }
    });

    it('should transform online number to boolean', () => {
      const device = {
        sn: 'TEST123',
        deviceName: 'Test Device',
        online: 1,
      };

      const result = safeParseEcoflowDevice(device);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.online).toBe(true);
      }
    });

    it('should reject invalid device object', () => {
      const invalidDevice = {
        sn: 123, // Should be string
        deviceName: 'Test Device',
      };

      const result = safeParseEcoflowDevice(invalidDevice);
      expect(result.success).toBe(false);
    });
  });

  describe('EcoflowDeviceStatusSchema', () => {
    it('should validate correct status object', () => {
      const status = {
        deviceId: 'TEST123',
        batteryLevel: 85,
        chargeRate: 120,
        dischargeRate: 0,
        status: 'charging' as const,
        timestamp: Date.now(),
      };

      const result = safeParseEcoflowDeviceStatus(status);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batteryLevel).toBe(85);
        expect(result.data.status).toBe('charging');
      }
    });

    it('should reject battery level outside 0-100 range', () => {
      const status = {
        deviceId: 'TEST123',
        batteryLevel: 150, // Over 100
        status: 'charging' as const,
        timestamp: Date.now(),
      };

      const result = safeParseEcoflowDeviceStatus(status);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.path.includes('batteryLevel'))).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const invalidStatus = {
        deviceId: 'TEST123',
        batteryLevel: '85', // Should be number
        status: 'invalid', // Invalid status
        timestamp: Date.now(),
      };

      const result = safeParseEcoflowDeviceStatus(invalidStatus);
      expect(result.success).toBe(false);
    });
  });
});

