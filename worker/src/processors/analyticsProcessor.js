const { db, requestLogs } = require('../config/database');
const { eq, and, gte, lte, count, avg } = require('drizzle-orm');
const logger = require('../utils/logger');

/**
 * Analytics Processor — recomputes aggregated metrics.
 * Triggered periodically or on-demand.
 */
async function processAnalytics(job) {
    const { apiId, from, to } = job.data;

    logger.info('Processing analytics aggregation', { apiId });

    // This processor can be used for deeper analytics beyond minute-level
    // (e.g., hourly rollups, daily summaries)
    // The primary minute-level aggregation happens in logProcessor via upsert.

    const [result] = await db.select({
        _count: count(),
        _avg_latencyMs: avg(requestLogs.latencyMs),
    })
    .from(requestLogs)
    .where(
        and(
            eq(requestLogs.apiId, apiId),
            gte(requestLogs.timestamp, new Date(from)),
            lte(requestLogs.timestamp, new Date(to))
        )
    );

    const totalRequests = Number(result?._count) || 0;
    const avgLatency = Number(result?._avg_latencyMs) || 0;

    logger.info('Analytics aggregation complete', {
        apiId,
        totalRequests,
        avgLatency,
    });

    return {
        _count: totalRequests,
        _avg: { latencyMs: avgLatency }
    };
}

module.exports = { processAnalytics };
