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
  batteryLevel: number; // 0-100 (unused / 0 for Smart Plug)
  chargeRate?: number; // Watts (power stations)
  dischargeRate?: number; // Watts (power stations)
  status: DeviceStatus;
  timestamp: number;
  /** True when payload was mapped as Smart Plug telemetry */
  isPlug?: boolean;
  /** Smart Plug relay on/off */
  switchSta?: boolean;
  /** Smart Plug power in watts (already converted from 0.1 W) */
  plugWatts?: number;
  /** True when plugWatts exceeds sane household max after unit conversion */
  plugWattsAnomalous?: boolean;
  /** Smart Plug voltage (V) */
  volt?: number;
  /** Smart Plug temperature */
  temp?: number;
  /** Minutes until full (Delta 3 cmsChgRemTime); omit when unknown */
  remainingChargeMin?: number;
  /** Minutes until empty (Delta 3 cmsDsgRemTime); omit when unknown */
  remainingDischargeMin?: number;
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

