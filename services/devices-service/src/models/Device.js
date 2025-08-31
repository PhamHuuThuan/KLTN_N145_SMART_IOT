import mongoose from 'mongoose';

const outletSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    enum: ['o1', 'o2', 'o3', 'o4', 'o5']
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['kitchen', 'safety'],
    default: 'kitchen'
  },
  status: {
    type: Boolean,
    default: false
  },
  powerConsumption: {
    type: Number,
    default: 0
  },
  lastToggleAt: {
    type: Date,
    default: Date.now
  }
});

const thresholdSchema = new mongoose.Schema({
  temperature: {
    min: { type: Number, default: 15 },
    max: { type: Number, default: 50 }
  },
  humidity: {
    min: { type: Number, default: 30 },
    max: { type: Number, default: 80 }
  },
  smoke: {
    max: { type: Number, default: 100 }
  },
  gas: {
    max: { type: Number, default: 1000 }
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
    required: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    default: 'kitchen_controller'
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance', 'error'],
    default: 'offline'
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  location: {
    room: { type: String, default: 'kitchen' },
    floor: { type: String, default: '1' }
  },
  outlets: [outletSchema],
  thresholds: thresholdSchema,
  emergencyMode: {
    type: Boolean,
    default: false
  },
  lastEmergencyAt: {
    type: Date
  },
  firmware: {
    version: { type: String, default: '1.0.0' },
    lastUpdate: { type: Date }
  },
  settings: {
    autoShutdown: { type: Boolean, default: true },
    notificationEnabled: { type: Boolean, default: true },
    emergencyResponseDelay: { type: Number, default: 5000 } // milliseconds
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
  this.emergencyMode = true;
  this.lastEmergencyAt = new Date();
  
  // Turn off all kitchen outlets
  this.outlets.forEach(outlet => {
    if (outlet.type === 'kitchen') {
      outlet.status = false;
    }
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
