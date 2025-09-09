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
    enum: ['temperature', 'gas_ppm', 'smoke']
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
  outletId: String
}, { _id: false });

// Action schema for rule actions
const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['toggle_outlet', 'send_notification', 'activate_emergency', 'send_alert', 'log_event']
  },
  deviceId: String,
  outletId: String,
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
    type: String,
    required: true,
    trim: true
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
