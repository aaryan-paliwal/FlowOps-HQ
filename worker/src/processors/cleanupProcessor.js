const { redis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Cleanup Processor — removes expired rate limit entries from Redis.
 * Runs periodically to prevent Redis memory bloat.
 */
async function processCleanup(job) {
    logger.info('Running rate limit cleanup');

    const keys = await redis.keys('ratelimit:*');
    let cleaned = 0;

    for (const key of keys) {
        const now = Date.now();
        const windowMs = 60 * 1000;
        const removed = await redis.zremrangebyscore(key, 0, now - windowMs);
        cleaned += removed;
    }

    logger.info('Rate limit cleanup complete', { keysScanned: keys.length, entriesRemoved: cleaned });
}

module.exports = { processCleanup };
