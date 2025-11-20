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
        gas_ppm: { type: Number, default: 2.0 },        // +100%
        humidity: { type: Number, default: 1.3 },       // +30%
        flame: { type: Number, default: 1.0 }           // Bật ngay khi phát hiện
      },
      medium: {
        temperature: { type: Number, default: 1.3 },    // +30%
        smoke: { type: Number, default: 1.8 },          // +80%
        gas_ppm: { type: Number, default: 2.5 },        // +150%
        humidity: { type: Number, default: 1.5 },       // +50%
        flame: { type: Number, default: 1.0 }
      },
      low: {
        temperature: { type: Number, default: 1.5 },    // +50%
        smoke: { type: Number, default: 2.0 },          // +100%
        gas_ppm: { type: Number, default: 3.0 },        // +200%
        humidity: { type: Number, default: 2.0 },       // +100%
        flame: { type: Number, default: 1.0 }
      }
    },
    criticalThresholds: {
      temperature: { type: Number, default: 90 },
      smoke: { type: Number, default: 1.5 },
      gas_ppm: { type: Number, default: 100 },
      humidity: { type: Number, default: 20 },
      flame: { type: Number, default: 1 }
    }
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
ruleSchema.methods.isInCooldown = function() {
  return false;
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

// Increment trigger count
ruleSchema.methods.incrementTriggerCount = function() {
  this.triggerCount++;
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
