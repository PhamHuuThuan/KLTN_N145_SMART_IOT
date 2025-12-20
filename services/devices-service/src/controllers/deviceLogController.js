import DeviceLog from '../models/DeviceLog.js';
import Device from '../models/Device.js';
import logger from '../utils/logger.js';
import { 
  normalizeTelemetryLogs, 
  smartDownsample, 
  SENSOR_FIELD_MAP 
} from '../utils/telemetryDataProcessor.js';

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
    
    let savedSuccessfully = true;
    try {
      await deviceLog.save();
    } catch (saveErr) {
      savedSuccessfully = false;
      logger.error('Device log save failed (accepted but not persisted):', saveErr);
    }
    
    res.status(savedSuccessfully ? 201 : 202).json({
      success: true,
      data: savedSuccessfully ? deviceLog : null,
      message: savedSuccessfully
        ? 'Device log created successfully'
        : 'Log accepted but not persisted'
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

export const getDeviceLogs = async (req, res) => {
  try {
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'service';
    const { deviceId, type, severity, limit = 100, page = 1, startDate, endDate } = req.query;
    
    let query = {};
    if (deviceId) {
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

export const getLatestTelemetry = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'service';
    
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

export const getTelemetryHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.sub;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'service';
    const { hours = 24, sensorType, startDate: startDateParam, endDate: endDateParam } = req.query;
    
    if (userId) {
      const ownershipCheck = await checkDeviceOwnership(deviceId, userId, isAdmin);
      if (!ownershipCheck.success) {
        return res.status(ownershipCheck.message.includes('not found') ? 404 : 403).json({
          success: false,
          message: ownershipCheck.message
        });
      }
    }
    
    const sensorField = sensorType ? SENSOR_FIELD_MAP[sensorType] : null;
    
    let dateFilter = {};
    if (startDateParam && endDateParam) {
      dateFilter.createdAt = {
        $gte: new Date(startDateParam),
        $lte: new Date(endDateParam)
      };
    } else {
      const startDate = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
      dateFilter.createdAt = { $gte: startDate };
    }
    
    const query = {
      deviceId,
      type: 'telemetry',
      ...dateFilter
    };
    
    if (sensorField) {
      query[`payload.${sensorField}`] = { $exists: true, $ne: null };
    }
    
    let selectFields = 'createdAt payload';
    if (!sensorField) {
      selectFields += ' payload.temp payload.humid payload.smoke payload.gas_ppm';
    }
    
    const logs = await DeviceLog.find(query)
      .sort({ createdAt: 1 })
      .select(selectFields)
      .lean();
    
    const normalizedLogs = normalizeTelemetryLogs(logs, sensorField);
    
    let actualHours = hours;
    if (startDateParam && endDateParam) {
      actualHours = Math.ceil((new Date(endDateParam) - new Date(startDateParam)) / (1000 * 60 * 60));
    }
    
    let MAX_RECORDS;
    if (actualHours <= 24) {
      MAX_RECORDS = Math.floor(actualHours * 60);
    } else if (actualHours <= 168) {
      MAX_RECORDS = Math.floor(800 + (actualHours - 24) * 5);
    } else {
      MAX_RECORDS = Math.floor(1200 + (actualHours - 168) * 2);
    }
    MAX_RECORDS = Math.min(3000, Math.max(800, MAX_RECORDS));
    const limitedLogs = normalizedLogs.length > MAX_RECORDS
      ? smartDownsample(normalizedLogs, MAX_RECORDS, sensorField)
      : normalizedLogs;
    
    res.json({
      success: true,
      data: limitedLogs,
      period: startDateParam && endDateParam 
        ? `${new Date(startDateParam).toISOString()} to ${new Date(endDateParam).toISOString()}`
        : `${hours} hours`,
      count: limitedLogs.length,
      totalCount: normalizedLogs.length,
      sensorType: sensorType || 'all',
      limited: normalizedLogs.length > MAX_RECORDS
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
