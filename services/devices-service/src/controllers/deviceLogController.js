import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
import { producer } from '../config/kafka.js';

// Create new device log (telemetry data)
export const createDeviceLog = async (req, res) => {
  try {
    const {
      type = 'telemetry',
      deviceId,
      topic,
      payload,
      severity = 'low',
      metadata
    } = req.body;
    
    // Validate required fields
    if (!deviceId || !topic || !payload) {
      return res.status(400).json({
        success: false,
        message: 'deviceId, topic, and payload are required'
      });
    }
    
    // Check if device exists
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Create device log
    const deviceLog = new DeviceLog({
      type,
      deviceId,
      topic,
      payload,
      severity,
      metadata
    });
    
    await deviceLog.save();
    
    // Update device lastSeenAt
    device.lastSeenAt = new Date();
    device.status = 'online';
    await device.save();
    
    // Check for emergency conditions
    const emergencyCheck = deviceLog.checkEmergencyConditions();
    if (emergencyCheck.emergency) {
      // Enter emergency mode
      device.enterEmergencyMode();
      await device.save();
      
      // Publish emergency event to Kafka
      await producer.send({
        topic: 'device.emergency',
        messages: [{
          key: deviceId,
          value: JSON.stringify({
            deviceId,
            action: 'emergency_mode_activated',
            reason: emergencyCheck.reason,
            timestamp: new Date(),
            telemetry: payload
          })
        }]
      });
      
      // Publish alert to Kafka
      await producer.send({
        topic: 'alerts.emergency',
        messages: [{
          key: deviceId,
          value: JSON.stringify({
            deviceId,
            ownerId: device.ownerId,
            type: 'emergency',
            reason: emergencyCheck.reason,
            severity: 'critical',
            timestamp: new Date(),
            telemetry: payload
          })
        }]
      });
    }
    
    // Publish telemetry data to Kafka for other services
    await producer.send({
      topic: 'telemetry.data',
      messages: [{
        key: deviceId,
        value: JSON.stringify({
          deviceId,
          ownerId: device.ownerId,
          type: 'telemetry',
          timestamp: new Date(),
          payload
        })
      }]
    });
    
    res.status(201).json({
      success: true,
      data: deviceLog,
      emergency: emergencyCheck.emergency,
      message: 'Device log created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating device log',
      error: error.message
    });
  }
};

// Get device logs
export const getDeviceLogs = async (req, res) => {
  try {
    const { deviceId, type, severity, limit = 100, page = 1, startDate, endDate } = req.query;
    
    let query = {};
    if (deviceId) query.deviceId = deviceId;
    if (type) query.type = type;
    if (severity) query.severity = severity;
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const logs = await DeviceLog.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await DeviceLog.countDocuments(query);
    
    res.json({
      success: true,
      data: logs,
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
      message: 'Error fetching device logs',
      error: error.message
    });
  }
};

// Get latest telemetry for a device
export const getLatestTelemetry = async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const latestLog = await DeviceLog.findOne({ 
      deviceId, 
      type: 'telemetry' 
    }).sort({ createdAt: -1 });
    
    if (!latestLog) {
      return res.status(404).json({
        success: false,
        message: 'No telemetry data found for this device'
      });
    }
    
    res.json({
      success: true,
      data: {
        deviceId,
        timestamp: latestLog.createdAt,
        payload: latestLog.payload
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching latest telemetry',
      error: error.message
    });
  }
};

// Get telemetry history for a device
export const getTelemetryHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { hours = 24, limit = 1000 } = req.query;
    
    const startDate = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    
    const logs = await DeviceLog.find({
      deviceId,
      type: 'telemetry',
      createdAt: { $gte: startDate }
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .select('payload createdAt');
    
    res.json({
      success: true,
      data: logs,
      period: `${hours} hours`,
      count: logs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching telemetry history',
      error: error.message
    });
  }
};

// Process unprocessed logs (for background processing)
export const processUnprocessedLogs = async (req, res) => {
  try {
    const unprocessedLogs = await DeviceLog.findUnprocessed();
    
    let processedCount = 0;
    let emergencyCount = 0;
    
    for (const log of unprocessedLogs) {
      // Check for emergency conditions
      const emergencyCheck = log.checkEmergencyConditions();
      if (emergencyCheck.emergency) {
        const device = await Device.findOne({ deviceId: log.deviceId });
        if (device) {
          device.enterEmergencyMode();
          await device.save();
          
          // Publish emergency event
          await producer.send({
            topic: 'device.emergency',
            messages: [{
              key: log.deviceId,
              value: JSON.stringify({
                deviceId: log.deviceId,
                action: 'emergency_mode_activated',
                reason: emergencyCheck.reason,
                timestamp: new Date(),
                telemetry: log.payload
              })
            }]
          });
          
          emergencyCount++;
        }
      }
      
      // Mark as processed
      log.markAsProcessed();
      await log.save();
      processedCount++;
    }
    
    res.json({
      success: true,
      message: 'Unprocessed logs processed successfully',
      processed: processedCount,
      emergencies: emergencyCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing unprocessed logs',
      error: error.message
    });
  }
};

// Get emergency logs
export const getEmergencyLogs = async (req, res) => {
  try {
    const { deviceId, limit = 50, page = 1 } = req.query;
    
    let query = { severity: { $in: ['high', 'critical'] } };
    if (deviceId) query.deviceId = deviceId;
    
    const logs = await DeviceLog.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await DeviceLog.countDocuments(query);
    
    res.json({
      success: true,
      data: logs,
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
      message: 'Error fetching emergency logs',
      error: error.message
    });
  }
};

// Delete old logs (cleanup)
export const deleteOldLogs = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const cutoffDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    const result = await DeviceLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    res.json({
      success: true,
      message: `Deleted logs older than ${days} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting old logs',
      error: error.message
    });
  }
};
