const { pool } = require('../config/db');

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getAuditLogs = async (req, res) => {
  const { action, user_id, status } = req.query;
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'page must be positive and limit must be between 1 and 100' });
  }
  if (user_id && !isUuid(user_id)) {
    return res.status(400).json({ error: 'user_id must be a valid UUID' });
  }
  if (status && !['SUCCESS', 'FAILURE'].includes(String(status).toUpperCase())) {
    return res.status(400).json({ error: 'status must be SUCCESS or FAILURE' });
  }

  const filters = [];
  const values = [];
  if (action) {
    values.push(String(action).toUpperCase());
    filters.push(`action = $${values.length}`);
  }
  if (user_id) {
    values.push(user_id);
    filters.push(`user_id = $${values.length}`);
  }
  if (status) {
    values.push(String(status).toUpperCase());
    filters.push(`status = $${values.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS total FROM audit_logs ${where}`,
      values
    );
    const offset = (page - 1) * limit;
    const logs = await pool.query(
      `SELECT * FROM audit_logs ${where}
       ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );
    res.json({ total: countResult.rows[0].total, page, limit, logs: logs.rows });
  } catch (err) {
    console.error('Failed to fetch audit logs:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

module.exports = { getAuditLogs };
