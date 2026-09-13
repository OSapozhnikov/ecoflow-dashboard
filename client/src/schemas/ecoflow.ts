/**
 * Zod schemas for runtime validation of API responses (Frontend)
 */

import { z } from 'zod';

/**
 * Schema for Device
 */
export const DeviceSchema = z.object({
  sn: z.string(),
  deviceName: z.string(),
  deviceType: z.string().optional(),
  productName: z.string().optional(),
  online: z.union([z.number(), z.boolean()]).transform((val) => {
    // Normalize to boolean
    if (typeof val === 'number') {
      return val === 1;
    }
    return val;
  }),
  deviceId: z.string().optional(),
  deviceSn: z.string().optional(),
  bindTime: z.number().optional(),
}).passthrough();

/**
 * Schema for Device List Response
 */
export const DeviceListResponseSchema = z.object({
  devices: z.array(DeviceSchema),
  total: z.number(),
});

/**
 * Schema for Device Status
 */
export const DeviceStatusSchema = z.object({
  deviceId: z.string(),
  batteryLevel: z.number().min(0).max(100),
  chargeRate: z.number().min(0).optional(),
  dischargeRate: z.number().min(0).optional(),
  status: z.enum(['charging', 'discharging', 'standby']),
  timestamp: z.number(),
}).passthrough();

/**
 * Schema for Device Status Response
 */
export const DeviceStatusResponseSchema = z.object({
  deviceId: z.string(),
  data: DeviceStatusSchema,
  source: z.enum(['mqtt', 'rest', 'error']).optional(),
  timestamp: z.number().optional(),
});

/**
 * Schema for API Error
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
  }),
});

/**
 * Type guards
 */
export function isDevice(data: unknown): data is z.infer<typeof DeviceSchema> {
  return DeviceSchema.safeParse(data).success;
}

export function isDeviceListResponse(data: unknown): data is z.infer<typeof DeviceListResponseSchema> {
  return DeviceListResponseSchema.safeParse(data).success;
}

export function isDeviceStatus(data: unknown): data is z.infer<typeof DeviceStatusSchema> {
  return DeviceStatusSchema.safeParse(data).success;
}

export function isDeviceStatusResponse(data: unknown): data is z.infer<typeof DeviceStatusResponseSchema> {
  return DeviceStatusResponseSchema.safeParse(data).success;
}

export function isApiError(data: unknown): data is z.infer<typeof ApiErrorSchema> {
  return ApiErrorSchema.safeParse(data).success;
}

/**
 * Safe parse functions
 */
export function safeParseDevice(data: unknown) {
  return DeviceSchema.safeParse(data);
}

export function safeParseDeviceListResponse(data: unknown) {
  return DeviceListResponseSchema.safeParse(data);
}

export function safeParseDeviceStatus(data: unknown) {
  return DeviceStatusSchema.safeParse(data);
}

export function safeParseDeviceStatusResponse(data: unknown) {
  return DeviceStatusResponseSchema.safeParse(data);
}

export function safeParseApiError(data: unknown) {
  return ApiErrorSchema.safeParse(data);
}

