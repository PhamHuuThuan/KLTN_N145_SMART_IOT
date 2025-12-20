import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  ruleId: {
    type: String,
    unique: true,
    required: false,
    trim: true
  },
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
  deviceId: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  conditions: [{
    type: {
      type: String,
      required: true,
      enum: ['sensor']
    },
    sensor: {
      type: String,
      enum: ['temperature', 'humidity', 'gas_ppm', 'smoke', 'flame']
    },
    operator: {
      type: String,
      enum: ['>', '<', '>=', '<=', '==', '!=', 'between']
    },
    value: mongoose.Schema.Types.Mixed
  }],
  actions: [{
    type: {
      type: String,
      required: true,
      enum: ['send_notification', 'send_alert']
    },
    message: String
  }],
  cooldownPeriod: {
    type: Number,
    default: 300000,
    min: 0,
    max: 86400000  // Max 24 hours
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  dailyTriggerCount: {
    type: Number,
    default: 0
  },
  lastTriggerDate: {
    type: Date,
    default: null
  },
  lastTriggeredAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
});

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

// Indexes
ruleSchema.index({ ruleId: 1 });
ruleSchema.index({ deviceId: 1 });
ruleSchema.index({ createdBy: 1 });
ruleSchema.index({ isActive: 1 });

// sort by priority
const sortByPriority = (a, b) =>
  PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);

// find by creator
ruleSchema.statics.findByCreator = async function (createdBy, options = {}) {
  const { deviceId, isActive, limit = 50, page = 1, includeDeleted = false } = options;
  
  const query = { 
    createdBy, 
    ...(deviceId && { deviceId }), 
    ...(isActive !== undefined && { isActive }),
    ...(includeDeleted ? {} : { deletedAt: null })
  };

  const rules = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

  return rules.sort(sortByPriority);
};

// Methods
ruleSchema.methods.isInCooldown = function() {
  if (!this.cooldownPeriod || this.cooldownPeriod <= 0) {
    return false;
  }
  if (!this.lastTriggeredAt) {
    return false;
  }

  const elapsed = Date.now() - new Date(this.lastTriggeredAt).getTime();
  return elapsed < this.cooldownPeriod;
};

// Increment trigger count
ruleSchema.methods.incrementTriggerCount = function() {
  const now = new Date();
  const todayKey = now.toDateString();
  const lastKey = this.lastTriggerDate ? new Date(this.lastTriggerDate).toDateString() : null;

  if (todayKey !== lastKey) {
    this.dailyTriggerCount = 0;
  }

  this.triggerCount++;
  this.dailyTriggerCount++;
  this.lastTriggerDate = now;
  this.lastTriggeredAt = now;
  return this.save();
};

// Check if rule can trigger
ruleSchema.methods.canTrigger = async function(currentSensorValue = null, sensorType = null) {
  if (!this.isActive) return false;
  
  if (this.deletedAt) return false;
  
  if (this.isInCooldown()) return false;
  
  return true;
};

ruleSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};

ruleSchema.statics.generateRuleId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `rule_${timestamp}_${random}`;
};

ruleSchema.pre('save', function(next) {
  if (!this.ruleId) {
    this.ruleId = this.constructor.generateRuleId();
  }
  next();
});

const Rule = mongoose.models.Rule || mongoose.model('Rule', ruleSchema);

export default Rule;
