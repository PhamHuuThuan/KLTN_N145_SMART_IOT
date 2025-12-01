import admin from 'firebase-admin';
import logger from '../utils/logger.js';

class FCMService {
  constructor() {
    this.initialized = false;
    this._initializeFirebase();
  }

  _initializeFirebase() {
    try {
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
      }
    } catch (error) {
      logger.error('Failed to initialize FCM service:', error);
    }
  }

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

      return { successCount, failureCount, totalTokens: flatTokens.length };
    } catch (error) {
      logger.error('Error sending FCM notification:', error);
      throw error;
    }
  }

  async sendEmergency(tokens, title, body, data = {}) {
    try {
      if (!this.initialized) {
        logger.warn('FCM service not initialized, skipping emergency send');
        return null;
      }

      const flatTokens = tokens.map(t => t.token || t).filter(Boolean);
      let successCount = 0;
      let failureCount = 0;

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

      return { successCount, failureCount, totalTokens: flatTokens.length };
    } catch (error) {
      logger.error('Error sending emergency notification:', error);
      throw error;
    }
  }

}

export default FCMService;
