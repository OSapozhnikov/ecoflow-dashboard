/**
 * Swagger/OpenAPI configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { getConfig } from './env';

const config = getConfig();

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ecoflow Delta 3 Monitor API',
      version: '1.0.0',
      description: 'API для моніторингу стану батарей пристроїв Ecoflow Delta 3 Max Plus та Delta 3 Plus у реальному часі.',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server (direct)',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server (via Vite proxy)',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Devices',
        description: 'Операції з пристроями',
      },
      {
        name: 'Status',
        description: 'Статус пристроїв',
      },
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
    ],
    components: {
      schemas: {
        Device: {
          type: 'object',
          properties: {
            sn: {
              type: 'string',
              description: 'Serial number пристрою',
              example: 'ABC123456789',
            },
            deviceName: {
              type: 'string',
              description: 'Назва пристрою',
              example: 'Delta 3 Max Plus',
            },
            deviceType: {
              type: 'string',
              description: 'Тип пристрою',
              example: 'DELTA_3_MAX_PLUS',
            },
            online: {
              type: 'number',
              description: 'Статус онлайн (1 = online, 0 = offline)',
              example: 1,
            },
          },
        },
        DeviceListResponse: {
          type: 'object',
          properties: {
            devices: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Device',
              },
            },
            total: {
              type: 'number',
              description: 'Загальна кількість пристроїв',
              example: 2,
            },
          },
        },
        DeviceStatus: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'ID пристрою',
              example: 'ABC123456789',
            },
            batteryLevel: {
              type: 'number',
              description: 'Рівень заряду батареї (0-100)',
              example: 85,
              minimum: 0,
              maximum: 100,
            },
            status: {
              type: 'string',
              enum: ['charging', 'discharging', 'standby'],
              description: 'Статус пристрою',
              example: 'charging',
            },
            chargeRate: {
              type: 'number',
              description: 'Швидкість заряджання (W)',
              example: 120,
            },
            dischargeRate: {
              type: 'number',
              description: 'Швидкість розряджання (W)',
              example: 0,
            },
            timestamp: {
              type: 'number',
              description: 'Unix timestamp',
              example: 1704451200000,
            },
          },
        },
        DeviceStatusResponse: {
          type: 'object',
          properties: {
            deviceId: {
              type: 'string',
              description: 'ID пристрою',
              example: 'ABC123456789',
            },
            data: {
              $ref: '#/components/schemas/DeviceStatus',
            },
            source: {
              type: 'string',
              enum: ['mqtt', 'rest', 'error'],
              description: 'Джерело даних',
              example: 'mqtt',
            },
            timestamp: {
              type: 'number',
              description: 'Unix timestamp',
              example: 1704451200000,
            },
          },
        },
        ConnectionStatus: {
          type: 'object',
          properties: {
            usingMQTT: {
              type: 'boolean',
              description: 'Чи використовується MQTT',
              example: true,
            },
            mqttConnected: {
              type: 'boolean',
              description: 'Чи підключено до MQTT брокера',
              example: true,
            },
            websocketEnabled: {
              type: 'boolean',
              description: 'Чи увімкнено WebSocket',
              example: true,
            },
            websocketClients: {
              type: 'number',
              description: 'Кількість підключених WebSocket клієнтів',
              example: 2,
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Повідомлення про помилку',
                  example: 'Device not found',
                },
                code: {
                  type: 'string',
                  description: 'Код помилки',
                  example: 'DEVICE_NOT_FOUND',
                },
              },
            },
          },
        },
      },
      responses: {
        NotFound: {
          description: 'Ресурс не знайдено',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Внутрішня помилка сервера',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        BadRequest: {
          description: 'Невірний запит',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
        RateLimitExceeded: {
          description: 'Перевищено ліміт запитів',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/app.ts', './src/config/swagger.docs.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

