const Redis = require('ioredis');
const { env } = require('./env');
const logger = require('../utils/logger');

// ─── Redis client with reconnect strategy ───
const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,       // required for BullMQ
    enableReadyCheck: true,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        logger.warn(`Redis reconnect attempt ${times}, retrying in ${delay}ms`);
        return delay;
    },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

module.exports = { redis };
