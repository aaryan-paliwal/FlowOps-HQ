const app = require('./app');
const { env } = require('./config/env');
const { sql } = require('./config/database');
const { redis } = require('./config/redis');
const logger = require('./utils/logger');

// ─── Start Server ───
const server = app.listen(env.PORT, () => {
    logger.info(`FlowOps HQ Backend running on port ${env.PORT}`, {
        env: env.NODE_ENV,
        port: env.PORT,
    });
});

// ─── Graceful Shutdown ───
async function gracefulShutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
        logger.info('HTTP server closed');

        try {
            await sql.end();
            logger.info('PostgreSQL disconnected');
        } catch (err) {
            logger.error('Error disconnecting PostgreSQL', { error: err.message });
        }

        try {
            await redis.quit();
            logger.info('Redis disconnected');
        } catch (err) {
            logger.error('Error disconnecting Redis', { error: err.message });
        }

        logger.info('Graceful shutdown complete');
        process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
        logger.error('Forced shutdown — timeout exceeded');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection', { error: err.message, stack: err.stack });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
});
