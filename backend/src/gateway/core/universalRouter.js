const axios = require('axios');
const logger = require('../../utils/logger');
const { redis } = require('../../config/redis');
const { calculatePromptTokens } = require('./tokenCounter');

// ─── 1. Provider Translators (Portkey Clone) ───
// Translates standard OpenAI JSON into specific Provider JSON

const translators = {
    openai: {
        getUrl: (model) => 'https://api.openai.com/v1/chat/completions',
        transformRequest: (body) => body,
        transformResponse: (data) => data
    },
    anthropic: {
        getUrl: (model) => 'https://api.anthropic.com/v1/messages',
        transformRequest: (body) => {
            let systemPrompt = '';
            const messages = body.messages.filter(m => {
                if (m.role === 'system') {
                    systemPrompt += m.content + ' ';
                    return false;
                }
                return true;
            });

            return {
                model: body.model.replace('anthropic/', ''),
                max_tokens: body.max_tokens || 1024,
                system: systemPrompt.trim() || undefined,
                messages: messages
            };
        },
        transformResponse: (data) => {
            return {
                id: data.id,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: data.model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: data.content?.[0]?.text || ''
                    },
                    finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason
                }],
                usage: {
                    prompt_tokens: data.usage?.input_tokens || 0,
                    completion_tokens: data.usage?.output_tokens || 0,
                    total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
                }
            };
        }
    },
    gemini: {
        getUrl: (model, apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`,
        transformRequest: (body) => {
            // Map messages to Gemini's format: {"role": "user"|"model", "parts": [{"text": "..."}]}
            const contents = body.messages
                .filter(m => m.role !== 'system') // Gemini handles system prompts separately
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content || '' }]
                }));

            // Extract system instruction if it exists
            const systemMsg = body.messages.find(m => m.role === 'system');
            const systemInstruction = systemMsg ? {
                parts: [{ text: systemMsg.content }]
            } : undefined;

            return {
                contents,
                systemInstruction
            };
        },
        transformResponse: (data) => {
            return {
                id: `chatcmpl-gemini-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gemini-1.5-flash',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: data.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
                    completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: data.usageMetadata?.totalTokenCount || 0
                }
            };
        }
    }
};

// ─── 2. Universal Proxy Engine with Caching & Fallbacks ───
async function executeAiProxy(req, providerStr, fallbackProviders = [], retryCount = 2, attempt = 0) {
    const provider = translators[providerStr];
    if (!provider) throw new Error(`Unsupported AI Provider: ${providerStr}`);

    const promptTokens = calculatePromptTokens(req.body.messages);

    // Only apply rate limiting and cache lookups on the first attempt of the execution pipeline
    if (attempt === 0) {
        // --- 1. Token Analytics & Rate Limiting (TPM) ---
        const identifier = req.headers['x-openai-key'] || req.ip;
        const rateLimitKey = `tpm_limit:${identifier}`;
        
        const currentTokens = await redis.get(rateLimitKey);
        const TPM_LIMIT = 50000; // 50k Tokens Per Minute hard limit

        if (currentTokens && parseInt(currentTokens) + promptTokens > TPM_LIMIT) {
            logger.warn('Rate Limit Exceeded: Token Budget Depleted');
            const err = new Error('Rate limit exceeded: Token budget depleted. Please upgrade your plan.');
            err.response = { status: 429 };
            throw err;
        }

        // --- 2. Semantic Caching Layer (Redis) ---
        const cacheKey = `prompt_cache:${Buffer.from(JSON.stringify(req.body.messages || [])).toString('base64')}`;
        if (req.headers['x-flowops-cache'] !== 'false') {
            const cachedResponse = await redis.get(cacheKey);
            if (cachedResponse) {
                logger.info('Cache HIT - Serving from Edge', { tokensSaved: promptTokens });
                return { 
                    status: 200, 
                    data: JSON.parse(cachedResponse), 
                    cached: true, 
                    provider: providerStr, 
                    model: req.body.model 
                };
            }
        }

        // Deduct tokens from budget before forwarding
        const multi = redis.multi();
        multi.incrby(rateLimitKey, promptTokens);
        if (!currentTokens) multi.expire(rateLimitKey, 60); // Reset window every 60s
        await multi.exec();
    }

    // --- 3. Request Translation ---
    const transformedBody = provider.transformRequest(req.body);
    const targetApiKey = req.headers[`x-${providerStr}-key`];

    const headers = {
        'Content-Type': 'application/json',
        ...(providerStr === 'openai' ? { 'Authorization': `Bearer ${targetApiKey}` } : {}),
        ...(providerStr === 'anthropic' ? { 'x-api-key': targetApiKey, 'anthropic-version': '2023-06-01' } : {})
    };

    const cacheKey = `prompt_cache:${Buffer.from(JSON.stringify(req.body.messages || [])).toString('base64')}`;

    // --- 4. Execution & Fallback Logic ---
    try {
        let responseData;
        
        // Dynamic Simulation Header for Offline Resilience Testing
        const simulateError = req.headers['x-flowops-simulate-error'];
        if (simulateError && providerStr === 'openai') {
            logger.info(`[Simulation] Injecting simulated upstream error code for OpenAI: ${simulateError}`);
            const err = new Error(`Simulated upstream provider failure (${simulateError})`);
            err.response = { status: parseInt(simulateError, 10) };
            throw err;
        }

        if (targetApiKey === 'mock-key') {
            // Mock response to test Caching & Limits without real billing
            logger.info(`[Mock] Simulating mock execution for provider: ${providerStr}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulating latency
            responseData = {
                id: `chatcmpl-mock-${providerStr}-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: transformedBody.model || 'mock-model',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: `Hello! I am a resilient simulated response from FlowOps Gateway via ${providerStr.toUpperCase()}.`
                    },
                    finish_reason: 'stop'
                }],
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: 15,
                    total_tokens: promptTokens + 15
                }
            };
        } else {
            const targetUrl = provider.getUrl(req.body.model, targetApiKey);
            const response = await axios.post(targetUrl, transformedBody, { headers, timeout: 30000 });
            responseData = provider.transformResponse(response.data);
        }

        // Save to Redis Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(responseData));

        return { 
            status: 200, 
            data: responseData, 
            cached: false, 
            provider: providerStr, 
            model: req.body.model 
        };

    } catch (error) {
        const statusCode = error.response?.status || 500;
        logger.error(`[Attempt ${attempt}/${retryCount}] ${providerStr.toUpperCase()} execution failed with status ${statusCode}: ${error.message}`);

        // Try to retry transient errors (429 Rate Limits or 5xx Server Errors)
        if (attempt < retryCount && (statusCode === 429 || statusCode >= 500)) {
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000); // Exp backoff max 8s
            logger.info(`Retrying ${providerStr.toUpperCase()} (attempt ${attempt + 1}/${retryCount}) in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return await executeAiProxy(req, providerStr, fallbackProviders, retryCount, attempt + 1);
        }

        // Auto-Fallback Routing across providers if current provider is fully exhausted
        if (fallbackProviders && fallbackProviders.length > 0) {
            const nextProvider = fallbackProviders[0];
            const remainingFallbacks = fallbackProviders.slice(1);
            
            // Resolve fallback model
            let fallbackModel = req.body.model;
            if (nextProvider === 'gemini') fallbackModel = 'gemini-1.5-flash';
            else if (nextProvider === 'openai') fallbackModel = 'gpt-4o-mini';
            else if (nextProvider === 'anthropic') fallbackModel = 'anthropic/claude-3-5-sonnet';

            const fallbackReq = {
                headers: req.headers || {},
                ip: req.ip,
                body: {
                    ...req.body,
                    model: fallbackModel
                }
            };

            logger.warn(`Resilience Fallback initiated: Switching from ${providerStr.toUpperCase()} to ${nextProvider.toUpperCase()} using model: ${fallbackModel}`);
            return await executeAiProxy(fallbackReq, nextProvider, remainingFallbacks, retryCount, 0);
        }

        throw error;
    }
}

module.exports = { executeAiProxy };
