import Device from '../models/Device.js';
import DeviceLog from '../models/DeviceLog.js';
import { producer } from '../config/kafka.js';
import logger from '../utils/logger.js';

// Helper function to check device ownership
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

// Get all devices for the authenticated user
export const getAllDevices = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { status, limit = 50, page = 1 } = req.query;
    
    logger.info(`Getting devices for user ${userId}`);
    
    // Only get devices owned by the authenticated user (unless admin)
    let query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'service') {
      query.ownerId = userId;
    } else if (req.query.ownerId) {
      // Admin can filter by ownerId
      query.ownerId = req.query.ownerId;
    }
    
    if (status) query.status = status;
    
    const devices = await Device.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Device.countDocuments(query);
    
    logger.info(`Found ${devices.length} devices for user ${userId}`);
    
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

// Get device by ID
export const getDeviceById = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    
    logger.info(`Getting device ${deviceId} for user ${userId}`);
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && req.user.role !== 'service' && device.ownerId !== userId) {
      logger.warn(`Access denied: User ${userId} trying to access device ${deviceId} owned by ${device.ownerId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own devices'
      });
    }
    
    logger.info(`Device ${deviceId} access granted for user ${userId}`);
    
    res.json({
      success: true,
      data: device
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

// Create new device
export const createDevice = async (req, res) => {
  try {
    const userId = req.user.sub;
    const {
      deviceId,
      name,
      outlets
    } = req.body;
    
    logger.info(`Creating device ${deviceId} for user ${userId}`);
    
    // Check if device already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      // If device exists and already has an owner
      if (existingDevice.ownerId) {
        return res.status(400).json({
          success: false,
          message: 'Device is already assigned to another user'
        });
      }
      
      // If device exists but has no owner, assign it to current user
      existingDevice.ownerId = userId;
      existingDevice.name = name || existingDevice.name;
      await existingDevice.save();
      
      // Publish device assignment event to Kafka
      producer.send({
        topic: 'device.assigned',
        messages: [{
          key: deviceId,
          value: JSON.stringify({
            deviceId,
            ownerId: userId,
            action: 'assigned',
            timestamp: new Date()
          })
        }]
      }).catch((kafkaError) => {
        logger.error('Failed to publish device assignment event to Kafka:', kafkaError);
      });
      
      return res.status(200).json({
        success: true,
        data: existingDevice,
        message: 'Device assigned successfully'
      });
    }
    
    // Create default outlets if not provided
    const defaultOutlets = outlets || [
      { id: 'o1', type: 'kitchen', name: 'Kitchen Outlet 1' },
      { id: 'o2', type: 'kitchen', name: 'Kitchen Outlet 2' },
      { id: 'o3', type: 'kitchen', name: 'Kitchen Outlet 3' },
      { id: 'o4', type: 'safety',  name: 'Safety Outlet 1' },
      { id: 'o5', type: 'safety',  name: 'Safety Outlet 2' }
    ];
    
    const device = new Device({
      deviceId,
      ownerId: userId, // Set ownerId from JWT token
      name,
      outlets: defaultOutlets
    });
    
    await device.save();
    
    // Publish device creation event to Kafka (non-blocking)
    producer.send({
      topic: 'device.created',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          ownerId: userId,
          action: 'created',
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish device creation event to Kafka:', kafkaError);
      // Don't throw error - device creation was successful
    });
    
    res.status(201).json({
      success: true,
      data: device,
      message: 'Device created successfully'
    });
  } catch (error) {
    logger.error('Error creating device:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId,
      deviceId,
      name
    });
    res.status(500).json({
      success: false,
      message: 'Error creating device',
      error: error.message
    });
  }
};

// Update device
export const updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updateData = req.body;
    
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Publish device update event to Kafka (non-blocking)
    producer.send({
      topic: 'device.updated',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          action: 'updated',
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish device update event to Kafka:', kafkaError);
    });
    
    res.json({
      success: true,
      data: device,
      message: 'Device updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating device',
      error: error.message
    });
  }
};

// Delete device
export const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    const isAdmin = req.user.role === 'admin';
    
    logger.info(`Deleting device ${deviceId} for user ${userId}`);
    
    // Check ownership first
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
    
    // Publish device deletion event to Kafka (non-blocking)
    producer.send({
      topic: 'device.deleted',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          action: 'deleted',
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish device deletion event to Kafka:', kafkaError);
    });
    
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

// Toggle outlet
export const toggleOutlet = async (req, res) => {
  try {
    const { deviceId, outletId } = req.params;
    let { status } = req.body;
    
    // Convert string status to boolean
    if (typeof status === 'string') {
      status = status.toLowerCase() === 'true' || status.toLowerCase() === 'on' || status === '1';
    }
    
    console.log(`🔌 Toggle outlet request: ${deviceId}/${outletId} -> ${status ? 'ON' : 'OFF'}`);
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check if device is online
    if (!device.isOnline()) {
      return res.status(400).json({
        success: false,
        message: 'Device is offline'
      });
    }
    
    // Toggle outlet
    const success = device.toggleOutlet(outletId, status);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid outlet ID'
      });
    }
    
    await device.save();
    
    // Get outlet info for notification
    const outlet = device.outlets.find(o => o.id === outletId);
    const outletName = outlet ? outlet.name : outletId;
    
    // Publish outlet toggle event to Kafka with userId (ownerId) in a timeout-guarded promise
    console.log(`📤 Publishing outlet toggle to Kafka: ${deviceId}/${outletId} by user ${device.ownerId}`);
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

    // Timeout safeguard to avoid hanging the HTTP request if Kafka is slow
    const timeoutMs = Number(process.env.KAFKA_SEND_TIMEOUT_MS || 1500);
    await Promise.race([
      sendPromise,
      new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs))
    ]).catch((err) => {
      console.error('❌ Kafka send error (non-fatal):', err?.message || err);
    });
    
    res.json({
      success: true,
      data: device,
      message: `Outlet ${outletId} ${status ? 'turned on' : 'turned off'} successfully`
    });
  } catch (error) {
    console.error('❌ Error toggling outlet:', error);
    
    // Publish failure event to Kafka if we have device info
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
      console.error('❌ Error publishing failure event:', kafkaError);
    }
    
    res.status(500).json({
      success: false,
      message: 'Error toggling outlet',
      error: error.message
    });
  }
};

// Enter emergency mode
export const enterEmergencyMode = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    console.log('Device found:', device);
    
    // Enter emergency mode
    device.enterEmergencyMode();
    await device.save();
    
  // Dispatch real device commands via Kafka so mqtt-service can act
  try {
    const timeoutMs = Number(process.env.KAFKA_SEND_TIMEOUT_MS || 1500);
    const sendTasks = device.outlets.map((o) => {
      const outletId = o.id;
      const outletName = o.name;
      const status = !!o.status; // true = ON, false = OFF
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
            reason: 'emergency_mode',
            timestamp: new Date()
          })
        }]
      });
      return Promise.race([
        sendPromise,
        new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs))
      ]).catch((err) => {
        console.error('❌ Kafka send error in emergency dispatch (non-fatal):', err?.message || err);
      });
    });
    await Promise.all(sendTasks);
  } catch (dispatchError) {
    console.error('❌ Error dispatching emergency outlet toggles:', dispatchError);
  }
  
    // Publish emergency mode event to Kafka (non-blocking)
    producer.send({
      topic: 'user-actions',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          userId: device.ownerId,
          deviceId,
          deviceName: device.name,
          action: 'emergency_mode_activated',
          result: 'success',
          timestamp: new Date(),
          reason: 'manual_activation'
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish emergency mode activation event to Kafka:', kafkaError);
    });
    
    res.json({
      success: true,
      data: device,
      message: 'Emergency mode activated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error activating emergency mode',
      error: error.message
    });
  }
};

// Exit emergency mode
export const exitEmergencyMode = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Exit emergency mode
    device.exitEmergencyMode();
    await device.save();
    
    // Publish emergency mode exit event to Kafka (non-blocking)
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
    
    res.json({
      success: true,
      data: device,
      message: 'Emergency mode deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deactivating emergency mode',
      error: error.message
    });
  }
};

// Get device status
export const getDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Get latest telemetry data
    const latestLog = await DeviceLog.findOne({ deviceId })
      .sort({ createdAt: -1 });
    const status = {
      deviceId: device.deviceId,
      name: device.name,
      status: device.status,
      online: device.isOnline(),
      lastSeenAt: device.lastSeenAt,
      emergencyMode: device.emergencyMode,
      outlets: device.outlets,
      latestTelemetry: latestLog ? latestLog.payload : null,
      lastUpdate: latestLog ? latestLog.createdAt : null
    };
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching device status',
      error: error.message
    });
  }
};

// Remove device ownership (unassign device from user)
export const removeDeviceOwnership = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.sub;
    
    logger.info(`Removing ownership of device ${deviceId} from user ${userId}`);
    
    const ownershipCheck = await checkDeviceOwnership(deviceId, userId);
    if (!ownershipCheck.success) {
      return res.status(ownershipCheck.message === 'Device not found' ? 404 : 403).json({
        success: false,
        message: ownershipCheck.message
      });
    }
    
    const device = ownershipCheck.device;
    
    // Clear ownerId
    device.ownerId = null;
    await device.save();
    
    // Publish device unassignment event to Kafka
    producer.send({
      topic: 'device.unassigned',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          previousOwnerId: userId,
          action: 'unassigned',
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish device unassignment event to Kafka:', kafkaError);
    });
    
    logger.info(`Device ${deviceId} ownership removed from user ${userId}`);
    
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

// Update outlet settings
export const updateOutletSettings = async (req, res) => {
  try {
    const { deviceId, outletId } = req.params;
    const { name } = req.body;
    const { type } = req.body;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Find and update outlet
    const outlet = device.outlets.find(o => o.id === outletId);
    if (!outlet) {
      return res.status(404).json({
        success: false,
        message: 'Outlet not found'
      });
    }
    
    // Update outlet settings
    if (name) outlet.name = name;
    if (type) outlet.type = type;
    
    await device.save();
    
    // Publish outlet settings update event to Kafka (non-blocking)
    producer.send({
      topic: 'user-actions',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          userId: device.ownerId,
          deviceId,
          deviceName: device.name,
          outletId,
          outletName: outlet.name,
          action: 'outlet_settings_updated',
          result: 'success',
          metadata: {
            name: outlet.name,
            type: outlet.type
          },
          timestamp: new Date()
        })
      }]
    }).catch((kafkaError) => {
      logger.error('Failed to publish outlet settings update event to Kafka:', kafkaError);
    });
    
    res.json({
      success: true,
      data: outlet,
      message: 'Outlet settings updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating outlet settings',
      error: error.message
    });
  }
};

