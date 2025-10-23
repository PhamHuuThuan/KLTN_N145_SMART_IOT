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
    addresses: [{
      name: { type: String, required: true },
      address: { type: String, required: true },
      isDefault: { type: Boolean, default: false },
      addedAt: { type: Date, default: Date.now }
    }]
  },
  sms: {
    enabled: { type: Boolean, default: false },
    phoneNumbers: [{
      name: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      isDefault: { type: Boolean, default: false },
      addedAt: { type: Date, default: Date.now }
    }]
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
  quietHours: {
    enabled: { type: Boolean, default: false },
    startTime: { type: String, default: '22:00' }, // HH:MM format
    endTime: { type: String, default: '08:00' },   // HH:MM format
    timezone: { type: String, default: 'UTC' },
    exceptions: [{
      type: { type: String, enum: ['urgent', 'security', 'system'] },
      enabled: { type: Boolean, default: true }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Method to check if notification should be sent via specific method
userNotificationPreferencesSchema.methods.shouldSendNotification = function(method, priority = 'medium') {
  // Check if method is enabled
  if (method === 'email' && !this.email.enabled) {
    return false;
  }
  if (method === 'sms' && !this.sms.enabled) {
    return false;
  }
  if (method === 'fcm' && !this.fcm.enabled) {
    return false;
  }
  if (method === 'inApp' && !this.inApp.enabled) {
    return false;
  }

  // Đơn giản hóa: chỉ urgent bypass tất cả, còn lại theo quiet hours
  if (priority === 'urgent') {
    return true; // Urgent luôn gửi qua tất cả channels
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
      addresses: email ? [{
        name: 'Tôi',
        address: email,
        isDefault: true,
        addedAt: new Date()
      }] : []
    },
    sms: {
      enabled: false,
      phoneNumbers: phoneNumber ? [{
        name: 'Tôi',
        phoneNumber: phoneNumber,
        isDefault: true,
        addedAt: new Date()
      }] : []
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
