const Redis = require('ioredis');
const { env } = require('./env');

const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
});

module.exports = { redis };
