const express = require('express');
const router  = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect, asyncHandler } = require('../middleware/auth');

router.post('/register', asyncHandler(register));
router.post('/login',    asyncHandler(login));
router.get('/me',        protect, getMe);

module.exports = router;
