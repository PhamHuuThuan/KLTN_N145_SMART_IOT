import axios from 'axios';
import logger from '../utils/logger.js';

class SMSService {
  constructor() {
    this.apiKey = process.env.SPEEDSMS_API_KEY;
    this.deviceId = process.env.SPEEDSMS_DEVICE_ID;
    this.senderName = process.env.SPEEDSMS_SENDER_NAME || '';
    this.apiUrl = process.env.SPEEDSMS_API_URL || 'https://api.speedsms.vn/index.php/sms/send';
    this.initialized = false;
    this._initialize();
  }

  _initialize() {
    try {
      if (this.apiKey) {
        this.initialized = true;
        logger.info('📱 SpeedSMS service initialized successfully');
      } else {
        logger.info('📱 SMS service disabled - SpeedSMS API key not provided');
      }
    } catch (error) {
      logger.error('Failed to initialize SMS service:', error);
    }
  }

  /**
   * Send SMS notification
   * @param {string} to - Recipient phone number
   * @param {string} message - SMS message
   * @param {Object} metadata - Additional metadata
   */
  async send(to, message, metadata = {}) {
    try {
      if (!this.initialized) {
        logger.warn('SMS service not initialized, skipping SMS send');
        return null;
      }

      const formattedMessage = this._formatMessage(message, metadata);
      const phoneNumber = this._formatPhoneNumber(to);
      
      // SpeedSMS API expects JSON data with Basic Auth (official NodeJS format)
      const requestData = {
        to: [phoneNumber],
        content: formattedMessage,
        sms_type: 5, // 1 = SMS thường
        device_id: this.deviceId,
        sender: this.deviceId,
      };

      // Create Basic Auth header
      const auth = Buffer.from(`${this.apiKey}:x`).toString('base64');

      logger.info('Sending SMS request to SpeedSMS', {
        url: this.apiUrl,
        to: phoneNumber,
        messageLength: formattedMessage.length,
        sender: requestData.sender,
        smsType: requestData.sms_type
      });
      
      console.log('requestData', requestData);

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'Smart-IoT-Kitchen/1.0'
        },
        timeout: 30000
      });

      if (response.data && response.data.status === 'success') {
        logger.info('SMS sent successfully', { 
          transactionId: response.data.tranId, 
          to: phoneNumber,
          status: response.data.status
        });
        
        return {
          success: true,
          transactionId: response.data.tranId,
          status: response.data.status,
          to: phoneNumber
        };
      } else {
        logger.error('SpeedSMS API error response', {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
          headers: response.headers
        });
        throw new Error(response.data?.message || `Failed to send SMS: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logger.error('Error sending SMS:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      throw error;
    }
  }

  /**
   * Send bulk SMS
   * @param {Array} smsData - Array of SMS data
   */
  async sendBulk(smsData) {
    const results = [];
    
    for (const sms of smsData) {
      try {
        const result = await this.send(sms.to, sms.message, sms.metadata);
        results.push({ success: true, result });
      } catch (error) {
        logger.error('Error in bulk SMS:', error);
        results.push({ success: false, error: error.message, data: sms });
      }
    }

    return results;
  }

  /**
   * Format SMS message with metadata
   * @private
   */
  _formatMessage(message, metadata) {
    const { deviceName, sensorType, sensorValue, threshold, action } = metadata;
    
    let formattedMessage = `Smart IoT Kitchen\n\n${message}`;
    
    if (deviceName) {
      formattedMessage += `\n\nThiết bị: ${deviceName}`;
    }
    
    if (sensorType) {
      formattedMessage += `\nCảm biến: ${sensorType}`;
      if (sensorValue !== undefined) {
        formattedMessage += `\nGiá trị: ${sensorValue}`;
      }
      if (threshold !== undefined) {
        formattedMessage += `\nNgưỡng: ${threshold}`;
      }
    }
    
    if (action) {
      formattedMessage += `\nHành động: ${action}`;
    }
    
    formattedMessage += `\n\nThời gian: ${new Date().toLocaleString('vi-VN')}`;
    
    return formattedMessage;
  }

  /**
   * Format phone number for international format
   * @private
   */
  _formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If it starts with 0, replace with +84 (Vietnam country code)
    if (cleaned.startsWith('0')) {
      return `+84${cleaned.substring(1)}`;
    }
    
    // If it doesn't start with +, add +
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return cleaned;
  }

  /**
   * Verify phone number
   * @param {string} phoneNumber - Phone number to verify
   */
  async verifyPhoneNumber(phoneNumber) {
    try {
      const formattedNumber = this._formatPhoneNumber(phoneNumber);
      
      // SpeedSMS doesn't have a lookup API, so we'll just validate the format
      const isValidFormat = /^(\+84|84|0)[1-9]\d{8,9}$/.test(formattedNumber);
      
      if (isValidFormat) {
        logger.info('Phone number format validated', { 
          phoneNumber: formattedNumber
        });
        
        return {
          valid: true,
          formatted: formattedNumber,
          countryCode: '+84',
          nationalFormat: formattedNumber
        };
      } else {
        return {
          valid: false,
          error: 'Invalid phone number format'
        };
      }
    } catch (error) {
      logger.error('Error verifying phone number:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Send verification code
   * @param {string} phoneNumber - Phone number
   * @param {string} code - Verification code
   */
  async sendVerificationCode(phoneNumber, code) {
    try {
      const message = `Ma xac thuc Smart IoT Kitchen: ${code}. Ma co hieu luc trong 5 phut.`;
      
      const result = await this.send(phoneNumber, message);
      
      logger.info('Verification code sent', { 
        phoneNumber, 
        transactionId: result.transactionId 
      });
      
      return result;
    } catch (error) {
      logger.error('Error sending verification code:', error);
      throw error;
    }
  }

  /**
   * Check SMS delivery status
   * @param {string} transactionId - SpeedSMS transaction ID
   */
  async checkDeliveryStatus(transactionId) {
    try {
      // SpeedSMS uses webhook for delivery status, not direct API call
      // This method is kept for compatibility but will return basic info
      logger.info('Checking delivery status via webhook', { transactionId });
      
      return {
        transactionId: transactionId,
        status: 'pending', // Status will be updated via webhook
        message: 'Delivery status will be updated via webhook'
      };
    } catch (error) {
      logger.error('Error checking SMS delivery status:', error);
      throw error;
    }
  }

  /**
   * Get SMS usage statistics
   * @param {Object} options - Query options
   */
  async getUsageStats(options = {}) {
    try {
      // SpeedSMS balance check would need separate endpoint
      // For now, return basic info
      logger.info('Getting SMS usage stats', { apiKey: this.apiKey ? 'provided' : 'missing' });
      
      return {
        balance: 'unknown', // Would need separate API call
        currency: 'VND',
        lastUpdated: new Date().toISOString(),
        message: 'Balance information requires separate API endpoint'
      };
    } catch (error) {
      logger.error('Error getting SMS usage stats:', error);
      throw error;
    }
  }
}

export default SMSService;
