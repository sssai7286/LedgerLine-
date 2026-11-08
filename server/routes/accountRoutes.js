const express = require('express');
const router  = express.Router();
const {
  getAllAccounts,
  createAccount,
  getAccount,
  getAccountBalance,
  getStatement,
} = require('../controllers/accountController');
const { protect, authorize } = require('../middleware/auth');

// All account routes require authentication
router.use(protect);

router.get('/',                getAllAccounts);
router.post('/',               authorize('ADMIN', 'ACCOUNT_HOLDER'), createAccount);
router.get('/:id',             getAccount);
router.get('/:id/balance',     getAccountBalance);
router.get('/:id/statement',   getStatement);

module.exports = router;
