import mongoose from 'mongoose';

const userNotificationPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  email: {
    enabled: { type: Boolean, default: true },
    address: { type: String, required: true },
    verified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationExpires: { type: Date }
  },
  sms: {
    enabled: { type: Boolean, default: false },
    phoneNumber: { type: String },
    verified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationExpires: { type: Date }
  },
  fcm: {
    enabled: { type: Boolean, default: true },
    tokens: [{ 
      token: { type: String, required: true },
      platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
      addedAt: { type: Date, default: Date.now },
      lastUsed: { type: Date, default: Date.now }
    }]
  },
  inApp: {
    enabled: { type: Boolean, default: true }
  },
  categories: {
    sensor: {
      enabled: { type: Boolean, default: true },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        fcm: { type: Boolean, default: true }
      }
    },
    outlet: {
      enabled: { type: Boolean, default: true },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        fcm: { type: Boolean, default: true }
      }
    },
    rule: {
      enabled: { type: Boolean, default: true },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        fcm: { type: Boolean, default: true }
      }
    },
    system: {
      enabled: { type: Boolean, default: true },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        fcm: { type: Boolean, default: true }
      }
    },
    security: {
      enabled: { type: Boolean, default: true },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        fcm: { type: Boolean, default: true }
      }
    },
    maintenance: {
      enabled: { type: Boolean, default: true },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        fcm: { type: Boolean, default: true }
      }
    },
    marketing: {
      enabled: { type: Boolean, default: false },
      methods: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        fcm: { type: Boolean, default: false }
      }
    }
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' }, // HH:MM format
    endTime: { type: String, default: '08:00' },   // HH:MM format
    timezone: { type: String, default: 'UTC' },
    exceptions: [{
      type: { type: String, enum: ['urgent', 'security', 'system'] },
      enabled: { type: Boolean, default: true }
    }]
  },
  frequency: {
    email: { type: String, enum: ['immediate', 'hourly', 'daily', 'weekly'], default: 'immediate' },
    sms: { type: String, enum: ['immediate', 'hourly', 'daily'], default: 'immediate' },
    fcm: { type: String, enum: ['immediate', 'hourly', 'daily'], default: 'immediate' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Method to check if notification should be sent via specific method
userNotificationPreferencesSchema.methods.shouldSendNotification = function(category, method, priority = 'medium') {
  const categoryConfig = this.categories[category];
  if (!categoryConfig || !categoryConfig.enabled) {
    return false;
  }

  // Check if method is enabled for this category
  if (!categoryConfig.methods[method]) {
    return false;
  }

  // Check quiet hours for non-urgent notifications
  if (this.quietHours.enabled && priority !== 'urgent') {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const startTime = this.quietHours.startTime;
    const endTime = this.quietHours.endTime;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      if (currentTime >= startTime || currentTime <= endTime) {
        return false;
      }
    } else {
      if (currentTime >= startTime && currentTime <= endTime) {
        return false;
      }
    }
  }

  return true;
};

// Method to add FCM token
userNotificationPreferencesSchema.methods.addFCMToken = function(token, platform) {
  // Remove existing token if it exists
  this.fcm.tokens = this.fcm.tokens.filter(t => t.token !== token);
  
  // Add new token
  this.fcm.tokens.push({
    token,
    platform,
    addedAt: new Date(),
    lastUsed: new Date()
  });
  
  return this.save();
};

// Method to remove FCM token
userNotificationPreferencesSchema.methods.removeFCMToken = function(token) {
  this.fcm.tokens = this.fcm.tokens.filter(t => t.token !== token);
  return this.save();
};

// Method to update last used time for FCM token
userNotificationPreferencesSchema.methods.updateFCMTokenUsage = function(token) {
  const tokenObj = this.fcm.tokens.find(t => t.token === token);
  if (tokenObj) {
    tokenObj.lastUsed = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to get preferences for user
userNotificationPreferencesSchema.statics.getUserPreferences = function(userId) {
  // Do not populate User to avoid MissingSchemaError in this service
  return this.findOne({ userId });
};

// Static method to create default preferences for new user
userNotificationPreferencesSchema.statics.createDefaultPreferences = function(userId, email, phoneNumber = null) {
  return this.create({
    userId,
    email: {
      enabled: true,
      address: email,
      verified: false
    },
    sms: {
      enabled: false,
      phoneNumber: phoneNumber,
      verified: false
    },
    fcm: {
      enabled: true,
      tokens: []
    },
    inApp: {
      enabled: true
    }
  });
};

// Ensure default preferences exist for a user; create if missing
userNotificationPreferencesSchema.statics.ensureDefaultPreferences = async function(userId, email, phoneNumber = null) {
  const existing = await this.findOne({ userId });
  if (existing) return existing;
  return this.createDefaultPreferences(userId, email, phoneNumber);
};

export default mongoose.model('UserNotificationPreferences', userNotificationPreferencesSchema);
