import Device from '../models/Device.js';
import { producer } from '../config/kafka.js';
import logger from '../utils/logger.js';

const AUTO_EMERGENCY_DELAY_MS = Number(process.env.AUTO_EMERGENCY_DELAY_MS || 60_000);
const KAFKA_SEND_TIMEOUT_MS = Number(process.env.KAFKA_SEND_TIMEOUT_MS || 1_500);

const pendingAutoEmergencies = new Map();

const withKafkaTimeout = (promise) => {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve('timeout'), KAFKA_SEND_TIMEOUT_MS))
  ]);
};

async function dispatchOutletEvents(device, context = {}) {
  if (!producer || !device?.outlets?.length) {
    return;
  }

  const tasks = device.outlets.map((outlet) => {
    const outletId = outlet.id;
    const outletName = outlet.name || outletId;
    const status = !!outlet.status;

    const payload = {
      userId: device.ownerId || context.userId || null,
      deviceId: device.deviceId,
      deviceName: device.name,
      outletId,
      outletName,
      status,
      action: 'outlet_toggled',
      result: 'success',
      reason: context.reason || 'emergency_mode',
      triggeredBy: context.triggeredBy || 'manual',
      initiatedBy: context.initiatedBy || 'user',
      metadata: context.metadata || {},
      timestamp: new Date()
    };

    const sendPromise = producer.send({
      topic: 'outlet.toggled',
      messages: [{
        key: device.deviceId,
        value: JSON.stringify(payload)
      }]
    });

    return withKafkaTimeout(sendPromise).catch((err) => {
      logger.error('Kafka send error for outlet.toggled (non-fatal):', err?.message || err);
    });
  });

  await Promise.all(tasks);
}

async function publishUserActionEvent(device, context = {}) {
  if (!producer || !device?.ownerId) {
    return;
  }

  const payload = {
    userId: device.ownerId,
    deviceId: device.deviceId,
    deviceName: device.name,
    action: 'emergency_mode_activated',
    result: 'success',
    reason: context.reason || 'emergency_mode',
    triggeredBy: context.triggeredBy || 'manual',
    initiatedBy: context.initiatedBy || 'user',
    autoTriggered: context.triggeredBy === 'auto_timeout',
    metadata: context.metadata || {},
    timestamp: new Date()
  };

  const sendPromise = producer.send({
    topic: 'user-actions',
    messages: [{
      key: device.deviceId,
      value: JSON.stringify(payload)
    }]
  });

  await withKafkaTimeout(sendPromise).catch((err) => {
    logger.error('Kafka send error for user-actions (non-fatal):', err?.message || err);
  });
}

export async function activateEmergencyMode(device, options = {}) {
  if (!device) {
    throw new Error('Device document is required to activate emergency mode');
  }

  const {
    reason = 'manual_activation',
    triggeredBy = 'manual',
    initiatedBy = 'user',
    metadata = {}
  } = options;

  device.enterEmergencyMode();
  device.emergencyMode = true;
  device.lastEmergencyAt = new Date();
  if (typeof device.markModified === 'function') {
    device.markModified('outlets');
  }

  await device.save();

  const context = { reason, triggeredBy, initiatedBy, metadata, userId: options.userId };

  try {
    await dispatchOutletEvents(device, context);
  } catch (error) {
    logger.error('Failed to dispatch outlet events for emergency mode:', error);
  }

  try {
    await publishUserActionEvent(device, context);
  } catch (error) {
    logger.error('Failed to publish user action event for emergency mode:', error);
  }

  return device;
}

async function triggerAutoEmergency(deviceId) {
  const pendingEntry = pendingAutoEmergencies.get(deviceId);
  pendingAutoEmergencies.delete(deviceId);

  const context = pendingEntry?.context || {};

  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      logger.warn('Auto emergency skipped: device not found', { deviceId, context });
      return;
    }

    if (device.emergencyMode) {
      logger.info('Auto emergency skipped: device already in emergency mode', { deviceId });
      return;
    }

    await activateEmergencyMode(device, {
      reason: context.reason || 'auto_timeout',
      triggeredBy: context.triggeredBy || 'auto_timeout',
      initiatedBy: context.initiatedBy || 'system:auto_timeout',
      metadata: context.metadata || {},
      userId: context.userId || device.ownerId || null
    });

    logger.warn('Auto emergency activated after timeout', {
      deviceId,
      delayMs: context.delayMs || AUTO_EMERGENCY_DELAY_MS,
      source: context.source || 'unknown',
      reason: context.reason || 'auto_timeout'
    });
  } catch (error) {
    logger.error('Auto emergency activation failed:', error);
  }
}

export function cancelAutoEmergency(deviceId, cancelReason = 'manual_intervention') {
  const entry = pendingAutoEmergencies.get(deviceId);
  if (!entry) {
    return false;
  }

  clearTimeout(entry.timer);
  pendingAutoEmergencies.delete(deviceId);

  logger.info('Pending auto emergency canceled', { deviceId, cancelReason });
  return true;
}

export function scheduleAutoEmergency(context = {}) {
  const deviceId = context.deviceId || context.device_id;
  if (!deviceId) {
    logger.warn('scheduleAutoEmergency skipped: missing deviceId', { context });
    return;
  }

  const delayMs = Number(context.delayMs) || AUTO_EMERGENCY_DELAY_MS;

  if (pendingAutoEmergencies.has(deviceId)) {
    clearTimeout(pendingAutoEmergencies.get(deviceId).timer);
    pendingAutoEmergencies.delete(deviceId);
    logger.info('Existing auto emergency rescheduled', { deviceId });
  }

  const timer = setTimeout(() => {
    triggerAutoEmergency(deviceId).catch((error) => {
      logger.error('Auto emergency trigger error:', error);
    });
  }, delayMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  pendingAutoEmergencies.set(deviceId, {
    timer,
    context: {
      ...context,
      deviceId,
      delayMs,
      scheduledAt: new Date()
    },
    expiresAt: new Date(Date.now() + delayMs)
  });

  logger.warn('Auto emergency scheduled', {
    deviceId,
    delayMs,
    reason: context.reason || 'auto_timeout',
    source: context.source || 'unknown'
  });
}

