import mongoose from 'mongoose';

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
      enum: ['temperature', 'humidity', 'gas_ppm', 'smoke']
    },
    operator: {
      type: String,
      enum: ['>', '<', '>=', '<=', '==', '!=', 'between']
    },
    value: mongoose.Schema.Types.Mixed,
    unit: {
      type: String,
      default: ''
    }
  }],
  conditionLogic: {
    type: String,
    enum: ['AND', 'OR'],
    default: 'AND'
  },
  actions: [{
    type: {
      type: String,
      required: true,
      enum: ['send_notification', 'send_alert']
    },
    message: String
  }],
  pausedUntil: {
    type: Date,
    default: null
  },
  cooldownPeriod: {
    type: Number,
    default: 300000,
    min: 0,
    max: 86400000  // Max 24 hours
  },
  maxTriggersPerDay: {
    type: Number,
    default: 10,
    min: 1,
    max: 1000  // Max 1000 triggers per day
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  lastTriggered: {
    type: Date,
    default: null
  },
  dailyResetDate: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  },
});

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

// Indexes
ruleSchema.index({ ownerId: 1, deviceId: 1 });
ruleSchema.index({ isActive: 1 });
ruleSchema.index({ pausedUntil: 1 });
ruleSchema.index({ lastTriggered: 1 });
ruleSchema.index({ dailyResetDate: 1 });

// sort by priority
const sortByPriority = (a, b) =>
  PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);

// Statics
ruleSchema.statics.findActiveRulesForDevice = async function (deviceId, ownerId = null) {
  const query = { deviceId, isActive: true, deletedAt: null, ...(ownerId && { ownerId }) };
  const rules = await this.find(query).sort({ createdAt: 1 });
  return rules.sort(sortByPriority);
};

// find by owner
ruleSchema.statics.findByOwner = async function (ownerId, options = {}) {
  const { deviceId, isActive, limit = 50, page = 1, includeDeleted = false } = options;
  const query = { 
    ownerId, 
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
  if (!this.lastTriggered || !this.cooldownPeriod) return false;
  const now = new Date();
  const cooldownEnd = new Date(this.lastTriggered.getTime() + this.cooldownPeriod);
  return now < cooldownEnd;
};

ruleSchema.methods.hasReachedDailyLimit = async function() {
  if (!this.maxTriggersPerDay) return false;
  
  // Reset daily counter if needed
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (!this.dailyResetDate || this.dailyResetDate < today) {
    this.triggerCount = 0;
    this.dailyResetDate = today;
    await this.save();
    return false;
  }
  
  return this.triggerCount >= this.maxTriggersPerDay;
};

ruleSchema.methods.incrementTriggerCount = function() {
  this.triggerCount++;
  this.lastTriggered = new Date();
  return this.save();
};

ruleSchema.methods.resetTriggerState = function() {
  this.triggerCount = 0;
  this.lastTriggered = null;
  this.dailyResetDate = null;
  return this.save();
};

ruleSchema.methods.canTrigger = async function() {
  // Check if rule is active
  if (!this.isActive) return false;
  
  // Check if rule is soft deleted
  if (this.deletedAt) return false;
  
  // Check if rule is paused
  if (this.pausedUntil && new Date() < this.pausedUntil) return false;
  
  // Check cooldown
  if (this.isInCooldown()) return false;
  
  // Check daily limit
  if (await this.hasReachedDailyLimit()) return false;
  
  return true;
};

// Soft delete method
ruleSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  return this.save();
};


const Rule = mongoose.models.Rule || mongoose.model('Rule', ruleSchema);

export default Rule;
