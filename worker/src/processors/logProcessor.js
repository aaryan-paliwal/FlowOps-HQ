const { db, requestLogs, apiMetrics } = require('../config/database');
const { eq, and } = require('drizzle-orm');
const logger = require('../utils/logger');

/**
 * Log Processor — stores gateway request logs to PostgreSQL.
 * Consumed from the "request-logs" queue.
 */
async function processLog(job) {
    const { apiId, endpoint, method, statusCode, latencyMs, ip, apiKeyId, requestId, timestamp } = job.data;

    logger.info('Processing log', { requestId, apiId, endpoint, statusCode });

    await db.insert(requestLogs).values({
        apiId,
        endpoint,
        method,
        statusCode,
        latencyMs,
        ip: ip || null,
        apiKeyId: apiKeyId || null,
        requestId: requestId || null,
        timestamp: new Date(timestamp),
    });

    // Also update aggregated metrics (upsert into minute bucket)
    const minuteBucket = new Date(timestamp);
    minuteBucket.setSeconds(0, 0); // truncate to minute

    // Check if metric exists for this bucket
    const [existingMetric] = await db.select().from(apiMetrics)
        .where(
            and(
                eq(apiMetrics.apiId, apiId),
                eq(apiMetrics.minuteBucket, minuteBucket)
            )
        )
        .limit(1);

    if (existingMetric) {
        await db.update(apiMetrics)
            .set({
                requestCount: existingMetric.requestCount + 1,
                errorCount: statusCode >= 400 ? existingMetric.errorCount + 1 : existingMetric.errorCount,
                totalLatency: existingMetric.totalLatency + latencyMs,
            })
            .where(eq(apiMetrics.id, existingMetric.id));
    } else {
        await db.insert(apiMetrics).values({
            apiId,
            minuteBucket,
            requestCount: 1,
            errorCount: statusCode >= 400 ? 1 : 0,
            totalLatency: latencyMs,
        });
    }

    logger.info('Log stored and metrics updated', { requestId, apiId });
}

module.exports = { processLog };
