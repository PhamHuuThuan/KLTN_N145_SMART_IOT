import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, name });
    const token = signToken({ sub: user._id.toString(), email });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email,
        name
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
        email,
        name: user.name
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'login_failed' });
  }
};

export const me = (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({
      tokenValid: true,
      userId: payload.sub,
      email: payload.email
    });
  } catch (_) {
    res.status(401).json({ error: 'invalid_token' });
  }
};
