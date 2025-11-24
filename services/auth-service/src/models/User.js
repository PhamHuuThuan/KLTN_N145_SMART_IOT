import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  passwordHash: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9+\-\s()]+$/, 'Please enter a valid phone number'],
    maxlength: 20
  },
  avatar: {
    type: String,
    default: null,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  resetCode: {
    type: String,
    default: null
  },
  resetCodeExpires: {
    type: Date,
    default: null
  },
  resetCodeAttempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

userSchema.index({ userId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

userSchema.virtual('password')
  .set(function(password) {
    this.passwordHash = bcrypt.hashSync(password, 12);
  });

userSchema.methods.checkPassword = function(password) {
  return bcrypt.compareSync(password, this.passwordHash);
};

userSchema.methods.isActive = function() {
  return this.status === 'active';
};

userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

userSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

userSchema.statics.findByRole = function(role) {
  return this.find({ role });
};

userSchema.statics.generateUserId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `user_${timestamp}_${random}`;
};

// Password reset methods
userSchema.statics.generateResetCode = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

userSchema.methods.setResetCode = function() {
  this.resetCode = this.constructor.generateResetCode();
  this.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  this.resetCodeAttempts = 0;
  return this.save();
};

userSchema.methods.verifyResetCode = function(code) {
  if (!this.resetCode || !this.resetCodeExpires) {
    return { valid: false, error: 'no_reset_code' };
  }
  
  if (new Date() > this.resetCodeExpires) {
    return { valid: false, error: 'code_expired' };
  }
  
  if (this.resetCodeAttempts >= 5) {
    return { valid: false, error: 'too_many_attempts' };
  }
  
  if (this.resetCode !== code) {
    this.resetCodeAttempts += 1;
    this.save();
    return { valid: false, error: 'invalid_code' };
  }
  
  return { valid: true };
};

userSchema.methods.clearResetCode = function() {
  this.resetCode = null;
  this.resetCodeExpires = null;
  this.resetCodeAttempts = 0;
  return this.save();
};

const User = mongoose.model('User', userSchema);

userSchema.pre('save', function(next) {
  if (!this.userId) {
    this.userId = this.constructor.generateUserId();
  }
  next();
});

export default User;
