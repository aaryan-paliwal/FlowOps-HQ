const { Router } = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validateRequest');
const { z } = require('zod');
const apiKeysController = require('./apiKeys.controller');

const router = Router();
router.use(authMiddleware);

const createKeySchema = z.object({
    apiId: z.string().uuid('Invalid API ID'),
    name: z.string().min(1, 'Key name is required').max(100),
});

router.get('/', apiKeysController.listKeys);
router.post('/', validate(createKeySchema), apiKeysController.createKey);
router.delete('/:id', apiKeysController.revokeKey);

module.exports = router;
