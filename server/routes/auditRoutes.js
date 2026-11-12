const express = require('express');
const router  = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, authorize, asyncHandler } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('ADMIN', 'AUDITOR'), asyncHandler(getAuditLogs));

module.exports = router;
