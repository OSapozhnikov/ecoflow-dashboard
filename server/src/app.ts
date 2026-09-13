/**
 * Express application setup
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { getConfig } from './config/env';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { metricsMiddleware } from './middleware/metrics';
import { register } from './utils/metrics';
import { swaggerSpec } from './config/swagger';
import devicesRouter from './routes/devices';
import statusRouter from './routes/status';

export function createApp(): Express {
  const app = express();
  const config = getConfig();

  // Middleware
  // CORS configuration - allow multiple origins in development
  const allowedOrigins = process.env.NODE_ENV === 'development'
    ? [
        config.cors.origin,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        `http://localhost:${config.port}`,
        `http://127.0.0.1:${config.port}`,
      ]
    : [config.cors.origin];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow same-origin requests (for Swagger UI)
      if (origin.includes(`localhost:${config.port}`) || origin.includes(`127.0.0.1:${config.port}`)) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for Swagger UI
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'http://localhost:*', 'ws:', 'wss:'], // Allow API calls and WebSocket
          fontSrc: ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow WebSocket connections
    })
  );

  // Metrics middleware (before rate limiting to capture all requests)
  app.use(metricsMiddleware);

  // Rate limiting
  app.use('/api', apiLimiter);

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Сервер працює нормально
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Prometheus metrics endpoint
  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch (error) {
      res.status(500).end(error);
    }
  });

  // Swagger API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Ecoflow Delta 3 Monitor API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete'],
      validatorUrl: null, // Disable online validator
    },
  }));

  // API routes
  app.use('/api/devices', devicesRouter);
  app.use('/api/devices', statusRouter);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

