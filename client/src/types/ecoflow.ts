/**
 * TypeScript types for Ecoflow API responses (Frontend)
 */

export interface Device {
  sn: string; // Serial number (primary identifier)
  deviceName: string;
  deviceType?: string;
  productName?: string;
  online: number | boolean; // API returns 1/0
  deviceId?: string; // Derived from sn if needed
  deviceSn?: string; // Alias for sn
  bindTime?: number;
  [key: string]: unknown; // For additional fields
}

export interface DeviceListResponse {
  devices: Device[];
  total: number;
}

export interface DeviceStatus {
  deviceId: string;
  batteryLevel: number;
  chargeRate?: number;
  dischargeRate?: number;
  status: 'charging' | 'discharging' | 'standby';
  timestamp: number;
  [key: string]: unknown;
}

export interface DeviceStatusResponse {
  deviceId: string;
  data: DeviceStatus;
  source?: 'mqtt' | 'rest' | 'error';
  timestamp?: number;
}

export interface ApiError {
  error: {
    message: string;
    code: string;
  };
}

