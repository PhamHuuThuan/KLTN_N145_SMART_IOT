import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import axios from 'axios';

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
    const user = await User.create({ email, passwordHash, name, phone, avatar });
    const token = signToken({ sub: user._id.toString(), email });

    // Fire-and-forget: initialize notification preferences in alerts-service
    (async () => {
      try {
        const alertsBaseUrl = process.env.ALERTS_SERVICE_URL || 'http://localhost:3004';
        
        // Create service-to-service token for internal communication
        const serviceToken = signToken({ 
          sub: user._id.toString(), 
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
        const response = await client.put(`/user/${user._id.toString()}/preferences`, {
          email: { 
            enabled: true, 
            address: email,
            verified: false
          },
          sms: { 
            enabled: false, 
            phoneNumber: '',
            verified: false
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
        
        console.log('✅ UserNotificationPreferences created for user:', user._id.toString(), 'Response:', response.status);
      } catch (e) {
        // Log only, do not block registration
        console.warn('❌ Failed to initialize notification preferences:', e?.message || e);
        console.warn('❌ Error details:', {
          status: e.response?.status,
          data: e.response?.data,
          url: e.config?.url,
          headers: e.config?.headers
        });
        
        // Retry after 2 seconds
        setTimeout(async () => {
          try {
            console.log('🔄 Retrying to create notification preferences...');
            const alertsBaseUrl = process.env.ALERTS_SERVICE_URL || 'http://localhost:3004';
            const serviceToken = signToken({ 
              sub: user._id.toString(), 
              email: email,
              role: 'service',
              service: 'auth-service'
            });
            
            const retryClient = axios.create({
              baseURL: `${alertsBaseUrl}/api/notifications`,
              timeout: 10000,
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceToken}`
              }
            });
            
            await retryClient.put(`/user/${user._id.toString()}/preferences`, {
              email: { enabled: true, address: email, verified: false },
              sms: { enabled: false, phoneNumber: '', verified: false },
              fcm: { enabled: true, tokens: [] },
              inApp: { enabled: true },
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
            
            console.log('✅ UserNotificationPreferences created on retry for user:', user._id.toString());
          } catch (retryError) {
            console.error('❌ Retry failed to create notification preferences:', retryError?.message || retryError);
          }
        }, 2000);
      }
    })();

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
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

    const token = signToken({ sub: user._id.toString(), email });

    res.json({
      token,
      user: {
        id: user._id,
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
    const user = await User.findById(payload.sub).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    res.json({
      user: {
        id: user._id,
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

    const user = await User.findByIdAndUpdate(
      payload.sub,
      updateData,
      { new: true, select: '-passwordHash' }
    );

    if (!user) {
      return res.status(404).json({ error: 'user_not_found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
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

    const user = await User.findById(payload.sub);
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
    
    // Update password
    await User.findByIdAndUpdate(payload.sub, { passwordHash: newPasswordHash });

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
