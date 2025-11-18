import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
import logger from '../utils/logger.js';

// Check device ownership for logs
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
      flame: payload.flame !== null && payload.flame !== undefined ? Boolean(Number(payload.flame)) : false,
      o: {
        o1: Boolean(payload.o?.o1) || false,
        o2: Boolean(payload.o?.o2) || false,
        o3: Boolean(payload.o?.o3) || false,
        o4: Boolean(payload.o?.o4) || false
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
    
    logger.info(`Device log created for device ${deviceId}`, { type, severity });
    
    res.status(201).json({
      success: true,
      data: deviceLog,
      message: 'Device log created successfully'
    });
  } catch (error) {
    logger.error('Error creating device log:', error);
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
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'service';
    const { deviceId, type, severity, limit = 100, page = 1, startDate, endDate } = req.query;
    
    let query = {};
    if (deviceId) {
      // Check device ownership if deviceId is provided
      if (userId) {
        const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
        if (!ownershipCheck.success) {
          return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
            success: false,
            message: ownershipCheck.message
          });
        }
      }
      query.deviceId = deviceId;
    } else if (userId && !isAdmin) {
      // If no deviceId specified, only show logs for user's devices
      const userDevices = await Device.find({ ownerId: userId }).select('deviceId');
      const deviceIds = userDevices.map(d => d.deviceId);
      query.deviceId = { $in: deviceIds };
    }
    
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
    logger.error('Error fetching device logs:', error);
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
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'service';
    
    // Check device ownership
    if (userId) {
      const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
      if (!ownershipCheck.success) {
        return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
          success: false,
          message: ownershipCheck.message
        });
      }
    }
    
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
    logger.error('Error fetching latest telemetry:', error);
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
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'service';
    const { hours = 24 } = req.query;
    
    // Check device ownership
    if (userId) {
      const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
      if (!ownershipCheck.success) {
        return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
          success: false,
          message: ownershipCheck.message
        });
      }
    }
    
    const startDate = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    
    const logs = await DeviceLog.find({
      deviceId,
      type: 'telemetry',
      createdAt: { $gte: startDate }
    })
    .sort({ createdAt: -1 })
    .select('payload createdAt')
    .lean();
    
    const normalizedLogs = logs.map(log => ({
      ...log,
      payload: {
        ...log.payload,
        temp: log.payload?.temp ?? 0,
        humid: log.payload?.humid ?? 0,
        smoke: log.payload?.smoke ?? 0,
        gas_ppm: log.payload?.gas_ppm ?? 0,
        flame: log.payload?.flame ?? false,
        o: {
          o1: log.payload?.o?.o1 ?? false,
          o2: log.payload?.o?.o2 ?? false,
          o3: log.payload?.o?.o3 ?? false,
          o4: log.payload?.o?.o4 ?? false,
        }
      }
    }));
    
    res.json({
      success: true,
      data: normalizedLogs,
      period: `${hours} hours`,
      count: normalizedLogs.length
    });
  } catch (error) {
    logger.error('Error fetching telemetry history:', error);
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
