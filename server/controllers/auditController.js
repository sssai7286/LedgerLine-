const AuditLog = require('../models/AuditLog');

// ── GET /api/audit ────────────────────────────────────────────────
// ADMIN / AUDITOR only
// Optional query params: ?action=DEPOSIT&user_id=xxx&limit=50&page=1
const getAuditLogs = async (req, res) => {
  try {
    const { action, user_id, status, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (action)  filter.action  = action.toUpperCase();
    if (user_id) filter.user_id = user_id;
    if (status)  filter.status  = status.toUpperCase();

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(filter);
    const logs  = await AuditLog.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ total, page: parseInt(page), limit: parseInt(limit), logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

module.exports = { getAuditLogs };
