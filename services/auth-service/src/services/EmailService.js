import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Sử dụng Gmail SMTP với app password
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER || 'your-email@gmail.com',
          pass: process.env.SMTP_PASS || 'your-app-password'
        }
      });

      logger.info('Email service initialized');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendPasswordResetEmail(email, resetCode, recipientName) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'Smart IoT Kitchen <noreply@smartiotkitchen.com>',
        to: email,
        subject: 'Mã xác nhận đặt lại mật khẩu - Smart IoT Kitchen',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
              <h2 style="color: #333; text-align: center;">Smart IoT Kitchen</h2>
              <h3 style="color: #007bff;">Mã xác nhận đặt lại mật khẩu</h3>
              
              <p>Xin chào <strong>${recipientName}</strong>,</p>
              
              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
              
              <div style="background-color: #e9ecef; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
                <h2 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${resetCode}</h2>
              </div>
              
              <p><strong>Lưu ý quan trọng:</strong></p>
              <ul>
                <li>Mã xác nhận này có hiệu lực trong <strong>15 phút</strong></li>
                <li>Không chia sẻ mã này với bất kỳ ai</li>
                <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
              </ul>
              
              <p>Nếu bạn gặp vấn đề, vui lòng liên hệ với chúng tôi.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; text-align: center;">
                Email này được gửi tự động từ hệ thống Smart IoT Kitchen.<br>
                Vui lòng không trả lời email này.
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Password reset email sent successfully', {
        email: email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email, recipientName) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || 'Smart IoT Kitchen <noreply@smartiotkitchen.com>',
        to: email,
        subject: 'Chào mừng đến với Smart IoT Kitchen!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px;">
              <h2 style="color: #333; text-align: center;">Smart IoT Kitchen</h2>
              
              <h3 style="color: #28a745;">Chào mừng bạn đến với Smart IoT Kitchen!</h3>
              
              <p>Xin chào <strong>${recipientName}</strong>,</p>
              
              <p>Cảm ơn bạn đã đăng ký tài khoản tại Smart IoT Kitchen. Chúng tôi rất vui được chào đón bạn!</p>
              
              <p>Với tài khoản của bạn, bạn có thể:</p>
              <ul>
                <li>Quản lý các thiết bị IoT trong nhà bếp</li>
                <li>Thiết lập các quy tắc tự động</li>
                <li>Nhận thông báo về trạng thái thiết bị</li>
                <li>Điều khiển từ xa các thiết bị</li>
              </ul>
              
              <p>Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.</p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; text-align: center;">
                Smart IoT Kitchen - Làm cho nhà bếp của bạn thông minh hơn
              </p>
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      logger.info('Welcome email sent successfully', {
        email: email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }
}

export default EmailService;
