import Joi from 'joi';
import mongoose from 'mongoose';

// Notification validation schema
const notificationSchema = Joi.object({
  userId: Joi.string().required().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }).messages({
    'any.invalid': 'userId must be a valid MongoDB ObjectId'
  }),
  title: Joi.string().max(200).required(),
  message: Joi.string().max(1000).required(),
  type: Joi.string().valid('device_alert', 'system_notification', 'security_alert', 'maintenance', 'promotion', 'acknowledged', 'dismissed', 'false_alarm', 'consolidated_alert').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  metadata: Joi.object({
    deviceId: Joi.string(),
    deviceName: Joi.string(),
    sensorType: Joi.string(),
    sensorValue: Joi.number(),
    threshold: Joi.number(),
    ruleId: Joi.string(),
    ruleName: Joi.string(),
    action: Joi.string(),
    source: Joi.string(),
    responseType: Joi.string(),
    responseTime: Joi.number()
  }).default({})
});

// User preferences validation schema (updated to support multiple emails/phones)
const preferencesSchema = Joi.object({
  email: Joi.object({
    enabled: Joi.boolean(),
    addresses: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        address: Joi.string().email().required(),
        isDefault: Joi.boolean().default(false),
        addedAt: Joi.date()
      })
    ).default([])
  }),
  sms: Joi.object({
    enabled: Joi.boolean(),
    phoneNumbers: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        phoneNumber: Joi.string().pattern(/^(\+?[1-9]\d{1,14}|0\d{9,10})$/).required(),
        isDefault: Joi.boolean().default(false),
        addedAt: Joi.date()
      })
    ).default([])
  }),
  fcm: Joi.object({
    enabled: Joi.boolean(),
    tokens: Joi.array().items(
      Joi.object({
        token: Joi.string().required(),
        platform: Joi.string().valid('android', 'ios', 'web').required(),
        addedAt: Joi.date(),
        lastUsed: Joi.date()
      })
    )
  }),
  inApp: Joi.object({
    enabled: Joi.boolean()
  }),
  quietHours: Joi.object({
    enabled: Joi.boolean(),
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    timezone: Joi.string(),
    exceptions: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('urgent', 'security', 'system'),
        enabled: Joi.boolean()
      })
    )
  })
});

// FCM token validation schema
const fcmTokenSchema = Joi.object({
  token: Joi.string().required(),
  platform: Joi.string().valid('android', 'ios', 'web').required()
});

// Validation middleware
export const validateNotification = (req, res, next) => {
  const { error, value } = notificationSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.body = value;
  next();
};

export const validatePreferences = (req, res, next) => {
  const { error, value } = preferencesSchema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true
  });
  
  if (error) {
    console.error('Validation error:', error.details);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.body = value;
  next();
};

export const validateFCMToken = (req, res, next) => {
  const { error, value } = fcmTokenSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.body = value;
  next();
};

// Bulk notification validation
export const validateBulkNotifications = (req, res, next) => {
  const { notifications } = req.body;
  
  if (!Array.isArray(notifications)) {
    return res.status(400).json({
      success: false,
      message: 'Notifications must be an array'
    });
  }
  
  const errors = [];
  
  notifications.forEach((notification, index) => {
    const { error } = notificationSchema.validate(notification, { abortEarly: false });
    if (error) {
      errors.push({
        index,
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
  });
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors in bulk notifications',
      errors
    });
  }
  
  next();
};
