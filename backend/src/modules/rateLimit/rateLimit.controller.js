const { eq, and } = require('drizzle-orm');
const { db, apis, rateLimits } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function getRateLimit(req, res, next) {
    try {
        const [api] = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.id, req.params.apiId), eq(apis.userId, req.user.userId)))
            .limit(1);
        if (!api) return response.error(res, 'API not found', 404);

        const [rateLimit] = await db.select().from(rateLimits)
            .where(eq(rateLimits.apiId, req.params.apiId)).limit(1);

        return response.success(res, { rateLimit: rateLimit || null });
    } catch (err) { next(err); }
}

async function updateRateLimit(req, res, next) {
    try {
        const [api] = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.id, req.params.apiId), eq(apis.userId, req.user.userId)))
            .limit(1);
        if (!api) return response.error(res, 'API not found', 404);

        // Check if rate limit already exists
        const [existing] = await db.select({ id: rateLimits.id }).from(rateLimits)
            .where(eq(rateLimits.apiId, req.params.apiId)).limit(1);

        let rateLimit;
        if (existing) {
            [rateLimit] = await db.update(rateLimits)
                .set({
                    requestsPerMinute: req.body.requestsPerMinute,
                    requestsPerDay: req.body.requestsPerDay,
                })
                .where(eq(rateLimits.apiId, req.params.apiId))
                .returning();
        } else {
            [rateLimit] = await db.insert(rateLimits).values({
                apiId: req.params.apiId,
                requestsPerMinute: req.body.requestsPerMinute,
                requestsPerDay: req.body.requestsPerDay,
            }).returning();
        }

        return response.success(res, { rateLimit });
    } catch (err) { next(err); }
}

module.exports = { getRateLimit, updateRateLimit };
