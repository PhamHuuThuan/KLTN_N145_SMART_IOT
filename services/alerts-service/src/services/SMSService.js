import twilio from 'twilio';
import logger from '../utils/logger.js';

class SMSService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.initialized = false;
    this._initialize();
  }

  _initialize() {
    try {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.initialized = true;
        logger.info('📱 SMS service initialized successfully');
      } else {
        logger.info('📱 SMS service disabled - Twilio credentials not provided');
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
      if (!this.initialized || !this.client) {
        logger.warn('SMS service not initialized, skipping SMS send');
        return null;
      }

      const formattedMessage = this._formatMessage(message, metadata);
      
      const result = await this.client.messages.create({
        body: formattedMessage,
        from: this.fromNumber,
        to: this._formatPhoneNumber(to)
      });

      logger.info('SMS sent successfully', { 
        sid: result.sid, 
        to, 
        status: result.status 
      });
      
      return result;
    } catch (error) {
      logger.error('Error sending SMS:', error);
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
      
      // Use Twilio Lookup API to verify the number
      const result = await this.client.lookups.v1.phoneNumbers(formattedNumber).fetch();
      
      logger.info('Phone number verified', { 
        phoneNumber: formattedNumber,
        countryCode: result.countryCode,
        nationalFormat: result.nationalFormat
      });
      
      return {
        valid: true,
        formatted: result.phoneNumber,
        countryCode: result.countryCode,
        nationalFormat: result.nationalFormat
      };
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
      const message = `Mã xác thực Smart IoT Kitchen: ${code}\nMã có hiệu lực trong 5 phút.`;
      
      const result = await this.send(phoneNumber, message);
      
      logger.info('Verification code sent', { 
        phoneNumber, 
        sid: result.sid 
      });
      
      return result;
    } catch (error) {
      logger.error('Error sending verification code:', error);
      throw error;
    }
  }

  /**
   * Check SMS delivery status
   * @param {string} messageSid - Twilio message SID
   */
  async checkDeliveryStatus(messageSid) {
    try {
      const message = await this.client.messages(messageSid).fetch();
      
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
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
      const { startDate, endDate, limit = 100 } = options;
      
      const messages = await this.client.messages.list({
        dateSentAfter: startDate,
        dateSentBefore: endDate,
        limit
      });
      
      const stats = {
        total: messages.length,
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        failed: messages.filter(m => m.status === 'failed').length,
        undelivered: messages.filter(m => m.status === 'undelivered').length
      };
      
      return stats;
    } catch (error) {
      logger.error('Error getting SMS usage stats:', error);
      throw error;
    }
  }
}

export default SMSService;
