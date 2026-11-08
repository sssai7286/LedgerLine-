const express = require('express');
const router  = express.Router();
const { deposit, withdraw, transfer } = require('../controllers/ledgerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ADMIN can do all operations; ACCOUNT_HOLDER can only operate own accounts
router.post('/deposit',  authorize('ADMIN', 'ACCOUNT_HOLDER'), deposit);
router.post('/withdraw', authorize('ADMIN', 'ACCOUNT_HOLDER'), withdraw);
router.post('/transfer', authorize('ADMIN', 'ACCOUNT_HOLDER'), transfer);

module.exports = router;
