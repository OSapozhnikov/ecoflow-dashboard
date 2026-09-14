/**
 * Zod schemas for runtime validation of Ecoflow API responses
 */

import { z } from 'zod';

/**
 * Schema for Ecoflow device
 */
export const EcoflowDeviceSchema = z.object({
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
}).passthrough(); // Allow additional fields

/**
 * Schema for Ecoflow device list response
 */
export const EcoflowDeviceListResponseSchema = z.object({
  devices: z.array(EcoflowDeviceSchema),
  total: z.number(),
});

/**
 * Schema for Ecoflow device status
 */
const DevicePortsSchema = z
  .object({
    acInW: z.number().optional(),
    acOutW: z.number().optional(),
    acOutLinesW: z.array(z.number()).optional(),
    pvW: z.number().optional(),
    pv2W: z.number().optional(),
    dc12vW: z.number().optional(),
    typec1W: z.number().optional(),
    typec2W: z.number().optional(),
    typec3W: z.number().optional(),
    qcusb1W: z.number().optional(),
    qcusb2W: z.number().optional(),
  })
  .passthrough();

const DeviceLimitsSchema = z
  .object({
    maxChargeSoc: z.number().min(0).max(100).optional(),
    minDischargeSoc: z.number().min(0).max(100).optional(),
    backupReserveSoc: z.number().min(0).max(100).optional(),
    energyBackupEnabled: z.boolean().optional(),
  })
  .passthrough();

export const EcoflowDeviceStatusSchema = z.object({
  deviceId: z.string(),
  batteryLevel: z.number().min(0).max(100),
  chargeRate: z.number().min(0).optional(),
  dischargeRate: z.number().min(0).optional(),
  status: z.enum(['charging', 'discharging', 'standby']),
  timestamp: z.number(),
  isPlug: z.boolean().optional(),
  switchSta: z.boolean().optional(),
  plugWatts: z.number().min(0).optional(),
  plugWattsAnomalous: z.boolean().optional(),
  volt: z.number().optional(),
  temp: z.number().optional(),
  runTimeSec: z.number().min(0).optional(),
  remainingChargeMin: z.number().min(0).optional(),
  remainingDischargeMin: z.number().min(0).optional(),
  ports: DevicePortsSchema.optional(),
  limits: DeviceLimitsSchema.optional(),
}).passthrough(); // Allow additional fields

/**
 * Schema for Ecoflow device status response
 */
export const EcoflowDeviceStatusResponseSchema = z.object({
  deviceId: z.string(),
  data: EcoflowDeviceStatusSchema,
});

/**
 * Schema for Ecoflow error response
 */
export const EcoflowErrorResponseSchema = z.object({
  code: z.union([z.string(), z.number()]),
  msg: z.string().optional(),
  message: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * Schema for Ecoflow MQTT certification
 */
export const EcoflowMQTTCertificationSchema = z.object({
  certificateAccount: z.string(),
  certificatePassword: z.string(),
  url: z.string(),
  port: z.string(),
  protocol: z.enum(['mqtt', 'mqtts']),
});

/**
 * Schema for Ecoflow MQTT certification response
 */
export const EcoflowMQTTCertificationResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: EcoflowMQTTCertificationSchema,
});

/**
 * Schema for generic Ecoflow API response wrapper
 */
export const EcoflowAPIResponseSchema = z.object({
  code: z.union([z.string(), z.number()]),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

/**
 * Type guards using zod schemas
 */
export function isEcoflowDevice(data: unknown): data is z.infer<typeof EcoflowDeviceSchema> {
  return EcoflowDeviceSchema.safeParse(data).success;
}

export function isEcoflowDeviceListResponse(data: unknown): data is z.infer<typeof EcoflowDeviceListResponseSchema> {
  return EcoflowDeviceListResponseSchema.safeParse(data).success;
}

export function isEcoflowDeviceStatus(data: unknown): data is z.infer<typeof EcoflowDeviceStatusSchema> {
  return EcoflowDeviceStatusSchema.safeParse(data).success;
}

export function isEcoflowDeviceStatusResponse(data: unknown): data is z.infer<typeof EcoflowDeviceStatusResponseSchema> {
  return EcoflowDeviceStatusResponseSchema.safeParse(data).success;
}

export function isEcoflowErrorResponse(data: unknown): data is z.infer<typeof EcoflowErrorResponseSchema> {
  return EcoflowErrorResponseSchema.safeParse(data).success;
}

export function isEcoflowMQTTCertificationResponse(data: unknown): data is z.infer<typeof EcoflowMQTTCertificationResponseSchema> {
  return EcoflowMQTTCertificationResponseSchema.safeParse(data).success;
}

/**
 * Safe parse with error handling
 */
export function safeParseEcoflowDevice(data: unknown) {
  return EcoflowDeviceSchema.safeParse(data);
}

export function safeParseEcoflowDeviceListResponse(data: unknown) {
  return EcoflowDeviceListResponseSchema.safeParse(data);
}

export function safeParseEcoflowDeviceStatus(data: unknown) {
  return EcoflowDeviceStatusSchema.safeParse(data);
}

export function safeParseEcoflowDeviceStatusResponse(data: unknown) {
  return EcoflowDeviceStatusResponseSchema.safeParse(data);
}

export function safeParseEcoflowErrorResponse(data: unknown) {
  return EcoflowErrorResponseSchema.safeParse(data);
}

export function safeParseEcoflowMQTTCertificationResponse(data: unknown) {
  return EcoflowMQTTCertificationResponseSchema.safeParse(data);
}

