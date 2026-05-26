const { prisma } = require('../../config/database');
const { generateApiKey } = require('../../utils/generateApiKey');
const response = require('../../utils/formatResponse');

async function listKeys(req, res, next) {
    try {
        const { apiId } = req.query;
        const where = {};

        if (apiId) {
            // Verify user owns this API
            const api = await prisma.api.findFirst({ where: { id: apiId, userId: req.user.userId } });
            if (!api) return response.error(res, 'API not found', 404);
            where.apiId = apiId;
        } else {
            // Get all keys for user's APIs
            const userApis = await prisma.api.findMany({
                where: { userId: req.user.userId },
                select: { id: true },
            });
            where.apiId = { in: userApis.map((a) => a.id) };
        }

        const keys = await prisma.apiKey.findMany({
            where,
            select: {
                id: true, apiId: true, name: true, keyPrefix: true,
                revoked: true, createdAt: true,
                api: { select: { name: true, slug: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return response.success(res, { keys });
    } catch (err) { next(err); }
}

async function createKey(req, res, next) {
    try {
        const { apiId, name } = req.body;

        // Verify ownership
        const api = await prisma.api.findFirst({ where: { id: apiId, userId: req.user.userId } });
        if (!api) return response.error(res, 'API not found', 404);

        const { rawKey, keyHash, keyPrefix } = generateApiKey();

        const key = await prisma.apiKey.create({
            data: { apiId, name, keyHash, keyPrefix },
            select: { id: true, apiId: true, name: true, keyPrefix: true, createdAt: true },
        });

        // Raw key is returned ONCE — will never be shown again
        return response.success(res, { key, rawKey }, 201);
    } catch (err) { next(err); }
}

async function revokeKey(req, res, next) {
    try {
        // Find key and verify ownership through API
        const key = await prisma.apiKey.findUnique({
            where: { id: req.params.id },
            include: { api: { select: { userId: true } } },
        });

        if (!key || key.api.userId !== req.user.userId) {
            return response.error(res, 'API key not found', 404);
        }

        await prisma.apiKey.update({
            where: { id: req.params.id },
            data: { revoked: true },
        });

        return response.success(res, { message: 'API key revoked' });
    } catch (err) { next(err); }
}

module.exports = { listKeys, createKey, revokeKey };
