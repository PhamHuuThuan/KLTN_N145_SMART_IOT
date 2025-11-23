import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import User from '../models/User.js';
import EmailService from '../services/EmailService.js';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-strong-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export const register = async (req, res) => {
  try {
    const { email, password, name, phone, avatar } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = User.generateUserId();
    const user = await User.create({ userId, email, passwordHash, name, phone, avatar });
    const token = signToken({ 
      sub: user.userId, 
      id: user._id.toString(),
      email 
    });

    // Fire-and-forget: initialize notification preferences in alerts-service
    (async () => {
      try {
        const alertsBaseUrl = process.env.ALERTS_SERVICE_URL || 'http://localhost:3004';
        
        // Create service-to-service token for internal communication
        const serviceToken = signToken({ 
          sub: user.userId, 
          email: email,
          role: 'service',
          service: 'auth-service'
        });
        
        const client = axios.create({
          baseURL: `${alertsBaseUrl}/api/notifications`,
          timeout: 10000,
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceToken}`
          }
        });
        
        // Try to create default preferences
        const response = await client.put(`/user/${user.userId.toString()}/preferences`, {
          email: { 
            enabled: true, 
            addresses: [{
              name: user.name,
              address: email,
              isDefault: true,
              addedAt: new Date()
            }],
          },
          sms: { 
            enabled: false, 
            phoneNumber: '',
          },
          fcm: { 
            enabled: true,
            tokens: []
          },
          inApp: { 
            enabled: true 
          },
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [
              { type: 'urgent', enabled: true },
              { type: 'security', enabled: true },
              { type: 'system', enabled: true }
            ]
          }
        });
        
      } catch (e) {
        // Log only, do not block registration
        logger.warn('❌ Failed to initialize notification preferences:', e?.message || e);
      }
    })();

    res.status(201).json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json({ error: 'registration_failed' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    const token = signToken({ 
      sub: user.userId, 
      id: user._id.toString(),
      email 
    });

    res.json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'login_failed' });
  }
};

export const me = async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ userId: payload.sub }).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    res.json({
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'invalid_token' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'missing_token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const { name, phone, avatar } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Only allow updating name, phone, and avatar - NOT email
    const updateData = { name };
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.findOneAndUpdate({ userId: payload.sub }, updateData, { new: true, select: '-passwordHash' });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    (async () => {
      try {
        const alertsBaseUrl = process.env.ALERTS_SERVICE_URL || 'http://localhost:3004';
        
        const serviceToken = signToken({ 
          sub: user.userId, 
          email: user.email,
          role: 'service',
          service: 'auth-service'
        });
        
        const client = axios.create({
          baseURL: `${alertsBaseUrl}/api/notifications`,
          timeout: 10000,
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceToken}`
          }
        });

        const currentPrefsResponse = await client.get(`/user/${user.userId.toString()}/preferences`);
        const currentPrefs = currentPrefsResponse.data?.data || {};
        const preferencesUpdate = {};
        
        if (currentPrefs.email && currentPrefs.email.addresses && currentPrefs.email.addresses.length > 0) {

          const defaultEmailIndex = currentPrefs.email.addresses.findIndex(addr => addr.isDefault);
          if (defaultEmailIndex >= 0) {
            preferencesUpdate.email = {
              ...currentPrefs.email,
              addresses: currentPrefs.email.addresses.map((addr, idx) => 
                idx === defaultEmailIndex 
                  ? { ...addr, address: user.email, name: user.name }
                  : addr
              )
            };
          } else {
            preferencesUpdate.email = {
              ...currentPrefs.email,
              addresses: [{
                name: user.name,
                address: user.email,
                isDefault: true,
                addedAt: new Date()
              }]
            };
          }
        }

        if (phone !== undefined && phone) {
          preferencesUpdate.sms = {
            ...currentPrefs.sms,
            phoneNumbers: phone ? [{
              name: user.name,
              phoneNumber: phone,
              isDefault: true,
              addedAt: new Date()
            }] : []
          };
        }

        if (Object.keys(preferencesUpdate).length > 0) {
          await client.put(`/user/${user.userId.toString()}/preferences`, preferencesUpdate);
        }
      } catch (e) {
        logger.warn(`Failed to update notification preferences: ${e?.message || e}`);
      }
    })();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        userId: user.userId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'invalid_token' });
    }
    res.status(500).json({ error: 'update_failed' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'missing_token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'new_password_must_be_at_least_6_characters' });
    }

    // payload.sub is userId string, payload.id is MongoDB ObjectId
    const user = await User.findOne({ userId: payload.sub });
    
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'current_password_incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    await User.findOneAndUpdate({ userId: payload.sub }, { passwordHash: newPasswordHash });

    res.json({
      message: 'Password changed successfully'
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'invalid_token' });
    }
    res.status(500).json({ error: 'password_change_failed' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email_required' });
    }

    // Kiểm tra email có tồn tại không
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ 
        message: 'If the email exists, a reset code has been sent' 
      });
    }

    // Tạo mã reset và lưu vào user
    await user.setResetCode();
    
    // Gửi email trực tiếp
    try {
      const emailService = new EmailService();
      await emailService.sendPasswordResetEmail(
        email.toLowerCase(), 
        user.resetCode, 
        user.name
      );
      
      logger.info('Password reset code sent successfully', { 
        email: email.toLowerCase(),
        code: user.resetCode 
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
    }

    res.json({ 
      message: 'If the email exists, a reset code has been sent' 
    });
  } catch (err) {
    logger.error('Forgot password error:', err);
    res.status(500).json({ error: 'forgot_password_failed' });
  }
};

export const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ error: 'email_and_code_required' });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'invalid_code_format' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    const result = user.verifyResetCode(code);
    
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      message: 'Code verified successfully',
      expiresAt: user.resetCodeExpires
    });
  } catch (err) {
    logger.error('Verify reset code error:', err);
    res.status(500).json({ error: 'verify_code_failed' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email_code_and_password_required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'password_must_be_at_least_6_characters' });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'invalid_code_format' });
    }

    // Tìm user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    // Xác thực mã một lần nữa
    const result = user.verifyResetCode(code);
    
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    // Hash mật khẩu mới
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Cập nhật mật khẩu và xóa mã reset
    await User.findByIdAndUpdate(user._id, { 
      passwordHash: newPasswordHash,
      resetCode: null,
      resetCodeExpires: null,
      resetCodeAttempts: 0
    });

    logger.info('Password reset successfully', { 
      email: email.toLowerCase(),
      userId: user.userId 
    });

    res.json({ 
      message: 'Password reset successfully' 
    });
  } catch (err) {
    logger.error('Reset password error:', err);
    res.status(500).json({ error: 'reset_password_failed' });
  }
};
