const express = require('express');
const router  = express.Router();
const {
  getAllAccounts,
  createAccount,
  getAccount,
  getAccountBalance,
  getStatement,
} = require('../controllers/accountController');
const { protect, authorize, asyncHandler } = require('../middleware/auth');

// All account routes require authentication
router.use(protect);

router.get('/',                asyncHandler(getAllAccounts));
router.post('/',               authorize('ADMIN', 'ACCOUNT_HOLDER'), asyncHandler(createAccount));
router.get('/:id',             asyncHandler(getAccount));
router.get('/:id/balance',     asyncHandler(getAccountBalance));
router.get('/:id/statement',   asyncHandler(getStatement));

module.exports = router;
