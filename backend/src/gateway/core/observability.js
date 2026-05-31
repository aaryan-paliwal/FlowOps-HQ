const { db, requestLogs } = require('../../config/database');
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
        model = null,
        promptOptimized = false,
        originalPromptTokens = 0,
        tokensSaved = 0,
        optimizationPercent = 0
    } = logParams;

    const logEntry = {
        apiId, endpoint, method, statusCode, latencyMs, ip, apiKeyId, requestId,
        promptTokens, completionTokens, tokensUsed: promptTokens + completionTokens,
        cacheHit, provider, model, promptOptimized, originalPromptTokens,
        tokensSaved, optimizationPercent, timestamp: new Date()
    };
    
    batchQueue.push(logEntry);
    
    // We trigger alerts synchronously or fire-and-forget them here
    checkAndTriggerAlerts(apiId).catch(err => logger.error('Alerts Error', { error: err.message }));
}

// ─── Batch Processor Queue ───
const batchQueue = [];
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000;

async function processBatch() {
    if (batchQueue.length === 0) return;
    
    // Take up to BATCH_SIZE items from the queue
    const batch = batchQueue.splice(0, BATCH_SIZE);
    
    try {
        await db.insert(requestLogs).values(batch);
        logger.info(`Observability: Batched ${batch.length} logs to DB`);
    } catch (err) {
        logger.error('Observability: Failed to batch write request logs to DB', {
            error: err.message
        });
        // On failure, re-queue the items
        batchQueue.unshift(...batch);
    }
}

// Start the background batch flusher
setInterval(processBatch, FLUSH_INTERVAL_MS);

module.exports = { logRequestAsync };
