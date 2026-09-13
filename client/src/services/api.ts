/**
 * API Client for backend communication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  DeviceListResponse,
  DeviceStatusResponse,
  ApiError,
} from '../types/ecoflow';
import {
  safeParseDeviceListResponse,
  safeParseDeviceStatusResponse,
  safeParseApiError,
} from '../schemas/ecoflow';
import { RateLimiter } from '../utils/rateLimiter';
import { RATE_LIMIT_CONFIG } from '../constants';
import { errorReporter } from '../utils/errorReporting';

// Determine API base URL
// In Docker, use service name. Locally, use localhost
const getApiBaseUrl = (): string => {
  // Check if we have explicit URL from env
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Default to localhost for local development
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

// Log API URL for debugging (only in development)
if (import.meta.env.DEV) {
  console.log('API Base URL:', API_BASE_URL);
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

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      RATE_LIMIT_CONFIG.MAX_REQUESTS,
      RATE_LIMIT_CONFIG.WINDOW_MS
    );
  }

  private handleError(error: unknown): never {
    const axiosError = error as AxiosError<unknown>;
    
    // Report error to error reporting service
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
    
    // Try to parse error response
    if (axiosError.response?.data) {
      const errorParse = safeParseApiError(axiosError.response.data);
      if (errorParse.success) {
        throw new Error(errorParse.data.error.message);
      }
    }
    
    // Handle network errors
    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ERR_NETWORK') {
      throw new Error(
        `Cannot connect to backend server at ${API_BASE_URL}. ` +
        'Please make sure the backend is running.'
      );
    }
    
    throw new Error(axiosError.message || 'An unknown error occurred');
  }

  /**
   * Get list of devices
   */
  async getDevices(): Promise<DeviceListResponse> {
    // Check rate limit
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getTimeUntilNextRequest();
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`
      );
    }

    try {
      const response = await this.client.get<unknown>('/api/devices');
      
      // Log response in development for debugging
      if (import.meta.env.DEV) {
        console.log('Devices API Response:', response.data);
      }
      
      // Handle different response structures
      let dataToValidate: unknown = response.data;
      
      // If response has devices array directly
      if (Array.isArray(response.data)) {
        dataToValidate = { devices: response.data, total: response.data.length };
      }
      // If response has data.devices (nested)
      else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
        const nested = response.data as { data?: { devices?: unknown[]; total?: number } };
        if (nested.data?.devices && Array.isArray(nested.data.devices)) {
          dataToValidate = {
            devices: nested.data.devices,
            total: nested.data.total || nested.data.devices.length,
          };
        }
      }
      
      // Validate with zod schema
      const parseResult = safeParseDeviceListResponse(dataToValidate);
      if (parseResult.success) {
        return parseResult.data;
      }
      
      // If validation fails, try to extract devices manually
      const data = response.data as { devices?: unknown[]; total?: number };
      if (data?.devices && Array.isArray(data.devices)) {
        // Validate each device individually
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
      
      // Default: return empty array with warning
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
    // Check rate limit
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
      
      // Validate response with zod schema
      const parseResult = safeParseDeviceStatusResponse(response.data);
      if (parseResult.success) {
        return parseResult.data;
      }
      
      // If validation fails, log warning and try to return partial data
      console.warn('Device status validation failed:', parseResult.error.issues);
      console.warn('Response data:', response.data);
      
      // Try to extract at least deviceId and basic structure
      const data = response.data as { deviceId?: string; data?: unknown };
      if (data?.deviceId) {
        return {
          deviceId: data.deviceId,
          data: {
            deviceId: data.deviceId,
            batteryLevel: 0,
            status: 'standby',
            timestamp: Date.now(),
          },
          source: 'error',
        };
      }
      
      throw new Error('Invalid device status response format');
    } catch (error) {
      this.handleError(error);
    }
  }
}

export const apiClient = new ApiClient();

