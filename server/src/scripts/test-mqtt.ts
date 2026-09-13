/**
 * Test script for MQTT connection to Ecoflow broker
 * Usage: npm run test-mqtt
 * 
 * This script helps test MQTT connectivity and discover topic structure
 */

import 'dotenv/config';
import mqtt, { MqttClient } from 'mqtt';
import { getConfig } from '../config/env';

const config = getConfig();

if (!config.ecoflow.mqtt?.enabled) {
  console.error('❌ MQTT is not enabled in configuration.');
  console.log('Set ECOFLOW_MQTT_ENABLED=true in .env file');
  process.exit(1);
}

const mqttConfig = config.ecoflow.mqtt;

console.log('🔌 Testing MQTT connection to Ecoflow broker...');
console.log('Broker URL:', mqttConfig.brokerUrl);
console.log('Client ID:', mqttConfig.clientId);
console.log('Username:', mqttConfig.username);
console.log('');

const options = {
  clientId: mqttConfig.clientId,
  username: mqttConfig.username,
  password: mqttConfig.password,
  clean: true,
  connectTimeout: 10000,
  keepalive: 60,
};

let client: MqttClient | null = null;

try {
  client = mqtt.connect(mqttConfig.brokerUrl, options);

  client.on('connect', () => {
    console.log('✅ Successfully connected to MQTT broker!');
    console.log('');
    
    // Try subscribing to common topic patterns
    const testTopics = [
      'device/+/status',
      'device/+/quota',
      'device/+/data',
      'ecoflow/+/status',
      'ecoflow/+/quota',
      'ecoflow/+/data',
      '#', // Subscribe to all topics (for discovery)
    ];

    console.log('📡 Subscribing to test topics for discovery...');
    testTopics.forEach((topic) => {
      client!.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
        } else {
          console.log(`✅ Subscribed to: ${topic}`);
        }
      });
    });

    console.log('');
    console.log('⏳ Waiting for messages (30 seconds)...');
    console.log('Press Ctrl+C to exit');
    console.log('');
  });

  client.on('message', (topic: string, message: Buffer) => {
    console.log('📨 Message received:');
    console.log('  Topic:', topic);
    console.log('  Message:', message.toString());
    
    try {
      const data = JSON.parse(message.toString());
      console.log('  Parsed JSON:', JSON.stringify(data, null, 2));
    } catch {
      console.log('  (Not valid JSON)');
    }
    console.log('');
  });

  client.on('error', (error: Error) => {
    console.error('❌ MQTT error:', error.message);
  });

  client.on('close', () => {
    console.log('🔌 Connection closed');
  });

  client.on('offline', () => {
    console.log('⚠️  Client went offline');
  });

  // Auto-disconnect after 30 seconds
  setTimeout(() => {
    console.log('');
    console.log('⏰ Test timeout (30 seconds). Disconnecting...');
    if (client) {
      client.end();
      process.exit(0);
    }
  }, 30000);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('');
    console.log('👋 Disconnecting...');
    if (client) {
      client.end();
    }
    process.exit(0);
  });

} catch (error) {
  const err = error as Error;
  console.error('❌ Failed to create MQTT client:', err.message);
  process.exit(1);
}

