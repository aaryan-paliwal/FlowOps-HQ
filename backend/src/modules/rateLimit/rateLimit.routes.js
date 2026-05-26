const { Router } = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { validate } = require('../../middleware/validateRequest');
const { z } = require('zod');
const rateLimitController = require('./rateLimit.controller');

const router = Router();
router.use(authMiddleware);

const updateRateLimitSchema = z.object({
    requestsPerMinute: z.number().int().min(1).max(10000),
    requestsPerDay: z.number().int().min(1).max(1000000),
});

router.get('/:apiId', rateLimitController.getRateLimit);
router.put('/:apiId', validate(updateRateLimitSchema), rateLimitController.updateRateLimit);

module.exports = router;
