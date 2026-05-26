const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const { checkAndTriggerAlerts } = require('./alerts');

/**
 * Asynchronously records a gateway API transaction directly to PostgreSQL
 * without blocking or increasing the client's HTTP response latency.
 *
 * @param {Object} logParams
 */
function logRequestAsync(logParams) {
    const {
        apiId,
        endpoint,
        method,
        statusCode,
        latencyMs,
        ip,
        apiKeyId,
        requestId,
        promptTokens = 0,
        completionTokens = 0,
        cacheHit = false,
        provider = null,
        model = null
    } = logParams;

    // Fire-and-forget: execute Prisma insert asynchronously in the Node event loop.
    // By not using 'await' here, the HTTP response goes back to the client immediately.
    prisma.requestLog.create({
        data: {
            apiId,
            endpoint,
            method,
            statusCode,
            latencyMs,
            ip,
            apiKeyId,
            requestId,
            promptTokens,
            completionTokens,
            tokensUsed: promptTokens + completionTokens,
            cacheHit,
            provider,
            model,
            timestamp: new Date()
        }
    }).then((createdLog) => {
        logger.info('Observability: Log persisted to DB', { logId: createdLog.id, cacheHit });
        
        // Execute dynamic thresholds and budget checks asynchronously
        checkAndTriggerAlerts(apiId);
    }).catch((err) => {
        logger.error('Observability: Failed to write request log to DB', {
            error: err.message,
            requestId,
            apiId
        });
    });
}

module.exports = { logRequestAsync };
