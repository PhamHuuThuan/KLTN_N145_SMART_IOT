import mongoose from 'mongoose';

const ruleTemplateSchema = new mongoose.Schema({
  templateKey: {
    type: String,
    required: true,
    trim: true,
    index: true
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
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true
  },
  cooldownPeriod: {
    type: Number,
    default: 300000,
    min: 0,
    max: 86400000  // Max 24 hours
  },
  conditions: [{
    type: {
      type: String,
      required: true,
      enum: ['sensor']
    },
    sensor: {
      type: String,
      enum: ['temperature', 'humidity', 'gas_ppm', 'smoke', 'flame'],
      required: true
    },
    operator: {
      type: String,
      enum: ['>', '<', '>=', '<=', '==', '!=', 'between'],
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    unit: {
      type: String,
      trim: true
    }
  }],
  actions: [{
    type: {
      type: String,
      required: true,
      enum: ['send_notification', 'send_alert']
    },
    message: {
      type: String,
      required: true
    }
  }],
  language: {
    type: String,
    enum: ['vi', 'en'],
    default: 'vi',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    trim: true
  },
  updatedBy: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
ruleTemplateSchema.index({ templateKey: 1, language: 1 }, { unique: true });
ruleTemplateSchema.index({ language: 1 });
ruleTemplateSchema.index({ priority: 1 });
ruleTemplateSchema.index({ isActive: 1 });

// Static methods
ruleTemplateSchema.statics.getByLanguage = async function(language = 'vi') {
  return this.find({ language, isActive: true }).sort({ priority: 1, templateKey: 1 });
};

ruleTemplateSchema.statics.getByKey = async function(templateKey, language = 'vi') {
  return this.findOne({ templateKey, language, isActive: true });
};

ruleTemplateSchema.statics.getAllTemplates = async function(language = 'vi') {
  return this.find({ language }).sort({ priority: 1, templateKey: 1 });
};

const RuleTemplate = mongoose.models.RuleTemplate || mongoose.model('RuleTemplate', ruleTemplateSchema);

export default RuleTemplate;
