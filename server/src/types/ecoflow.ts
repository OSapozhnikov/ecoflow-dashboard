/**
 * TypeScript types for Ecoflow API responses
 */

export interface EcoflowDevice {
  sn: string; // Serial number (primary identifier)
  deviceName: string;
  deviceType?: string;
  productName?: string;
  online: number | boolean; // API returns 1/0, we convert to boolean
  deviceId?: string; // May be derived from sn
  deviceSn?: string; // Alias for sn
  bindTime?: number;
  [key: string]: unknown; // For additional fields from API
}

export interface EcoflowDeviceListResponse {
  devices: EcoflowDevice[];
  total: number;
}

export interface EcoflowDeviceStatus {
  deviceId: string;
  batteryLevel: number;
  chargeRate?: number;
  dischargeRate?: number;
  status: 'charging' | 'discharging' | 'standby';
  timestamp: number;
  [key: string]: unknown; // For additional fields from API
}

export interface EcoflowDeviceStatusResponse {
  deviceId: string;
  data: EcoflowDeviceStatus;
}

export interface EcoflowErrorResponse {
  code: number;
  msg: string;
  requestId?: string;
}

export interface EcoflowMQTTCertification {
  certificateAccount: string;
  certificatePassword: string;
  url: string;
  port: string;
  protocol: 'mqtt' | 'mqtts';
}

export interface EcoflowMQTTCertificationResponse {
  code: string;
  message: string;
  data: EcoflowMQTTCertification;
}

