const { prisma } = require('../../config/database');
const response = require('../../utils/formatResponse');

/**
 * Overview: total requests, error rate, avg latency, active APIs, and advanced LLM SaaS metrics (tokens, savings, cache ratio)
 */
async function getOverview(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                totalRequests: 0,
                errorRate: 0,
                avgLatency: 0,
                activeApis: 0,
                totalTokens: 0,
                cacheHitRatio: 0,
                costSaved: 0
            });
        }

        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const [stats, activeApis, tokenStats, cacheStats] = await Promise.all([
            prisma.requestLog.aggregate({
                where,
                _count: true,
                _avg: { latencyMs: true },
            }),
            prisma.api.count({ where: { userId: req.user.userId, isActive: true } }),
            prisma.requestLog.aggregate({
                where,
                _sum: { tokensUsed: true, promptTokens: true, completionTokens: true }
            }),
            prisma.requestLog.groupBy({
                by: ['cacheHit', 'provider', 'model'],
                where,
                _count: true,
                _sum: { promptTokens: true }
            })
        ]);

        const totalRequests = stats._count || 0;
        const errorCount = await prisma.requestLog.count({
            where: { ...where, statusCode: { gte: 400 } },
        });

        const errorRate = totalRequests > 0 ? ((errorCount / totalRequests) * 100).toFixed(2) : 0;
        const avgLatency = Math.round(stats._avg?.latencyMs || 0);

        // --- Calculate LLM SaaS Metrics ---
        const totalTokens = tokenStats._sum?.tokensUsed || 0;
        
        let cacheHits = 0;
        let costSaved = 0;

        // Pricing rates per 1M tokens
        const rates = {
            'gemini': 0.075,
            'openai': 2.50, // default premium
            'gpt-4o-mini': 0.150,
            'gpt-4o': 2.50,
            'anthropic': 3.00
        };

        cacheStats.forEach((bucket) => {
            if (bucket.cacheHit) {
                cacheHits += bucket._count;
                
                const promptTokensSaved = bucket._sum?.promptTokens || 0;
                let rate = rates[bucket.provider] || rates.openai;
                if (bucket.model && rates[bucket.model]) {
                    rate = rates[bucket.model];
                }
                
                costSaved += (promptTokensSaved / 1000000) * rate;
            }
        });

        const cacheHitRatio = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(2) : 0;

        return response.success(res, {
            totalRequests,
            errorRate: Number(errorRate),
            avgLatency,
            activeApis,
            totalTokens,
            cacheHitRatio: Number(cacheHitRatio),
            costSaved: Number(costSaved.toFixed(4))
        });
    } catch (err) { next(err); }
}

/**
 * Traffic: request volume over time (grouped by interval)
 */
async function getTraffic(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { dataPoints: [] });
        }

        const { apiId, from, to } = req.query;

        // Use pre-aggregated metrics if available, fall back to raw logs
        const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : new Date();

        const targetApiIds = apiId ? [apiId] : apiIds;

        const metrics = await prisma.apiMetrics.findMany({
            where: {
                apiId: { in: targetApiIds },
                minuteBucket: { gte: fromDate, lte: toDate },
            },
            orderBy: { minuteBucket: 'asc' },
        });

        // Group by hour for cleaner visualization
        const hourlyMap = new Map();
        metrics.forEach((m) => {
            const hourKey = new Date(m.minuteBucket);
            hourKey.setMinutes(0, 0, 0);
            const key = hourKey.toISOString();

            if (!hourlyMap.has(key)) {
                hourlyMap.set(key, { timestamp: key, requests: 0, errors: 0, avgLatency: 0, totalLatency: 0 });
            }
            const entry = hourlyMap.get(key);
            entry.requests += m.requestCount;
            entry.errors += m.errorCount;
            entry.totalLatency += m.totalLatency;
        });

        const dataPoints = Array.from(hourlyMap.values()).map((dp) => ({
            timestamp: dp.timestamp,
            requests: dp.requests,
            errors: dp.errors,
            avgLatency: dp.requests > 0 ? Math.round(dp.totalLatency / dp.requests) : 0,
        }));

        return response.success(res, { dataPoints });
    } catch (err) { next(err); }
}

/**
 * Top endpoints by request count
 */
async function getEndpoints(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);
        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const endpoints = await prisma.requestLog.groupBy({
            by: ['endpoint', 'method'],
            where,
            _count: true,
            _avg: { latencyMs: true },
            orderBy: { _count: { endpoint: 'desc' } },
            take: 10,
        });

        const result = endpoints.map((ep) => ({
            endpoint: ep.endpoint,
            method: ep.method,
            requests: ep._count,
            avgLatency: Math.round(ep._avg.latencyMs || 0),
        }));

        return response.success(res, { endpoints: result });
    } catch (err) { next(err); }
}

/**
 * Error distribution by status code
 */
async function getErrors(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);
        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const errors = await prisma.requestLog.groupBy({
            by: ['statusCode'],
            where,
            _count: true,
            orderBy: { _count: { statusCode: 'desc' } },
        });

        const result = errors.map((e) => ({
            statusCode: e.statusCode,
            count: e._count,
        }));

        return response.success(res, { errorDistribution: result });
    } catch (err) { next(err); }
}

/**
 * Advanced LLM metrics: provider distribution and model distribution
 */
async function getLlmMetrics(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { providers: [], models: [] });
        }

        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const [providersGroup, modelsGroup] = await Promise.all([
            prisma.requestLog.groupBy({
                by: ['provider'],
                where,
                _count: true,
                _sum: { tokensUsed: true }
            }),
            prisma.requestLog.groupBy({
                by: ['model'],
                where,
                _count: true,
                _sum: { tokensUsed: true }
            })
        ]);

        const providers = providersGroup.map(p => ({
            provider: p.provider || 'unknown',
            requests: p._count,
            tokens: p._sum.tokensUsed || 0
        }));

        const models = modelsGroup.map(m => ({
            model: m.model || 'unknown',
            requests: m._count,
            tokens: m._sum.tokensUsed || 0
        }));

        return response.success(res, { providers, models });
    } catch (err) { next(err); }
}

// ─── Helper: build where clause ───
function buildWhere(apiIds, apiId, from, to) {
    const where = { apiId: apiId ? apiId : { in: apiIds } };
    if (from || to) {
        where.timestamp = {};
        if (from) where.timestamp.gte = new Date(from);
        if (to) where.timestamp.lte = new Date(to);
    }
    return where;
}

/**
 * Cache Telemetry: hits, speedup latency, cache hit rate, savings, and hourly chart buckets
 */
async function getCacheMetrics(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                cacheHits: 0,
                totalRequests: 0,
                cacheHitRate: 0,
                cacheSavings: 0,
                avgCacheLatency: 0,
                avgNonCacheLatency: 0,
                cacheSpeedupPercent: 0,
                timeSeries: []
            });
        }

        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const [totalStats, cacheStats, nonCacheStats, timeBucketStats] = await Promise.all([
            prisma.requestLog.count({ where }),
            prisma.requestLog.aggregate({
                where: { ...where, cacheHit: true },
                _count: true,
                _avg: { latencyMs: true },
                _sum: { promptTokens: true }
            }),
            prisma.requestLog.aggregate({
                where: { ...where, cacheHit: false },
                _count: true,
                _avg: { latencyMs: true }
            })
        ]);

        const totalRequests = totalStats;
        const cacheHits = cacheStats._count || 0;
        const cacheHitRate = totalRequests > 0 ? Number(((cacheHits / totalRequests) * 100).toFixed(2)) : 0;
        const avgCacheLatency = Math.round(cacheStats._avg?.latencyMs || 0);
        const avgNonCacheLatency = Math.round(nonCacheStats._avg?.latencyMs || 0);
        const speedupDiff = avgNonCacheLatency - avgCacheLatency;
        const cacheSpeedupPercent = avgNonCacheLatency > 0 ? Math.max(0, Math.round((speedupDiff / avgNonCacheLatency) * 100)) : 0;

        // Dynamic cost savings calculation:
        // Use promptTokensSaved * model pricing or average $0.0015 per 1K tokens
        const promptTokensSaved = cacheStats._sum?.promptTokens || 0;
        const cacheSavings = Number(((promptTokensSaved / 1000) * 0.0015).toFixed(4));

        // Generate dynamic 12-hour interval time series
        const timeSeriesMap = new Map();
        const intervals = 12;
        const now = Date.now();
        for (let i = 0; i < intervals; i++) {
            const timeVal = new Date(now - (intervals - i) * 2 * 60 * 60 * 1000);
            timeVal.setMinutes(0, 0, 0);
            const key = timeVal.toISOString();
            timeSeriesMap.set(key, { timestamp: key, cacheHits: 0, requests: 0, savings: 0 });
        }

        const hourlyLogs = await prisma.requestLog.findMany({
            where,
            select: { cacheHit: true, timestamp: true, promptTokens: true }
        });

        hourlyLogs.forEach(log => {
            const date = new Date(log.timestamp);
            date.setMinutes(0, 0, 0);
            const key = date.toISOString();

            let entry = timeSeriesMap.get(key);
            if (!entry) {
                let minDiff = Infinity;
                let nearestKey = null;
                for (const k of timeSeriesMap.keys()) {
                    const diff = Math.abs(new Date(k) - date);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestKey = k;
                    }
                }
                if (nearestKey && minDiff < 4 * 60 * 60 * 1000) {
                    entry = timeSeriesMap.get(nearestKey);
                }
            }

            if (entry) {
                entry.requests += 1;
                if (log.cacheHit) {
                    entry.cacheHits += 1;
                    entry.savings += (log.promptTokens / 1000) * 0.0015;
                }
            }
        });

        const timeSeries = Array.from(timeSeriesMap.values()).map(item => ({
            timestamp: item.timestamp,
            cacheHits: item.cacheHits,
            totalRequests: item.requests,
            hitRate: item.requests > 0 ? Number(((item.cacheHits / item.requests) * 100).toFixed(1)) : 0,
            savings: Number(item.savings.toFixed(6))
        }));

        return response.success(res, {
            cacheHits,
            totalRequests,
            cacheHitRate,
            cacheSavings,
            avgCacheLatency,
            avgNonCacheLatency,
            cacheSpeedupPercent,
            timeSeries
        });
    } catch (err) { next(err); }
}

/**
 * User Telemetry: unique active user count, average requests per user, and time-series buckets
 */
async function getUserMetrics(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                uniqueUsers: 0,
                requestsPerUser: 0,
                timeSeries: []
            });
        }

        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const logs = await prisma.requestLog.findMany({
            where,
            select: { ip: true, timestamp: true }
        });

        const uniqueIps = new Set(logs.map(l => l.ip).filter(Boolean));
        const uniqueUsers = uniqueIps.size;
        const totalRequests = logs.length;
        const requestsPerUser = uniqueUsers > 0 ? Number((totalRequests / uniqueUsers).toFixed(2)) : 0;

        const timeSeriesMap = new Map();
        const intervals = 12;
        const now = Date.now();
        for (let i = 0; i < intervals; i++) {
            const timeVal = new Date(now - (intervals - i) * 2 * 60 * 60 * 1000);
            timeVal.setMinutes(0, 0, 0);
            const key = timeVal.toISOString();
            timeSeriesMap.set(key, { timestamp: key, requests: 0, ips: new Set() });
        }

        logs.forEach(log => {
            const date = new Date(log.timestamp);
            date.setMinutes(0, 0, 0);
            const key = date.toISOString();

            let entry = timeSeriesMap.get(key);
            if (!entry) {
                let minDiff = Infinity;
                let nearestKey = null;
                for (const k of timeSeriesMap.keys()) {
                    const diff = Math.abs(new Date(k) - date);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestKey = k;
                    }
                }
                if (nearestKey && minDiff < 4 * 60 * 60 * 1000) {
                    entry = timeSeriesMap.get(nearestKey);
                }
            }

            if (entry) {
                entry.requests += 1;
                if (log.ip) entry.ips.add(log.ip);
            }
        });

        const timeSeries = Array.from(timeSeriesMap.values()).map(item => ({
            timestamp: item.timestamp,
            uniqueUsers: item.ips.size,
            requests: item.requests,
            requestsPerUser: item.ips.size > 0 ? Number((item.requests / item.ips.size).toFixed(1)) : 0
        }));

        return response.success(res, {
            uniqueUsers,
            requestsPerUser,
            timeSeries
        });
    } catch (err) { next(err); }
}

/**
 * Quality & Sentiment Feedback: maps response quality based on latency and errors into rating stats
 */
async function getFeedbackMetrics(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, {
                positiveCount: 0,
                neutralCount: 0,
                negativeCount: 0,
                avgRating: 0,
                feedbackList: [],
                timeSeries: []
            });
        }

        const { apiId, from, to } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        const logs = await prisma.requestLog.findMany({
            where,
            select: { statusCode: true, latencyMs: true, cacheHit: true, timestamp: true, model: true }
        });

        let positiveCount = 0;
        let neutralCount = 0;
        let negativeCount = 0;
        let ratingSum = 0;

        logs.forEach(log => {
            let rating = 4.0;
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
        });

        const total = logs.length;
        const avgRating = total > 0 ? Number((ratingSum / total).toFixed(2)) : 0;

        const timeSeriesMap = new Map();
        const intervals = 12;
        const now = Date.now();
        for (let i = 0; i < intervals; i++) {
            const timeVal = new Date(now - (intervals - i) * 2 * 60 * 60 * 1000);
            timeVal.setMinutes(0, 0, 0);
            const key = timeVal.toISOString();
            timeSeriesMap.set(key, { timestamp: key, ratingSum: 0, count: 0 });
        }

        logs.forEach(log => {
            let rating = 4.0;
            if (log.statusCode >= 400) rating = 1.0;
            else if (log.latencyMs > 1500) rating = 2.0;
            else if (log.cacheHit) rating = 5.0;
            else if (log.latencyMs < 300) rating = 4.5;
            else rating = 3.5;

            const date = new Date(log.timestamp);
            date.setMinutes(0, 0, 0);
            const key = date.toISOString();

            let entry = timeSeriesMap.get(key);
            if (!entry) {
                let minDiff = Infinity;
                let nearestKey = null;
                for (const k of timeSeriesMap.keys()) {
                    const diff = Math.abs(new Date(k) - date);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestKey = k;
                    }
                }
                if (nearestKey && minDiff < 4 * 60 * 60 * 1000) {
                    entry = timeSeriesMap.get(nearestKey);
                }
            }

            if (entry) {
                entry.ratingSum += rating;
                entry.count += 1;
            }
        });

        const timeSeries = Array.from(timeSeriesMap.values()).map(item => ({
            timestamp: item.timestamp,
            avgRating: item.count > 0 ? Number((item.ratingSum / item.count).toFixed(2)) : 0,
            requests: item.count
        }));

        const feedbackList = [];
        const highLatencyLogs = logs.filter(l => l.latencyMs > 1000 && l.statusCode < 400);
        if (highLatencyLogs.length > 5) {
            feedbackList.push({
                type: 'warning',
                title: 'High Latency Spike Detected',
                description: `${highLatencyLogs.length} logs observed high query duration over 1000ms. Consider model substitution.`,
                timestamp: new Date().toISOString()
            });
        }

        const errorLogs = logs.filter(l => l.statusCode >= 400);
        if (errorLogs.length > 0) {
            feedbackList.push({
                type: 'error',
                title: 'Gateway Errors Triggered',
                description: `${errorLogs.length} requests ended with status code >= 400. Inspect validation failures.`,
                timestamp: new Date().toISOString()
            });
        }

        const lowCacheLogs = logs.filter(l => !l.cacheHit);
        if (lowCacheLogs.length > 10) {
            const currentCacheRate = total > 0 ? ((logs.filter(l => l.cacheHit).length / total) * 100).toFixed(0) : 0;
            feedbackList.push({
                type: 'info',
                title: 'Cache Invalidation Optimization Opportunities',
                description: `Cache hit rate is currently ${currentCacheRate}%. Tweak cache headers to capture prompt repetitions.`,
                timestamp: new Date().toISOString()
            });
        }

        return response.success(res, {
            positiveCount,
            neutralCount,
            negativeCount,
            avgRating,
            feedbackList,
            timeSeries
        });
    } catch (err) { next(err); }
}

/**
 * Summarized Telemetry: dynamic grouped metrics according to selected frontend dropdown filters
 */
async function getSummaryMetrics(req, res, next) {
    try {
        const userApis = await prisma.api.findMany({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        const apiIds = userApis.map((a) => a.id);

        if (apiIds.length === 0) {
            return response.success(res, { summary: [] });
        }

        const { apiId, from, to, groupBy = 'AI Service' } = req.query;
        const where = buildWhere(apiIds, apiId, from, to);

        let field = 'provider';
        if (groupBy === 'Model') field = 'model';
        else if (groupBy === 'Status Code') field = 'statusCode';
        else if (groupBy === 'API Key') field = 'apiKeyId';
        else if (groupBy === 'Config') field = 'apiId';
        else if (groupBy === 'Provider') field = 'provider';
        else if (groupBy === 'Prompt') field = 'endpoint';

        const groups = await prisma.requestLog.groupBy({
            by: [field],
            where,
            _count: true,
            _avg: { latencyMs: true },
            _sum: { tokensUsed: true }
        });

        const summary = await Promise.all(groups.map(async (g) => {
            let label = String(g[field] || 'unknown');

            if (field === 'apiId' && label !== 'unknown') {
                const apiRec = await prisma.api.findUnique({
                    where: { id: label },
                    select: { name: true }
                });
                if (apiRec) label = apiRec.name;
            }

            if (field === 'apiKeyId' && label !== 'unknown') {
                const keyRec = await prisma.apiKey.findUnique({
                    where: { id: label },
                    select: { name: true, keyPrefix: true }
                });
                if (keyRec) label = `${keyRec.name} (${keyRec.keyPrefix})`;
            }

            if (field === 'statusCode') {
                label = `HTTP ${label}`;
            }

            const tokens = g._sum.tokensUsed || 0;
            const cost = Number(((tokens / 1000000) * 1.5).toFixed(5));

            return {
                group: label,
                requests: g._count,
                avgLatency: Math.round(g._avg.latencyMs || 0),
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
    getUserMetrics,
    getFeedbackMetrics,
    getSummaryMetrics
};
