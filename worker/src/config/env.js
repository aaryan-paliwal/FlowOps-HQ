require('dotenv').config();

const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    NODE_ENV: process.env.NODE_ENV || 'development',
};

if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
}

module.exports = { env };
