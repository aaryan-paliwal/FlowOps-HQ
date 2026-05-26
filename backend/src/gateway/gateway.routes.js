const express = require('express');
const { executeAiProxy } = require('./core/universalRouter');
const { prisma } = require('../config/database');
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
    let apiKeyRecord = null;
    let tier = 'FREE';
    let isMock = false;
    let requestedModel = req.body.model || 'unknown';
    let providerStr = 'unknown';

    try {
        const rawKey = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-flowops-api-key'];

        // 1. Authenticate API Key
        if (rawKey === 'mock-key') {
            isMock = true;
            tier = 'MAX'; // Sandbox mode grants MAX access

            // Dynamic Sandbox API/Key Seeding to populate dashboard analytics instantly
            const firstUser = await prisma.user.findFirst();
            if (firstUser) {
                let sandboxApi = await prisma.api.findFirst({
                    where: {
                        OR: [
                            { userId: firstUser.id, name: 'FlowOps Sandbox API' },
                            { slug: 'sandbox' }
                        ]
                    }
                });
                if (!sandboxApi) {
                    sandboxApi = await prisma.api.create({
                        data: {
                            name: 'FlowOps Sandbox API',
                            slug: 'sandbox',
                            baseUrl: 'http://localhost:5000',
                            userId: firstUser.id
                        }
                    });
                }
                apiId = sandboxApi.id;
                
                let sandboxKey = await prisma.apiKey.findFirst({
                    where: { apiId: sandboxApi.id }
                });
                if (!sandboxKey) {
                    sandboxKey = await prisma.apiKey.create({
                        data: {
                            apiId: sandboxApi.id,
                            name: 'Sandbox Key',
                            keyHash: 'sandbox-hash',
                            keyPrefix: 'fl_live_sandbox'
                        }
                    });
                }
                apiKeyId = sandboxKey.id;
            }
        } else {
            if (!rawKey) {
                return res.status(401).json({
                    error: { message: 'Authentication required. Pass your FlowOps key in Authorization header or x-flowops-api-key header.' }
                });
            }

            const keyHash = hashApiKey(rawKey);
            apiKeyRecord = await prisma.apiKey.findUnique({
                where: { keyHash },
                include: { api: { include: { user: true } } }
            });

            if (!apiKeyRecord || apiKeyRecord.revoked) {
                return res.status(403).json({
                    error: { message: 'Invalid or revoked FlowOps API key.' }
                });
            }

            tier = apiKeyRecord.api.user.subscriptionTier || 'FREE';
            apiId = apiKeyRecord.apiId;
            apiKeyId = apiKeyRecord.id;
        }

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
        req.headers['x-openai-key'] = isMock ? 'mock-key' : process.env.OPENAI_API_KEY;
        req.headers['x-gemini-key'] = isMock ? 'mock-key' : process.env.GEMINI_API_KEY;
        req.headers['x-anthropic-key'] = isMock ? 'mock-key' : process.env.ANTHROPIC_API_KEY;

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

        logger.info(`SaaS Proxy Execution`, { 
            tier, 
            requestedModel, 
            provider: providerStr, 
            retries: retryCount, 
            fallbacks: fallbackChain 
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
                model: result.model || requestedModel
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
