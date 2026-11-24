// Mock db and redis before importing cacheManager so it can run isolated without db env vars
jest.mock('../../config/database', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
        delete: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 'mock-id' }]),
    },
    semanticCache: {
        id: 'id',
        apiId: 'apiId',
        model: 'model',
        temperature: 'temperature',
        systemPromptHash: 'systemPromptHash',
        expiresAt: 'expiresAt',
        embedding: 'embedding',
        promptText: 'promptText',
        responsePayload: 'responsePayload',
        tokensUsed: 'tokensUsed',
    },
}));

jest.mock('../../config/redis', () => ({
    redis: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockResolvedValue('OK'),
        sadd: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        smembers: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
    },
}));

const { redis } = require('../../config/redis');
const {
    clampThreshold,
    buildScopedRedisKey,
    isCacheEligible,
    buildExactCacheKey,
    extractPrompts,
    flushTwoTierCache,
} = require('./cacheManager');

describe('Cache Scoping and Bypass Rules', () => {
    describe('isCacheEligible', () => {
        it('should allow caching when temperature is 0 and no tools are present', () => {
            const result = isCacheEligible({ temperature: 0, messages: [{ role: 'user', content: 'hello' }] }, {});
            expect(result.eligible).toBe(true);
        });

        it('should allow caching when temperature is undefined (defaulting to 0)', () => {
            const result = isCacheEligible({ messages: [{ role: 'user', content: 'hello' }] }, {});
            expect(result.eligible).toBe(true);
        });

        it('should bypass cache when temperature is greater than 0', () => {
            const result = isCacheEligible({ temperature: 0.7, messages: [{ role: 'user', content: 'hello' }] }, {});
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Temperature > 0');
        });

        it('should bypass cache when temperature is string > 0', () => {
            const result = isCacheEligible({ temperature: '0.2' }, {});
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Temperature > 0');
        });

        it('should bypass cache when tools array is non-empty', () => {
            const result = isCacheEligible({
                temperature: 0,
                tools: [{ type: 'function', function: { name: 'get_weather' } }],
            }, {});
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Request uses tools');
        });

        it('should bypass cache when functions array is non-empty', () => {
            const result = isCacheEligible({
                temperature: 0,
                functions: [{ name: 'execute_sql' }],
            }, {});
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Request uses functions');
        });

        it('should bypass cache when tool_choice is specified', () => {
            const result = isCacheEligible({
                temperature: 0,
                tool_choice: 'auto',
            }, {});
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Request specifies tool_choice');
        });

        it('should bypass cache when client passes x-flowops-cache: false header', () => {
            const result = isCacheEligible(
                { temperature: 0 },
                { 'x-flowops-cache': 'false' }
            );
            expect(result.eligible).toBe(false);
            expect(result.reason).toContain('Cache explicitly disabled via x-flowops-cache header');
        });

        it('should mark forceRefresh when client passes x-flowops-cache-force-refresh: true', () => {
            const result = isCacheEligible(
                { temperature: 0, messages: [{ role: 'user', content: 'hello' }] },
                { 'x-flowops-cache-force-refresh': 'true' }
            );
            expect(result.eligible).toBe(true);
            expect(result.forceRefresh).toBe(true);
        });
    });

    describe('Threshold clamping & Two-Tier Flush', () => {
        it('clamps similarity threshold within [0.70, 0.99] and defaults to 0.88', () => {
            expect(clampThreshold(undefined)).toBe(0.88);
            expect(clampThreshold('invalid')).toBe(0.88);
            expect(clampThreshold(0.3)).toBe(0.70);
            expect(clampThreshold(1.5)).toBe(0.99);
            expect(clampThreshold('0.91')).toBe(0.91);
        });

        it('scopes Redis keys by apiId when provided', () => {
            expect(buildScopedRedisKey('exact_cache:m:0:h1:h2')).toBe('exact_cache:m:0:h1:h2');
            expect(buildScopedRedisKey('exact_cache:m:0:h1:h2', 'api-99')).toBe('exact_cache:m:0:h1:h2:api-99');
        });

        it('flushes tracked Redis exact keys and pgvector rows for given API IDs', async () => {
            redis.smembers.mockResolvedValueOnce(['exact_cache:k1:api-1', 'exact_cache:k2:api-1']);
            const res = await flushTwoTierCache(['api-1']);
            expect(redis.smembers).toHaveBeenCalledWith('exact_cache_index:api-1');
            expect(redis.del).toHaveBeenCalledWith('exact_cache:k1:api-1', 'exact_cache:k2:api-1');
            expect(redis.del).toHaveBeenCalledWith('exact_cache_index:api-1');
            expect(res.deletedExact).toBe(2);
            expect(res.deletedSemantic).toBe(1);
        });
    });

    describe('Scoping and Isolation', () => {
        it('should scope exact key by model, temperature, and system prompt hash', () => {
            const key1 = buildExactCacheKey({
                model: 'gemini-1.5-flash',
                temperature: 0,
                systemPromptHash: 'sys_hash_A',
                messagesJson: JSON.stringify([{ role: 'user', content: 'test' }]),
            });

            const keyDifferentModel = buildExactCacheKey({
                model: 'llama-3-70b',
                temperature: 0,
                systemPromptHash: 'sys_hash_A',
                messagesJson: JSON.stringify([{ role: 'user', content: 'test' }]),
            });

            const keyDifferentSysPrompt = buildExactCacheKey({
                model: 'gemini-1.5-flash',
                temperature: 0,
                systemPromptHash: 'sys_hash_B',
                messagesJson: JSON.stringify([{ role: 'user', content: 'test' }]),
            });

            const keyDifferentTemp = buildExactCacheKey({
                model: 'gemini-1.5-flash',
                temperature: 0.5,
                systemPromptHash: 'sys_hash_A',
                messagesJson: JSON.stringify([{ role: 'user', content: 'test' }]),
            });

            expect(key1).not.toEqual(keyDifferentModel);
            expect(key1).not.toEqual(keyDifferentSysPrompt);
            expect(key1).not.toEqual(keyDifferentTemp);
        });

        it('should extract distinct system prompts and user prompt texts', () => {
            const messages = [
                { role: 'system', content: 'You are a concise assistant.' },
                { role: 'user', content: 'What is photosynthesis?' },
            ];
            const { promptText, systemPrompt } = extractPrompts(messages);
            expect(promptText).toBe('What is photosynthesis?');
            expect(systemPrompt).toBe('You are a concise assistant.');
        });
    });
});
