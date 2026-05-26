const { prisma } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function listApis(req, res, next) {
    try {
        const apis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            include: {
                _count: { select: { apiKeys: true, logs: true } },
                rateLimit: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return response.success(res, { apis });
    } catch (err) { next(err); }
}

async function getApi(req, res, next) {
    try {
        const api = await prisma.api.findFirst({
            where: { id: req.params.id, userId: req.user.userId },
            include: {
                _count: { select: { apiKeys: true, logs: true } },
                rateLimit: true,
            },
        });
        if (!api) return response.error(res, 'API not found', 404);
        return response.success(res, { api });
    } catch (err) { next(err); }
}

async function createApi(req, res, next) {
    try {
        const api = await prisma.api.create({
            data: {
                name: req.body.name,
                slug: req.body.slug,
                baseUrl: req.body.baseUrl,
                userId: req.user.userId,
                fallbackProviders: req.body.fallbackProviders,
                retryCount: req.body.retryCount ? parseInt(req.body.retryCount, 10) : undefined,
                loadBalancingWeights: req.body.loadBalancingWeights,
                slackWebhookUrl: req.body.slackWebhookUrl,
                errorAlertThreshold: req.body.errorAlertThreshold ? parseFloat(req.body.errorAlertThreshold) : undefined,
                alertWindowMinutes: req.body.alertWindowMinutes ? parseInt(req.body.alertWindowMinutes, 10) : undefined,
                costLimitAlert: req.body.costLimitAlert ? parseFloat(req.body.costLimitAlert) : undefined,
            },
        });

        // Also create default rate limit
        await prisma.rateLimit.create({
            data: {
                apiId: api.id,
                requestsPerMinute: req.body.requestsPerMinute ? parseInt(req.body.requestsPerMinute, 10) : 100,
                requestsPerDay: req.body.requestsPerDay ? parseInt(req.body.requestsPerDay, 10) : 5000,
            },
        });

        return response.success(res, { api }, 201);
    } catch (err) { next(err); }
}

async function updateApi(req, res, next) {
    try {
        // Verify ownership
        const existing = await prisma.api.findFirst({
            where: { id: req.params.id, userId: req.user.userId },
        });
        if (!existing) return response.error(res, 'API not found', 404);

        const api = await prisma.api.update({
            where: { id: req.params.id },
            data: req.body,
        });
        return response.success(res, { api });
    } catch (err) { next(err); }
}

async function deleteApi(req, res, next) {
    try {
        const existing = await prisma.api.findFirst({
            where: { id: req.params.id, userId: req.user.userId },
        });
        if (!existing) return response.error(res, 'API not found', 404);

        await prisma.api.delete({ where: { id: req.params.id } });
        return response.success(res, { message: 'API deleted' });
    } catch (err) { next(err); }
}

module.exports = { listApis, getApi, createApi, updateApi, deleteApi };
