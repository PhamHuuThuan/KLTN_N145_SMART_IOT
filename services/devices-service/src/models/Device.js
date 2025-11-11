import mongoose from 'mongoose';
import { OUTLET_VALUES } from '../constants/outlets.js';
import { OUTLET_TYPE_VALUES, OUTLET_TYPES } from '../constants/outletTypes.js';
import { DEVICE_STATUS_VALUES, DEVICE_STATUS } from '../constants/deviceStatus.js';

const outletSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    enum: OUTLET_VALUES
  },
  type: {
    type: String,
    enum: OUTLET_TYPE_VALUES,
    default: OUTLET_TYPES.KITCHEN
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    default: false
  },
  lastToggleAt: {
    type: Date,
    default: Date.now
  }
});


const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  ownerId: {
    type: String,
    required: false,
    trim: true,
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: DEVICE_STATUS_VALUES,
    default: DEVICE_STATUS.OFFLINE
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  outlets: [outletSchema],
  emergencyMode: {
    type: Boolean,
    default: false
  },
  lastEmergencyAt: {
    type: Date
  },
  latestTelemetry: {
    ts: { type: Number, default: Date.now },
    temp: { type: Number },
    humid: { type: Number },
    smoke: { type: Number },
    gas_ppm: { type: Number },
    o: { type: Object, default: {} }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ ownerId: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ lastSeenAt: 1 });

// Method to check if device is online (seen within last 5 minutes)
deviceSchema.methods.isOnline = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastSeenAt > fiveMinutesAgo;
};

// Method to toggle outlet
deviceSchema.methods.toggleOutlet = function(outletId, status) {
  const outlet = this.outlets.find(o => o.id === outletId);
  if (outlet) {
    outlet.status = status;
    outlet.lastToggleAt = new Date();
    return true;
  }
  return false;
};

// Method to enter emergency mode
deviceSchema.methods.enterEmergencyMode = function() {
  // Emergency rule: kitchen -> OFF, safety -> ON
  this.outlets.forEach(outlet => {
    const outletType = (outlet.type || '').toLowerCase();
    // Backward compatibility: infer safety by id if type missing (only o4 is safety now)
    const inferredSafety = !outletType && outlet.id === 'o4';
    const isSafety = outletType === 'safety' || inferredSafety;
    outlet.status = isSafety; // safety ON, kitchen OFF
    outlet.lastToggleAt = new Date();
  });

  return this;
};

// Method to exit emergency mode
deviceSchema.methods.exitEmergencyMode = function() {
  this.emergencyMode = false;
  return this;
};

// Static method to find devices by owner
deviceSchema.statics.findByOwner = function(ownerId) {
  return this.find({ ownerId });
};

// Static method to find online devices
deviceSchema.statics.findOnline = function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.find({ lastSeenAt: { $gt: fiveMinutesAgo } });
};

const Device = mongoose.model('Device', deviceSchema);

export default Device;
