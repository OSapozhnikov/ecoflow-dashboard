/**
 * Test setup file for Vitest
 */

// Add any global test setup here
// For example, you can set up test environment variables

process.env.NODE_ENV = 'test';

// Set required environment variables for tests
process.env.ECOFLOW_ACCESS_KEY = 'test-access-key';
process.env.ECOFLOW_SECRET_KEY = 'test-secret-key';
process.env.ECOFLOW_API_BASE_URL = 'https://api.ecoflow.com';
process.env.PORT = '5000';
process.env.ECOFLOW_MQTT_ENABLED = 'true'; // Enable MQTT for tests by default

