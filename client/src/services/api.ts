/**
 * API Client for backend communication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  DeviceListResponse,
  DeviceStatusResponse,
} from '../types/ecoflow';
import {
  safeParseDeviceListResponse,
  safeParseDeviceStatusResponse,
  safeParseApiError,
} from '../schemas/ecoflow';
import { RateLimiter } from '../utils/rateLimiter';
import { RATE_LIMIT_CONFIG } from '../constants';
import { errorReporter } from '../utils/errorReporting';

/**
 * Same-origin by default (empty base → relative `/api/...`).
 * Override with VITE_API_BASE_URL when the API is on another origin.
 */
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();

if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL || '(same-origin)');
}

class ApiClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.rateLimiter = new RateLimiter(
      RATE_LIMIT_CONFIG.MAX_REQUESTS,
      RATE_LIMIT_CONFIG.WINDOW_MS
    );
  }

  private handleError(error: unknown): never {
    const axiosError = error as AxiosError<unknown>;

    errorReporter.reportError(
      axiosError instanceof Error ? axiosError : new Error(String(axiosError)),
      {
        component: 'ApiClient',
        action: 'api_request',
        url: axiosError.config?.url,
        method: axiosError.config?.method,
        status: axiosError.response?.status,
        responseData: axiosError.response?.data,
      }
    );

    if (axiosError.response?.data) {
      const errorParse = safeParseApiError(axiosError.response.data);
      if (errorParse.success) {
        throw new Error(errorParse.data.error.message);
      }
    }

    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ERR_NETWORK') {
      const target = API_BASE_URL || 'this origin';
      throw new Error(
        `Cannot connect to backend server at ${target}. ` +
          'Please make sure the backend is running.'
      );
    }

    throw new Error(axiosError.message || 'An unknown error occurred');
  }

  /**
   * Get list of devices
   */
  async getDevices(): Promise<DeviceListResponse> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getTimeUntilNextRequest();
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`
      );
    }

    try {
      const response = await this.client.get<unknown>('/api/devices');

      if (import.meta.env.DEV) {
        console.log('Devices API Response:', response.data);
      }

      let dataToValidate: unknown = response.data;

      if (Array.isArray(response.data)) {
        dataToValidate = { devices: response.data, total: response.data.length };
      } else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        const nested = response.data as { data?: { devices?: unknown[]; total?: number } };
        if (nested.data?.devices && Array.isArray(nested.data.devices)) {
          dataToValidate = {
            devices: nested.data.devices,
            total: nested.data.total || nested.data.devices.length,
          };
        }
      }

      const parseResult = safeParseDeviceListResponse(dataToValidate);
      if (parseResult.success) {
        return parseResult.data;
      }

      const data = response.data as { devices?: unknown[]; total?: number };
      if (data?.devices && Array.isArray(data.devices)) {
        const validatedDevices = data.devices.filter((device) => {
          const deviceParse = safeParseDeviceListResponse({ devices: [device], total: 1 });
          return deviceParse.success;
        });

        if (validatedDevices.length > 0) {
          return {
            devices: validatedDevices as DeviceListResponse['devices'],
            total: data.total || validatedDevices.length,
          };
        }
      }

      console.warn('Unexpected API response structure:', response.data);
      console.warn('Validation errors:', parseResult.error.issues);
      return {
        devices: [],
        total: 0,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get device status
   */
  async getDeviceStatus(deviceId: string): Promise<DeviceStatusResponse> {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getTimeUntilNextRequest();
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`
      );
    }

    try {
      const response = await this.client.get<unknown>(
        `/api/devices/${deviceId}/status`
      );

      const parseResult = safeParseDeviceStatusResponse(response.data);
      if (parseResult.success) {
        // Never treat error-source payloads as real SOC readings
        if (parseResult.data.source === 'error') {
          throw new Error('Device status unavailable');
        }
        return parseResult.data;
      }

      console.warn('Device status validation failed:', parseResult.error.issues);
      console.warn('Response data:', response.data);

      throw new Error('Invalid device status response format');
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Device status unavailable' ||
          error.message === 'Invalid device status response format')
      ) {
        throw error;
      }
      this.handleError(error);
    }
  }
}

export const apiClient = new ApiClient();
