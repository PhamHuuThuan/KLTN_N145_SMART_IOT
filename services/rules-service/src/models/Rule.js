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
      enum: ['temperature', 'humidity', 'gas_ppm', 'smoke']
    },
    operator: {
      type: String,
      enum: ['>', '<', '>=', '<=', '==', '!=', 'between']
    },
    value: mongoose.Schema.Types.Mixed
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
  escalationConfig: {
    enabled: { type: Boolean, default: true },
    escalationMultipliers: {
      // Multiplier theo priority (0=high, 1=medium, 2=low)
      high: {
        temperature: { type: Number, default: 1.2 },    // +20%
        smoke: { type: Number, default: 1.5 },          // +50%
        gas_ppm: { type: Number, default: 2.0 },       // +100%
        humidity: { type: Number, default: 1.3 }         // +30%
      },
      medium: {
        temperature: { type: Number, default: 1.3 },    // +30%
        smoke: { type: Number, default: 1.8 },          // +80%
        gas_ppm: { type: Number, default: 2.5 },       // +150%
        humidity: { type: Number, default: 1.5 }        // +50%
      },
      low: {
        temperature: { type: Number, default: 1.5 },    // +50%
        smoke: { type: Number, default: 2.0 },         // +100%
        gas_ppm: { type: Number, default: 3.0 },       // +200%
        humidity: { type: Number, default: 2.0 }        // +100%
      }
    },
    criticalThresholds: {
      temperature: { type: Number, default: 90 },
      smoke: { type: Number, default: 1.5 },
      gas_ppm: { type: Number, default: 100 },
      humidity: { type: Number, default: 20 }
    }
  }
});

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

// Indexes
ruleSchema.index({ ruleId: 1 });
ruleSchema.index({ deviceId: 1 });
ruleSchema.index({ createdBy: 1 });
ruleSchema.index({ isActive: 1 });
ruleSchema.index({ pausedUntil: 1 });
ruleSchema.index({ lastTriggered: 1 });
ruleSchema.index({ dailyResetDate: 1 });

// sort by priority
const sortByPriority = (a, b) =>
  PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);

// Statics
// find by creator (người tạo rule)
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
ruleSchema.methods.isInCooldown = function(currentSensorValue = null, sensorType = null) {
  if (!this.lastTriggered || !this.cooldownPeriod) return false;
  const now = new Date();
  const cooldownEnd = new Date(this.lastTriggered.getTime() + this.cooldownPeriod);
  const isInBasicCooldown = now < cooldownEnd;
  
  if (!isInBasicCooldown) return false;
  
  if (currentSensorValue && sensorType && this.escalationConfig.enabled) {
    return !this.shouldEscalate(currentSensorValue, sensorType);
  }
  
  return true;
};

// Check if rule should escalate
ruleSchema.methods.shouldEscalate = function(currentValue, sensorType) {
  if (this.priority === 'urgent') {
    return false;
  }
  
  if (!this.escalationConfig.enabled) return false;
  
  const criticalThreshold = this.escalationConfig.criticalThresholds[sensorType];
  if (criticalThreshold && currentValue >= criticalThreshold) {
    return true;
  }
  
  // Lấy multiplier theo priority của rule
  const priorityMultipliers = this.escalationConfig.escalationMultipliers[this.priority];
  if (!priorityMultipliers) return false;
  
  const multiplier = priorityMultipliers[sensorType];
  if (!multiplier) return false;
  
  const condition = this.conditions.find(c => c.sensor === sensorType);
  if (!condition || !condition.value) return false;
  
  const originalThreshold = condition.value;
  const escalationThreshold = originalThreshold * multiplier;
  
  return currentValue >= escalationThreshold;
};

// Check if rule has reached daily limit
ruleSchema.methods.hasReachedDailyLimit = async function() {
  if (!this.maxTriggersPerDay) return false;
  
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

// Increment trigger count
ruleSchema.methods.incrementTriggerCount = function() {
  this.triggerCount++;
  this.lastTriggered = new Date();
  return this.save();
};

// Check if rule can trigger
ruleSchema.methods.canTrigger = async function(currentSensorValue = null, sensorType = null) {
  if (!this.isActive) return false;
  
  if (this.deletedAt) return false;
  
  if (this.pausedUntil && new Date() < this.pausedUntil) return false;
  
  if (this.isInCooldown(currentSensorValue, sensorType)) return false;
  
  if (await this.hasReachedDailyLimit()) return false;
  
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
