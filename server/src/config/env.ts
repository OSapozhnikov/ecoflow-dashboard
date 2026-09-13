/**
 * Environment variables validation and configuration
 */

const requiredEnvVars = [
  'ECOFLOW_ACCESS_KEY',
  'ECOFLOW_SECRET_KEY',
  'ECOFLOW_API_BASE_URL',
  'PORT'
];

export function validateEnv(): void {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
}

export interface Config {
  port: number;
  nodeEnv: string;
  ecoflow: {
    accessKey: string;
    secretKey: string;
    apiBaseUrl: string;
    mqtt?: {
      brokerUrl: string;
      enabled: boolean;
      authType?: 'access_key' | 'email';
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

export function getConfig(): Config {
  validateEnv();

  const mqttEnabled = process.env.ECOFLOW_MQTT_ENABLED === 'true';
  const mqttBrokerUrl = process.env.ECOFLOW_MQTT_BROKER_URL || 'mqtt://mqtt.ecoflow.com:1883';

  return {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    ecoflow: {
      accessKey: process.env.ECOFLOW_ACCESS_KEY!,
      secretKey: process.env.ECOFLOW_SECRET_KEY!,
      apiBaseUrl: process.env.ECOFLOW_API_BASE_URL!,
      mqtt: mqttEnabled ? {
        brokerUrl: mqttBrokerUrl, // This is now a fallback, actual URL comes from API
        enabled: true,
        // Note: MQTT credentials are now obtained via API endpoint /iot-open/sign/certification
        // The following fields are kept for backward compatibility but may not be used
        authType: (process.env.ECOFLOW_MQTT_AUTH_TYPE as 'access_key' | 'email') || 'api', // 'api' means use certification endpoint
        username: process.env.ECOFLOW_MQTT_USERNAME, // Not used when authType='api'
        password: process.env.ECOFLOW_MQTT_PASSWORD, // Not used when authType='api'
        email: process.env.ECOFLOW_MQTT_EMAIL, // Not used when authType='api'
        clientId: process.env.ECOFLOW_MQTT_CLIENT_ID || `ecoflow-monitor-${Date.now()}`,
      } : undefined,
    },
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    },
    websocket: {
      enabled: process.env.WEBSOCKET_ENABLED !== 'false',
      path: process.env.WEBSOCKET_PATH || '/ws',
    },
  };
}

