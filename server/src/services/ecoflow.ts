/**
 * Ecoflow API Service
 * Handles HMAC-SHA256 signature authentication and API requests
 * Implements signing algorithm per Ecoflow documentation and working Postman script
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import { mapQuotaData, toDeviceStatusFields, resolveDeviceFamily, isSmartPlugFamily } from '@ecoflow/shared';
import { getConfig } from '../config/env';
import {
  EcoflowDeviceListResponse,
  EcoflowDeviceStatusResponse,
  EcoflowMQTTCertificationResponse,
} from '../types/ecoflow';
import {
  safeParseEcoflowDeviceListResponse,
  safeParseEcoflowErrorResponse,
  safeParseEcoflowMQTTCertificationResponse,
  EcoflowAPIResponseSchema,
} from '../schemas/ecoflow';
import {
  EcoflowAPIError,
  EcoflowValidationError,
  EcoflowNetworkError,
} from '../errors/EcoflowError';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../constants';

/** Last request signing context for ops debug (never includes secretKey). */
export interface EcoflowSigningDebugContext {
  canonicalSigningString: string;
  requestParams: Record<string, string>;
  nonce: string;
  timestamp: string;
  accessKey: string;
  endpoint?: string;
  method?: string;
}

export class EcoflowService {
  private client: AxiosInstance;
  private readonly config = getConfig();
  private lastSuccessAt: number | null = null;
  /** Most recent signing string + public params (for quota/all reject debug). */
  private lastSigningDebug: EcoflowSigningDebugContext | null = null;
  /** Last REST error per device SN (diagnostics). */
  private lastErrors = new Map<
    string,
    { code?: string; message: string; at: number }
  >();

  constructor() {
    this.client = axios.create({
      baseURL: this.config.ecoflow.apiBaseUrl,
      timeout: API_CONFIG.TIMEOUT,
    });

    logger.debug('Ecoflow API Base URL:', { url: this.config.ecoflow.apiBaseUrl });
  }

  /** Timestamp of last successful Ecoflow API response (ms), or null */
  getLastSuccessAt(): number | null {
    return this.lastSuccessAt;
  }

  /** Last HMAC canonical string / public signing params (no secret). */
  getLastSigningDebug(): EcoflowSigningDebugContext | null {
    return this.lastSigningDebug;
  }

  getLastDeviceError(
    deviceSn: string
  ): { code?: string; message: string; at: number } | undefined {
    return this.lastErrors.get(deviceSn);
  }

  private setLastDeviceError(
    deviceSn: string,
    message: string,
    code?: string
  ): void {
    this.lastErrors.set(deviceSn, { code, message, at: Date.now() });
  }

  private clearLastDeviceError(deviceSn: string): void {
    this.lastErrors.delete(deviceSn);
  }

  /**
   * Expand nested objects/arrays to key-value string format
   * E.g. { params: { id: 1 } } -> "params.id=1"
   * Used for POST/PUT requests with nested body
   */
  private expandParams(obj: unknown, prefix = ''): string[] {
    const pairs: string[] = [];

    if (obj === null || obj === undefined) {
      return pairs;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const key = `${prefix}[${index}]`;
        if (typeof item === 'object' && item !== null) {
          pairs.push(...this.expandParams(item, key));
        } else {
          pairs.push(`${key}=${item}`);
        }
      });
    } else if (typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        const value = (obj as Record<string, unknown>)[key];
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          pairs.push(...this.expandParams(value, fullKey));
        } else if (Array.isArray(value)) {
          pairs.push(...this.expandParams(value, fullKey));
        } else {
          pairs.push(`${fullKey}=${value}`);
        }
      });
    } else {
      pairs.push(`${prefix}=${obj}`);
    }

    return pairs;
  }

  /**
   * Build canonical signing string (sorted key=value&...).
   * Same algorithm as before — extracted so reject paths can log it without the secret.
   */
  private buildCanonicalSigningString(
    params: Record<string, string | number>,
    accessKey: string,
    nonce: string,
    timestamp: string
  ): { canonicalString: string; signingParams: Record<string, string> } {
    const signingParams: Record<string, string> = {};

    Object.keys(params).forEach((key) => {
      signingParams[key] = String(params[key]);
    });

    signingParams.accessKey = accessKey;
    signingParams.nonce = nonce;
    signingParams.timestamp = timestamp;

    const sortedKeys = Object.keys(signingParams).sort();
    const canonicalString = sortedKeys
      .map((key) => `${key}=${signingParams[key]}`)
      .join('&');

    return { canonicalString, signingParams };
  }

  /**
   * Generate HMAC-SHA256 signature
   * Matches the working Postman script approach
   * For GET requests with query params, values should be used as-is (raw) from URL
   * HMAC algorithm intentionally unchanged (A3: log-only unless a proven signing bug).
   */
  private generateSignature(
    params: Record<string, string | number>,
    accessKey: string,
    secretKey: string,
    nonce: string,
    timestamp: string
  ): string {
    const { canonicalString, signingParams } = this.buildCanonicalSigningString(
      params,
      accessKey,
      nonce,
      timestamp
    );

    const requestParams: Record<string, string> = {};
    Object.keys(params).forEach((key) => {
      requestParams[key] = String(params[key]);
    });

    this.lastSigningDebug = {
      canonicalSigningString: canonicalString,
      requestParams,
      nonce,
      timestamp,
      accessKey,
    };

    logger.debug('=== Signature Generation (per Ecoflow docs) ===', {
      requestParams: params,
      sortedKeys: Object.keys(signingParams).sort(),
      canonicalString,
      signingParams,
      secretKeyLength: secretKey.length,
      secretKeyPreview: secretKey.substring(0, 10) + '...',
    });

    // Step 4: Encrypt with HMAC-SHA256 (unchanged)
    const signBytes = crypto
      .createHmac('sha256', secretKey)
      .update(canonicalString)
      .digest();

    // Step 5: Convert byte[] to hexadecimal string
    const signature = signBytes.toString('hex');

    logger.debug('Generated signature:', { signature });

    return signature;
  }

  /**
   * Make authenticated request to Ecoflow API
   */
  private async authenticatedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: unknown,
    useQueryString = false,
    queryParams?: Record<string, string>
  ): Promise<T> {
    // Generate nonce (6-digit random number, matching Postman script)
    const nonce = String(Math.floor(100000 + Math.random() * 900000));
    // Timestamp in milliseconds (as per Ecoflow docs)
    const timestamp = String(Date.now());
    
    if (method === 'GET' && endpoint.includes('?')) {
      logger.debug('=== GET Request with Query Params Debug ===', {
        nonce,
        timestamp,
        accessKey: this.config.ecoflow.accessKey,
      });
    }

    // Prepare parameters for signing
    let params: Record<string, string | number> = {};

    // For GET requests, extract parameters from data object first (like Java example)
    // In Java example: JSONObject req is passed even for GET requests
    if (method === 'GET' || useQueryString) {
      logger.debug('=== Extracting params for GET request ===', {
        method,
        endpoint,
        dataObject: data,
        queryParams,
      });
      
      // Priority 1: use data object if provided (like Java example)
      if (data && typeof data === 'object') {
        // Extract params from data object (like MyMapUtil.getMapFromObject in Java)
        Object.keys(data).forEach((key) => {
          const value = (data as Record<string, unknown>)[key];
          if (value !== null && value !== undefined) {
            params[key] = String(value);
          }
        });
        
        logger.debug('Using data object for signature:', { params });
      } else if (queryParams && Object.keys(queryParams).length > 0) {
        // Priority 2: use queryParams object if data not provided
        Object.keys(queryParams).forEach((key) => {
          params[key] = queryParams[key];
        });
        
        logger.debug('Using queryParams object for signature:', { params });
      } else {
        // Priority 3: extract query string from endpoint
        const queryIndex = endpoint.indexOf('?');
        if (queryIndex !== -1) {
          const queryString = endpoint.substring(queryIndex + 1);
          
          logger.debug('Query string:', { queryString });
          
          // Parse query string for signature
          queryString.split('&').forEach((pair) => {
            const equalIndex = pair.indexOf('=');
            if (equalIndex !== -1) {
              const key = decodeURIComponent(pair.substring(0, equalIndex));
              const value = decodeURIComponent(pair.substring(equalIndex + 1));
              params[key] = value;
            } else {
              const key = decodeURIComponent(pair);
              params[key] = '';
            }
          });
        }
      }
      
      logger.debug('Final extracted params:', {
        params,
        paramsCount: Object.keys(params).length,
      });
    }

    // For POST/PUT with body data
    if (data && typeof data === 'object' && (method === 'POST' || method === 'PUT')) {
      // For nested objects, expand them
      const expanded = this.expandParams(data);
      expanded.forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
          params[key] = value;
        }
      });
    } else if (data && typeof data === 'object') {
      // For simple objects, use as-is
      Object.keys(data).forEach((key) => {
        const value = (data as Record<string, unknown>)[key];
        if (value !== null && value !== undefined) {
          params[key] = String(value);
        }
      });
    }

    // Generate signature
    logger.debug('=== Before signature generation ===', {
      params,
      paramsKeys: Object.keys(params),
      paramsCount: Object.keys(params).length,
    });
    
    const sign = this.generateSignature(
      params,
      this.config.ecoflow.accessKey,
      this.config.ecoflow.secretKey,
      nonce,
      timestamp
    );

    if (this.lastSigningDebug) {
      this.lastSigningDebug = {
        ...this.lastSigningDebug,
        endpoint,
        method,
      };
    }

    // Prepare headers
    const headers: Record<string, string> = {
      accessKey: this.config.ecoflow.accessKey,
      nonce,
      timestamp,
      sign,
    };

    // Prepare request config
    const requestConfig: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      url: string;
      headers: Record<string, string>;
      data?: unknown;
      params?: Record<string, string>;
    } = {
      method,
      url: endpoint,
      headers,
    };

    // Handle data based on Content-Type
    if (useQueryString || method === 'GET') {
      // For GET requests, build URL with query params from data object (like Java example)
      if (data && typeof data === 'object') {
        // Build query string from data object (like Java: URLEncoder.encode(queryString))
        const queryString = Object.keys(data)
          .map(key => {
            const value = (data as Record<string, unknown>)[key];
            return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
          })
          .join('&');
        requestConfig.url = `${endpoint}?${queryString}`;
        
        logger.debug('GET request - built URL from data object:', { url: requestConfig.url });
      } else if (queryParams && Object.keys(queryParams).length > 0) {
        // Fallback: use queryParams object
        const queryString = Object.keys(queryParams)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
          .join('&');
        requestConfig.url = `${endpoint}?${queryString}`;
        
        logger.debug('GET request - built URL with query params:', { url: requestConfig.url });
      } else {
        // Use endpoint as-is with existing query string
        requestConfig.url = endpoint;
        
        logger.debug('GET request - using endpoint with query string:', { endpoint });
      }
      
      logger.debug('Signature params (for signing):', { params });
    } else if (method === 'POST' || method === 'PUT') {
      // For POST/PUT with JSON body
      headers['Content-Type'] = 'application/json;charset=UTF-8';
      requestConfig.data = data;
    }

    try {
      // Log request details
      const fullUrl = requestConfig.url.startsWith('http')
        ? requestConfig.url
        : `${this.config.ecoflow.apiBaseUrl}${requestConfig.url}`;
      
      logger.debug(`Making ${method} request:`, {
        url: requestConfig.url,
        fullUrl,
        headers: Object.keys(headers),
        hasParams: !!requestConfig.params,
      });
      
      const response = await this.client.request<T>(requestConfig);
      
      // Log response for debugging
      logger.debug(`Ecoflow API ${method} ${endpoint} Response:`, {
        status: response.status,
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        actualUrl: response.config?.url,
        baseURL: response.config?.baseURL,
      });

      this.lastSuccessAt = Date.now();
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<unknown>;
      
      // Better error handling for DNS/network errors
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        throw new EcoflowNetworkError(
          `Cannot connect to Ecoflow API at ${this.config.ecoflow.apiBaseUrl}. ` +
          `DNS/Network error: ${axiosError.message}. ` +
          `Please check: 1) Internet connection, 2) API URL is correct, 3) DNS settings`,
          axiosError
        );
      }

      // Try to parse error response
      const errorResponse = axiosError.response?.data;
      if (errorResponse) {
        const parsedError = safeParseEcoflowErrorResponse(errorResponse);
        if (parsedError.success) {
          throw new EcoflowAPIError(
            parsedError.data.msg || parsedError.data.message || 'Ecoflow API error',
            String(parsedError.data.code),
            axiosError.response?.status,
            errorResponse,
            axiosError
          );
        }
      }

      logger.error('Ecoflow API Error:', {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
        url: axiosError.config?.url,
      });

      throw new EcoflowAPIError(
        axiosError.message || 'Unknown Ecoflow API error',
        'UNKNOWN_ERROR',
        axiosError.response?.status,
        errorResponse,
        axiosError
      );
    }
  }

  /**
   * Get list of devices
   */
  async getDevices(): Promise<EcoflowDeviceListResponse> {
    const response = await this.authenticatedRequest<unknown>(
      'GET',
      '/iot-open/sign/device/list'
    );

    // Validate API response wrapper
    const apiResponseParse = EcoflowAPIResponseSchema.safeParse(response);
    if (!apiResponseParse.success) {
      throw new EcoflowValidationError(
        'Invalid API response structure',
        apiResponseParse.error.issues,
        new Error('API response validation failed')
      );
    }

    const apiResponse = apiResponseParse.data;

    // Check for error code (normalize to string for comparison)
    const code = String(apiResponse.code);
    if (code !== '0') {
      throw new EcoflowAPIError(
        apiResponse.message || 'API returned error code',
        code,
        undefined,
        response
      );
    }

    // Handle different response structures from Ecoflow API
    logger.debug('Raw Ecoflow API response:', { response });

    // Ecoflow API returns: { code: "0", message: "Success", data: [...] }
    // data is an array of devices directly
    let devicesData: unknown = null;
    
    if (apiResponse.data) {
      // If data is an array (Ecoflow API format) - THIS IS THE CORRECT FORMAT
      if (Array.isArray(apiResponse.data)) {
        devicesData = { devices: apiResponse.data, total: apiResponse.data.length };
      }
      // If data is an object with devices property (alternative format)
      else if (typeof apiResponse.data === 'object' && 'devices' in apiResponse.data) {
        devicesData = apiResponse.data;
      }
    }
    // If response is already in expected format with devices property
    else if (typeof response === 'object' && response !== null && 'devices' in response) {
      devicesData = response;
    }
    // If response is an array directly
    else if (Array.isArray(response)) {
      devicesData = { devices: response, total: response.length };
    }

    // Validate with zod schema
    if (devicesData) {
      const parseResult = safeParseEcoflowDeviceListResponse(devicesData);
        if (parseResult.success) {
          logger.debug('✅ Validated devices response:', {
            deviceCount: parseResult.data.devices.length,
          });
          return parseResult.data;
        } else {
        throw new EcoflowValidationError(
          'Invalid devices response structure',
          parseResult.error.issues,
          new Error('Devices validation failed')
        );
      }
    }

    // Default: return empty (but log warning)
    logger.warn('Unexpected response structure from Ecoflow API:', { response });
    return {
      devices: [],
      total: 0,
    };
  }

  /**
   * Get device status (quota)
   */
  async getDeviceStatus(deviceSn: string): Promise<EcoflowDeviceStatusResponse> {
    const endpoint = '/iot-open/sign/device/quota/all';
    // For GET requests, pass params as data object (like in Java example)
    // The authenticatedRequest will extract them for signature and URL
    try {
      const response = await this.authenticatedRequest<unknown>(
        'GET',
        endpoint,
        { sn: deviceSn }, // Pass as data object, not queryParams
        false
      );

      // Handle different response structures from Ecoflow API
      logger.debug('Device Status API Response:', { response });

      // Ecoflow API returns: { code: "0", message: "Success", data: {...} }
      if (response && typeof response === 'object' && 'data' in response) {
        const apiResponse = response as {
          code?: string;
          message?: string;
          data?: unknown;
        };

        if (apiResponse.code && apiResponse.code !== '0') {
          this.throwQuotaAllApiError(deviceSn, apiResponse.code, apiResponse.message, response);
        }

        if (apiResponse.data && typeof apiResponse.data === 'object') {
          // Parse quota data into device status format
          // Flat keys e.g. { "bmsMaster.soc": "100", "bmsMaster.inputWatts": "0", ... }
          const quotaData = apiResponse.data as Record<string, unknown>;
          const forcePlug = isSmartPlugFamily(resolveDeviceFamily({ sn: deviceSn }));
          const mapped = mapQuotaData(quotaData, { forcePlug, sn: deviceSn });
          const statusFields = toDeviceStatusFields(mapped);

          this.clearLastDeviceError(deviceSn);
          return {
            deviceId: deviceSn,
            data: {
              deviceId: deviceSn,
              timestamp: Date.now(),
              ...quotaData, // Include all other fields
              ...statusFields, // Normalized fields win over raw 0.1 W watts etc.
            },
          };
        }
      }

      // If response is already in expected format
      if (response && typeof response === 'object' && 'deviceId' in response && 'data' in response) {
        this.clearLastDeviceError(deviceSn);
        return response as EcoflowDeviceStatusResponse;
      }

      // Handle error responses (like signature errors)
      if (response && typeof response === 'object' && 'code' in response) {
        const errorResponse = response as { code?: string; message?: string };
        if (errorResponse.code && errorResponse.code !== '0') {
          this.throwQuotaAllApiError(
            deviceSn,
            errorResponse.code,
            errorResponse.message,
            response
          );
        }
      }

      logger.warn('Unexpected response structure from Device Status API:', { response });
      const unexpected = new Error('Unexpected response structure from Device Status API');
      this.setLastDeviceError(deviceSn, unexpected.message);
      throw unexpected;
    } catch (error) {
      const err = error as Error & { code?: string; name?: string };
      if (err.name !== 'EcoflowAPIError') {
        this.setLastDeviceError(deviceSn, err.message, err.code);
      }
      throw error;
    }
  }

  /**
   * Lab: raw quota/all envelope without mapping into DeviceStatus.
   * Non-zero vendor codes return ok:false (no throw) so the UI can show the reject body.
   */
  async getRawQuotaAll(deviceSn: string): Promise<{
    ok: boolean;
    code?: string | number;
    message?: string;
    data?: unknown;
    raw: unknown;
  }> {
    const endpoint = '/iot-open/sign/device/quota/all';
    try {
      const response = await this.authenticatedRequest<unknown>(
        'GET',
        endpoint,
        { sn: deviceSn },
        false
      );

      if (response && typeof response === 'object') {
        const apiResponse = response as {
          code?: string | number;
          message?: string;
          data?: unknown;
        };
        const code = apiResponse.code;
        const codeStr = code !== undefined && code !== null ? String(code) : undefined;
        const ok = codeStr === '0' || codeStr === undefined;

        if (codeStr && codeStr !== '0') {
          this.setLastDeviceError(
            deviceSn,
            apiResponse.message || codeStr,
            codeStr
          );
          return {
            ok: false,
            code,
            message: apiResponse.message,
            data: apiResponse.data,
            raw: response,
          };
        }

        if (ok && apiResponse.data !== undefined) {
          this.clearLastDeviceError(deviceSn);
        }

        return {
          ok: true,
          code,
          message: apiResponse.message,
          data: apiResponse.data,
          raw: response,
        };
      }

      return {
        ok: false,
        message: 'Unexpected response structure from Device Status API',
        raw: response,
      };
    } catch (error) {
      const err = error as Error & { code?: string; name?: string; response?: unknown };
      this.setLastDeviceError(deviceSn, err.message, err.code);
      return {
        ok: false,
        code: err.code,
        message: err.message,
        raw: err.response ?? { error: err.message },
      };
    }
  }

  /**
   * Log quota/all reject details (SN, API code, canonical signing string — no secret)
   * and throw a typed EcoflowAPIError. Misleading "signature is wrong" is clarified
   * so Tau (P351…) vs Taurus (D3M1…) failures are easier to compare in ops logs.
   */
  private throwQuotaAllApiError(
    deviceSn: string,
    apiCode: string,
    vendorMessage: string | undefined,
    response: unknown,
    httpStatus?: number
  ): never {
    const signing = this.lastSigningDebug;
    const messageText = vendorMessage || apiCode;

    logger.warn('Ecoflow quota/all rejected', {
      sn: deviceSn,
      httpStatus: httpStatus ?? null,
      apiCode,
      message: vendorMessage,
      canonicalSigningString: signing?.canonicalSigningString ?? null,
      requestParams: signing?.requestParams ?? null,
      nonce: signing?.nonce ?? null,
      timestamp: signing?.timestamp ?? null,
      accessKey: signing?.accessKey ?? null,
      endpoint: signing?.endpoint ?? '/iot-open/sign/device/quota/all',
      apiBaseUrl: this.config.ecoflow.apiBaseUrl,
      // Compare failing Tau P351… with successful Taurus D3M1… using the same fields above.
    });

    const misleadingSignature = /signature\s+is\s+wrong/i.test(messageText);
    const message = misleadingSignature
      ? `Ecoflow rejected quota/all for SN ${deviceSn} with "${messageText}". ` +
        `This often means the SN is unsupported, offline, or not entitled on this account/region ` +
        `(not a global HMAC failure). Compare logs with a working SN (e.g. Taurus D3M1…). ` +
        `Vendor code: ${apiCode}.`
      : `Ecoflow API error: ${messageText}`;

    this.setLastDeviceError(deviceSn, message, String(apiCode));
    throw new EcoflowAPIError(message, String(apiCode), httpStatus, response);
  }

  /**
   * Get MQTT certification
   * Returns MQTT credentials (certificateAccount, certificatePassword, url, port, protocol)
   * According to official documentation: https://developer-eu.ecoflow.com
   */
  async getMQTTCertification(): Promise<EcoflowMQTTCertificationResponse> {
    const response = await this.authenticatedRequest<unknown>(
      'GET',
      '/iot-open/sign/certification'
    );

    // Validate response
    const parseResult = safeParseEcoflowMQTTCertificationResponse(response);
    if (!parseResult.success) {
      throw new EcoflowValidationError(
        'Invalid MQTT certification response structure',
        parseResult.error.issues,
        new Error('MQTT certification validation failed')
      );
    }

    // Check for error code
    if (parseResult.data.code !== '0') {
      throw new EcoflowAPIError(
        parseResult.data.message || 'Failed to get MQTT certification',
        parseResult.data.code,
        undefined,
        response
      );
    }

    return parseResult.data;
  }
}

// Singleton instance
export const ecoflowService = new EcoflowService();
