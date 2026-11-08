const express = require('express');
const router  = express.Router();
const {
  getAllTransactions,
  createTransaction,
  getTransactionEntries,
} = require('../controllers/transactionController');

router.get('/',             getAllTransactions);
router.post('/',            createTransaction);
router.get('/:id/entries',  getTransactionEntries);

module.exports = router;
