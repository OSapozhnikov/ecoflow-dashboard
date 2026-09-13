/**
 * Structured logging utility using Winston
 */

import winston from 'winston';
import { getConfig } from '../config/env';

const config = getConfig();
const isProduction = config.nodeEnv === 'production';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const transports: winston.transport[] = isProduction
  ? [
      // Production: stdout JSON only (no file transports to logs/)
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
      }),
    ]
  : [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.colorize({ all: true }),
          winston.format.printf(
            (info: winston.Logform.TransformableInfo) =>
              `${info.timestamp} ${info.level}: ${info.message}`
          )
        ),
      }),
    ];

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
  exitOnError: false,
});

export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
