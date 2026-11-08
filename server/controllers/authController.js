const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ── POST /api/auth/register ──────────────────────────────────────
const register = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    // Only ADMINs can create ADMIN or AUDITOR roles
    const safeRole = ['ADMIN', 'AUDITOR'].includes(role?.toUpperCase())
      ? role.toUpperCase()
      : 'ACCOUNT_HOLDER';

    const user = await User.create({ name, email, password, role: safeRole });
    const token = signToken(user._id);

    await AuditLog.create({
      user_id:    user._id,
      user_email: user.email,
      role:       user.role,
      action:     'AUTH_REGISTER',
      resource:   'User',
      resource_id: user._id.toString(),
      ip:         req.ip,
      status:     'SUCCESS',
    });

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      await AuditLog.create({
        user_email: email,
        action: 'AUTH_LOGIN',
        ip: req.ip,
        status: 'FAILURE',
        meta: { reason: 'Invalid credentials' },
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = signToken(user._id);

    await AuditLog.create({
      user_id:    user._id,
      user_email: user.email,
      role:       user.role,
      action:     'AUTH_LOGIN',
      resource:   'User',
      resource_id: user._id.toString(),
      ip:         req.ip,
      status:     'SUCCESS',
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({
    id:    req.user._id,
    name:  req.user.name,
    email: req.user.email,
    role:  req.user.role,
  });
};

module.exports = { register, login, getMe };
