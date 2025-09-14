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

      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
          type: data.type || 'notification'
        },
        android: {
          priority: 'high',
          notification: {
            icon: 'ic_notification',
            color: '#2C3E50',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        },
        webpush: {
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            requireInteraction: true
          }
        }
      };

      // Send to all tokens
      const response = await admin.messaging().sendMulticast({
        tokens: tokens.map(token => token.token || token),
        ...message
      });

      logger.info('FCM notification sent', {
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: tokens.length
      });

      // Log failed tokens
      if (response.failureCount > 0) {
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            logger.error('FCM send failed', {
              token: tokens[index],
              error: resp.error?.message
            });
          }
        });
      }

      return response;
    } catch (error) {
      logger.error('Error sending FCM notification:', error);
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
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          timestamp: Date.now().toString(),
          type: data.type || 'notification'
        },
        topic,
        android: {
          priority: 'high',
          notification: {
            icon: 'ic_notification',
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
      const message = {
        data: {
          ...data,
          timestamp: Date.now().toString()
        },
        tokens: tokens.map(token => token.token || token),
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

      const response = await admin.messaging().sendMulticast(message);
      
      logger.info('FCM data message sent', {
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return response;
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
