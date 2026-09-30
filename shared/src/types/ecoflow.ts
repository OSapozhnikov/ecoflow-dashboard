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
export type DataSource = 'mqtt' | 'rest' | 'error' | 'paused';

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
export interface DevicePortsTelemetry {
  acInW?: number;
  /** Sum of abs(AC out lines) */
  acOutW?: number;
  acOutLinesW?: number[];
  pvW?: number;
  pv2W?: number;
  dc12vW?: number;
  typec1W?: number;
  typec2W?: number;
  typec3W?: number;
  qcusb1W?: number;
  qcusb2W?: number;
}

export interface DeviceLimitsTelemetry {
  maxChargeSoc?: number;
  minDischargeSoc?: number;
  backupReserveSoc?: number;
  energyBackupEnabled?: boolean;
}

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
  /** Vendor runTime in seconds; omit when unknown */
  runTimeSec?: number;
  /** Minutes until full (Delta 3 cmsChgRemTime); omit when unknown */
  remainingChargeMin?: number;
  /** Minutes until empty (Delta 3 cmsDsgRemTime); omit when unknown */
  remainingDischargeMin?: number;
  /** Delta 3 port power breakdown (whole W) */
  ports?: DevicePortsTelemetry;
  /** Delta 3 charge / backup limits */
  limits?: DeviceLimitsTelemetry;
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

