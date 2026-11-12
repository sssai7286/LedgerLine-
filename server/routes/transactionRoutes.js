const express = require('express');
const router  = express.Router();
const {
  createTransaction,
  getAllTransactions,
  getTransactionEntries,
} = require('../controllers/transactionController');
const { protect, authorize, asyncHandler } = require('../middleware/auth');

router.use(protect);

router.post('/', authorize('ADMIN', 'ACCOUNT_HOLDER'), asyncHandler(createTransaction));
router.get('/',             asyncHandler(getAllTransactions));
router.get('/:id/entries',  asyncHandler(getTransactionEntries));

module.exports = router;
