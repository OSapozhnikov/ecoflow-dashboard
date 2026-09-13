/**
 * Shared TypeScript types for Ecoflow API
 * Used by both frontend and backend
 */

/**
 * Device status enum
 */
export type DeviceStatus = 'charging' | 'discharging' | 'standby';

/**
 * Data source enum
 */
export type DataSource = 'mqtt' | 'rest' | 'error';

/**
 * Base device interface
 */
export interface BaseDevice {
  sn: string; // Serial number (primary identifier)
  deviceName: string;
  deviceType?: string;
  productName?: string;
  online: boolean; // Normalized to boolean
  deviceId?: string; // May be derived from sn
  deviceSn?: string; // Alias for sn
  bindTime?: number;
  [key: string]: unknown; // For additional fields from API
}

/**
 * Device status interface
 */
export interface BaseDeviceStatus {
  deviceId: string;
  batteryLevel: number; // 0-100
  chargeRate?: number; // Watts
  dischargeRate?: number; // Watts
  status: DeviceStatus;
  timestamp: number;
  [key: string]: unknown; // For additional fields from API
}

/**
 * Device list response interface
 */
export interface BaseDeviceListResponse {
  devices: BaseDevice[];
  total: number;
}

/**
 * Device status response interface
 */
export interface BaseDeviceStatusResponse {
  deviceId: string;
  data: BaseDeviceStatus;
  source?: DataSource;
  timestamp?: number;
}

/**
 * API error response interface
 */
export interface BaseApiError {
  error: {
    message: string;
    code: string;
  };
}

