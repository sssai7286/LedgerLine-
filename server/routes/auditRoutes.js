const express = require('express');
const router  = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('ADMIN', 'AUDITOR'), getAuditLogs);

module.exports = router;
