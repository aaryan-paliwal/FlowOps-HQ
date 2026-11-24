const { Router } = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const logsController = require('./logs.controller');

const router = Router();
router.use(authMiddleware);

router.get('/', logsController.getLogs);

module.exports = router;
