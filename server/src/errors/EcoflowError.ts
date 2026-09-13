/**
 * Custom error classes for Ecoflow service
 */

/**
 * Base error class for Ecoflow-related errors
 */
export class EcoflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EcoflowError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for API-related issues
 */
export class EcoflowAPIError extends EcoflowError {
  constructor(
    message: string,
    code: string,
    public statusCode?: number,
    public response?: unknown,
    originalError?: Error
  ) {
    super(message, code, originalError);
    this.name = 'EcoflowAPIError';
  }
}

/**
 * Error for validation issues
 */
export class EcoflowValidationError extends EcoflowError {
  constructor(
    message: string,
    public validationErrors: unknown,
    originalError?: Error
  ) {
    super(message, 'VALIDATION_ERROR', originalError);
    this.name = 'EcoflowValidationError';
  }
}

/**
 * Error for MQTT-related issues
 */
export class EcoflowMQTTError extends EcoflowError {
  constructor(
    message: string,
    public mqttError?: Error,
    originalError?: Error
  ) {
    super(message, 'MQTT_ERROR', originalError);
    this.name = 'EcoflowMQTTError';
  }
}

/**
 * Error for network/connection issues
 */
export class EcoflowNetworkError extends EcoflowError {
  constructor(
    message: string,
    public networkError?: Error,
    originalError?: Error
  ) {
    super(message, 'NETWORK_ERROR', originalError);
    this.name = 'EcoflowNetworkError';
  }
}

