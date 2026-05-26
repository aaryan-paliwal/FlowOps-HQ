const { Router } = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const usersController = require('./users.controller');

const router = Router();

router.get('/me', authMiddleware, usersController.getProfile);
router.put('/me', authMiddleware, usersController.updateProfile);

module.exports = router;
