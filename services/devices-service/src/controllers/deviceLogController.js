import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';

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
    
    if (!deviceId || !topic || !payload) {
      return res.status(400).json({
        success: false,
        message: 'deviceId, topic, and payload are required'
      });
    }
    
    const sanitizedPayload = {
      ts: Number(payload.ts) || Date.now(),
      temp: payload.temp !== null && payload.temp !== undefined ? Number(payload.temp) : 0,
      humid: payload.humid !== null && payload.humid !== undefined ? Number(payload.humid) : 0,
      smoke: payload.smoke !== null && payload.smoke !== undefined ? Number(payload.smoke) : 0,
      gas_ppm: payload.gas_ppm !== null && payload.gas_ppm !== undefined ? Number(payload.gas_ppm) : 0,
      o: {
        o1: Boolean(payload.o?.o1) || false,
        o2: Boolean(payload.o?.o2) || false,
        o3: Boolean(payload.o?.o3) || false,
        o4: Boolean(payload.o?.o4) || false,
        o5: Boolean(payload.o?.o5) || false,
      }
    };

    const deviceLog = new DeviceLog({
      type,
      deviceId,
      topic,
      payload: sanitizedPayload,
      severity,
      metadata
    });
    
    await deviceLog.save();
    
    res.status(201).json({
      success: true,
      data: deviceLog,
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
