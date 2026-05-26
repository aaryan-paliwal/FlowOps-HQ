const { prisma } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function getRateLimit(req, res, next) {
    try {
        const api = await prisma.api.findFirst({
            where: { id: req.params.apiId, userId: req.user.userId },
            include: { rateLimit: true },
        });
        if (!api) return response.error(res, 'API not found', 404);
        return response.success(res, { rateLimit: api.rateLimit });
    } catch (err) { next(err); }
}

async function updateRateLimit(req, res, next) {
    try {
        const api = await prisma.api.findFirst({
            where: { id: req.params.apiId, userId: req.user.userId },
        });
        if (!api) return response.error(res, 'API not found', 404);

        const rateLimit = await prisma.rateLimit.upsert({
            where: { apiId: req.params.apiId },
            update: {
                requestsPerMinute: req.body.requestsPerMinute,
                requestsPerDay: req.body.requestsPerDay,
            },
            create: {
                apiId: req.params.apiId,
                requestsPerMinute: req.body.requestsPerMinute,
                requestsPerDay: req.body.requestsPerDay,
            },
        });

        return response.success(res, { rateLimit });
    } catch (err) { next(err); }
}

module.exports = { getRateLimit, updateRateLimit };
