/**
 * Frontend Ecoflow types — aliases over @ecoflow/shared without the open index signature,
 * so React keys / JSX stay typed as string.
 */

import type {
  BaseDeviceStatus,
  BaseDeviceStatusResponse,
  BaseApiError,
  DeviceStatus as SharedDeviceStatusEnum,
  DataSource,
} from '@ecoflow/shared';

export type { SharedDeviceStatusEnum as DeviceStatusEnum, DataSource };

export interface Device {
  sn: string;
  deviceName: string;
  deviceType?: string;
  productName?: string;
  /** API may send 1/0 before schema normalization */
  online: number | boolean;
  deviceId?: string;
  deviceSn?: string;
  bindTime?: number;
}

export interface DeviceListResponse {
  devices: Device[];
  total: number;
}

export type DeviceStatus = BaseDeviceStatus;

export type DeviceStatusResponse = Omit<BaseDeviceStatusResponse, 'data'> & {
  data: DeviceStatus;
};

export type ApiError = BaseApiError;
