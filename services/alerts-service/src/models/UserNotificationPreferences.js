import mongoose from 'mongoose';

const userNotificationPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.String,
    required: true,
    unique: true
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
    startTime: { type: String, default: '22:00' },
    endTime: { type: String, default: '08:00' },
    timezone: { type: String, default: 'UTC' },
    exceptions: [{
      type: { type: String, enum: ['urgent', 'security', 'system'] },
      enabled: { type: Boolean, default: true }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true   }
});

userNotificationPreferencesSchema.methods.shouldSendNotification = function(method, priority = 'medium') {
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

  if (priority === 'urgent') {
    return true;
  }

  if (this.quietHours.enabled && priority !== 'urgent') {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const startTime = this.quietHours.startTime;
    const endTime = this.quietHours.endTime;
    
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

userNotificationPreferencesSchema.methods.addFCMToken = function(token, platform) {
  this.fcm.tokens = this.fcm.tokens.filter(t => t.token !== token);
  
  this.fcm.tokens.push({
    token,
    platform,
    addedAt: new Date(),
    lastUsed: new Date()
  });
  
  return this.save();
};

userNotificationPreferencesSchema.methods.removeFCMToken = function(token) {
  this.fcm.tokens = this.fcm.tokens.filter(t => t.token !== token);
  return this.save();
};

userNotificationPreferencesSchema.methods.updateFCMTokenUsage = function(token) {
  const tokenObj = this.fcm.tokens.find(t => t.token === token);
  if (tokenObj) {
    tokenObj.lastUsed = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

userNotificationPreferencesSchema.statics.getUserPreferences = function(userId) {
  return this.findOne({ userId: userId });
};

userNotificationPreferencesSchema.statics.createDefaultPreferences = function(userId, email, phoneNumber = null) {
  return this.create({
    userId: userId,
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

userNotificationPreferencesSchema.statics.ensureDefaultPreferences = async function(userId, email, phoneNumber = null) {
  const existing = await this.findOne({ userId: userId });
  if (existing) return existing;
  return this.createDefaultPreferences(userId, email, phoneNumber);
};

export default mongoose.model('UserNotificationPreferences', userNotificationPreferencesSchema);
