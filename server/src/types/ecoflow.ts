/**
 * TypeScript types for Ecoflow API responses
 * Shared device types come from @ecoflow/shared; MQTT cert types stay server-only.
 */

export type {
  BaseDevice as EcoflowDevice,
  BaseDeviceListResponse as EcoflowDeviceListResponse,
  BaseDeviceStatus as EcoflowDeviceStatus,
  BaseDeviceStatusResponse as EcoflowDeviceStatusResponse,
  DeviceStatus,
  DataSource,
  BaseApiError,
} from '@ecoflow/shared';

/** Narrow status response used by REST service (no source/timestamp required) */
export interface EcoflowRestStatusResponse {
  deviceId: string;
  data: import('@ecoflow/shared').BaseDeviceStatus;
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
