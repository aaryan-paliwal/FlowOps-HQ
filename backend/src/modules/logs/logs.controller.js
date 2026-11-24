const { eq, and, gte, lte, inArray, desc, count } = require('drizzle-orm');
const { db, apis, requestLogs } = require('../../config/database');
const response = require('../../utils/formatResponse');

async function getLogs(req, res, next) {
    try {
        const { apiId, status, method, from, to, page = 1, limit = 50 } = req.query;
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

        // Verify user owns the APIs in the active workspace.
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const userApiIds = userApis.map((a) => a.id);

        if (userApiIds.length === 0) {
            return response.paginated(res, [], { page: pageNum, limit: limitNum, total: 0 });
        }

        // Build dynamic conditions
        const conditions = [];

        if (apiId) {
            if (!userApiIds.includes(apiId)) {
                return response.error(res, 'API not found', 404);
            }
            conditions.push(eq(requestLogs.apiId, apiId));
        } else {
            conditions.push(inArray(requestLogs.apiId, userApiIds));
        }

        if (status) conditions.push(eq(requestLogs.statusCode, parseInt(status)));
        if (method) conditions.push(eq(requestLogs.method, method.toUpperCase()));
        if (from) conditions.push(gte(requestLogs.timestamp, new Date(from)));
        if (to) conditions.push(lte(requestLogs.timestamp, new Date(to)));

        const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

        const [logs, [totalResult]] = await Promise.all([
            db.select().from(requestLogs)
                .where(whereClause)
                .orderBy(desc(requestLogs.timestamp))
                .offset((pageNum - 1) * limitNum)
                .limit(limitNum),
            db.select({ count: count() }).from(requestLogs).where(whereClause),
        ]);

        // Enrich logs with api name/slug
        const enriched = await Promise.all(logs.map(async (log) => {
            const [api] = await db.select({ name: apis.name, slug: apis.slug }).from(apis)
                .where(eq(apis.id, log.apiId)).limit(1);
            return { ...log, api: api || null };
        }));

        return response.paginated(res, enriched, { page: pageNum, limit: limitNum, total: totalResult?.count || 0 });
    } catch (err) { next(err); }
}

module.exports = { getLogs };
