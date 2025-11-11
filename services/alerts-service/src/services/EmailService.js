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
        logger.info('📧 Email service initialized successfully');
      } else {
        logger.info('📧 Email service disabled - SMTP credentials not provided');
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
    const createdAt = metadata.timestamp ? new Date(metadata.timestamp) : new Date();
    const priority = (metadata.priority || metadata.rulePriority || '').toString().toLowerCase();
    const priorityLabel = priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Info';
        
    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart IoT Kitchen Notification</title>
        <style>
          :root {
            --bg: #f6f7fb;
            --card: #ffffff;
            --text: #2c3e50;
            --muted: #6b7280;
            --primary: #3b82f6;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --border: #eef1f6;
          }
          body {
            margin: 0;
            padding: 24px;
            background: var(--bg);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
          }
          .wrapper { max-width: 640px; margin: 0 auto; }
          .card {
            background: var(--card);
            border-radius: 14px;
            border: 1px solid var(--border);
            box-shadow: 0 8px 24px rgba(149, 157, 165, 0.1);
            overflow: hidden;
          }
          .header {
            padding: 16px 20px;
            background: linear-gradient(135deg,rgb(77, 125, 193),rgb(77, 125, 193));
            color: #fff;
          }
          .brand { margin: 0; font-size: 18px; letter-spacing: .3px; }
          .subtitle { margin: 4px 0 0; opacity: .8; font-size: 12px; }
          .content { padding: 16px 20px; }
          .title {
            margin: 0 0 6px;
            font-size: 17px;
            color: var(--text);
          }
          .message { margin: 0 0 12px; color: var(--muted); }
          .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 14px; }
          .chip { display: inline-block; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: #fafbff; color: var(--muted); font-size: 12px; }
          .chip--primary { background: rgba(59,130,246,.08); color: var(--primary); border-color: rgba(59,130,246,.25); }
          .chip--success { background: rgba(16,185,129,.08); color: var(--success); border-color: rgba(16,185,129,.25); }
          .chip--warning { background: rgba(245,158,11,.08); color: var(--warning); border-color: rgba(245,158,11,.25); }
          .chip--danger { background: rgba(239,68,68,.08); color: var(--danger); border-color: rgba(239,68,68,.25); }
          .section {
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 14px;
            margin: 12px 0;
          }
          .section-title { margin: 0 0 10px; font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
          .kv { width: 100%; border-collapse: collapse; }
          .kv td { padding: 6px 0; vertical-align: top; }
          .kv td.key { width: 42%; color: var(--muted); }
          .kv td.val { color: var(--text); }
          .cta { text-align: left; margin-top: 14px; }
          .btn {
            display: inline-block;
            padding: 9px 14px;
            background: var(--primary);
            color: #fff !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(59,130,246,.25);
          }
          .footer {
            padding: 14px 20px 18px;
            border-top: 1px solid var(--border);
            background: #fafbff;
            color: var(--muted);
            font-size: 12px;
            text-align: center;
          }
          .icon { display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: -2px; }
          .lead {
            display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:10px; background:#f9fafb; border:1px solid var(--border); margin-bottom:12px;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">
            <div class="header">
              <h1 class="brand">Smart IoT Kitchen</h1>
              <p class="subtitle">Thông báo từ hệ thống</p>
            </div>
            <div class="content">
              <h2 class="title">${subject}</h2>
              <p class="message">${message}</p>
              <div class="chips">
                <span class="chip chip--primary">${createdAt.toLocaleString('vi-VN')}</span>
                ${deviceName ? `<span class=\"chip\"><span class=\"icon\">🔌</span>${deviceName}</span>` : ''}
                ${sensorType ? `<span class=\"chip chip--success\"><span class=\"icon\">📟</span>${sensorType}</span>` : ''}
                ${priority ? `<span class=\"chip ${priority === 'urgent' ? 'chip--danger' : (priority === 'high' ? 'chip--warning' : 'chip--primary')}\">Độ ưu tiên: ${priorityLabel}</span>` : ''}
              </div>
              ${deviceName || metadata.deviceId ? `
                <div class="section">
                  <div class="section-title">Thông tin thiết bị</div>
                  <table class="kv">
                    ${deviceName ? `<tr><td class="key">Tên thiết bị</td><td class="val">${deviceName}</td></tr>` : ''}
                    ${metadata.deviceId ? `<tr><td class="key">ID thiết bị</td><td class="val">${metadata.deviceId}</td></tr>` : ''}
                  </table>
                </div>
              ` : ''}
              ${sensorType || (sensorValue !== undefined) || (threshold !== undefined) ? `
                <div class="section">
                  <div class="section-title">Thông tin cảm biến</div>
                  <table class="kv">
                    ${sensorType ? `<tr><td class="key">Loại cảm biến</td><td class="val">${sensorType}</td></tr>` : ''}
                    ${sensorValue !== undefined ? `<tr><td class="key">Giá trị hiện tại</td><td class="val">${sensorValue}</td></tr>` : ''}
                    ${threshold !== undefined ? `<tr><td class="key">Ngưỡng</td><td class="val">${threshold}</td></tr>` : ''}
                  </table>
                </div>
              ` : ''}
              ${action ? `
                <div class="section">
                  <div class="section-title">Hành động thực hiện</div>
                  <table class="kv">
                    <tr><td class="key">Hành động</td><td class="val">${action}</td></tr>
                  </table>
                </div>
              ` : ''}
              <div class="cta">
                <a class="btn" href="${process.env.APP_URL || 'http://localhost:3000'}/notifications">Xem chi tiết</a>
              </div>
            </div>
            <div class="footer">
              <p>Đây là email tự động từ hệ thống Smart IoT Kitchen. Vui lòng không trả lời email này.</p>
              <p>&copy; ${new Date().getFullYear()} Smart IoT Kitchen. All rights reserved.</p>
            </div>
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
