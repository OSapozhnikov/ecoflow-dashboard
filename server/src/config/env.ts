/**
 * Environment variables validation and configuration (Zod)
 */

import { z } from 'zod';

const envSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/, 'PORT must be a number')
    .default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ECOFLOW_ACCESS_KEY: z.string().min(1, 'ECOFLOW_ACCESS_KEY is required'),
  ECOFLOW_SECRET_KEY: z.string().min(1, 'ECOFLOW_SECRET_KEY is required'),
  ECOFLOW_API_BASE_URL: z.string().url('ECOFLOW_API_BASE_URL must be a valid URL'),
  ECOFLOW_MQTT_ENABLED: z.enum(['true', 'false']).optional(),
  ECOFLOW_MQTT_BROKER_URL: z.string().optional(),
  ECOFLOW_MQTT_AUTH_TYPE: z.enum(['access_key', 'email', 'api']).optional(),
  ECOFLOW_MQTT_USERNAME: z.string().optional(),
  ECOFLOW_MQTT_PASSWORD: z.string().optional(),
  ECOFLOW_MQTT_EMAIL: z.string().optional(),
  ECOFLOW_MQTT_CLIENT_ID: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  WEBSOCKET_ENABLED: z.enum(['true', 'false']).optional(),
  WEBSOCKET_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export interface Config {
  port: number;
  nodeEnv: Env['NODE_ENV'];
  ecoflow: {
    accessKey: string;
    secretKey: string;
    apiBaseUrl: string;
    mqtt?: {
      brokerUrl: string;
      enabled: boolean;
      authType?: 'access_key' | 'email' | 'api';
      username?: string;
      password?: string;
      email?: string;
      clientId?: string;
    };
  };
  cors: {
    origin: string;
  };
  websocket?: {
    enabled: boolean;
    path: string;
  };
}

let cachedConfig: Config | null = null;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${details}\n` +
        'Please check your .env file or environment configuration.'
    );
  }
  return result.data;
}

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = validateEnv();
  const mqttEnabled = env.ECOFLOW_MQTT_ENABLED === 'true';
  const mqttBrokerUrl = env.ECOFLOW_MQTT_BROKER_URL || 'mqtt://mqtt.ecoflow.com:1883';

  cachedConfig = {
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
    ecoflow: {
      accessKey: env.ECOFLOW_ACCESS_KEY,
      secretKey: env.ECOFLOW_SECRET_KEY,
      apiBaseUrl: env.ECOFLOW_API_BASE_URL,
      mqtt: mqttEnabled
        ? {
            brokerUrl: mqttBrokerUrl,
            enabled: true,
            // MQTT credentials come from /iot-open/sign/certification when authType is api
            authType: env.ECOFLOW_MQTT_AUTH_TYPE || 'api',
            username: env.ECOFLOW_MQTT_USERNAME,
            password: env.ECOFLOW_MQTT_PASSWORD,
            email: env.ECOFLOW_MQTT_EMAIL,
            clientId: env.ECOFLOW_MQTT_CLIENT_ID || `ecoflow-monitor-${Date.now()}`,
          }
        : undefined,
    },
    cors: {
      origin: env.CORS_ORIGIN || 'http://localhost:3000',
    },
    websocket: {
      enabled: env.WEBSOCKET_ENABLED !== 'false',
      path: env.WEBSOCKET_PATH || '/ws',
    },
  };

  return cachedConfig;
}

/** Reset cached config (tests only) */
export function resetConfigCache(): void {
  cachedConfig = null;
}
