import mongoose from 'mongoose';
import { LOG_TYPES, LOG_TYPE_VALUES } from '../constants/logTypes.js';
import { LOG_SEVERITY, LOG_SEVERITY_VALUES } from '../constants/logSeverity.js';

const telemetrySchema = new mongoose.Schema({
  ts: {
    type: Number,
    required: true
  },
  temp: {
    type: Number,
    required: true,
    default: 0
  },
  humid: {
    type: Number,
    required: true,
    default: 0
  },
  smoke: {
    type: Number,
    required: true,
    default: 0
  },
  gas_ppm: {
    type: Number,
    required: true,
    default: 0
  },
  flame: {
    type: Boolean,
    required: true,
    default: false
  },
  o: {
    o1: { type: Boolean, default: false },
    o2: { type: Boolean, default: false },
    o3: { type: Boolean, default: false },
    o4: { type: Boolean, default: false }
  }
}, { _id: false });

const deviceLogSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  enum: LOG_TYPE_VALUES,
  default: LOG_TYPES.TELEMETRY
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
    enum: LOG_SEVERITY_VALUES,
    default: LOG_SEVERITY.LOW
  },
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      source: 'esp32',
      version: '1.0'
    }
  }
}, {
  timestamps: true
});

deviceLogSchema.index({ deviceId: 1 });
deviceLogSchema.index({ type: 1 });
deviceLogSchema.index({ createdAt: -1 });
deviceLogSchema.index({ severity: 1 });
deviceLogSchema.index({ processed: 1 });
deviceLogSchema.index({ deviceId: 1, createdAt: -1 });

deviceLogSchema.methods.markAsProcessed = function() {
  this.processed = true;
  this.processedAt = new Date();
  return this;
};

const DeviceLog = mongoose.model('DeviceLog', deviceLogSchema);

export default DeviceLog;
