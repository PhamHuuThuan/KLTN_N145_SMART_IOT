import admin from 'firebase-admin';
import logger from '../utils/logger.js';

class FCMService {
  constructor() {
    this.initialized = false;
    this._initializeFirebase();
  }

  _initializeFirebase() {
    try {
      // Check if Firebase credentials are provided
      const hasCredentials = process.env.FCM_PROJECT_ID && 
                           process.env.FCM_PRIVATE_KEY && 
                           process.env.FCM_CLIENT_EMAIL;
      
      if (hasCredentials) {
        if (!admin.apps.length) {
          const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FCM_PROJECT_ID,
            private_key_id: process.env.FCM_PRIVATE_KEY_ID,
            private_key: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FCM_CLIENT_EMAIL,
            client_id: process.env.FCM_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FCM_CLIENT_EMAIL}`
          };

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FCM_PROJECT_ID
          });
        }
        this.initialized = true;
        logger.info('🔔 FCM service initialized successfully');
      } else {
        // Only log as info, not warning, since FCM is optional
        logger.info('🔔 FCM service disabled - Firebase credentials not provided');
      }
    } catch (error) {
      logger.error('Failed to initialize FCM service:', error);
    }
  }

  /**
   * Send FCM notification to multiple tokens
   * @param {Array} tokens - Array of FCM tokens
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} data - Additional data payload
   */
  async send(tokens, title, body, data = {}) {
    try {
      if (!this.initialized) {
        logger.warn('FCM service not initialized, skipping FCM send');
        return null;
      }

      if (!tokens || tokens.length === 0) {
        logger.warn('No FCM tokens provided');
        return null;
      }

      // FCM data payload must be strings only; drop undefined and stringify others
      const sanitizedData = Object.fromEntries(
        Object.entries(data || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [
            k,
            typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v))
          ])
      );

      const imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : "https://lh3.googleusercontent.com/pw/AP1GczM7gq9owwwcjM55gVV3gg2g0C4j4nBYCNAguAoItm5XAx4-iRXT64KLF4Gy8B8AFDlmixUuRCPRXwavig0rwsgCcNVsEqd_B-KNC5SNmbeCRFPrW3KKmxVnpp_OGewHdx9INnEiah9E_B6MNBDVYtB2=w444-h444-s-no?authuser=0";

      const message = {
        notification: {
          title,
          body,
          ...(imageUrl ? { imageUrl } : {})
        },
        data: {
          ...sanitizedData,
          timestamp: Date.now().toString(),
          type: String((data && data.type) || 'notification'),
          title: title,
          body: body,
          category: data.category || 'system',
          priority: data.priority || 'low'
        },
        android: {
          priority: 'high',
          notification: {
            color: '#2C3E50',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            channelId: 'default',
            ...(imageUrl ? { imageUrl } : {})
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              alert: {
                title,
                body
              }
            }
          }
        },
        webpush: {
          notification: {
            ...(imageUrl ? { image: imageUrl } : {}),
            badge: '/icons/badge-72x72.png',
            requireInteraction: true
          }
        }
      };

      // Workaround: send individually to avoid /batch issues on some environments
      const flatTokens = tokens.map(t => t.token || t).filter(Boolean);
      let successCount = 0;
      let failureCount = 0;
      for (const t of flatTokens) {
        try {
          await admin.messaging().send({ token: t, ...message });
          successCount++;
        } catch (e) {
          failureCount++;
          logger.error('FCM send failed', { token: t, error: e?.message });
        }
      }

      logger.info('FCM notification sent', {
        successCount,
        failureCount,
        totalTokens: flatTokens.length
      });

      return { successCount, failureCount, totalTokens: flatTokens.length };
    } catch (error) {
      logger.error('Error sending FCM notification:', error);
      throw error;
    }
  }

  /**
   * Send high-priority emergency alert with full-screen notification
   * @param {Array} tokens - FCM tokens
   * @param {string} title - Title (for fallback)
   * @param {string} body - Body (for fallback)
   * @param {Object} data - Must include type/category/priority and metadata
   */
  async sendEmergency(tokens, title, body, data = {}) {
    try {
      if (!this.initialized) {
        logger.warn('FCM service not initialized, skipping emergency send');
        return null;
      }

      const flatTokens = tokens.map(t => t.token || t).filter(Boolean);
      let successCount = 0;
      let failureCount = 0;

      // Normalize emergency data payload (strings only)
      const baseData = Object.fromEntries(
        Object.entries({
          type: 'security_alert',
          category: 'security',
          priority: 'urgent',
          title: String(title || 'Cảnh báo khẩn cấp'),
          body: String(body || 'Phát hiện sự cố an toàn. Mở ngay.'),
          ...data,
        }).map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
      );

      for (const t of flatTokens) {
        try {
          // Send both notification and data for better compatibility
          await admin.messaging().send({
            token: t,
            data: {
              ...baseData,
              timestamp: Date.now().toString(),
              type: String(baseData.type || 'security_alert'),
              title: baseData.title,
              body: baseData.body,
              category: baseData.category || 'security',
              priority: baseData.priority || 'urgent'
            },
            android: {
              priority: 'high',
              ttl: 0,
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                  alert: {
                    title: baseData.title,
                    body: baseData.body
                  },
                  'content-available': 1,
                  'mutable-content': 1
                }
              }
            }
          });
          successCount++;
        } catch (e) {
          failureCount++;
          logger.error('Emergency FCM send failed', { token: t, error: e?.message });
        }
      }

      logger.info('Emergency notification sent', { successCount, failureCount, totalTokens: flatTokens.length });
      return { successCount, failureCount, totalTokens: flatTokens.length };
    } catch (error) {
      logger.error('Error sending emergency notification:', error);
      throw error;
    }
  }

  /**
   * Send FCM notification to topic
   * @param {string} topic - Topic name
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} data - Additional data payload
   */
  async sendToTopic(topic, title, body, data = {}) {
    try {
      const sanitizedData = Object.fromEntries(
        Object.entries(data || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [
            k,
            typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v))
          ])
      );
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...sanitizedData,
          timestamp: Date.now().toString(),
          type: String((data && data.type) || 'notification')
        },
        topic,
        android: {
          priority: 'high',
          notification: {
            icon: 'https://lh3.googleusercontent.com/pw/AP1GczM7gq9owwwcjM55gVV3gg2g0C4j4nBYCNAguAoItm5XAx4-iRXT64KLF4Gy8B8AFDlmixUuRCPRXwavig0rwsgCcNVsEqd_B-KNC5SNmbeCRFPrW3KKmxVnpp_OGewHdx9INnEiah9E_B6MNBDVYtB2=w444-h444-s-no?authuser=0',
            color: '#2C3E50',
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      
      logger.info('FCM topic notification sent', {
        topic,
        messageId: response
      });

      return response;
    } catch (error) {
      logger.error('Error sending FCM topic notification:', error);
      throw error;
    }
  }

  /**
   * Send FCM data-only message
   * @param {Array} tokens - Array of FCM tokens
   * @param {Object} data - Data payload
   */
  async sendDataMessage(tokens, data) {
    try {
      const sanitizedData = Object.fromEntries(
        Object.entries(data || {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [
            k,
            typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v))
          ])
      );
      const message = {
        data: {
          ...sanitizedData,
          timestamp: Date.now().toString()
        },
        android: {
          priority: 'high'
        },
        apns: {
          payload: {
            aps: {
              'content-available': 1
            }
          }
        }
      };

      // Send individually to avoid /batch issues
      const flatTokens = tokens.map(t => t.token || t).filter(Boolean);
      let successCount = 0;
      let failureCount = 0;
      for (const t of flatTokens) {
        try {
          await admin.messaging().send({ token: t, ...message });
          successCount++;
        } catch (e) {
          failureCount++;
          logger.error('FCM data send failed', { token: t, error: e?.message });
        }
      }

      logger.info('FCM data message sent', { successCount, failureCount });
      return { successCount, failureCount, totalTokens: flatTokens.length };
    } catch (error) {
      logger.error('Error sending FCM data message:', error);
      throw error;
    }
  }

  /**
   * Subscribe tokens to topic
   * @param {Array} tokens - Array of FCM tokens
   * @param {string} topic - Topic name
   */
  async subscribeToTopic(tokens, topic) {
    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      
      logger.info('Tokens subscribed to topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response;
    } catch (error) {
      logger.error('Error subscribing to topic:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe tokens from topic
   * @param {Array} tokens - Array of FCM tokens
   * @param {string} topic - Topic name
   */
  async unsubscribeFromTopic(tokens, topic) {
    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      
      logger.info('Tokens unsubscribed from topic', {
        topic,
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response;
    } catch (error) {
      logger.error('Error unsubscribing from topic:', error);
      throw error;
    }
  }

  /**
   * Validate FCM token
   * @param {string} token - FCM token to validate
   */
  async validateToken(token) {
    try {
      // Try to send a test message to validate the token
      const message = {
        token,
        data: {
          test: 'true',
          timestamp: Date.now().toString()
        }
      };

      await admin.messaging().send(message);
      
      logger.info('FCM token validated', { token });
      return { valid: true };
    } catch (error) {
      logger.error('FCM token validation failed:', error);
      return { 
        valid: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get FCM service info
   */
  getServiceInfo() {
    return {
      projectId: process.env.FCM_PROJECT_ID,
      initialized: admin.apps.length > 0
    };
  }
}

export default FCMService;
