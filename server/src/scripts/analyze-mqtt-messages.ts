/**
 * Script to analyze MQTT messages structure
 * Run with: npm run analyze-mqtt
 */

import mqtt, { MqttClient } from 'mqtt';
import { getConfig } from '../config/env';
import { ecoflowService } from '../services/ecoflow';
import fs from 'fs';
import path from 'path';

interface MessageSample {
  topic: string;
  timestamp: number;
  data: unknown;
}

const messages: MessageSample[] = [];
const MAX_MESSAGES = 20; // Collect up to 20 messages

async function analyzeMQTTMessages() {
  console.log('🔍 Starting MQTT message analysis...\n');

  const config = getConfig();
  
  if (!config.ecoflow.mqtt?.enabled) {
    console.error('❌ MQTT is not enabled. Set ECOFLOW_MQTT_ENABLED=true');
    process.exit(1);
  }

  // Get MQTT certification
  console.log('📋 Fetching MQTT certification...');
  const certificationResponse = await ecoflowService.getMQTTCertification();
  const certification = certificationResponse.data;
  console.log('✅ MQTT certification received\n');

  // Get device list
  console.log('📋 Fetching device list...');
  const devicesResponse = await ecoflowService.getDevices();
  const devices = devicesResponse.devices || [];
  console.log(`✅ Found ${devices.length} devices\n`);

  if (devices.length === 0) {
    console.error('❌ No devices found');
    process.exit(1);
  }

  // Connect to MQTT
  const brokerUrl = `${certification.protocol}://${certification.url}:${certification.port}`;
  console.log(`🔌 Connecting to MQTT broker: ${brokerUrl}`);

  const client: MqttClient = mqtt.connect(brokerUrl, {
    clientId: `ecoflow-analyzer-${Date.now()}`,
    username: certification.certificateAccount,
    password: certification.certificatePassword,
    clean: true,
  });

  return new Promise<void>((resolve, reject) => {
    client.on('connect', () => {
      console.log('✅ MQTT connected\n');

      // Subscribe to all devices
      const certificateAccount = certification.certificateAccount;
      devices.forEach((device) => {
        const topics = [
          `/open/${certificateAccount}/${device.sn}/quota`,
          `/open/${certificateAccount}/${device.sn}/status`,
        ];

        topics.forEach((topic) => {
          client.subscribe(topic, (err) => {
            if (err) {
              console.error(`❌ Failed to subscribe to ${topic}:`, err.message);
            } else {
              console.log(`✅ Subscribed to: ${topic}`);
            }
          });
        });
      });

      console.log('\n⏳ Waiting for MQTT messages... (will collect up to 20 messages)\n');

      // Set timeout to stop after 60 seconds
      const timeout = setTimeout(() => {
        console.log('\n⏰ Timeout reached. Analyzing collected messages...\n');
        client.end();
        analyzeCollectedMessages();
        resolve();
      }, 60000);

      // Collect messages
      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          
          messages.push({
            topic,
            timestamp: Date.now(),
            data,
          });

          console.log(`\n📨 Message ${messages.length}/${MAX_MESSAGES} received on ${topic}:`);
          console.log(JSON.stringify(data, null, 2));

          if (messages.length >= MAX_MESSAGES) {
            clearTimeout(timeout);
            console.log('\n✅ Collected enough messages. Analyzing...\n');
            client.end();
            analyzeCollectedMessages();
            resolve();
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });
    });

    client.on('error', (error) => {
      console.error('❌ MQTT connection error:', error);
      reject(error);
    });
  });
}

function analyzeCollectedMessages() {
  console.log('📊 Analysis Results\n');
  console.log(`Total messages collected: ${messages.length}\n`);

  // Group by topic
  const byTopic: Record<string, MessageSample[]> = {};
  messages.forEach((msg) => {
    if (!byTopic[msg.topic]) {
      byTopic[msg.topic] = [];
    }
    byTopic[msg.topic].push(msg);
  });

  console.log('📋 Messages by topic:');
  Object.keys(byTopic).forEach((topic) => {
    console.log(`  ${topic}: ${byTopic[topic].length} messages`);
  });
  console.log('');

  // Analyze structure
  console.log('🔍 Message structure analysis:\n');
  
  Object.keys(byTopic).forEach((topic) => {
    const samples = byTopic[topic];
    if (samples.length === 0) return;

    console.log(`\n📌 Topic: ${topic}`);
    console.log(`   Messages: ${samples.length}`);
    
    const firstMessage = samples[0].data as Record<string, unknown>;
    console.log(`   Top-level keys: ${Object.keys(firstMessage).join(', ')}`);

    // Check for common structures
    if ('data' in firstMessage) {
      const dataField = firstMessage.data as Record<string, unknown>;
      console.log(`   'data' field keys: ${Object.keys(dataField).join(', ')}`);
      
      // Check for battery level in data
      const batteryFields = ['soc', 'bpSoc', 'batteryLevel', 'battery', 'batteryPercent', 'batterySoc', 'batterySOC'];
      const foundBattery = batteryFields.find(field => field in dataField);
      if (foundBattery) {
        console.log(`   ✅ Found battery field in 'data': ${foundBattery} = ${dataField[foundBattery]}`);
      }
    }

    if ('params' in firstMessage) {
      const paramsField = firstMessage.params as Record<string, unknown>;
      console.log(`   'params' field keys: ${Object.keys(paramsField).join(', ')}`);
      
      // Check for battery level in params
      const batteryFields = ['soc', 'bpSoc', 'batteryLevel', 'battery', 'batteryPercent', 'batterySoc', 'batterySOC'];
      const foundBattery = batteryFields.find(field => field in paramsField);
      if (foundBattery) {
        console.log(`   ✅ Found battery field in 'params': ${foundBattery} = ${paramsField[foundBattery]}`);
      }
    }

    // Deep search for battery level
    const batteryFields = ['soc', 'bpSoc', 'batteryLevel', 'battery', 'batteryPercent', 'batterySoc', 'batterySOC'];
    const deepSearch = (obj: unknown, keys: string[]): { field: string; value: unknown } | null => {
      if (typeof obj !== 'object' || obj === null) return null;
      
      const record = obj as Record<string, unknown>;
      for (const key of keys) {
        if (key in record) {
          return { field: key, value: record[key] };
        }
      }
      
      for (const value of Object.values(record)) {
        if (typeof value === 'object' && value !== null) {
          const found = deepSearch(value, keys);
          if (found) return found;
        }
      }
      
      return null;
    };

    const batteryInfo = deepSearch(firstMessage, batteryFields);
    if (batteryInfo) {
      console.log(`   ✅ Found battery level: ${batteryInfo.field} = ${batteryInfo.value}`);
    } else {
      console.log(`   ⚠️  No battery level found in message`);
    }
  });

  // Save to file
  const outputFile = path.join(__dirname, '../../mqtt_messages_analysis.json');
  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        collectedAt: new Date().toISOString(),
        totalMessages: messages.length,
        messagesByTopic: byTopic,
        allMessages: messages,
      },
      null,
      2
    )
  );
  console.log(`\n💾 Analysis saved to: ${outputFile}`);
}

// Run if executed directly
if (require.main === module) {
  analyzeMQTTMessages()
    .then(() => {
      console.log('\n✅ Analysis complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzeMQTTMessages };

