import Device from '../models/Device.js';
import { OUTLET_TYPES } from '../constants/outletTypes.js';
import { producer } from '../config/kafka.js';
import logger from '../utils/logger.js';
import { activateEmergencyMode, cancelAutoEmergency } from '../services/autoEmergencyScheduler.js';
import { emitDeviceTelemetry } from '../realtime/socket.js';

const checkDeviceOwnership = async (deviceId, userId, isAdmin = false) => {
  const device = await Device.findOne({ deviceId });
  if (!device) {
    return { success: false, message: 'Device not found', device: null };
  }
  
  if (!isAdmin && device.ownerId !== userId) {
    return { success: false, message: 'Access denied: You can only access your own devices', device: null };
  }
  
  return { success: true, device };
};

export const getAllDevices = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { status, limit = 50, page = 1 } = req.query;
    
    let query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'service') {
      query.ownerId = userId;
    } else if (req.query.ownerId) {
      query.ownerId = req.query.ownerId;
    }
    
    if (status) query.status = status;
    
    const devices = await Device.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Device.countDocuments(query);
    
    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching devices',
      error: error.message
    });
  }
};

export const getDeviceById = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    res.json({
      success: true,
      data: ownershipCheck.device
    });
  } catch (error) {
    logger.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device',
      error: error.message
    });
  }
};

export const createDevice = async (req, res) => {
  try {
    const userId = req.user.sub;
    const userRole = req.user.role || 'user';
    const {
      deviceId,
      name,
      outlets
    } = req.body;
    
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      if (existingDevice.ownerId) {
        return res.status(400).json({
          success: false,
          message: 'Device is already assigned to another user'
        });
      }
      
      if (userRole !== 'admin') {
        existingDevice.ownerId = userId;
      }
      existingDevice.name = name || existingDevice.name;
      await existingDevice.save();
      
      return res.status(200).json({
        success: true,
        data: existingDevice,
        message: 'Device assigned successfully'
      });
    }
    
    const defaultOutlets = outlets || [
      { id: 'o1', type: OUTLET_TYPES.KITCHEN, name: 'Kitchen Outlet 1' },
      { id: 'o2', type: OUTLET_TYPES.KITCHEN, name: 'Kitchen Outlet 2' },
      { id: 'o3', type: OUTLET_TYPES.KITCHEN, name: 'Kitchen Outlet 3' },
      { id: 'o4', type: OUTLET_TYPES.SAFETY,  name: 'Safety Outlet 1' }
    ];
    
    const device = new Device({
      deviceId,
      ownerId: userRole === 'admin' ? null : userId,
      name,
      outlets: defaultOutlets
    });
    
    await device.save();
    
    res.status(201).json({
      success: true,
      data: device,
      message: 'Device created successfully'
    });
  } catch (error) {
    logger.error('Error creating device:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating device',
      error: error.message
    });
  }
};

export const updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    const updateData = req.body;
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    res.json({
      success: true,
      data: device,
      message: 'Device updated successfully'
    });
  } catch (error) {
    logger.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating device',
      error: error.message
    });
  }
};

export const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin';
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = await Device.findOneAndDelete({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting device',
      error: error.message
    });
  }
};

export const toggleOutlet = async (req, res) => {
  try {
    const { deviceId, outletId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    let { status } = req.body;
    
    if (typeof status === 'string') {
      status = status.toLowerCase() === 'true' || status.toLowerCase() === 'on' || status === '1';
    }
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    
    if (device.status !== 'online') {
      return res.status(400).json({
        success: false,
        message: 'Device is offline'
      });
    }
    
    const success = device.toggleOutlet(outletId, status);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid outlet ID'
      });
    }
    
    await device.save();

    const outlet = device.outlets.find(o => o.id === outletId);
    const outletName = outlet ? outlet.name : outletId;
    
    const sendPromise = producer.send({
      topic: 'outlet.toggled',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          userId: device.ownerId,
          deviceId,
          deviceName: device.name,
          outletId,
          outletName,
          status,
          action: 'outlet_toggled',
          result: 'success',
          timestamp: new Date()
        })
      }]
    });

    const timeoutMs = Number(process.env.KAFKA_SEND_TIMEOUT_MS || 1500);
    await Promise.race([
      sendPromise,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs))
    ]).catch((err) => {
      logger.error('Kafka send error (non-fatal):', err?.message || err);
    });
    
    res.json({
      success: true,
      data: device,
      message: `Outlet ${outletId} ${status ? 'turned on' : 'turned off'} successfully`
    });
  } catch (error) {
    logger.error('Error toggling outlet:', error);
    
    try {
      const { deviceId, outletId } = req.params;
      const device = await Device.findOne({ deviceId });
      if (device) {
        await producer.send({
          topic: 'outlet.toggled',
          messages: [{
            key: deviceId,
            value: JSON.stringify({
              userId: device.ownerId,
              deviceId,
              deviceName: device.name,
              outletId,
              status: null,
              action: 'outlet_toggled',
              result: 'failed',
              error: error.message,
              timestamp: new Date()
            })
          }]
        });
      }
    } catch (kafkaError) {
      logger.error('Error publishing failure event:', kafkaError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error toggling outlet',
      error: error.message
    });
  }
};

export const enterEmergencyMode = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    
    cancelAutoEmergency(deviceId, 'manual_activation');

    const updatedDevice = await activateEmergencyMode(device, {
      reason: req.body?.reason || 'manual_activation',
      triggeredBy: 'manual',
      initiatedBy: userId,
      metadata: {
        source: 'api_enter_emergency',
        triggeredByUser: userId
      }
    });

    res.json({
      success: true,
      data: updatedDevice,
      message: 'Emergency mode activated successfully'
    });
  } catch (error) {
    logger.error('Error activating emergency mode:', error);
    res.status(500).json({
      success: false,
      message: 'Error activating emergency mode',
      error: error.message
    });
  }
};

export const exitEmergencyMode = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    cancelAutoEmergency(deviceId, 'manual_exit');
    device.exitEmergencyMode();
    await device.save();
    
    producer.send({
      topic: 'outlet.toggled',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          userId: device.ownerId,
          deviceId,
          deviceName: device.name,
          outletId: BUZZER_OUTLET_ID,
          outletName: 'Buzzer',
          status: false,
          action: 'outlet_toggled',
          result: 'success',
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish buzzer off event to Kafka:', kafkaError);
    });
    
    producer.send({
      topic: 'user-actions',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          userId: device.ownerId,
          deviceId,
          deviceName: device.name,
          action: 'emergency_mode_deactivated',
          result: 'success',
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish emergency mode deactivation event to Kafka:', kafkaError);
    });

    try {
      if (device.latestTelemetry) {
        emitDeviceTelemetry(deviceId, device.latestTelemetry, device);
      }
    } catch (error) {
      logger.error('Failed to emit device telemetry with emergency mode:', error);
    }
    
    res.json({
      success: true,
      data: device,
      message: 'Emergency mode deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating emergency mode:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating emergency mode',
      error: error.message
    });
  }
};

const BUZZER_OUTLET_ID = 'o5';

const sendBuzzerCommand = async (deviceId, userId, isAdmin, targetStatus) => {
  const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
  if (!ownershipCheck.success) {
    throw new Error(ownershipCheck.message);
  }
  
  const device = ownershipCheck.device;
  
  producer.send({
    topic: 'outlet.toggled',
    messages: [{
      key: deviceId,
      value: JSON.stringify({
        userId: device.ownerId,
        deviceId,
        deviceName: device.name,
        outletId: BUZZER_OUTLET_ID,
        outletName: 'Buzzer',
        status: targetStatus,
        action: 'outlet_toggled',
        result: 'success',
        timestamp: new Date()
      })
    }]
  }).catch((kafkaError) => {
    logger.error('Failed to publish buzzer command to Kafka:', kafkaError);
  });
  
  return device;
};

export const toggleBuzzer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const device = await sendBuzzerCommand(deviceId, userId, isAdmin, true);
    
    res.json({
      success: true,
      data: device,
      message: 'Buzzer command sent successfully'
    });
  } catch (error) {
    logger.error('Error toggling buzzer:', error);
    const statusCode = error.message.includes('not found') ? 404 
      : error.message.includes('Access denied') ? 403 
      : 500;
    res.status(statusCode).json({
      success: false,
      message: 'Error toggling buzzer',
      error: error.message
    });
  }
};

export const turnOnBuzzer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const device = await sendBuzzerCommand(deviceId, userId, isAdmin, true);
    
    res.json({
      success: true,
      data: device,
      message: 'Buzzer turned on successfully'
    });
  } catch (error) {
    logger.error('Error turning on buzzer:', error);
    const statusCode = error.message.includes('not found') ? 404 
      : error.message.includes('Access denied') ? 403 
      : 500;
    res.status(statusCode).json({
      success: false,
      message: 'Error turning on buzzer',
      error: error.message
    });
  }
};

export const turnOffBuzzer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const device = await sendBuzzerCommand(deviceId, userId, isAdmin, false);
    
    res.json({
      success: true,
      data: device,
      message: 'Buzzer turned off successfully'
    });
  } catch (error) {
    logger.error('Error turning off buzzer:', error);
    const statusCode = error.message.includes('not found') ? 404 
      : error.message.includes('Access denied') ? 403 
      : 500;
    res.status(statusCode).json({
      success: false,
      message: 'Error turning off buzzer',
      error: error.message
    });
  }
};

export const testBuzzer = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const device = await sendBuzzerCommand(deviceId, userId, isAdmin, true);
    
    setTimeout(async () => {
      try {
        const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
        if (ownershipCheck.success) {
          const updatedDevice = ownershipCheck.device;
          
          producer.send({
            topic: 'outlet.toggled',
            messages: [{
              key: deviceId,
              value: JSON.stringify({
                userId: updatedDevice.ownerId,
                deviceId,
                deviceName: updatedDevice.name,
                outletId: BUZZER_OUTLET_ID,
                outletName: 'Buzzer',
                status: false,
                action: 'outlet_toggled',
                result: 'success',
                timestamp: new Date()
              })
            }]
          }).catch((kafkaError) => {
            logger.error('Failed to publish buzzer test off event to Kafka:', kafkaError);
          });
        }
      } catch (error) {
        logger.error('Error turning off buzzer after test:', error);
      }
    }, 5000);
    
    res.json({
      success: true,
      data: device,
      message: 'Buzzer test initiated (will turn off after 5 seconds)'
    });
  } catch (error) {
    logger.error('Error testing buzzer:', error);
    const statusCode = error.message.includes('not found') ? 404 
      : error.message.includes('Access denied') ? 403 
      : 500;
    res.status(statusCode).json({
      success: false,
      message: 'Error testing buzzer',
      error: error.message
    });
  }
};

export const getDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    const status = device;
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error fetching device status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device status',
      error: error.message
    });
  }
};

export const removeDeviceOwnership = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message === 'Device not found' ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    
    device.ownerId = null;
    await device.save();
    
    res.json({
      success: true,
      message: 'Device ownership removed successfully',
      data: {
        deviceId: device.deviceId,
        name: device.name,
        ownerId: null
      }
    });
  } catch (error) {
    logger.error('Error removing device ownership:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing device ownership',
      error: error.message
    });
  }
};

export const updateOutletSettings = async (req, res) => {
  try {
    const { deviceId, outletId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'service';
    const { name, type } = req.body;
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    const outlet = device.outlets.find(o => o.id === outletId);
    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: 'Outlet not found'
      });
    }
    
    if (name) outlet.name = name;
    if (type) outlet.type = type;
    
    await device.save();
    
    res.json({
      success: true,
      data: outlet,
      message: 'Outlet settings updated successfully'
    });
  } catch (error) {
    logger.error('Error updating outlet settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating outlet settings',
      error: error.message
    });
  }
};
