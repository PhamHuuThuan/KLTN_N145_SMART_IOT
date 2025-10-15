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
  }],
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
  duration: {
    type: Number,
    default: 0,  // 0 = trigger ngay lập tức
    min: 0,
    max: 3600000  // Max 1 hour (ms)
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
  durationStartTime: {
    type: Date,
    default: null
  },
  durationMet: {
    type: Boolean,
    default: false
  }
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
  const query = { deviceId, isActive: true, ...(ownerId && { ownerId }) };
  const rules = await this.find(query).sort({ createdAt: 1 });
  return rules.sort(sortByPriority);
};

// find by owner
ruleSchema.statics.findByOwner = async function (ownerId, options = {}) {
  const { deviceId, isActive, limit = 50, page = 1 } = options;
  const query = { ownerId, ...(deviceId && { deviceId }), ...(isActive !== undefined && { isActive }) };

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
  
  // Check if rule is paused
  if (this.pausedUntil && new Date() < this.pausedUntil) return false;
  
  // Check cooldown
  if (this.isInCooldown()) return false;
  
  // Check daily limit
  if (await this.hasReachedDailyLimit()) return false;
  
  return true;
};

// Start duration tracking
ruleSchema.methods.startDurationTracking = function() {
  if (this.duration > 0 && !this.durationStartTime) {
    this.durationStartTime = new Date();
    this.durationMet = false;
    console.log(`⏱️ Started duration tracking for ${this.name}: ${this.duration}ms`);
  }
};

// Check if duration has been met
ruleSchema.methods.checkDurationMet = function() {
  if (this.duration === 0) return true; // No duration required
  
  if (!this.durationStartTime) {
    this.startDurationTracking();
    return false;
  }

  const elapsed = Date.now() - this.durationStartTime.getTime();
  const met = elapsed >= this.duration;
  
  if (met && !this.durationMet) {
    this.durationMet = true;
    console.log(`✅ Duration met for ${this.name}: ${elapsed}ms >= ${this.duration}ms`);
  }
  
  return met;
};

// Reset duration tracking
ruleSchema.methods.resetDurationTracking = function() {
  this.durationStartTime = null;
  this.durationMet = false;
  console.log(`🔄 Reset duration tracking for ${this.name}`);
};

const Rule = mongoose.models.Rule || mongoose.model('Rule', ruleSchema);

export default Rule;
