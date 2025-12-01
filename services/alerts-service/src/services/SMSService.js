import axios from 'axios';
import logger from '../utils/logger.js';

class SMSService {
  constructor() {
    this.apiKey = process.env.SPEEDSMS_API_KEY;
    this.deviceId = process.env.SPEEDSMS_DEVICE_ID;
    this.apiUrl = process.env.SPEEDSMS_API_URL || 'https://api.speedsms.vn/index.php/sms/send';
    this.initialized = false;
    this._initialize();
  }

  _initialize() {
    try {
      if (this.apiKey) {
        this.initialized = true;
      }
    } catch (error) {
      logger.error('Failed to initialize SMS service:', error);
    }
  }

  async send(to, message, metadata = {}) {
    try {
      if (!this.initialized) {
        logger.warn('SMS service not initialized, skipping SMS send');
        return null;
      }

      const formattedMessage = this._formatMessage(message, metadata);
      const phoneNumber = this._formatPhoneNumber(to);
      
      const requestData = {
        to: [phoneNumber],
        content: formattedMessage,
        sms_type: 5,
        sender: this.deviceId,
      };

      const auth = Buffer.from(`${this.apiKey}:x`).toString('base64');

      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'Smart-IoT-Kitchen/1.0'
        },
        timeout: 30000
      });

      if (response.data && response.data.status === 'success') {
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

  _formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      return `+84${cleaned.substring(1)}`;
    }
    
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return cleaned;
  }

}

export default SMSService;
