const express = require('express');
const router  = express.Router();
const { getAllTransactions, getTransactionEntries } = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/',             getAllTransactions);
router.get('/:id/entries',  getTransactionEntries);

module.exports = router;
