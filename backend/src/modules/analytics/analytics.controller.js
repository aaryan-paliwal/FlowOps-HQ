const { eq, and, gte, lte, inArray, count, avg, sum, desc, sql } = require('drizzle-orm');
const { db, apis, requestLogs, apiKeys } = require('../../config/database');
const { getSemanticCacheStats, flushTwoTierCache } = require('../../gateway/core/cacheManager');
const { MODEL_RATES } = require('../../gateway/core/alerts');
const response = require('../../utils/formatResponse');

// ─── Helper: build where conditions ───
function buildConditions(apiIds, apiId, from, to) {
    const conditions = [];
    if (apiId) {
        conditions.push(and(eq(requestLogs.apiId, apiId), inArray(requestLogs.apiId, apiIds)));
    } else {
        conditions.push(inArray(requestLogs.apiId, apiIds));
    }
    if (from) conditions.push(gte(requestLogs.timestamp, new Date(from)));
    if (to) conditions.push(lte(requestLogs.timestamp, new Date(to)));
    return conditions.length > 1 ? and(...conditions) : conditions[0];
}

/**
 * Overview: total requests, error rate, avg latency, active APIs, and advanced LLM SaaS metrics
 */
async function getOverview(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                totalRequests: 0, errorRate: 0, avgLatency: 0,
                p50Latency: 0, p90Latency: 0, p95Latency: 0, p99Latency: 0,
                activeApis: 0, totalTokens: 0, cacheHitRatio: 0,
                exactCacheHits: 0, semanticCacheHits: 0,
                streamingRequests: 0, failoverRequests: 0, totalRetries: 0,
                costSaved: 0, costSavedInr: 0, totalSavedTokens: 0,
                optTokensSaved: 0, optimizedCount: 0
            });
        }

        const { apiId, from, to } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const [[agg], [activeResult]] = await Promise.all([
            db.select({
                totalRequests: count(),
                avgLatency: avg(requestLogs.latencyMs),
                p50Latency: sql`coalesce(percentile_cont(0.50) within group (order by ${requestLogs.latencyMs}), 0)`,
                p90Latency: sql`coalesce(percentile_cont(0.90) within group (order by ${requestLogs.latencyMs}), 0)`,
                p95Latency: sql`coalesce(percentile_cont(0.95) within group (order by ${requestLogs.latencyMs}), 0)`,
                p99Latency: sql`coalesce(percentile_cont(0.99) within group (order by ${requestLogs.latencyMs}), 0)`,
                totalTokens: sql`coalesce(sum(${requestLogs.tokensUsed}), 0)`,
                errorCount: sql`count(*) filter (where ${requestLogs.statusCode} >= 400)`,
                cacheHits: sql`count(*) filter (where ${requestLogs.cacheHit} = true)`,
                exactCacheHits: sql`count(*) filter (where ${requestLogs.cacheHit} = true and (${requestLogs.cacheTier} = 'exact' or ${requestLogs.cacheTier} is null))`,
                semanticCacheHits: sql`count(*) filter (where ${requestLogs.cacheHit} = true and ${requestLogs.cacheTier} = 'semantic')`,
                cacheTokensSaved: sql`coalesce(sum(case when ${requestLogs.cacheHit} = true then ${requestLogs.promptTokens} else 0 end), 0)`,
                streamingRequests: sql`count(*) filter (where ${requestLogs.isStreaming} = true)`,
                failoverRequests: sql`count(*) filter (where ${requestLogs.failoverUsed} = true)`,
                totalRetries: sql`coalesce(sum(${requestLogs.retryAttempts}), 0)`,
                optimizedCount: sql`count(*) filter (where ${requestLogs.promptOptimized} = true)`,
                optTokensSaved: sql`coalesce(sum(case when ${requestLogs.promptOptimized} = true then ${requestLogs.tokensSaved} else 0 end), 0)`,
            }).from(requestLogs).where(whereClause),
            db.select({ count: count() }).from(apis)
                .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug), eq(apis.isActive, true))),
        ]);

        const totalRequests = Number(agg?.totalRequests) || 0;
        const errorCount = Number(agg?.errorCount) || 0;
        const errorRate = totalRequests > 0 ? Number(((errorCount / totalRequests) * 100).toFixed(2)) : 0;
        const avgLatency = Math.round(Number(agg?.avgLatency) || 0);
        const p50Latency = Math.round(Number(agg?.p50Latency) || 0);
        const p90Latency = Math.round(Number(agg?.p90Latency) || 0);
        const p95Latency = Math.round(Number(agg?.p95Latency) || 0);
        const p99Latency = Math.round(Number(agg?.p99Latency) || 0);
        const totalTokens = Number(agg?.totalTokens) || 0;

        const cacheHits = Number(agg?.cacheHits) || 0;
        const cacheHitRatio = totalRequests > 0 ? Number(((cacheHits / totalRequests) * 100).toFixed(2)) : 0;

        const cacheTokensSaved = Number(agg?.cacheTokensSaved) || 0;
        const optTokensSaved = Number(agg?.optTokensSaved) || 0;
        const totalSavedTokens = cacheTokensSaved + optTokensSaved;
        const costSavedInr = Number(((totalSavedTokens / 1000) * 0.04).toFixed(4));

        return response.success(res, {
            totalRequests,
            errorRate: Number(errorRate),
            avgLatency,
            p50Latency,
            p90Latency,
            p95Latency,
            p99Latency,
            activeApis: Number(activeResult?.count) || 0,
            totalTokens,
            cacheHitRatio: Number(cacheHitRatio),
            exactCacheHits: Number(agg?.exactCacheHits) || 0,
            semanticCacheHits: Number(agg?.semanticCacheHits) || 0,
            streamingRequests: Number(agg?.streamingRequests) || 0,
            failoverRequests: Number(agg?.failoverRequests) || 0,
            totalRetries: Number(agg?.totalRetries) || 0,
            costSavedInr,
            totalSavedTokens,
            optTokensSaved,
            optimizedCount: Number(agg?.optimizedCount) || 0,
        });
    } catch (err) { next(err); }
}

/**
 * Traffic: request volume over time (grouped by interval)
 */
async function getTraffic(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { dataPoints: [] });
        }

        const { apiId, from, to } = req.query;
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();
        const targetApiIds = apiId ? (apiIds.includes(apiId) ? [apiId] : []) : apiIds;

        const logs = await db.select({
            timestamp: requestLogs.timestamp,
            latencyMs: requestLogs.latencyMs,
            tokensUsed: requestLogs.tokensUsed,
            statusCode: requestLogs.statusCode,
            ip: requestLogs.ip
        }).from(requestLogs)
            .where(and(
                inArray(requestLogs.apiId, targetApiIds),
                gte(requestLogs.timestamp, fromDate),
                lte(requestLogs.timestamp, toDate)
            ))
            .orderBy(requestLogs.timestamp);

        // Group by hour for cleaner visualization
        const hourlyMap = new Map();
        logs.forEach((log) => {
            const hourKey = new Date(log.timestamp);
            hourKey.setMinutes(0, 0, 0);
            const key = hourKey.toISOString();

            if (!hourlyMap.has(key)) {
                hourlyMap.set(key, { timestamp: key, requests: 0, errors: 0, totalLatency: 0, tokensUsed: 0, costInr: 0, uniqueIps: new Set() });
            }
            const entry = hourlyMap.get(key);
            entry.requests += 1;
            if (log.statusCode >= 400) entry.errors += 1;
            entry.totalLatency += log.latencyMs;
            entry.tokensUsed += log.tokensUsed;
            entry.costInr += (log.tokensUsed / 1000000) * 208.5;
            if (log.ip) entry.uniqueIps.add(log.ip);
        });

        const dataPoints = Array.from(hourlyMap.values()).map((dp) => ({
            timestamp: dp.timestamp,
            requests: dp.requests,
            errors: dp.errors,
            tokensUsed: dp.tokensUsed,
            costInr: dp.costInr,
            avgLatency: dp.requests > 0 ? Math.round(dp.totalLatency / dp.requests) : 0,
            uniqueUsers: dp.uniqueIps.size
        }));
        
        console.log(`getTraffic returning ${dataPoints.length} dataPoints for targetApiIds:`, targetApiIds);

        return response.success(res, { dataPoints });
    } catch (err) { next(err); }
}

/**
 * Top endpoints by request count
 */
async function getEndpoints(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { endpoints: [] });
        }

        const { apiId, from, to } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const endpoints = await db.select({
            endpoint: requestLogs.endpoint,
            method: requestLogs.method,
            requests: count(),
            avgLatency: avg(requestLogs.latencyMs),
        }).from(requestLogs)
            .where(whereClause)
            .groupBy(requestLogs.endpoint, requestLogs.method)
            .orderBy(desc(count()))
            .limit(10);

        const result = endpoints.map((ep) => ({
            endpoint: ep.endpoint,
            method: ep.method,
            requests: Number(ep.requests),
            avgLatency: Math.round(Number(ep.avgLatency) || 0),
        }));

        return response.success(res, { endpoints: result });
    } catch (err) { next(err); }
}

/**
 * Error distribution by status code
 */
async function getErrors(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { errorDistribution: [] });
        }

        const { apiId, from, to } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const errors = await db.select({
            statusCode: requestLogs.statusCode,
            count: count(),
        }).from(requestLogs)
            .where(whereClause)
            .groupBy(requestLogs.statusCode)
            .orderBy(desc(count()));

        const result = errors.map((e) => ({
            statusCode: e.statusCode,
            count: Number(e.count),
        }));

        return response.success(res, { errorDistribution: result });
    } catch (err) { next(err); }
}

/**
 * Advanced LLM metrics: provider distribution and model distribution
 */
async function getLlmMetrics(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { providers: [], models: [] });
        }

        const { apiId, from, to } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const [providersGroup, modelsGroup] = await Promise.all([
            db.select({
                provider: requestLogs.provider,
                requests: count(),
                tokens: sum(requestLogs.tokensUsed),
            }).from(requestLogs).where(whereClause)
                .groupBy(requestLogs.provider),
            db.select({
                model: requestLogs.model,
                requests: count(),
                tokens: sum(requestLogs.tokensUsed),
            }).from(requestLogs).where(whereClause)
                .groupBy(requestLogs.model),
        ]);

        const providers = providersGroup.map(p => ({
            provider: p.provider || 'unknown',
            requests: Number(p.requests),
            tokens: Number(p.tokens) || 0
        }));

        const models = modelsGroup.map(m => ({
            model: m.model || 'unknown',
            requests: Number(m.requests),
            tokens: Number(m.tokens) || 0
        }));

        return response.success(res, { providers, models });
    } catch (err) { next(err); }
}

/**
 * Cache Telemetry
 */
async function getCacheMetrics(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                cacheHits: 0, exactHits: 0, semanticHits: 0,
                totalRequests: 0, cacheHitRate: 0, cacheSavings: 0,
                avgCacheLatency: 0, avgNonCacheLatency: 0, cacheSpeedupPercent: 0,
                semanticEntries: 0, totalTokensCached: 0, recentEntries: [], timeSeries: []
            });
        }

        const { apiId, from, to } = req.query;
        const targetApiIds = apiId ? (apiIds.includes(apiId) ? [apiId] : []) : apiIds;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const [logs, semanticStats] = await Promise.all([
            db.select({
                timestamp: requestLogs.timestamp,
                cacheHit: requestLogs.cacheHit,
                cacheTier: requestLogs.cacheTier,
                latencyMs: requestLogs.latencyMs,
                promptTokens: requestLogs.promptTokens
            }).from(requestLogs).where(whereClause).orderBy(requestLogs.timestamp),
            getSemanticCacheStats(targetApiIds),
        ]);

        let totalRequests = logs.length;
        let cacheHitsCount = 0;
        let exactHits = 0;
        let semanticHits = 0;
        let cacheLatencySum = 0;
        let nonCacheLatencySum = 0;
        let promptTokensSaved = 0;

        const hourlyMap = new Map();

        logs.forEach(log => {
            if (log.cacheHit) {
                cacheHitsCount++;
                if (log.cacheTier === 'semantic') semanticHits++;
                else exactHits++;
                cacheLatencySum += log.latencyMs;
                promptTokensSaved += log.promptTokens;
            } else {
                nonCacheLatencySum += log.latencyMs;
            }

            const hourKey = new Date(log.timestamp);
            hourKey.setMinutes(0, 0, 0);
            const key = hourKey.toISOString();

            if (!hourlyMap.has(key)) {
                hourlyMap.set(key, { timestamp: key, requests: 0, cacheHits: 0, tokensSaved: 0 });
            }
            const entry = hourlyMap.get(key);
            entry.requests += 1;
            if (log.cacheHit) {
                entry.cacheHits += 1;
                entry.tokensSaved += log.promptTokens;
            }
        });

        const cacheHitRate = totalRequests > 0 ? Number(((cacheHitsCount / totalRequests) * 100).toFixed(2)) : 0;
        const avgCacheLatency = cacheHitsCount > 0 ? Math.round(cacheLatencySum / cacheHitsCount) : 0;
        const nonCacheCount = totalRequests - cacheHitsCount;
        const avgNonCacheLatency = nonCacheCount > 0 ? Math.round(nonCacheLatencySum / nonCacheCount) : 0;

        const speedupDiff = avgNonCacheLatency - avgCacheLatency;
        const cacheSpeedupPercent = (cacheHitsCount > 0 && avgNonCacheLatency > 0)
            ? Math.max(0, Math.round((speedupDiff / avgNonCacheLatency) * 100))
            : 0;
        const cacheSavings = Number(((promptTokensSaved / 1000) * 0.04).toFixed(4));

        const timeSeries = Array.from(hourlyMap.values()).map(dp => ({
            timestamp: dp.timestamp,
            cacheHits: dp.cacheHits,
            hitRate: dp.requests > 0 ? Number(((dp.cacheHits / dp.requests) * 100).toFixed(2)) : 0,
            savings: Number(((dp.tokensSaved / 1000) * 0.04).toFixed(4))
        }));

        return response.success(res, {
            cacheHits: cacheHitsCount,
            exactHits,
            semanticHits,
            totalRequests,
            cacheHitRate,
            cacheSavings,
            avgCacheLatency,
            avgNonCacheLatency,
            cacheSpeedupPercent,
            semanticEntries: semanticStats.activeEntries,
            totalTokensCached: semanticStats.totalTokensCached,
            recentEntries: semanticStats.recentEntries,
            timeSeries
        });
    } catch (err) { next(err); }
}

async function getCacheEntries(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);
        const { apiId } = req.query;
        const targetApiIds = apiId ? (apiIds.includes(apiId) ? [apiId] : []) : apiIds;

        const stats = await getSemanticCacheStats(targetApiIds);
        return response.success(res, stats);
    } catch (err) { next(err); }
}

async function clearCache(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);
        const { apiId } = req.query;
        const targetApiIds = apiId ? (apiIds.includes(apiId) ? [apiId] : []) : apiIds;

        const result = await flushTwoTierCache(targetApiIds);
        return response.success(res, result);
    } catch (err) { next(err); }
}

/**
 * User Telemetry
 */
async function getUserMetrics(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { uniqueUsers: 0, requestsPerUser: 0, timeSeries: [] });
        }

        const { apiId, from, to } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const logs = await db.select({
            ip: requestLogs.ip,
            timestamp: requestLogs.timestamp,
        }).from(requestLogs).where(whereClause).orderBy(requestLogs.timestamp);

        const uniqueIps = new Set(logs.map(l => l.ip).filter(Boolean));
        const uniqueUsers = uniqueIps.size;
        const totalRequests = logs.length;
        const requestsPerUser = uniqueUsers > 0 ? Number((totalRequests / uniqueUsers).toFixed(2)) : 0;

        const hourlyMap = new Map();
        logs.forEach(log => {
            const hourKey = new Date(log.timestamp);
            hourKey.setMinutes(0, 0, 0);
            const key = hourKey.toISOString();

            if (!hourlyMap.has(key)) {
                hourlyMap.set(key, { timestamp: key, ips: new Set(), requests: 0 });
            }
            const entry = hourlyMap.get(key);
            entry.requests += 1;
            if (log.ip) entry.ips.add(log.ip);
        });

        const timeSeries = Array.from(hourlyMap.values()).map(dp => ({
            timestamp: dp.timestamp,
            uniqueUsers: dp.ips.size,
            requestsPerUser: dp.ips.size > 0 ? Number((dp.requests / dp.ips.size).toFixed(2)) : 0
        }));

        return response.success(res, { uniqueUsers, requestsPerUser, timeSeries });
    } catch (err) { next(err); }
}

/**
 * Quality & Sentiment Feedback
 */
async function getFeedbackMetrics(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                positiveCount: 0, neutralCount: 0, negativeCount: 0,
                avgRating: 0, feedbackList: [], timeSeries: []
            });
        }

        const { apiId, from, to } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        const logs = await db.select({
            statusCode: requestLogs.statusCode,
            latencyMs: requestLogs.latencyMs,
            cacheHit: requestLogs.cacheHit,
            timestamp: requestLogs.timestamp
        }).from(requestLogs).where(whereClause).orderBy(requestLogs.timestamp);

        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        let ratingSum = 0;

        const hourlyMap = new Map();

        logs.forEach(log => {
            let rating;
            if (log.statusCode >= 400) {
                rating = 1.0;
                negativeCount++;
            } else if (log.latencyMs > 1500) {
                rating = 2.0;
                negativeCount++;
            } else if (log.cacheHit) {
                rating = 5.0;
                positiveCount++;
            } else if (log.latencyMs < 300) {
                rating = 4.5;
                positiveCount++;
            } else {
                rating = 3.5;
                neutralCount++;
            }
            ratingSum += rating;

            const hourKey = new Date(log.timestamp);
            hourKey.setMinutes(0, 0, 0);
            const key = hourKey.toISOString();

            if (!hourlyMap.has(key)) {
                hourlyMap.set(key, { timestamp: key, requests: 0, ratingSum: 0 });
            }
            const entry = hourlyMap.get(key);
            entry.requests += 1;
            entry.ratingSum += rating;
        });

        const total = logs.length;
        const avgRating = total > 0 ? Number((ratingSum / total).toFixed(2)) : 0;

        const timeSeries = Array.from(hourlyMap.values()).map(dp => ({
            timestamp: dp.timestamp,
            avgRating: dp.requests > 0 ? Number((dp.ratingSum / dp.requests).toFixed(2)) : 0,
            requests: dp.requests
        }));

        return response.success(res, {
            positiveCount, neutralCount, negativeCount,
            avgRating, feedbackList: [], timeSeries
        });
    } catch (err) { next(err); }
}

/**
 * Summarized Telemetry
 */
async function getSummaryMetrics(req, res, next) {
    try {
        const workspaceSlug = req.headers['x-workspace-slug'] || 'workspace-1';
        const userApis = await db.select({ id: apis.id }).from(apis)
            .where(and(eq(apis.userId, req.user.userId), eq(apis.workspaceSlug, workspaceSlug)));
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { summary: [] });
        }

        const { apiId, from, to, groupBy: groupByField = 'AI Service' } = req.query;
        const whereClause = buildConditions(apiIds, apiId, from, to);

        let field = requestLogs.provider;
        if (groupByField === 'Model') field = requestLogs.model;
        else if (groupByField === 'Status Code') field = requestLogs.statusCode;
        else if (groupByField === 'API Key') field = requestLogs.apiKeyId;
        else if (groupByField === 'Config') field = requestLogs.apiId;
        else if (groupByField === 'Provider') field = requestLogs.provider;
        else if (groupByField === 'Prompt') field = requestLogs.endpoint;

        const groups = await db.select({
            groupValue: field,
            requests: count(),
            avgLatency: avg(requestLogs.latencyMs),
            tokens: sum(requestLogs.tokensUsed),
        }).from(requestLogs)
            .where(whereClause)
            .groupBy(field);

        const summary = await Promise.all(groups.map(async (g) => {
            let label = String(g.groupValue || 'unknown');

            if (field === requestLogs.apiId && label !== 'unknown') {
                const [apiRec] = await db.select({ name: apis.name }).from(apis)
                    .where(eq(apis.id, label)).limit(1);
                if (apiRec) label = apiRec.name;
            }

            if (field === requestLogs.apiKeyId && label !== 'unknown') {
                const [keyRec] = await db.select({ name: apiKeys.name, keyPrefix: apiKeys.keyPrefix })
                    .from(apiKeys).where(eq(apiKeys.id, label)).limit(1);
                if (keyRec) label = `${keyRec.name} (${keyRec.keyPrefix})`;
            }

            if (field === requestLogs.statusCode) {
                label = `HTTP ${label}`;
            }

            const tokens = Number(g.tokens) || 0;
            const usdPer1M = MODEL_RATES[label] ?? 0.50;
            const cost = Number(((tokens / 1000000) * usdPer1M * 84).toFixed(5));

            return {
                group: label,
                requests: Number(g.requests),
                avgLatency: Math.round(Number(g.avgLatency) || 0),
                tokens,
                cost
            };
        }));

        summary.sort((a, b) => b.requests - a.requests);

        return response.success(res, { summary });
    } catch (err) { next(err); }
}

module.exports = {
    getOverview,
    getTraffic,
    getEndpoints,
    getErrors,
    getLlmMetrics,
    getCacheMetrics,
    getCacheEntries,
    clearCache,
    getUserMetrics,
    getFeedbackMetrics,
    getSummaryMetrics
};
