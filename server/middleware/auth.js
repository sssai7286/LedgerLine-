const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (!isUuid(decoded.id)) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = TRUE',
      [decoded.id]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${roles.join(' or ')}`,
    });
  }
  return next();
};

const auditAction = (action, resource = null) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const status = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
    const resourceId = body?.id || body?.transaction?.id || req.params?.id || null;
    pool.query(
      `INSERT INTO audit_logs
         (user_id, user_email, role, action, resource, resource_id, meta, ip, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        req.user?.id || null,
        req.user?.email || null,
        req.user?.role || null,
        action,
        resource,
        resourceId,
        JSON.stringify({ body: req.body, params: req.params }),
        req.ip,
        status,
      ]
    ).catch((err) => console.error('Audit log write failed:', err.message));
    return originalJson(body);
  };
  return next();
};

module.exports = { protect, authorize, auditAction, asyncHandler };
