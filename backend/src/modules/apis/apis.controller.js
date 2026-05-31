const { eq, and, desc, count } = require('drizzle-orm');
const { db, apis, apiKeys, rateLimits } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function listApis(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        let apiList = await db.select().from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)))
            .orderBy(desc(apis.createdAt));

        // --- TEST/DEMO SEEDING LOGIC ---
        // If the workspace has no APIs, create some test APIs for this specific workspace
        if (apiList.length === 0) {
            const testApi1 = await db.insert(apis).values({
                name: `Production Gateway (${workspaceSlug})`,
                slug: `prod-${workspaceSlug}`,
                baseUrl: 'https://api.openai.com',
                userId: req.user.userId,
                workspaceSlug: workspaceSlug,
            }).returning();
            
            const testApi2 = await db.insert(apis).values({
                name: `Staging Sandbox (${workspaceSlug})`,
                slug: `sandbox-${workspaceSlug}`,
                baseUrl: 'http://localhost:5000',
                userId: req.user.userId,
                workspaceSlug: workspaceSlug,
            }).returning();

            // Insert rate limits for them
            await db.insert(rateLimits).values([
                { apiId: testApi1[0].id, requestsPerMinute: 1000, requestsPerDay: 50000 },
                { apiId: testApi2[0].id, requestsPerMinute: 100, requestsPerDay: 5000 }
            ]);

            apiList = [...testApi1, ...testApi2];
        }
        // --------------------------------

        // Attach counts and rate limits for each api
        const enriched = await Promise.all(apiList.map(async (api) => {
            const [keyCount] = await db.select({ count: count() }).from(apiKeys).where(eq(apiKeys.apiId, api.id));
            const [rateLimit] = await db.select().from(rateLimits).where(eq(rateLimits.apiId, api.id)).limit(1);
            return {
                ...api,
                _count: { apiKeys: keyCount?.count || 0 },
                rateLimit: rateLimit || null,
            };
        }));

        return response.success(res, { apis: enriched });
    } catch (err) { next(err); }
}

async function getApi(req, res, next) {
    try {
        const [api] = await db.select().from(apis)
            .where(and(eq(apis.id, req.params.id), eq(apis.userId, req.user.userId)))
            .limit(1);

        if (!api) return response.error(res, 'API not found', 404);

        const [keyCount] = await db.select({ count: count() }).from(apiKeys).where(eq(apiKeys.apiId, api.id));
        const [rateLimit] = await db.select().from(rateLimits).where(eq(rateLimits.apiId, api.id)).limit(1);

        return response.success(res, {
            api: {
                ...api,
                _count: { apiKeys: keyCount?.count || 0 },
                rateLimit: rateLimit || null,
            }
        });
    } catch (err) { next(err); }
}

async function createApi(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const [api] = await db.insert(apis).values({
            name: req.body.name,
            slug: req.body.slug,
            baseUrl: req.body.baseUrl,
            userId: req.user.userId,
            workspaceSlug: workspaceSlug,
            fallbackProviders: req.body.fallbackProviders,
            retryCount: req.body.retryCount ? parseInt(req.body.retryCount, 10) : undefined,
            loadBalancingWeights: req.body.loadBalancingWeights,
            slackWebhookUrl: req.body.slackWebhookUrl,
            errorAlertThreshold: req.body.errorAlertThreshold ? parseFloat(req.body.errorAlertThreshold) : undefined,
            alertWindowMinutes: req.body.alertWindowMinutes ? parseInt(req.body.alertWindowMinutes, 10) : undefined,
            costLimitAlert: req.body.costLimitAlert ? parseFloat(req.body.costLimitAlert) : undefined,
        }).returning();

        // Also create default rate limit
        await db.insert(rateLimits).values({
            apiId: api.id,
            requestsPerMinute: req.body.requestsPerMinute ? parseInt(req.body.requestsPerMinute, 10) : 100,
            requestsPerDay: req.body.requestsPerDay ? parseInt(req.body.requestsPerDay, 10) : 5000,
        });

        return response.success(res, { api }, 201);
    } catch (err) { next(err); }
}

async function updateApi(req, res, next) {
    try {
        // Verify ownership
        const [existing] = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.id, req.params.id), eq(apis.userId, req.user.userId)))
            .limit(1);

        if (!existing) return response.error(res, 'API not found', 404);

        const [api] = await db.update(apis)
            .set({ ...req.body, updatedAt: new Date() })
            .where(eq(apis.id, req.params.id))
            .returning();

        return response.success(res, { api });
    } catch (err) { next(err); }
}

async function deleteApi(req, res, next) {
    try {
        const [existing] = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.id, req.params.id), eq(apis.userId, req.user.userId)))
            .limit(1);

        if (!existing) return response.error(res, 'API not found', 404);

        await db.delete(apis).where(eq(apis.id, req.params.id));
        return response.success(res, { message: 'API deleted' });
    } catch (err) { next(err); }
}

module.exports = { listApis, getApi, createApi, updateApi, deleteApi };
