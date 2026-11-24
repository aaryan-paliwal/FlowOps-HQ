const axios = require('axios');
const logger = require('../../utils/logger');
const { redis } = require('../../config/redis');
const { calculatePromptTokens } = require('./tokenCounter');
const {
    clampThreshold,
    isCacheEligible,
    lookupTwoTierCache,
    saveToTwoTierCache,
} = require('./cacheManager');

const DEFAULT_FALLBACK_MODELS = {
    gemini: 'gemini-3.5-flash',
    openai: 'gpt-4o-mini',
    anthropic: 'anthropic/claude-3-5-sonnet',
};

/**
 * Bounded Full Jitter exponential backoff delay (ms).
 */
function computeBackoffDelayMs(attempt) {
    const capMs = 8000;
    const baseMs = Math.min(1000 * Math.pow(2, attempt), capMs);
    return Math.max(100, Math.round(Math.random() * baseMs));
}

function extractGeminiText(parts = [], fallbackToAny = false) {
    if (!Array.isArray(parts) || parts.length === 0) return '';
    const nonThought = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
    if (nonThought || !fallbackToAny) return nonThought;
    return parts.find((p) => typeof p.text === 'string')?.text || '';
}

function buildProviderHeaders(providerStr, targetApiKey) {
    return {
        'Content-Type': 'application/json',
        ...(providerStr === 'openai' || (providerStr === 'openai-compatible' && targetApiKey)
            ? { Authorization: `Bearer ${targetApiKey}` }
            : {}),
        ...(providerStr === 'anthropic'
            ? { 'x-api-key': targetApiKey, 'anthropic-version': '2023-06-01' }
            : {}),
    };
}

function buildOpenAiStreamChunk({ id, created, model, delta, finishReason = null, usage = null }) {
    const payload = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
    };
    if (usage) payload.usage = usage;
    return `data: ${JSON.stringify(payload)}\n\n`;
}

// ─── 1. Provider Translators (Portkey Pattern) ───
// Translates standard OpenAI JSON (and SSE chunks) into specific Provider formats and back.

const translators = {
    openai: {
        getUrl: () => 'https://api.openai.com/v1/chat/completions',
        getStreamUrl: () => 'https://api.openai.com/v1/chat/completions',
        transformRequest: (body) => body,
        transformStreamRequest: (body) => ({
            ...body,
            stream: true,
            stream_options: { include_usage: true },
        }),
        transformResponse: (data) => data,
    },
    'openai-compatible': {
        getUrl: (_model, _apiKey, req) => {
            const base = (req?.headers?.['x-flowops-target-url'] || 'http://localhost:11434/v1').replace(/\/+$/, '');
            return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
        },
        getStreamUrl: (model, apiKey, req) => translators['openai-compatible'].getUrl(model, apiKey, req),
        transformRequest: (body) => body,
        transformStreamRequest: (body) => ({ ...body, stream: true }),
        transformResponse: (data) => data,
    },
    anthropic: {
        getUrl: () => 'https://api.anthropic.com/v1/messages',
        getStreamUrl: () => 'https://api.anthropic.com/v1/messages',
        transformRequest: (body) => {
            let systemPrompt = '';
            const messages = (body.messages || []).filter((m) => {
                if (m.role === 'system') {
                    systemPrompt += `${m.content} `;
                    return false;
                }
                return true;
            });

            return {
                model: (body.model || '').replace('anthropic/', ''),
                max_tokens: body.max_tokens || 1024,
                system: systemPrompt.trim() || undefined,
                messages,
            };
        },
        transformStreamRequest: (body) => ({
            ...translators.anthropic.transformRequest(body),
            stream: true,
        }),
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
                        content: data.content?.[0]?.text || '',
                    },
                    finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason,
                }],
                usage: {
                    prompt_tokens: data.usage?.input_tokens || 0,
                    completion_tokens: data.usage?.output_tokens || 0,
                    total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
                },
            };
        },
    },
    gemini: {
        getUrl: (model, apiKey) =>
            `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3.5-flash'}:generateContent?key=${apiKey}`,
        getStreamUrl: (model, apiKey) =>
            `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3.5-flash'}:streamGenerateContent?alt=sse&key=${apiKey}`,
        transformRequest: (body) => {
            const contents = (body.messages || [])
                .filter((m) => m.role !== 'system')
                .map((m) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content || '' }],
                }));

            const systemMsg = (body.messages || []).find((m) => m.role === 'system');
            const systemInstruction = systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined;

            const generationConfig = {};
            if (body.max_tokens !== undefined) generationConfig.maxOutputTokens = body.max_tokens;
            if (body.temperature !== undefined) generationConfig.temperature = body.temperature;

            return {
                contents,
                ...(systemInstruction ? { systemInstruction } : {}),
                ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
            };
        },
        transformStreamRequest: (body) => translators.gemini.transformRequest(body),
        transformResponse: (data, requestedModel) => {
            const contentText = extractGeminiText(data.candidates?.[0]?.content?.parts, true);

            return {
                id: `chatcmpl-gemini-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: requestedModel || 'gemini-3.5-flash',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: contentText,
                    },
                    finish_reason: 'stop',
                }],
                usage: {
                    prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
                    completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
                    total_tokens: data.usageMetadata?.totalTokenCount || 0,
                },
            };
        },
    },
};

async function enforceTpmRateLimit(req, promptTokens) {
    const identifier = req.headers?.['x-openai-key'] || req.ip || 'unknown';
    const rateLimitKey = `tpm_limit:${identifier}`;
    const currentTokens = await redis.get(rateLimitKey);
    const TPM_LIMIT = 50000;

    if (currentTokens && parseInt(currentTokens, 10) + promptTokens > TPM_LIMIT) {
        logger.warn('Rate Limit Exceeded: Token Budget Depleted');
        const err = new Error('Rate limit exceeded: Token budget depleted. Please upgrade your plan.');
        err.response = { status: 429 };
        throw err;
    }

    const multi = redis.multi();
    multi.incrby(rateLimitKey, promptTokens);
    if (!currentTokens) multi.expire(rateLimitKey, 60);
    await multi.exec();
}

function resolveTargetApiKey(req, providerStr) {
    return (
        req.headers?.[`x-${providerStr}-key`] ||
        (providerStr === 'openai-compatible' ? req.headers?.['x-custom-key'] : undefined)
    );
}

function maybeThrowSimulatedError(req, providerStr) {
    const simulateError = req.headers?.['x-flowops-simulate-error'];
    const simulateProvider = req.headers?.['x-flowops-simulate-provider'] || 'openai';
    if (simulateError && providerStr === simulateProvider) {
        logger.info(`[Simulation] Injecting simulated upstream error for ${providerStr}: ${simulateError}`);
        const err = new Error(`Simulated upstream provider failure (${simulateError})`);
        err.response = { status: parseInt(simulateError, 10) || 503 };
        throw err;
    }
}

function buildFallbackRequest(req, nextProvider) {
    const fallbackModel = DEFAULT_FALLBACK_MODELS[nextProvider] || req.body?.model;
    return {
        req: {
            headers: req.headers || {},
            ip: req.ip,
            flowopsApiId: req.flowopsApiId,
            flowopsSimilarityThreshold: req.flowopsSimilarityThreshold,
            body: {
                ...req.body,
                model: fallbackModel,
            },
        },
        fallbackModel,
    };
}

function writeSseHeaders(res, extraHeaders = {}) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    for (const [key, val] of Object.entries(extraHeaders)) {
        if (val !== undefined && val !== null) {
            res.setHeader(key, String(val));
        }
    }
    res.status(200);
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function replayResponseAsSseStream(res, cachedData, extraHeaders = {}) {
    writeSseHeaders(res, extraHeaders);
    const id = cachedData?.id || `chatcmpl-cache-${Date.now()}`;
    const created = cachedData?.created || Math.floor(Date.now() / 1000);
    const model = cachedData?.model || 'cached-model';
    const content = cachedData?.choices?.[0]?.message?.content || '';

    // Chunk cached response smoothly so client SSE consumers receive standard incremental frames
    const chunkSize = 24;
    res.write(buildOpenAiStreamChunk({ id, created, model, delta: { role: 'assistant', content: '' } }));
    for (let i = 0; i < content.length; i += chunkSize) {
        const piece = content.slice(i, i + chunkSize);
        res.write(buildOpenAiStreamChunk({ id, created, model, delta: { content: piece } }));
    }
    res.write(buildOpenAiStreamChunk({
        id,
        created,
        model,
        delta: {},
        finishReason: 'stop',
        usage: cachedData?.usage || undefined,
    }));
    res.write('data: [DONE]\n\n');
    res.end();
}

function parseProviderStreamLine({ rawLine, providerStr, streamId, created, model, state }) {
    const trimmed = rawLine.trim();
    if (!trimmed || !trimmed.startsWith('data:')) return null;
    const payloadStr = trimmed.slice(5).trim();
    if (!payloadStr || payloadStr === '[DONE]') return { done: payloadStr === '[DONE]', chunk: null };

    let parsed;
    try {
        parsed = JSON.parse(payloadStr);
    } catch {
        return null;
    }

    if (providerStr === 'openai' || providerStr === 'openai-compatible') {
        const deltaText = parsed.choices?.[0]?.delta?.content;
        if (typeof deltaText === 'string') state.fullText += deltaText;
        if (parsed.usage) {
            state.promptTokens = parsed.usage.prompt_tokens ?? state.promptTokens;
            state.completionTokens = parsed.usage.completion_tokens ?? state.completionTokens;
        }
        const normalized = {
            id: parsed.id || streamId,
            object: 'chat.completion.chunk',
            created: parsed.created || created,
            model: parsed.model || model,
            choices: parsed.choices || [{ index: 0, delta: {}, finish_reason: null }],
            ...(parsed.usage ? { usage: parsed.usage } : {}),
        };
        return { done: false, chunk: `data: ${JSON.stringify(normalized)}\n\n` };
    }

    if (providerStr === 'gemini') {
        const text = extractGeminiText(parsed.candidates?.[0]?.content?.parts, false);
        const finishRaw = parsed.candidates?.[0]?.finishReason;
        if (parsed.usageMetadata) {
            state.promptTokens = parsed.usageMetadata.promptTokenCount ?? state.promptTokens;
            state.completionTokens = parsed.usageMetadata.candidatesTokenCount ?? state.completionTokens;
        }
        let chunk = '';
        if (!state.sentRole) {
            state.sentRole = true;
            chunk += buildOpenAiStreamChunk({ id: streamId, created, model, delta: { role: 'assistant', content: text } });
            if (text) state.fullText += text;
        } else if (text) {
            state.fullText += text;
            chunk += buildOpenAiStreamChunk({ id: streamId, created, model, delta: { content: text } });
        }
        if (finishRaw) {
            chunk += buildOpenAiStreamChunk({
                id: streamId,
                created,
                model,
                delta: {},
                finishReason: finishRaw === 'STOP' ? 'stop' : String(finishRaw).toLowerCase(),
                ...(parsed.usageMetadata
                    ? {
                        usage: {
                            prompt_tokens: state.promptTokens,
                            completion_tokens: state.completionTokens,
                            total_tokens: state.promptTokens + state.completionTokens,
                        },
                    }
                    : {}),
            });
        }
        return { done: false, chunk: chunk || null };
    }

    if (providerStr === 'anthropic') {
        if (parsed.type === 'message_start') {
            state.promptTokens = parsed.message?.usage?.input_tokens ?? state.promptTokens;
            if (!state.sentRole) {
                state.sentRole = true;
                return { done: false, chunk: buildOpenAiStreamChunk({ id: streamId, created, model, delta: { role: 'assistant', content: '' } }) };
            }
        } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            const text = parsed.delta.text || '';
            state.fullText += text;
            return { done: false, chunk: buildOpenAiStreamChunk({ id: streamId, created, model, delta: { content: text } }) };
        } else if (parsed.type === 'message_delta') {
            if (parsed.usage?.output_tokens !== undefined) {
                state.completionTokens = parsed.usage.output_tokens;
            }
            const stop = parsed.delta?.stop_reason === 'end_turn' ? 'stop' : (parsed.delta?.stop_reason || 'stop');
            return {
                done: false,
                chunk: buildOpenAiStreamChunk({
                    id: streamId,
                    created,
                    model,
                    delta: {},
                    finishReason: stop,
                    usage: {
                        prompt_tokens: state.promptTokens,
                        completion_tokens: state.completionTokens,
                        total_tokens: state.promptTokens + state.completionTokens,
                    },
                }),
            };
        } else if (parsed.type === 'message_stop') {
            return { done: true, chunk: null };
        }
    }

    return null;
}

// ─── 2. Universal Non-Streaming Proxy Engine (2-Tier Cache + Jittered Retry + Failover) ───
async function executeAiProxy(
    req,
    providerStr,
    fallbackProviders = [],
    retryCount = 2,
    attempt = 0,
    meta = { retryAttempts: 0, failoverUsed: false, failoverFrom: null }
) {
    const provider = translators[providerStr];
    if (!provider) throw new Error(`Unsupported AI Provider: ${providerStr}`);

    const promptTokens = calculatePromptTokens(req.body.messages);
    const apiId = req.flowopsApiId || null;
    const temperature = req.body.temperature !== undefined && req.body.temperature !== null ? Number(req.body.temperature) : 0;
    const similarityThreshold = clampThreshold(req.headers?.['x-flowops-cache-threshold'] ?? req.flowopsSimilarityThreshold);
    const elig = isCacheEligible(req.body, req.headers);

    if (attempt === 0) {
        await enforceTpmRateLimit(req, promptTokens);

        if (!meta.failoverUsed && elig.eligible && !elig.forceRefresh) {
            const cached = await lookupTwoTierCache({
                model: req.body.model || providerStr,
                temperature,
                messages: req.body.messages || [],
                apiId,
                similarityThreshold,
            });
            if (cached.hit) {
                logger.info('Cache HIT - Serving from Two-Tier Cache', {
                    tier: cached.tier,
                    similarity: cached.similarity,
                    tokensSaved: promptTokens,
                });
                return {
                    status: 200,
                    data: cached.data,
                    cached: true,
                    cacheTier: cached.tier,
                    cacheSimilarity: cached.similarity,
                    matchedPrompt: cached.promptText,
                    cacheBypassReason: null,
                    provider: providerStr,
                    model: req.body.model,
                    retryAttempts: meta.retryAttempts || 0,
                    failoverUsed: Boolean(meta.failoverUsed),
                    failoverFrom: meta.failoverFrom || null,
                };
            }
        }
    }

    const transformedBody = provider.transformRequest(req.body);
    const targetApiKey = resolveTargetApiKey(req, providerStr);
    const headers = buildProviderHeaders(providerStr, targetApiKey);

    try {
        maybeThrowSimulatedError(req, providerStr);

        const targetUrl = provider.getUrl(req.body.model, targetApiKey, req);
        const response = await axios.post(targetUrl, transformedBody, { headers, timeout: 30000 });
        const responseData = provider.transformResponse(response.data, req.body.model);

        if (elig.eligible) {
            await saveToTwoTierCache({
                model: req.body.model || providerStr,
                temperature,
                messages: req.body.messages || [],
                responseData,
                apiId,
                ttlSeconds: 3600,
            });
        }

        return {
            status: 200,
            data: responseData,
            cached: false,
            cacheTier: null,
            cacheSimilarity: null,
            cacheBypassReason: elig.eligible ? (elig.forceRefresh ? 'Cache force-refreshed via header' : null) : elig.reason,
            provider: providerStr,
            model: req.body.model,
            retryAttempts: meta.retryAttempts || 0,
            failoverUsed: Boolean(meta.failoverUsed),
            failoverFrom: meta.failoverFrom || null,
        };
    } catch (error) {
        const statusCode = error.response?.status || 500;
        logger.error(`[Attempt ${attempt}/${retryCount}] ${providerStr.toUpperCase()} execution failed with status ${statusCode}: ${error.message}`);

        if (attempt < retryCount && (statusCode === 429 || statusCode >= 500)) {
            const delayMs = computeBackoffDelayMs(attempt);
            const nextMeta = { ...meta, retryAttempts: (meta.retryAttempts || 0) + 1 };
            logger.info(`Retrying ${providerStr.toUpperCase()} (attempt ${attempt + 1}/${retryCount}) in ${delayMs}ms (full jitter)...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return await executeAiProxy(req, providerStr, fallbackProviders, retryCount, attempt + 1, nextMeta);
        }

        if (fallbackProviders && fallbackProviders.length > 0) {
            const [nextProvider, ...remainingFallbacks] = fallbackProviders;
            const { req: fallbackReq, fallbackModel } = buildFallbackRequest(req, nextProvider);
            const nextMeta = {
                retryAttempts: meta.retryAttempts || 0,
                failoverUsed: true,
                failoverFrom: meta.failoverFrom || providerStr,
            };

            logger.warn(`Resilience Fallback initiated: Switching from ${providerStr.toUpperCase()} to ${nextProvider.toUpperCase()} using model: ${fallbackModel}`);
            return await executeAiProxy(fallbackReq, nextProvider, remainingFallbacks, retryCount, 0, nextMeta);
        }

        throw error;
    }
}

// ─── 3. Universal SSE Streaming Proxy Engine ───
async function executeStreamingAiProxy(
    req,
    res,
    providerStr,
    fallbackProviders = [],
    retryCount = 2,
    attempt = 0,
    meta = { retryAttempts: 0, failoverUsed: false, failoverFrom: null },
    extraHeaders = {}
) {
    const provider = translators[providerStr];
    if (!provider) throw new Error(`Unsupported AI Provider: ${providerStr}`);

    const promptTokens = calculatePromptTokens(req.body.messages);
    const apiId = req.flowopsApiId || null;
    const temperature = req.body.temperature !== undefined && req.body.temperature !== null ? Number(req.body.temperature) : 0;
    const similarityThreshold = clampThreshold(req.headers?.['x-flowops-cache-threshold'] ?? req.flowopsSimilarityThreshold);
    const elig = isCacheEligible(req.body, req.headers);

    if (attempt === 0) {
        await enforceTpmRateLimit(req, promptTokens);

        if (!meta.failoverUsed && elig.eligible && !elig.forceRefresh) {
            const cached = await lookupTwoTierCache({
                model: req.body.model || providerStr,
                temperature,
                messages: req.body.messages || [],
                apiId,
                similarityThreshold,
            });
            if (cached.hit) {
                replayResponseAsSseStream(res, cached.data, {
                    ...extraHeaders,
                    'x-flowops-cache': 'HIT',
                    'x-flowops-cache-tier': cached.tier,
                    'x-flowops-cache-similarity': Number(cached.similarity || 1).toFixed(4),
                    'x-flowops-streaming': 'true',
                    'x-flowops-provider': providerStr,
                    'x-flowops-model-selected': req.body.model,
                    'x-flowops-retry-count': meta.retryAttempts || 0,
                    'x-flowops-fallback-used': Boolean(meta.failoverUsed),
                });
                return {
                    status: 200,
                    cached: true,
                    cacheTier: cached.tier,
                    cacheSimilarity: cached.similarity,
                    streaming: true,
                    provider: providerStr,
                    model: req.body.model,
                    promptTokens: cached.data?.usage?.prompt_tokens || promptTokens,
                    completionTokens: cached.data?.usage?.completion_tokens || 0,
                    retryAttempts: meta.retryAttempts || 0,
                    failoverUsed: Boolean(meta.failoverUsed),
                    failoverFrom: meta.failoverFrom || null,
                };
            }
        }
    }

    const targetApiKey = resolveTargetApiKey(req, providerStr);
    const headers = buildProviderHeaders(providerStr, targetApiKey);
    const streamBody = provider.transformStreamRequest(req.body);
    const streamUrl = provider.getStreamUrl(req.body.model, targetApiKey, req);
    const abortController = new AbortController();
    const onClose = () => abortController.abort();
    if (typeof req.on === 'function') req.on('close', onClose);

    try {
        maybeThrowSimulatedError(req, providerStr);

        const upstream = await axios.post(streamUrl, streamBody, {
            headers,
            responseType: 'stream',
            timeout: 45000,
            signal: abortController.signal,
        });

        writeSseHeaders(res, {
            ...extraHeaders,
            ...(elig.eligible ? {} : { 'x-flowops-cache-reason': elig.reason }),
            'x-flowops-streaming': 'true',
            'x-flowops-provider': providerStr,
            'x-flowops-model-selected': req.body.model,
            'x-flowops-retry-count': meta.retryAttempts || 0,
            'x-flowops-fallback-used': Boolean(meta.failoverUsed),
            ...(meta.failoverFrom ? { 'x-flowops-failover-from': meta.failoverFrom } : {}),
        });

        const streamId = `chatcmpl-stream-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);
        const state = {
            fullText: '',
            promptTokens,
            completionTokens: 0,
            sentRole: false,
            doneSent: false,
        };

        await new Promise((resolve, reject) => {
            let lineBuffer = '';
            upstream.data.on('data', (rawChunk) => {
                lineBuffer += rawChunk.toString('utf8');
                const lines = lineBuffer.split(/\r?\n/);
                lineBuffer = lines.pop() || '';
                for (const line of lines) {
                    const out = parseProviderStreamLine({
                        rawLine: line,
                        providerStr,
                        streamId,
                        created,
                        model: req.body.model,
                        state,
                    });
                    if (!out) continue;
                    if (out.chunk && !res.writableEnded) res.write(out.chunk);
                    if (out.done && !state.doneSent && !res.writableEnded) {
                        state.doneSent = true;
                        res.write('data: [DONE]\n\n');
                    }
                }
            });

            upstream.data.on('end', () => {
                if (lineBuffer.trim()) {
                    const out = parseProviderStreamLine({
                        rawLine: lineBuffer,
                        providerStr,
                        streamId,
                        created,
                        model: req.body.model,
                        state,
                    });
                    if (out?.chunk && !res.writableEnded) res.write(out.chunk);
                }
                if (!state.doneSent && !res.writableEnded) {
                    state.doneSent = true;
                    res.write('data: [DONE]\n\n');
                }
                if (!res.writableEnded) res.end();
                resolve();
            });

            upstream.data.on('error', (err) => {
                if (!res.writableEnded) res.end();
                reject(err);
            });
        });

        const estimatedCompletionTokens = state.completionTokens || calculatePromptTokens([{ content: state.fullText }]);
        const synthesizedResponse = {
            id: streamId,
            object: 'chat.completion',
            created,
            model: req.body.model,
            choices: [{
                index: 0,
                message: { role: 'assistant', content: state.fullText },
                finish_reason: 'stop',
            }],
            usage: {
                prompt_tokens: state.promptTokens,
                completion_tokens: estimatedCompletionTokens,
                total_tokens: state.promptTokens + estimatedCompletionTokens,
            },
        };

        if (elig.eligible && state.fullText) {
            saveToTwoTierCache({
                model: req.body.model || providerStr,
                temperature,
                messages: req.body.messages || [],
                responseData: synthesizedResponse,
                apiId,
                ttlSeconds: 3600,
            }).catch((err) => logger.warn('[Stream Cache Save Error]', { error: err.message }));
        }

        return {
            status: 200,
            cached: false,
            cacheTier: null,
            streaming: true,
            provider: providerStr,
            model: req.body.model,
            promptTokens: state.promptTokens,
            completionTokens: estimatedCompletionTokens,
            retryAttempts: meta.retryAttempts || 0,
            failoverUsed: Boolean(meta.failoverUsed),
            failoverFrom: meta.failoverFrom || null,
        };
    } catch (error) {
        if (typeof req.off === 'function') req.off('close', onClose);
        const statusCode = error.response?.status || 500;
        logger.error(`[Stream Attempt ${attempt}/${retryCount}] ${providerStr.toUpperCase()} failed with status ${statusCode}: ${error.message}`);

        if (attempt < retryCount && (statusCode === 429 || statusCode >= 500)) {
            const delayMs = computeBackoffDelayMs(attempt);
            const nextMeta = { ...meta, retryAttempts: (meta.retryAttempts || 0) + 1 };
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return await executeStreamingAiProxy(req, res, providerStr, fallbackProviders, retryCount, attempt + 1, nextMeta, extraHeaders);
        }

        if (fallbackProviders && fallbackProviders.length > 0) {
            const [nextProvider, ...remainingFallbacks] = fallbackProviders;
            const { req: fallbackReq } = buildFallbackRequest(req, nextProvider);
            const nextMeta = {
                retryAttempts: meta.retryAttempts || 0,
                failoverUsed: true,
                failoverFrom: meta.failoverFrom || providerStr,
            };
            return await executeStreamingAiProxy(fallbackReq, res, nextProvider, remainingFallbacks, retryCount, 0, nextMeta, extraHeaders);
        }

        throw error;
    } finally {
        if (typeof req.off === 'function') req.off('close', onClose);
    }
}

module.exports = {
    executeAiProxy,
    executeStreamingAiProxy,
    replayResponseAsSseStream,
    parseProviderStreamLine,
    computeBackoffDelayMs,
    translators,
};
