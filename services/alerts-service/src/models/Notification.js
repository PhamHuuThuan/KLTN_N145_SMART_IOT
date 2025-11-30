import mongoose from 'mongoose';
import { generateNotificationId } from '../utils/idGenerator.js';

const notificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    default: generateNotificationId,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['device_alert', 'system_notification', 'security_alert', 'maintenance', 'promotion', 'acknowledged', 'dismissed', 'false_alarm', 'consolidated_alert', 'escalation_alert'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  deliveryStatus: {
    inApp: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null }
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
      error: { type: String, default: null }
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
      error: { type: String, default: null }
    },
    fcm: {
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
      error: { type: String, default: null }
    }
  },
  metadata: {
    deviceId: { type: String },
    deviceName: { type: String },
    sensorType: { type: String },
    sensorValue: { type: Number },
    threshold: { type: Number },
    ruleId: { type: String },
    ruleName: { type: String },
    action: { type: String },
    source: { type: String },
    responseType: { type: String },
    responseTime: { type: Number }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1 });

notificationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  this.readAt = null;
  return this.save();
};

notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, isRead: false });
};

notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    priority,
    isRead,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;

  const query = { userId };
  
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (isRead !== undefined) query.isRead = isRead;

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

export default mongoose.model('Notification', notificationSchema);
