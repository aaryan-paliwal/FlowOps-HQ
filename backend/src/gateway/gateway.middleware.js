const { prisma } = require('../config/database');
const { redis } = require('../config/redis');
const { hashApiKey } = require('../utils/generateApiKey');
const { proxyRequest } = require('./gateway.proxy');
const response = require('../utils/formatResponse');
const logger = require('../utils/logger');
const { Queue } = require('bullmq');

// ─── BullMQ Queue for async log processing ───
const logQueue = new Queue('request-logs', {
    connection: { lazyConnect: true, url: process.env.REDIS_URL },
});

/**
 * Gateway Middleware Pipeline.
 * Order: extractApiName → validateApiKey → checkRateLimit → proxyForward → pushLogToQueue
 *
 * This is ISOLATED from core business modules.
 * It only depends on: Prisma (read), Redis (rate limit), BullMQ (queue).
 */
async function gatewayPipeline(req, res) {
    const startTime = Date.now();
    const { apiName } = req.params;
    let api = null;
    let apiKeyRecord = null;

    try {
        // ── Step 1: Extract API Name → Lookup API record ──
        api = await prisma.api.findUnique({
            where: { slug: apiName },
            include: { rateLimit: true },
        });

        if (!api || !api.isActive) {
            return response.error(res, `API '${apiName}' not found`, 404);
        }

        // ── Step 2: Validate API Key ──
        const rawKey = req.headers['x-api-key'];
        if (!rawKey) {
            return response.error(res, 'API key required (x-api-key header)', 401);
        }

        const keyHash = hashApiKey(rawKey);
        apiKeyRecord = await prisma.apiKey.findUnique({
            where: { keyHash },
        });

        if (!apiKeyRecord || apiKeyRecord.apiId !== api.id || apiKeyRecord.revoked) {
            return response.error(res, 'Invalid or revoked API key', 403);
        }

        // ── Step 3: Check Rate Limit (Sliding Window Log) ──
        if (api.rateLimit) {
            const rateLimitKey = `ratelimit:${keyHash}`;
            const now = Date.now();
            const windowMs = 60 * 1000; // 1 minute window
            const limit = api.rateLimit.requestsPerMinute;

            // Atomic pipeline: remove expired → count → add → set TTL
            const pipeline = redis.pipeline();
            pipeline.zremrangebyscore(rateLimitKey, 0, now - windowMs);
            pipeline.zcard(rateLimitKey);
            pipeline.zadd(rateLimitKey, now, `${now}:${req.requestId}`);
            pipeline.expire(rateLimitKey, 60);

            const results = await pipeline.exec();
            const currentCount = results[1][1]; // zcard result

            if (currentCount >= limit) {
                res.setHeader('X-RateLimit-Limit', limit);
                res.setHeader('X-RateLimit-Remaining', 0);
                res.setHeader('Retry-After', '60');
                return response.error(res, 'Rate limit exceeded', 429);
            }

            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount - 1));
        }

        // ── Step 4: Proxy Forward Request ──
        const targetPath = req.params[0] || '';
        const targetUrl = `${api.baseUrl.replace(/\/$/, '')}/${targetPath}`;

        const proxyResult = await proxyRequest(req, targetUrl);

        // ── Step 5: Return Response to Client ──
        const latencyMs = Date.now() - startTime;

        // Forward response headers from target
        Object.entries(proxyResult.headers).forEach(([key, value]) => {
            if (!['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        res.status(proxyResult.status).send(proxyResult.data);

        // ── Step 6: Push Log to Queue (async, non-blocking) ──
        logQueue.add('process-log', {
            apiId: api.id,
            endpoint: `/${targetPath}`,
            method: req.method,
            statusCode: proxyResult.status,
            latencyMs,
            ip: req.ip,
            apiKeyId: apiKeyRecord.id,
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
        }).catch((err) => {
            logger.error('Failed to enqueue log', { error: err.message, requestId: req.requestId });
        });

    } catch (err) {
        const latencyMs = Date.now() - startTime;

        // If it's a proxy timeout/error
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            // Still log the failed request
            if (api) {
                logQueue.add('process-log', {
                    apiId: api.id,
                    endpoint: req.params[0] || '/',
                    method: req.method,
                    statusCode: 502,
                    latencyMs,
                    ip: req.ip,
                    apiKeyId: apiKeyRecord?.id,
                    requestId: req.requestId,
                    timestamp: new Date().toISOString(),
                }).catch(() => { });
            }
            return response.error(res, 'Target API unreachable', 502);
        }

        if (err.code === 'ECONNABORTED') {
            return response.error(res, 'Target API timeout', 504);
        }

        logger.error('Gateway error', {
            error: err.message,
            requestId: req.requestId,
            apiName,
        });
        return response.error(res, 'Gateway error', 500);
    }
}

module.exports = { gatewayPipeline };
