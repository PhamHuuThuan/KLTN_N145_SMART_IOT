import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this._initialize();
  }

  _initialize() {
    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.transporter = this._createTransporter();
        this.initialized = true;
        logger.info('Email service initialized successfully');
      } else {
        logger.warn('Email service not initialized - missing SMTP credentials');
      }
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  _createTransporter() {
    const config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    return nodemailer.createTransport(config);
  }

  /**
   * Send email notification
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} message - Email message
   * @param {Object} metadata - Additional metadata
   */
  async send(to, subject, message, metadata = {}) {
    try {
      if (!this.initialized || !this.transporter) {
        logger.warn('Email service not initialized, skipping email send');
        return null;
      }

      const htmlContent = this._generateEmailHTML(subject, message, metadata);
      
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: `Smart IoT Kitchen - ${subject}`,
        html: htmlContent,
        text: message
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { 
        messageId: result.messageId, 
        to, 
        subject 
      });
      
      return result;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send bulk emails
   * @param {Array} emails - Array of email data
   */
  async sendBulk(emails) {
    const results = [];
    
    for (const emailData of emails) {
      try {
        const result = await this.send(
          emailData.to,
          emailData.subject,
          emailData.message,
          emailData.metadata
        );
        results.push({ success: true, result });
      } catch (error) {
        logger.error('Error in bulk email:', error);
        results.push({ success: false, error: error.message, data: emailData });
      }
    }

    return results;
  }

  /**
   * Generate HTML email template
   * @private
   */
  _generateEmailHTML(subject, message, metadata) {
    const { deviceName, sensorType, sensorValue, threshold, action } = metadata;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart IoT Kitchen Notification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .header {
            background-color: #2C3E50;
            color: white;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            margin-bottom: 20px;
          }
          .content {
            padding: 20px 0;
          }
          .device-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid #007bff;
          }
          .sensor-info {
            background-color: #e8f5e8;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid #28a745;
          }
          .action-info {
            background-color: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid #ffc107;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Smart IoT Kitchen</h1>
            <p>Thông báo từ hệ thống</p>
          </div>
          
          <div class="content">
            <h2>${subject}</h2>
            <p>${message}</p>
            
            ${deviceName ? `
              <div class="device-info">
                <h3>Thông tin thiết bị</h3>
                <p><strong>Tên thiết bị:</strong> ${deviceName}</p>
                ${deviceId ? `<p><strong>ID thiết bị:</strong> ${metadata.deviceId}</p>` : ''}
              </div>
            ` : ''}
            
            ${sensorType ? `
              <div class="sensor-info">
                <h3>Thông tin cảm biến</h3>
                <p><strong>Loại cảm biến:</strong> ${sensorType}</p>
                ${sensorValue !== undefined ? `<p><strong>Giá trị hiện tại:</strong> ${sensorValue}</p>` : ''}
                ${threshold !== undefined ? `<p><strong>Ngưỡng:</strong> ${threshold}</p>` : ''}
              </div>
            ` : ''}
            
            ${action ? `
              <div class="action-info">
                <h3>Hành động</h3>
                <p><strong>Hành động được thực hiện:</strong> ${action}</p>
              </div>
            ` : ''}
            
            <p>
              <a href="${process.env.APP_URL || 'http://localhost:3000'}/notifications" class="btn">
                Xem chi tiết
              </a>
            </p>
          </div>
          
          <div class="footer">
            <p>Đây là email tự động từ hệ thống Smart IoT Kitchen.</p>
            <p>Vui lòng không trả lời email này.</p>
            <p>&copy; 2024 Smart IoT Kitchen. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Verify email configuration
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
}

export default EmailService;
