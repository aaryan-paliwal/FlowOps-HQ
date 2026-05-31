const { sql: sqlInstance } = require('../config/database');
const { redis } = require('../config/redis');
const response = require('../utils/formatResponse');

// ─── Module Routes ───
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/users.routes');
const apiRoutes = require('../modules/apis/apis.routes');
const apiKeyRoutes = require('../modules/apiKeys/apiKeys.routes');
const rateLimitRoutes = require('../modules/rateLimit/rateLimit.routes');
const logRoutes = require('../modules/logs/logs.routes');
const analyticsRoutes = require('../modules/analytics/analytics.routes');
const gatewayRoutes = require('../gateway/gateway.routes');

function registerRoutes(app) {
    // ─── Health Check ───
    app.get('/health', async (req, res) => {
        try {
            await sqlInstance`SELECT 1`;
            const redisPing = await redis.ping();

            return response.success(res, {
                status: 'ok',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                services: {
                    database: 'connected',
                    redis: redisPing === 'PONG' ? 'connected' : 'disconnected',
                },
            });
        } catch (err) {
            return response.error(res, 'Health check failed', 503, {
                database: err.message.includes('postgres') ? 'disconnected' : 'connected',
                redis: 'unknown',
            });
        }
    });

    // ─── Metrics Endpoint ───
    app.get('/metrics', async (req, res) => {
        const memUsage = process.memoryUsage();
        return response.success(res, {
            uptime: process.uptime(),
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            },
            timestamp: new Date().toISOString(),
        });
    });

    // ─── API Routes (v1) ───
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/users', userRoutes);
    app.use('/api/v1/apis', apiRoutes);
    app.use('/api/v1/keys', apiKeyRoutes);
    app.use('/api/v1/rate-limits', rateLimitRoutes);
    app.use('/api/v1/logs', logRoutes);
    app.use('/api/v1/analytics', analyticsRoutes);

    // ─── Gateway Routes (separate layer) ───
    app.use('/gateway', gatewayRoutes);

    // ─── 404 Handler ───
    app.use('*', (req, res) => {
        response.error(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
    });
}

module.exports = { registerRoutes };
