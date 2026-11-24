jest.mock('axios');
const axios = require('axios');

jest.mock('../../config/redis', () => ({
    redis: {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        ping: jest.fn().mockResolvedValue('PONG'),
        multi: jest.fn().mockReturnValue({
            incrby: jest.fn().mockReturnThis(),
            expire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
        }),
    },
}));

jest.mock('./cacheManager', () => ({
    clampThreshold: (threshold) => {
        const parsed = Number(threshold);
        if (!Number.isFinite(parsed)) return 0.88;
        return Math.min(0.99, Math.max(0.70, parsed));
    },
    isCacheEligible: (reqBody = {}, headers = {}) => {
        if (headers['x-flowops-cache'] === 'false') {
            return { eligible: false, reason: 'Cache explicitly disabled via x-flowops-cache header' };
        }
        const temp = reqBody.temperature !== undefined && reqBody.temperature !== null ? Number(reqBody.temperature) : 0;
        if (temp > 0) {
            return { eligible: false, reason: `Temperature > 0 (${temp}). Non-deterministic requests bypass cache.` };
        }
        if (reqBody.tools && Array.isArray(reqBody.tools) && reqBody.tools.length > 0) {
            return { eligible: false, reason: 'Request uses tools. Dynamic agentic requests bypass cache.' };
        }
        if (reqBody.functions && Array.isArray(reqBody.functions) && reqBody.functions.length > 0) {
            return { eligible: false, reason: 'Request uses functions. Dynamic agentic requests bypass cache.' };
        }
        if (reqBody.tool_choice && reqBody.tool_choice !== 'none') {
            return { eligible: false, reason: 'Request specifies tool_choice.' };
        }
        if (headers['x-flowops-cache-force-refresh'] === 'true') {
            return { eligible: true, forceRefresh: true };
        }
        return { eligible: true };
    },
    lookupTwoTierCache: jest.fn().mockResolvedValue({ hit: false, tier: null }),
    saveToTwoTierCache: jest.fn().mockResolvedValue(undefined),
}));

const cacheManager = require('./cacheManager');
const { classifyPrompt } = require('./smartClassifier');
const {
    executeAiProxy,
    replayResponseAsSseStream,
    parseProviderStreamLine,
    computeBackoffDelayMs,
    translators,
} = require('./universalRouter');

describe('Feature 1: Universal Gateway & Smart Classifier', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Smart Classifier', () => {
        it('routes simple short prompt to fast tier', () => {
            const res = classifyPrompt([{ role: 'user', content: 'Say hello in two words' }], {
                strategy: 'cost-optimized',
                availableProviders: { openai: 'sk-test', gemini: 'AIza-test' },
            });
            expect(res.tier).toBe('fast');
            expect(res.selectedModel).toBe('gemini-3.5-flash');
        });

        it('routes code prompt to reasoning tier when flagship key exists', () => {
            const res = classifyPrompt(
                [{ role: 'user', content: '```python\ndef binary_search(arr, x):\n  pass\n```' }],
                {
                    strategy: 'cost-optimized',
                    availableProviders: { openai: 'sk-test', gemini: 'AIza-test' },
                }
            );
            expect(res.tier).toBe('reasoning');
            expect(res.selectedModel).toBe('gpt-4o');
            expect(res.reason).toContain('code syntax');
        });

        it('gracefully falls back to Gemini when only Gemini key is configured for reasoning queries', () => {
            const res = classifyPrompt(
                [{ role: 'user', content: 'Please analyze and evaluate trade-offs of microservices.' }],
                {
                    strategy: 'cost-optimized',
                    availableProviders: { gemini: 'AIza-test' },
                }
            );
            expect(res.tier).toBe('reasoning');
            expect(res.selectedModel).toBe('gemini-3.5-flash');
        });

        it('respects quality-optimized strategy override', () => {
            const res = classifyPrompt([{ role: 'user', content: 'Hi' }], {
                strategy: 'quality-optimized',
                availableProviders: { openai: 'sk-test', gemini: 'AIza-test' },
            });
            expect(res.tier).toBe('reasoning');
            expect(res.selectedModel).toBe('gpt-4o');
        });
    });

    describe('Universal Adapters (Portkey Pattern)', () => {
        it('translates OpenAI chat format to Gemini format and back', () => {
            const reqBody = {
                model: 'gemini-3.5-flash',
                temperature: 0,
                max_tokens: 150,
                messages: [
                    { role: 'system', content: 'Be concise.' },
                    { role: 'user', content: 'Explain REST' },
                ],
            };

            const geminiPayload = translators.gemini.transformRequest(reqBody);
            expect(geminiPayload.systemInstruction.parts[0].text).toBe('Be concise.');
            expect(geminiPayload.contents).toEqual([{ role: 'user', parts: [{ text: 'Explain REST' }] }]);
            expect(geminiPayload.generationConfig).toEqual({ maxOutputTokens: 150, temperature: 0 });

            const normalized = translators.gemini.transformResponse(
                {
                    candidates: [{ content: { parts: [{ text: 'REST uses HTTP verbs.' }] } }],
                    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
                },
                'gemini-3.5-flash'
            );

            expect(normalized.object).toBe('chat.completion');
            expect(normalized.model).toBe('gemini-3.5-flash');
            expect(normalized.choices[0].message.content).toBe('REST uses HTTP verbs.');
            expect(normalized.usage.total_tokens).toBe(15);
        });

        it('translates OpenAI chat format to Anthropic format and back', () => {
            const anthropicPayload = translators.anthropic.transformRequest({
                model: 'anthropic/claude-3-5-sonnet',
                max_tokens: 200,
                messages: [
                    { role: 'system', content: 'Expert engineer' },
                    { role: 'user', content: 'Hello' },
                ],
            });
            expect(anthropicPayload.model).toBe('claude-3-5-sonnet');
            expect(anthropicPayload.system).toBe('Expert engineer');
            expect(anthropicPayload.messages).toHaveLength(1);

            const normalized = translators.anthropic.transformResponse({
                id: 'msg_123',
                model: 'claude-3-5-sonnet',
                content: [{ text: 'Hello there!' }],
                stop_reason: 'end_turn',
                usage: { input_tokens: 8, output_tokens: 4 },
            });
            expect(normalized.choices[0].message.content).toBe('Hello there!');
            expect(normalized.usage.total_tokens).toBe(12);
        });

        it('resolves custom OpenAI-compatible target URLs for open-source models (Ollama/Groq/vLLM)', () => {
            const url = translators['openai-compatible'].getUrl('llama3', null, {
                headers: { 'x-flowops-target-url': 'https://api.groq.com/openai/v1/' },
            });
            expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
        });
    });

    describe('BYOK & Simulated Failover', () => {
        it('forwards BYOK key header for custom OpenAI-compatible open-source providers', async () => {
            axios.post.mockResolvedValueOnce({
                data: {
                    id: 'chatcmpl-groq-1',
                    object: 'chat.completion',
                    model: 'llama3-8b-8192',
                    choices: [{ index: 0, message: { role: 'assistant', content: 'Groq OK' }, finish_reason: 'stop' }],
                    usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
                },
            });

            const req = {
                ip: '127.0.0.1',
                headers: {
                    'x-flowops-target-url': 'https://api.groq.com/openai/v1',
                    'x-custom-key': 'gsk_user_paid_key',
                },
                body: {
                    model: 'llama3-8b-8192',
                    messages: [{ role: 'user', content: 'Test' }],
                },
            };

            const result = await executeAiProxy(req, 'openai-compatible', [], 0, 0);
            expect(result.status).toBe(200);
            expect(result.data.choices[0].message.content).toBe('Groq OK');
            expect(axios.post).toHaveBeenCalledWith(
                'https://api.groq.com/openai/v1/chat/completions',
                req.body,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer gsk_user_paid_key',
                    }),
                })
            );
        });

        it('automatically fails over from simulated OpenAI 503 outage to Gemini', async () => {
            axios.post.mockResolvedValueOnce({
                data: {
                    candidates: [{ content: { parts: [{ text: 'Saved by Gemini failover!' }] } }],
                    usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5, totalTokenCount: 9 },
                },
            });

            const req = {
                ip: '127.0.0.1',
                headers: {
                    'x-openai-key': 'sk-mock',
                    'x-gemini-key': 'AIza-real',
                    'x-flowops-simulate-error': '503',
                },
                body: {
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: 'Critical prod query' }],
                },
            };

            const result = await executeAiProxy(req, 'openai', ['gemini'], 0, 0);
            expect(result.status).toBe(200);
            expect(result.provider).toBe('gemini');
            expect(result.model).toBe('gemini-3.5-flash');
            expect(result.data.choices[0].message.content).toBe('Saved by Gemini failover!');
        });
    });

    describe('SSRF URL Validator & Routing Config Schema', () => {
        const { validateTargetUrl } = require('./urlValidator');
        const { createApiSchema, updateApiSchema } = require('../../modules/apis/apis.schema');

        it('blocks cloud metadata, private IPv4/IPv6 ranges, internal domains, and non-HTTP protocols', () => {
            const blockedUrls = [
                'http://169.254.169.254/latest/meta-data/',
                'http://10.0.0.1/v1',
                'http://172.16.0.5/v1',
                'http://192.168.1.25/v1',
                'file:///etc/passwd',
                'ftp://files.example.com/model',
                'https://metadata.google.internal/computeMetadata/v1/',
                'http://internal-llm.local/v1',
                'http://[::ffff:169.254.169.254]/v1',
                'http://[fe80::1]/v1',
                'http://redis:6379/',
                'https://user:pass@api.openai.com/v1',
            ];

            for (const url of blockedUrls) {
                const result = validateTargetUrl(url);
                expect(result.valid).toBe(false);
            }
        });

        it('allows trusted HTTPS AI endpoints and dev loopback unless allowLocal is false', () => {
            expect(validateTargetUrl('https://api.openai.com/v1').valid).toBe(true);
            expect(validateTargetUrl('https://api.groq.com/openai/v1').valid).toBe(true);
            expect(validateTargetUrl('http://localhost:11434/v1').valid).toBe(true);
            expect(validateTargetUrl('http://127.0.0.1:8080/v1').valid).toBe(true);
            expect(validateTargetUrl('http://localhost:11434/v1', { allowLocal: false }).valid).toBe(false);
        });

        it('validates retryCount (including 0) and loadBalancingWeights in apis schemas', () => {
            const createOk = createApiSchema.safeParse({
                name: 'Prod Gateway',
                baseUrl: 'https://api.openai.com/v1',
                slug: 'prod-gateway',
                retryCount: 0,
                fallbackProviders: 'gemini,anthropic',
                loadBalancingWeights: { openai: 50, gemini: 30, anthropic: 20 },
            });
            expect(createOk.success).toBe(true);
            expect(createOk.data.retryCount).toBe(0);
            expect(createOk.data.loadBalancingWeights).toBe('{"openai":50,"gemini":30,"anthropic":20}');

            expect(updateApiSchema.safeParse({ retryCount: 6 }).success).toBe(false);
            expect(updateApiSchema.safeParse({ loadBalancingWeights: '{"openai":-10}' }).success).toBe(false);
            expect(updateApiSchema.safeParse({ fallbackProviders: 'gemini,anthropic', retryCount: 3 }).success).toBe(true);
            expect(updateApiSchema.safeParse({ slackWebhookUrl: 'http://localhost:8080/hook' }).success).toBe(false);
            expect(updateApiSchema.safeParse({ slackWebhookUrl: 'http://169.254.169.254/latest' }).success).toBe(false);
            expect(updateApiSchema.safeParse({ slackWebhookUrl: 'https://hooks.slack.com/services/T00/B00/XXX' }).success).toBe(true);
        });
    });

    describe('Features 2, 3, & 4: Two-Tier Cache, Universal SSE Streaming, & Full Jitter Telemetry', () => {
        it('returns Two-Tier semantic cache hit telemetry without hitting upstream provider', async () => {
            cacheManager.lookupTwoTierCache.mockResolvedValueOnce({
                hit: true,
                tier: 'semantic',
                similarity: 0.94,
                promptText: 'What is photosynthesis?',
                data: {
                    id: 'chatcmpl-cached-1',
                    object: 'chat.completion',
                    model: 'gemini-3.5-flash',
                    choices: [{ index: 0, message: { role: 'assistant', content: 'Cached plant answer' }, finish_reason: 'stop' }],
                    usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
                },
            });

            const req = {
                ip: '127.0.0.1',
                flowopsApiId: 'api-123',
                headers: { 'x-gemini-key': 'AIza-real' },
                body: {
                    model: 'gemini-3.5-flash',
                    temperature: 0,
                    messages: [{ role: 'user', content: 'Explain how photosynthesis works' }],
                },
            };

            const result = await executeAiProxy(req, 'gemini', [], 0, 0);
            expect(result.cached).toBe(true);
            expect(result.cacheTier).toBe('semantic');
            expect(result.cacheSimilarity).toBe(0.94);
            expect(result.data.choices[0].message.content).toBe('Cached plant answer');
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('bypasses cache lookup on x-flowops-cache-force-refresh: true and saves fresh response', async () => {
            axios.post.mockResolvedValueOnce({
                data: {
                    candidates: [{ content: { parts: [{ text: 'Fresh Gemini output' }] } }],
                    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 4, totalTokenCount: 9 },
                },
            });

            const req = {
                ip: '127.0.0.1',
                flowopsApiId: 'api-123',
                headers: {
                    'x-gemini-key': 'AIza-real',
                    'x-flowops-cache-force-refresh': 'true',
                },
                body: {
                    model: 'gemini-3.5-flash',
                    temperature: 0,
                    messages: [{ role: 'user', content: 'Fresh prompt' }],
                },
            };

            const result = await executeAiProxy(req, 'gemini', [], 0, 0);
            expect(cacheManager.lookupTwoTierCache).not.toHaveBeenCalled();
            expect(cacheManager.saveToTwoTierCache).toHaveBeenCalledTimes(1);
            expect(result.cached).toBe(false);
            expect(result.cacheBypassReason).toContain('force-refreshed');
        });

        it('normalizes Gemini and Anthropic SSE lines into OpenAI chat.completion.chunk frames', () => {
            const geminiState = { sentRole: false, fullText: '', promptTokens: 0, completionTokens: 0 };
            const geminiFrame = parseProviderStreamLine({
                rawLine: `data: ${JSON.stringify({
                    candidates: [{ content: { parts: [{ text: 'Hello SSE' }] }, finishReason: 'STOP' }],
                    usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
                })}`,
                providerStr: 'gemini',
                streamId: 'chatcmpl-test',
                created: 1700000000,
                model: 'gemini-3.5-flash',
                state: geminiState,
            });
            expect(geminiFrame.done).toBe(false);
            expect(geminiFrame.chunk).toContain('"object":"chat.completion.chunk"');
            expect(geminiFrame.chunk).toContain('Hello SSE');
            expect(geminiFrame.chunk).toContain('"finish_reason":"stop"');
            expect(geminiState.fullText).toBe('Hello SSE');

            const anthropicState = { sentRole: false, fullText: '', promptTokens: 0, completionTokens: 0 };
            const antDelta = parseProviderStreamLine({
                rawLine: `data: ${JSON.stringify({
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: 'Claude chunk' },
                })}`,
                providerStr: 'anthropic',
                streamId: 'chatcmpl-ant',
                created: 1700000000,
                model: 'claude-3-5-sonnet',
                state: anthropicState,
            });
            expect(antDelta.chunk).toContain('Claude chunk');
            const antStop = parseProviderStreamLine({
                rawLine: 'data: {"type":"message_stop"}',
                providerStr: 'anthropic',
                streamId: 'chatcmpl-ant',
                created: 1700000000,
                model: 'claude-3-5-sonnet',
                state: anthropicState,
            });
            expect(antStop.done).toBe(true);
        });

        it('replays cached responses as standard OpenAI SSE streams ending in [DONE]', () => {
            const chunks = [];
            const mockRes = {
                setHeader: jest.fn(),
                status: jest.fn(),
                flushHeaders: jest.fn(),
                write: jest.fn((chunk) => chunks.push(chunk)),
                end: jest.fn(),
            };

            replayResponseAsSseStream(
                mockRes,
                {
                    id: 'chatcmpl-replay',
                    created: 1700000000,
                    model: 'gemini-3.5-flash',
                    choices: [{ message: { content: 'Fast replayed response from pgvector cache.' } }],
                    usage: { prompt_tokens: 6, completion_tokens: 7, total_tokens: 13 },
                },
                { 'x-flowops-cache': 'HIT', 'x-flowops-cache-tier': 'semantic' }
            );

            expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream; charset=utf-8');
            expect(mockRes.setHeader).toHaveBeenCalledWith('x-flowops-cache-tier', 'semantic');
            expect(chunks.some((c) => c.includes('"object":"chat.completion.chunk"'))).toBe(true);
            expect(chunks[chunks.length - 1]).toBe('data: [DONE]\n\n');
            expect(mockRes.end).toHaveBeenCalled();
        });

        it('computes bounded Full Jitter backoff delays and records failover telemetry', async () => {
            for (let attempt = 0; attempt <= 4; attempt++) {
                const cap = Math.min(1000 * Math.pow(2, attempt), 8000);
                const delay = computeBackoffDelayMs(attempt);
                expect(delay).toBeGreaterThanOrEqual(100);
                expect(delay).toBeLessThanOrEqual(cap);
            }

            axios.post.mockResolvedValueOnce({
                data: {
                    candidates: [{ content: { parts: [{ text: 'Fallback OK' }] } }],
                    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 2, totalTokenCount: 4 },
                },
            });

            const req = {
                ip: '127.0.0.1',
                headers: {
                    'x-openai-key': 'sk-mock',
                    'x-gemini-key': 'AIza-real',
                    'x-flowops-simulate-error': '503',
                },
                body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Failover check' }] },
            };

            const res = await executeAiProxy(req, 'openai', ['gemini'], 0, 0);
            expect(res.failoverUsed).toBe(true);
            expect(res.failoverFrom).toBe('openai');
            expect(res.retryAttempts).toBe(0);
        });
    });
});

