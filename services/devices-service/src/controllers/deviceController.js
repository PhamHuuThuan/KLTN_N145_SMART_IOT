import Device from '../models/Device.js';
import DeviceLog from '../models/DeviceLog.js';
import { producer } from '../config/kafka.js';

// Get all devices
export const getAllDevices = async (req, res) => {
  try {
    const { ownerId, status, limit = 50, page = 1 } = req.query;
    
    let query = {};
    if (ownerId) query.ownerId = ownerId;
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
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    res.json({
      success: true,
      data: device
    });
  } catch (error) {
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
    const {
      deviceId,
      ownerId,
      name,
      location,
      outlets,
      thresholds
    } = req.body;
    
    // Check if device already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({
        success: false,
        message: 'Device with this ID already exists'
      });
    }
    
    // Create default outlets if not provided
    const defaultOutlets = outlets || [
      { id: 'o1', name: 'Kitchen Outlet 1', type: 'kitchen' },
      { id: 'o2', name: 'Kitchen Outlet 2', type: 'kitchen' },
      { id: 'o3', name: 'Kitchen Outlet 3', type: 'kitchen' },
      { id: 'o4', name: 'Safety Outlet 1', type: 'safety' },
      { id: 'o5', name: 'Safety Outlet 2', type: 'safety' }
    ];
    
    const device = new Device({
      deviceId,
      ownerId,
      name,
      location,
      outlets: defaultOutlets,
      thresholds
    });
    
    await device.save();
    
    // Publish device creation event to Kafka
    await producer.send({
      topic: 'device.created',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          ownerId,
          action: 'created',
          timestamp: new Date()
        })
      }]
    });
    
    res.status(201).json({
      success: true,
      data: device,
      message: 'Device created successfully'
    });
  } catch (error) {
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
    
    // Publish device update event to Kafka
    await producer.send({
      topic: 'device.updated',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          action: 'updated',
          timestamp: new Date()
        })
      }]
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
    
    const device = await Device.findOneAndDelete({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Publish device deletion event to Kafka
    await producer.send({
      topic: 'device.deleted',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          action: 'deleted',
          timestamp: new Date()
        })
      }]
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
    const { status } = req.body;
    
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
    
    // Publish outlet toggle event to Kafka
    await producer.send({
      topic: 'outlet.toggled',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          outletId,
          status,
          action: 'outlet_toggled',
          timestamp: new Date()
        })
      }]
    });
    
    res.json({
      success: true,
      data: device,
      message: `Outlet ${outletId} ${status ? 'turned on' : 'turned off'} successfully`
    });
  } catch (error) {
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
    
    // Enter emergency mode
    device.enterEmergencyMode();
    await device.save();
    
    // Publish emergency mode event to Kafka
    await producer.send({
      topic: 'device.emergency',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          action: 'emergency_mode_activated',
          timestamp: new Date(),
          reason: 'manual_activation'
        })
      }]
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
    
    // Publish emergency mode exit event to Kafka
    await producer.send({
      topic: 'device.emergency',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          action: 'emergency_mode_deactivated',
          timestamp: new Date()
        })
      }]
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

// Update device thresholds
export const updateThresholds = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { thresholds } = req.body;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    device.thresholds = { ...device.thresholds, ...thresholds };
    await device.save();
    
    res.json({
      success: true,
      data: device,
      message: 'Thresholds updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating thresholds',
      error: error.message
    });
  }
};
