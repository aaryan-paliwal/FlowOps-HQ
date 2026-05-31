const express = require('express');
const { eq } = require('drizzle-orm');
const { executeAiProxy } = require('./core/universalRouter');
const { optimizePrompt } = require('./core/promptOptimizer');
const { db, users, apis, apiKeys } = require('../config/database');
const { hashApiKey } = require('../utils/generateApiKey');
const { logRequestAsync } = require('./core/observability');
const logger = require('../utils/logger');

const router = express.Router();

// Define allowed models per subscription tier
const TIER_ACCESS = {
    FREE: ['gemini-1.5-flash'],
    PRO: ['gemini-1.5-flash', 'gpt-4o-mini'],
    MAX: ['gemini-1.5-flash', 'gpt-4o-mini', 'gpt-4o', 'anthropic/claude-3-5-sonnet']
};

// Map models to their respective providers
const MODEL_TO_PROVIDER = {
    'gemini-1.5-flash': 'gemini',
    'gpt-4o-mini': 'openai',
    'gpt-4o': 'openai',
    'anthropic/claude-3-5-sonnet': 'anthropic'
};

// ─── SaaS Gateway Route ───
router.post('/v1/chat/completions', async (req, res) => {
    const startTime = Date.now();
    let apiId = null;
    let apiKeyId = null;
    let tier;
    let requestedModel = req.body.model || 'unknown';
    let providerStr = 'unknown';

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

        // 2. Validate requested model
        if (!req.body.model) {
            return res.status(400).json({
                error: { message: 'Model field is required in request body.' }
            });
        }

        const allowedModels = TIER_ACCESS[tier] || TIER_ACCESS.FREE;
        if (!allowedModels.includes(requestedModel)) {
            return res.status(403).json({
                error: {
                    message: `Access denied. Model '${requestedModel}' is not available on the ${tier} tier. Please upgrade your subscription plan.`
                }
            });
        }

        // 3. Resolve Provider and assign upstream API Keys
        providerStr = MODEL_TO_PROVIDER[requestedModel];
        if (!providerStr) {
            return res.status(400).json({
                error: { message: `Unsupported model: ${requestedModel}` }
            });
        }

        // ─── Dynamic Database-Driven Weighted Load Balancing ───
        let dbWeights = null;
        if (apiKeyRecord?.api?.loadBalancingWeights) {
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

                // If a different provider is selected by weighted load balancing, swap it
                if (selectedProvider !== providerStr) {
                    logger.info(`[Load Balancing] Selected alternative provider: ${selectedProvider.toUpperCase()} (was ${providerStr.toUpperCase()})`);
                    providerStr = selectedProvider;
                    if (providerStr === 'gemini') requestedModel = 'gemini-1.5-flash';
                    else if (providerStr === 'openai') requestedModel = tier === 'MAX' ? 'gpt-4o' : 'gpt-4o-mini';
                    else if (providerStr === 'anthropic') requestedModel = 'anthropic/claude-3-5-sonnet';

                    req.body.model = requestedModel; // Override model in request body
                }
            }
        }

        // Bind all secure environment keys to headers so fallback providers can retrieve their keys
        req.headers['x-openai-key'] = process.env.OPENAI_API_KEY;
        req.headers['x-gemini-key'] = process.env.GEMINI_API_KEY;
        req.headers['x-anthropic-key'] = process.env.ANTHROPIC_API_KEY;

        // 4. Resolve Retries Count (from header, db record, or default to 2)
        const customRetries = req.headers['x-flowops-retries'];
        const dbRetries = apiKeyRecord?.api?.retryCount;
        const retryCount = customRetries ? parseInt(customRetries, 10) : (dbRetries !== undefined && dbRetries !== null ? dbRetries : 2);

        // 5. Resolve Fallback Chain (from header, db record, or compute smart tier-based default)
        let fallbackChain = [];
        const customFallbacks = req.headers['x-flowops-fallbacks']; // e.g. "gemini,anthropic"
        const dbFallbacks = apiKeyRecord?.api?.fallbackProviders;

        if (customFallbacks) {
            fallbackChain = customFallbacks.split(',').map(s => s.trim().toLowerCase());
        } else if (dbFallbacks) {
            fallbackChain = dbFallbacks.split(',').map(s => s.trim().toLowerCase());
        } else {
            // Smart defaults based on subscription capabilities
            if (providerStr === 'openai') {
                if (tier === 'MAX') fallbackChain = ['gemini', 'anthropic'];
                else if (tier === 'PRO') fallbackChain = ['gemini'];
            } else if (providerStr === 'anthropic') {
                if (tier === 'MAX') fallbackChain = ['openai', 'gemini'];
            } else if (providerStr === 'gemini') {
                if (tier === 'MAX') fallbackChain = ['openai', 'anthropic'];
                else if (tier === 'PRO') fallbackChain = ['openai'];
            }
        }

        // Filter fallbacks to ensure they match tier capabilities
        const allowedProvidersInTier = new Set();
        (TIER_ACCESS[tier] || TIER_ACCESS.FREE).forEach(m => {
            const prov = MODEL_TO_PROVIDER[m];
            if (prov) allowedProvidersInTier.add(prov);
        });
        fallbackChain = fallbackChain.filter(prov => allowedProvidersInTier.has(prov) && prov !== providerStr);

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

        logger.info('SaaS Proxy Execution', {
            tier,
            requestedModel,
            provider: providerStr,
            retries: retryCount,
            fallbacks: fallbackChain,
            optimizerActive: !!optimizerStats
        });

        // 6. Forward to the Universal Gateway Engine
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
                provider: result.provider || providerStr,
                model: result.model || requestedModel,
                
                // Optimizer Metrics
                promptOptimized: !!optimizerStats,
                originalPromptTokens: optimizerStats?.originalTokens || 0,
                tokensSaved: optimizerStats?.savedTokens || 0,
                optimizationPercent: optimizerStats?.savingsPercent || 0
            });
        }

        // 8. Return response
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
                provider: providerStr,
                model: requestedModel
            });
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
