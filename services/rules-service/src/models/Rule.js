import mongoose from 'mongoose';

// Condition schema for rule conditions
const conditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['sensor', 'time', 'device_status', 'outlet_status', 'emergency']
  },
  sensor: {
    type: String,
    enum: ['temperature', 'humidity', 'gas_ppm', 'smoke']
  },
  operator: {
    type: String,
    enum: ['>', '<', '>=', '<=', '==', '!=', 'between']
  },
  value: {
    type: mongoose.Schema.Types.Mixed
  },
  timeCondition: {
    hour: { type: Number, min: 0, max: 23 },
    minute: { type: Number, min: 0, max: 59 },
    days: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }]
  },
  deviceId: String,
  outletId: {
    type: String,
    enum: ['o1', 'o2', 'o3', 'o4', 'o5']
  },
  deviceStatus: {
    type: String,
    enum: ['online', 'offline', 'maintenance', 'error']
  }
}, { _id: false });

// Action schema for rule actions
const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['toggle_outlet', 'send_notification', 'activate_emergency', 'send_alert', 'log_event']
  },
  deviceId: String,
  outletId: {
    type: String,
    enum: ['o1', 'o2', 'o3', 'o4', 'o5']
  },
  outletType: {
    type: String,
    enum: ['kitchen', 'safety']
  },
  status: Boolean,
  message: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  delay: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Main rule schema
const ruleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['safety', 'automation', 'energy_saving', 'comfort', 'maintenance'],
    default: 'automation'
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  conditions: [conditionSchema],
  actions: [actionSchema],
  cooldownPeriod: {
    type: Number,
    default: 30000
  },
  lastTriggeredAt: {
    type: Date
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  settings: {
    autoDisable: {
      type: Boolean,
      default: false
    },
    maxTriggersPerDay: {
      type: Number,
      default: 100
    },
    notificationEnabled: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

const Rule = mongoose.models.Rule || mongoose.model('Rule', ruleSchema);

export default Rule;
