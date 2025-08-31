import mongoose from 'mongoose';

const telemetrySchema = new mongoose.Schema({
  ts: {
    type: Number,
    required: true
  },
  temp: {
    type: Number,
    required: true
  },
  humid: {
    type: Number,
    required: true
  },
  smoke: {
    type: Number,
    required: true
  },
  gas_ppm: {
    type: Number,
    required: true
  },
  o: {
    o1: { type: Boolean, default: false },
    o2: { type: Boolean, default: false },
    o3: { type: Boolean, default: false },
    o4: { type: Boolean, default: false },
    o5: { type: Boolean, default: false }
  }
});

const deviceLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['telemetry', 'event', 'command', 'error'],
    default: 'telemetry'
  },
  deviceId: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  payload: {
    type: telemetrySchema,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date
  },
  metadata: {
    source: { type: String, default: 'esp32' },
    version: { type: String, default: '1.0' },
    ip: { type: String },
    mac: { type: String }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
deviceLogSchema.index({ deviceId: 1 });
deviceLogSchema.index({ type: 1 });
deviceLogSchema.index({ createdAt: -1 });
deviceLogSchema.index({ severity: 1 });
deviceLogSchema.index({ processed: 1 });

// Compound index for device and time range queries
deviceLogSchema.index({ deviceId: 1, createdAt: -1 });

// Method to mark as processed
deviceLogSchema.methods.markAsProcessed = function() {
  this.processed = true;
  this.processedAt = new Date();
  return this;
};

// Method to check if telemetry data indicates emergency
deviceLogSchema.methods.checkEmergencyConditions = function() {
  const payload = this.payload;
  
  // Check temperature threshold
  if (payload.temp > 60) return { emergency: true, reason: 'high_temperature' };
  
  // Check smoke threshold
  if (payload.smoke > 100) return { emergency: true, reason: 'smoke_detected' };
  
  // Check gas threshold
  if (payload.gas_ppm > 1000) return { emergency: true, reason: 'gas_leak' };
  
  return { emergency: false, reason: null };
};

// Static method to find logs by device
deviceLogSchema.statics.findByDevice = function(deviceId, limit = 100) {
  return this.find({ deviceId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to find unprocessed logs
deviceLogSchema.statics.findUnprocessed = function() {
  return this.find({ processed: false });
};

// Static method to find logs by severity
deviceLogSchema.statics.findBySeverity = function(severity) {
  return this.find({ severity });
};

// Static method to find logs in time range
deviceLogSchema.statics.findInTimeRange = function(deviceId, startDate, endDate) {
  return this.find({
    deviceId,
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ createdAt: -1 });
};

const DeviceLog = mongoose.model('DeviceLog', deviceLogSchema);

export default DeviceLog;
