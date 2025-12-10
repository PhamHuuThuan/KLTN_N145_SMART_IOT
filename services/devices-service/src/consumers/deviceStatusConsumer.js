import { Kafka } from 'kafkajs';
import Device from '../models/Device.js';
import logger from '../utils/logger.js';
import { activateEmergencyMode } from '../services/autoEmergencyScheduler.js';

const kafka = new Kafka({
  clientId: 'devices-status-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:29092').split(','),
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ 
  groupId: 'devices-status-group',
  allowAutoTopicCreation: true,
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

const TEMP_EMERGENCY_THRESHOLD = Number(process.env.EMERGENCY_AUTO_TEMP_THRESHOLD || 60);
const EMERGENCY_SENSOR_TYPES = new Set(['gas_ppm', 'gas', 'smoke', 'flame']);
const AUTO_EMERGENCY_TOPICS = ['device-alerts', 'iot.alerts.ml'];
const LEGACY_TOPICS = ['device.status.updated', 'outlet.toggled'];

async function startDeviceStatusConsumer() {
  try {
    await consumer.connect();

    const topicsToSubscribe = [...new Set([...AUTO_EMERGENCY_TOPICS, ...LEGACY_TOPICS])];
    for (const topic of topicsToSubscribe) {
      await consumer.subscribe({
        topic,
        fromBeginning: false
      });
    }

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 5000,
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());

          switch (topic) {
            case 'device.status.updated':
              await handleDeviceStatusUpdate(messageData);
              break;
            case 'outlet.toggled':
              await handleOutletToggle(messageData);
              break;
            case 'device-alerts':
              await handleDeviceAlert(messageData);
              break;
            case 'iot.alerts.ml':
              await handleMlAlert(messageData);
              break;
          }
        } catch (error) {
          logger.error('Error processing device status message:', error);
          logger.error('Error details:', {
            message: error.message,
            stack: error.stack,
            topic,
            partition,
            messageValue: message.value.toString()
          });
          
          try {
            await consumer.commitOffsets([{
              topic,
              partition,
              offset: message.offset
            }]);
          } catch (commitError) {
            logger.error('Error committing offset:', commitError);
          }
        }
      },
    });
  } catch (error) {
    logger.error('Error starting device status consumer:', error);
  }
}

async function handleDeviceStatusUpdate(data) {
  try {
    const { deviceId, outletId, status, action } = data;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.error(`Device not found: ${deviceId}`);
      return;
    }

    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
    } else {
      logger.error(`Outlet not found: ${outletId}`);
    }
  } catch (error) {
    logger.error('Error handling device status update:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      data
    });
  }
}

async function handleOutletToggle(data) {
  try {
    const { deviceId, outletId, status } = data;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.error(`Device not found: ${deviceId}`);
      return;
    }

    const outlet = device.outlets.find(o => o.id === outletId);
    if (outlet) {
      outlet.status = status;
      outlet.lastToggleAt = new Date();
      await device.save();
    } else {
      logger.error(`Outlet not found: ${outletId}`);
    }
  } catch (error) {
    logger.error('Error handling outlet toggle:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      data
    });
  }
}

function isEmergencyAlert(message) {
  if (!message) return false;

  const priority = String(message.priority || '').toLowerCase();
  const category = String(message.category || '').toLowerCase();
  if (priority === 'urgent' || category === 'security') {
    return true;
  }

  const sensorType = String(message.sensorType || '').toLowerCase();
  if (EMERGENCY_SENSOR_TYPES.has(sensorType)) {
    return true;
  }

  if (sensorType === 'temperature') {
    const sensorValue = Number(message.sensorValue);
    return !Number.isNaN(sensorValue) && sensorValue >= TEMP_EMERGENCY_THRESHOLD;
  }

  return false;
}

async function handleDeviceAlert(message) {
  try {
    if (!message?.deviceId) {
      return;
    }

    if (!isEmergencyAlert(message)) {
      return;
    }

    const device = await Device.findOne({ deviceId: message.deviceId });
    if (!device || device.emergencyMode) {
      return;
    }

    await activateEmergencyMode(device, {
      reason: `alert_${message.sensorType || 'security'}`,
      triggeredBy: 'rule_alert',
      initiatedBy: 'system:rule_alert',
      userId: message.userId || device.ownerId || null,
      metadata: {
        ruleId: message.ruleId,
        ruleName: message.ruleName,
        sensorType: message.sensorType,
        sensorValue: message.sensorValue,
        threshold: message.threshold,
        alertType: message.alertType,
        priority: message.priority,
        category: message.category
      }
    });
  } catch (error) {
    logger.error('handleDeviceAlert failed:', error);
  }
}

async function handleMlAlert(message) {
  try {
    const deviceId = message?.device_id || message?.deviceId;
    if (!deviceId) {
      return;
    }

    const alertLevel = String(message.alert_level || '').toLowerCase();
    if (!['critical', 'high'].includes(alertLevel)) {
      return;
    }

    const device = await Device.findOne({ deviceId });
    if (!device || device.emergencyMode) {
      return;
    }

    await activateEmergencyMode(device, {
      reason: `ml_${alertLevel}`,
      triggeredBy: 'ml_alert',
      initiatedBy: 'system:ml_alert',
      userId: message.userId || device.ownerId || null,
      metadata: message
    });
  } catch (error) {
    logger.error('handleMlAlert failed:', error);
  }
}

process.on('SIGINT', async () => {
  await consumer.disconnect();
  process.exit(0);
});

export { startDeviceStatusConsumer };
