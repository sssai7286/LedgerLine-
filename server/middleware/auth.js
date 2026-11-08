const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * protect — verifies JWT and attaches req.user
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * authorize(...roles) — restricts route to specific roles
 * Usage: router.get('/admin', protect, authorize('ADMIN'), handler)
 */
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
  next();
};

/**
 * auditAction(action, resource?) — logs every request to AuditLog
 * Call AFTER protect so req.user is available.
 */
const auditAction = (action, resource = null) => async (req, res, next) => {
  // Run after response to capture status
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const status = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
    AuditLog.create({
      user_id:     req.user?._id   || null,
      user_email:  req.user?.email || null,
      role:        req.user?.role  || null,
      action,
      resource,
      resource_id: body?._id || body?.transaction?._id || req.params?.id || null,
      meta:        { body: req.body, params: req.params },
      ip:          req.ip,
      status,
    }).catch((e) => console.error('AuditLog write failed:', e.message));
    return originalJson(body);
  };
  next();
};

module.exports = { protect, authorize, auditAction };
