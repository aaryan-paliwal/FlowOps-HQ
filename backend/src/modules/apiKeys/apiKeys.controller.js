const { eq, and, inArray, desc } = require('drizzle-orm');
const { db, apis, apiKeys } = require('../../config/database');
const { generateApiKey } = require('../../utils/generateApiKey');
const response = require('../../utils/formatResponse');

async function listKeys(req, res, next) {
    try {
        const { apiId } = req.query;
        let targetApiIds;

        if (apiId) {
            // Verify user owns this API
            const [api] = await db.select({ id: apis.id }).from(apis)
                .where(and(eq(apis.id, apiId), eq(apis.userId, req.user.userId)))
                .limit(1);
            if (!api) return response.error(res, 'API not found', 404);
            targetApiIds = [apiId];
        } else {
            // Get all keys for user's APIs
            const userApis = await db.select({ id: apis.id }).from(apis)
                .where(eq(apis.userId, req.user.userId));
            targetApiIds = userApis.map((a) => a.id);
        }

        if (targetApiIds.length === 0) {
            return response.success(res, { keys: [] });
        }

        const keys = await db.select({
            id: apiKeys.id,
            apiId: apiKeys.apiId,
            name: apiKeys.name,
            keyPrefix: apiKeys.keyPrefix,
            revoked: apiKeys.revoked,
            createdAt: apiKeys.createdAt,
        }).from(apiKeys)
            .where(inArray(apiKeys.apiId, targetApiIds))
            .orderBy(desc(apiKeys.createdAt));

        // Enrich with api info
        const enrichedKeys = await Promise.all(keys.map(async (key) => {
            const [api] = await db.select({ name: apis.name, slug: apis.slug }).from(apis)
                .where(eq(apis.id, key.apiId)).limit(1);
            return { ...key, api: api || null };
        }));

        return response.success(res, { keys: enrichedKeys });
    } catch (err) { next(err); }
}

async function createKey(req, res, next) {
    try {
        const { apiId, name } = req.body;

        // Verify ownership
        const [api] = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.id, apiId), eq(apis.userId, req.user.userId)))
            .limit(1);
        if (!api) return response.error(res, 'API not found', 404);

        const { rawKey, keyHash, keyPrefix } = generateApiKey();

        const [key] = await db.insert(apiKeys).values({ apiId, name, keyHash, keyPrefix }).returning({
            id: apiKeys.id,
            apiId: apiKeys.apiId,
            name: apiKeys.name,
            keyPrefix: apiKeys.keyPrefix,
            createdAt: apiKeys.createdAt,
        });

        // Raw key is returned ONCE — will never be shown again
        return response.success(res, { key, rawKey }, 201);
    } catch (err) { next(err); }
}

async function revokeKey(req, res, next) {
    try {
        // Find key and verify ownership through API
        const [key] = await db.select({
            id: apiKeys.id,
            apiId: apiKeys.apiId,
        }).from(apiKeys).where(eq(apiKeys.id, req.params.id)).limit(1);

        if (!key) return response.error(res, 'API key not found', 404);

        const [api] = await db.select({ userId: apis.userId }).from(apis)
            .where(eq(apis.id, key.apiId)).limit(1);

        if (!api || api.userId !== req.user.userId) {
            return response.error(res, 'API key not found', 404);
        }

        await db.update(apiKeys)
            .set({ revoked: true })
            .where(eq(apiKeys.id, req.params.id));

        return response.success(res, { message: 'API key revoked' });
    } catch (err) { next(err); }
}

module.exports = { listKeys, createKey, revokeKey };
