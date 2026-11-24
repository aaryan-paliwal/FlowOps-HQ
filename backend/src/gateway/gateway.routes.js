const express = require('express');
const { eq } = require('drizzle-orm');
const { executeAiProxy, executeStreamingAiProxy } = require('./core/universalRouter');
const { classifyPrompt } = require('./core/smartClassifier');
const { optimizePrompt } = require('./core/promptOptimizer');
const { db, users, apis, apiKeys } = require('../config/database');
const { hashApiKey } = require('../utils/generateApiKey');
const { logRequestAsync } = require('./core/observability');
const logger = require('../utils/logger');

const router = express.Router();

// Define allowed models per subscription tier
const TIER_ACCESS = {
    FREE: ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'flowops-smart'],
    PRO: ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gpt-4o-mini', 'flowops-smart'],
    MAX: ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gpt-4o-mini', 'gpt-4o', 'anthropic/claude-3-5-sonnet', 'claude-3-5-sonnet', 'flowops-smart']
};

// Map models to their respective providers
const MODEL_TO_PROVIDER = {
    'gemini-1.5-flash': 'gemini',
    'gemini-2.5-flash': 'gemini',
    'gemini-3.5-flash': 'gemini',
    'gemini-3.5-flash-lite': 'gemini',
    'gemini-3.8-flash': 'gemini',
    'gpt-4o-mini': 'openai',
    'gpt-4o': 'openai',
    'anthropic/claude-3-5-sonnet': 'anthropic',
    'claude-3-5-sonnet': 'anthropic'
};

// OpenAI-compatible models discovery endpoint
router.get('/v1/models', (req, res) => {
    const models = Object.keys(MODEL_TO_PROVIDER).concat(['flowops-smart']).map((id) => ({
        id,
        object: 'model',
        owned_by: MODEL_TO_PROVIDER[id] || 'flowops'
    }));
    res.json({ object: 'list', data: models });
});

// ─── SaaS Gateway Route ───
router.post('/v1/chat/completions', async (req, res) => {
    const startTime = Date.now();
    let apiId = null;
    let apiKeyId = null;
    let tier;
    let requestedModel = req.body.model || 'unknown';
    let providerStr = 'unknown';
    let classificationMeta = null;

    try {
        const rawKey = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-flowops-api-key'];

        // 1. Authenticate API Key
        if (!rawKey) {
            return res.status(401).json({
                error: { message: 'Authentication required. Pass your FlowOps HQ key in Authorization header or x-flowops-api-key header.' }
            });
        }

        const keyHash = hashApiKey(rawKey);
        const [keyRow] = await db.select().from(apiKeys)
            .where(eq(apiKeys.keyHash, keyHash))
            .limit(1);

        if (!keyRow || keyRow.revoked) {
            return res.status(403).json({
                error: { message: 'Invalid or revoked FlowOps HQ API key.' }
            });
        }

        // Load the associated API and user
        const [apiRow] = await db.select().from(apis).where(eq(apis.id, keyRow.apiId)).limit(1);
        const [userRow] = apiRow ? await db.select().from(users).where(eq(users.id, apiRow.userId)).limit(1) : [null];

        const apiKeyRecord = { ...keyRow, api: { ...apiRow, user: userRow } };

        tier = userRow ? userRow.subscriptionTier : 'FREE';
        apiId = keyRow.apiId;
        apiKeyId = keyRow.id;
        req.flowopsApiId = apiId;

        // Bind BYOK headers first, falling back to server environment vault keys
        req.headers['x-openai-key'] = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
        req.headers['x-gemini-key'] = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY;
        req.headers['x-anthropic-key'] = req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY;

        // 1b. Validate custom OpenAI-compatible target URL to prevent SSRF
        const rawTargetUrl = req.headers['x-flowops-target-url'];
        if (rawTargetUrl !== undefined && String(rawTargetUrl).trim() !== '') {
            const { validateTargetUrl } = require('./core/urlValidator');
            const targetCheck = validateTargetUrl(String(rawTargetUrl));
            if (!targetCheck.valid) {
                return res.status(400).json({
                    error: { message: `Invalid x-flowops-target-url header: ${targetCheck.reason}` }
                });
            }
            req.headers['x-flowops-target-url'] = targetCheck.normalizedUrl;
        }

        // 2. Resolve model (Explicit vs Smart Classifier)
        const smartRoutingHeader = String(req.headers['x-flowops-smart-routing'] || '').toLowerCase();
        const shouldUseSmartClassifier =
            req.body.model === 'flowops-smart' ||
            req.body.model === 'auto' ||
            smartRoutingHeader === 'true' ||
            (smartRoutingHeader !== 'false' && !req.body.model && apiRow?.smartRoutingEnabled);

        if (shouldUseSmartClassifier) {
            const strategy = req.headers['x-flowops-strategy'] || apiRow?.routingStrategy || 'cost-optimized';
            classificationMeta = classifyPrompt(req.body.messages || [], {
                strategy,
                availableProviders: {
                    openai: req.headers['x-openai-key'],
                    gemini: req.headers['x-gemini-key'],
                    anthropic: req.headers['x-anthropic-key'],
                    customTargetUrl: req.headers['x-flowops-target-url'],
                    customModel: req.headers['x-flowops-custom-model'],
                }
            });
            requestedModel = classificationMeta.selectedModel;
            req.body.model = requestedModel;
            logger.info('[Smart Classifier] Selected model dynamically', {
                model: requestedModel,
                tier: classificationMeta.tier,
                reason: classificationMeta.reason
            });
        }

        if (!req.body.model) {
            return res.status(400).json({
                error: { message: 'Model field is required in request body (or enable smartRoutingEnabled / pass model: "flowops-smart").' }
            });
        }

        // Support open-source / custom OpenAI-compatible targets via header or prefix
        const isCustomOpenAICompatible =
            req.headers['x-flowops-provider'] === 'openai-compatible' ||
            Boolean(req.headers['x-flowops-target-url']) ||
            /^(ollama|groq|local|custom)\//.test(requestedModel);

        if (isCustomOpenAICompatible) {
            providerStr = 'openai-compatible';
            requestedModel = requestedModel.replace(/^(ollama|groq|local|custom)\//, '');
            req.body.model = requestedModel;
        } else {
            const allowedModels = TIER_ACCESS[tier] || TIER_ACCESS.FREE;
            const hasByokKey =
                (MODEL_TO_PROVIDER[requestedModel] === 'openai' && Boolean(req.headers['x-openai-key'])) ||
                (MODEL_TO_PROVIDER[requestedModel] === 'anthropic' && Boolean(req.headers['x-anthropic-key'])) ||
                (MODEL_TO_PROVIDER[requestedModel] === 'gemini' && Boolean(req.headers['x-gemini-key']));

            if (!allowedModels.includes(requestedModel) && !hasByokKey) {
                return res.status(403).json({
                    error: {
                        message: `Access denied. Model '${requestedModel}' is not available on the ${tier} tier. Pass your own provider key header or upgrade your plan.`
                    }
                });
            }

            // 3. Resolve Provider
            providerStr = MODEL_TO_PROVIDER[requestedModel];
            if (!providerStr) {
                return res.status(400).json({
                    error: { message: `Unsupported model: ${requestedModel}` }
                });
            }
        }

        // ─── Dynamic Database-Driven Weighted Load Balancing (only when NOT explicitly overridden by smart classifier, failover test, or custom endpoint) ───
        const simulateErrorActive = Boolean(req.headers['x-flowops-simulate-error']);
        const lbDisabled = String(req.headers['x-flowops-lb'] || '').toLowerCase() === 'false';
        let dbWeights = null;
        if (!classificationMeta && !simulateErrorActive && !lbDisabled && providerStr !== 'openai-compatible' && apiKeyRecord?.api?.loadBalancingWeights) {
            try {
                dbWeights = JSON.parse(apiKeyRecord.api.loadBalancingWeights);
            } catch (e) {
                logger.warn('Failed to parse load balancing weights JSON', { error: e.message });
            }
        }

        if (dbWeights && Object.keys(dbWeights).length > 0) {
            const providers = Object.keys(dbWeights);
            const weights = Object.values(dbWeights).map(w => Number(w) || 0);
            const totalWeight = weights.reduce((a, b) => a + b, 0);

            if (totalWeight > 0) {
                let randomNum = Math.random() * totalWeight;
                let selectedProvider = providerStr;

                for (let i = 0; i < providers.length; i++) {
                    randomNum -= weights[i];
                    if (randomNum <= 0) {
                        selectedProvider = providers[i];
                        break;
                    }
                }

                // Only swap to an alternative provider if credentials exist for it
                const selectedHasKey =
                    (selectedProvider === 'gemini' && Boolean(req.headers['x-gemini-key'])) ||
                    (selectedProvider === 'openai' && Boolean(req.headers['x-openai-key'])) ||
                    (selectedProvider === 'anthropic' && Boolean(req.headers['x-anthropic-key']));

                if (selectedProvider !== providerStr && selectedHasKey) {
                    logger.info(`[Load Balancing] Selected alternative provider: ${selectedProvider.toUpperCase()} (was ${providerStr.toUpperCase()})`);
                    providerStr = selectedProvider;
                    if (providerStr === 'gemini') requestedModel = 'gemini-3.5-flash';
                    else if (providerStr === 'openai') requestedModel = tier === 'MAX' ? 'gpt-4o' : 'gpt-4o-mini';
                    else if (providerStr === 'anthropic') requestedModel = 'anthropic/claude-3-5-sonnet';

                    req.body.model = requestedModel; // Override model in request body
                }
            }
        }

        // 4. Resolve Retries Count (from header, db record, or default to 2)
        const customRetries = req.headers['x-flowops-retries'];
        const dbRetries = apiKeyRecord?.api?.retryCount;
        const retryCount = customRetries ? parseInt(customRetries, 10) : (dbRetries !== undefined && dbRetries !== null ? dbRetries : 2);

        // 5. Resolve Fallback Chain (from header, db record, or compute smart tier-based default)
        let fallbackChain = [];
        const customFallbacks = req.headers['x-flowops-fallbacks']; // e.g. "gemini,anthropic"
        const dbFallbacks = apiKeyRecord?.api?.fallbackProviders;

        if (customFallbacks) {
            fallbackChain = customFallbacks.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        } else if (dbFallbacks) {
            fallbackChain = dbFallbacks.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        } else {
            // Smart defaults based on subscription capabilities or active BYOK keys
            if (providerStr === 'openai') {
                if (tier === 'MAX') fallbackChain = ['gemini', 'anthropic'];
                else if (tier === 'PRO' || req.headers['x-gemini-key']) fallbackChain = ['gemini'];
            } else if (providerStr === 'anthropic') {
                if (tier === 'MAX') fallbackChain = ['openai', 'gemini'];
                else if (req.headers['x-gemini-key']) fallbackChain = ['gemini'];
            } else if (providerStr === 'gemini') {
                if (tier === 'MAX') fallbackChain = ['openai', 'anthropic'];
                else if (tier === 'PRO' || req.headers['x-openai-key']) fallbackChain = ['openai'];
            }
        }

        // Filter fallbacks to providers allowed by tier OR explicitly backed by BYOK headers
        const allowedProvidersInTier = new Set();
        (TIER_ACCESS[tier] || TIER_ACCESS.FREE).forEach(m => {
            const prov = MODEL_TO_PROVIDER[m];
            if (prov) allowedProvidersInTier.add(prov);
        });
        fallbackChain = fallbackChain.filter((prov) => {
            if (!prov || prov === providerStr) return false;
            const hasByok =
                (prov === 'openai' && Boolean(req.headers['x-openai-key'])) ||
                (prov === 'anthropic' && Boolean(req.headers['x-anthropic-key'])) ||
                (prov === 'gemini' && Boolean(req.headers['x-gemini-key'])) ||
                (prov === 'openai-compatible' && Boolean(req.headers['x-flowops-target-url']));
            return allowedProvidersInTier.has(prov) || hasByok;
        });

        // 5.5 Trigger Codex Prompt Optimizer if requested
        let optimizerStats = null;
        if (req.headers['x-flowops-optimize'] === 'true' && req.body.messages) {
            try {
                const openaiKey = req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
                const optResult = await optimizePrompt(req.body.messages, openaiKey);
                if (optResult.optimizedMessages) {
                    req.body.messages = optResult.optimizedMessages;
                    optimizerStats = optResult.stats; // NOTE: extracting .stats, not the whole result!
                    
                    res.setHeader('x-flowops-optimized', 'true');
                    res.setHeader('x-flowops-tokens-saved', optimizerStats.savedTokens || 0);
                    res.setHeader('x-flowops-optimization-percent', optimizerStats.savingsPercent || 0);
                }
            } catch (err) {
                logger.warn('Optimizer failed during proxy, proceeding with original', { error: err.message });
            }
        }

        const isStreamRequested = req.body.stream === true || req.body.stream === 'true';

        logger.info('SaaS Proxy Execution', {
            tier,
            requestedModel,
            provider: providerStr,
            retries: retryCount,
            fallbacks: fallbackChain,
            streaming: isStreamRequested,
            optimizerActive: !!optimizerStats
        });

        // 6. Execute either Streaming (SSE) or Unary Chat Completion
        if (isStreamRequested) {
            const streamExtraHeaders = {
                ...(classificationMeta ? {
                    'x-flowops-classifier-tier': classificationMeta.tier,
                    'x-flowops-router-reason': classificationMeta.reason,
                } : {}),
                ...(optimizerStats ? {
                    'x-flowops-optimized': 'true',
                    'x-flowops-tokens-saved': optimizerStats.savedTokens || 0,
                    'x-flowops-optimization-percent': optimizerStats.savingsPercent || 0,
                } : {}),
            };

            const streamResult = await executeStreamingAiProxy(
                req,
                res,
                providerStr,
                fallbackChain,
                retryCount,
                0,
                { retryAttempts: 0, failoverUsed: false, failoverFrom: null },
                streamExtraHeaders
            );
            const latencyMs = Date.now() - startTime;

            if (apiId) {
                logRequestAsync({
                    apiId,
                    endpoint: '/v1/chat/completions',
                    method: 'POST',
                    statusCode: streamResult.status,
                    latencyMs,
                    ip: req.ip,
                    apiKeyId,
                    requestId: req.requestId || `req-${Date.now()}`,
                    promptTokens: streamResult.promptTokens || 0,
                    completionTokens: streamResult.completionTokens || 0,
                    cacheHit: Boolean(streamResult.cached),
                    cacheTier: streamResult.cacheTier || null,
                    isStreaming: true,
                    retryAttempts: streamResult.retryAttempts || 0,
                    failoverUsed: Boolean(streamResult.failoverUsed),
                    provider: streamResult.provider || providerStr,
                    model: streamResult.model || requestedModel,
                    promptOptimized: !!optimizerStats,
                    originalPromptTokens: optimizerStats?.originalTokens || 0,
                    tokensSaved: optimizerStats?.savedTokens || 0,
                    optimizationPercent: optimizerStats?.savingsPercent || 0
                });
            }
            return;
        }

        const result = await executeAiProxy(req, providerStr, fallbackChain, retryCount);
        const latencyMs = Date.now() - startTime;

        // 7. Asynchronously log proxy transaction to PostgreSQL for observability
        if (apiId) {
            logRequestAsync({
                apiId,
                endpoint: '/v1/chat/completions',
                method: 'POST',
                statusCode: result.status,
                latencyMs,
                ip: req.ip,
                apiKeyId,
                requestId: req.requestId || `req-${Date.now()}`,
                promptTokens: result.data?.usage?.prompt_tokens || 0,
                completionTokens: result.data?.usage?.completion_tokens || 0,
                cacheHit: result.cached || false,
                cacheTier: result.cacheTier || null,
                isStreaming: false,
                retryAttempts: result.retryAttempts || 0,
                failoverUsed: Boolean(result.failoverUsed),
                provider: result.provider || providerStr,
                model: result.model || requestedModel,
                
                // Optimizer Metrics
                promptOptimized: !!optimizerStats,
                originalPromptTokens: optimizerStats?.originalTokens || 0,
                tokensSaved: optimizerStats?.savedTokens || 0,
                optimizationPercent: optimizerStats?.savingsPercent || 0
            });
        }

        // 8. Return response with observability, cache & resilience headers
        if (result.cached) {
            res.setHeader('x-flowops-cache', 'HIT');
            if (result.cacheTier) res.setHeader('x-flowops-cache-tier', result.cacheTier);
            if (result.cacheSimilarity !== undefined && result.cacheSimilarity !== null) {
                res.setHeader('x-flowops-cache-similarity', Number(result.cacheSimilarity).toFixed(4));
            }
        } else if (result.cacheBypassReason) {
            res.setHeader('x-flowops-cache', 'BYPASS');
            res.setHeader('x-flowops-cache-reason', result.cacheBypassReason);
        } else {
            res.setHeader('x-flowops-cache', 'MISS');
        }
        res.setHeader('x-flowops-latency', latencyMs);
        res.setHeader('x-flowops-provider', result.provider || providerStr);
        res.setHeader('x-flowops-model-selected', result.model || requestedModel);
        res.setHeader('x-flowops-retry-count', result.retryAttempts || 0);
        res.setHeader('x-flowops-fallback-used', Boolean(result.failoverUsed));
        if (result.failoverFrom) {
            res.setHeader('x-flowops-failover-from', result.failoverFrom);
        }
        if (classificationMeta) {
            res.setHeader('x-flowops-classifier-tier', classificationMeta.tier);
            res.setHeader('x-flowops-router-reason', classificationMeta.reason);
        }
        return res.status(result.status).json(result.data);

    } catch (error) {
        const latencyMs = Date.now() - startTime;
        logger.error('Gateway Error', { error: error.message });

        // Log the failure to the database too
        if (apiId) {
            logRequestAsync({
                apiId,
                endpoint: '/v1/chat/completions',
                method: 'POST',
                statusCode: error.response?.status || 500,
                latencyMs,
                ip: req.ip,
                apiKeyId,
                requestId: req.requestId || `req-${Date.now()}`,
                promptTokens: 0,
                completionTokens: 0,
                cacheHit: false,
                cacheTier: null,
                isStreaming: Boolean(req.body?.stream === true || req.body?.stream === 'true'),
                retryAttempts: 0,
                failoverUsed: false,
                provider: providerStr,
                model: requestedModel
            });
        }

        if (res.headersSent) {
            if (!res.writableEnded) res.end();
            return;
        }

        return res.status(error.response?.status || 500).json({
            error: {
                message: error.message || 'Internal Gateway Error',
                type: 'flowops_gateway_error',
                code: 'proxy_failure'
            }
        });
    }
});

module.exports = router;
