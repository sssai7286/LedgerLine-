const express = require('express');
const router  = express.Router();
const {
  getAllAccounts,
  createAccount,
  getAccountBalance,
} = require('../controllers/accountController');

router.get('/',           getAllAccounts);
router.post('/',          createAccount);
router.get('/:id/balance', getAccountBalance);

module.exports = router;
