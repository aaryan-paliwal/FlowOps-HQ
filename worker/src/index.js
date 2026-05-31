require('./config/env');
const { Worker } = require('bullmq');
const { redis } = require('./config/redis');
const { sql } = require('./config/database');
const { processLog } = require('./processors/logProcessor');
const { processAnalytics } = require('./processors/analyticsProcessor');
const { processCleanup } = require('./processors/cleanupProcessor');
const logger = require('./utils/logger');

// ─── Request Log Worker ───
const logWorker = new Worker('request-logs', async (job) => {
    if (job.name === 'process-log') {
        await processLog(job);
    }
}, {
    connection: redis,
    concurrency: 10,
});

// ─── Analytics Worker ───
const analyticsWorker = new Worker('analytics', async (job) => {
    if (job.name === 'aggregate') {
        await processAnalytics(job);
    }
}, {
    connection: redis,
    concurrency: 5,
});

// ─── Cleanup Worker ───
const cleanupWorker = new Worker('cleanup', async (job) => {
    if (job.name === 'rate-limit-cleanup') {
        await processCleanup(job);
    }
}, {
    connection: redis,
    concurrency: 1,
});

// ─── Worker Event Handlers ───
[logWorker, analyticsWorker, cleanupWorker].forEach((worker) => {
    worker.on('completed', (job) => {
        logger.debug(`Job ${job.name} completed`, { jobId: job.id });
    });

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.name} failed`, {
            jobId: job?.id,
            error: err.message,
        });
    });
});

logger.info('FlowOps HQ Worker started', {
    queues: ['request-logs', 'analytics', 'cleanup'],
});

// ─── Graceful Shutdown ───
async function gracefulShutdown(signal) {
    logger.info(`${signal} received — shutting down workers`);

    await Promise.all([
        logWorker.close(),
        analyticsWorker.close(),
        cleanupWorker.close(),
    ]);

    await sql.end();
    await redis.quit();

    logger.info('Worker shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection', { error: err.message, stack: err.stack });
});
