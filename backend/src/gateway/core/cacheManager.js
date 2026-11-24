const crypto = require('crypto');
const { eq, and, gt, desc, inArray, cosineDistance, sql } = require('drizzle-orm');
const { db, semanticCache } = require('../../config/database');
const { redis } = require('../../config/redis');
const logger = require('../../utils/logger');

const DEFAULT_SIMILARITY_THRESHOLD = 0.88;
const MIN_SIMILARITY_THRESHOLD = 0.70;
const MAX_SIMILARITY_THRESHOLD = 0.99;

function clampThreshold(threshold) {
    const parsed = Number(threshold);
    if (!Number.isFinite(parsed)) return DEFAULT_SIMILARITY_THRESHOLD;
    return Math.min(MAX_SIMILARITY_THRESHOLD, Math.max(MIN_SIMILARITY_THRESHOLD, parsed));
}

function buildScopedRedisKey(exactKey, apiId = null) {
    return apiId ? `${exactKey}:${apiId}` : exactKey;
}

// Singleton embedder instance promise
let embedderPromise = null;

async function getEmbedder() {
    if (!embedderPromise) {
        embedderPromise = (async () => {
            const { pipeline } = await import('@xenova/transformers');
            return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true,
            });
        })().catch((err) => {
            logger.error('[Embedder] Failed to initialize model pipeline', { error: err.message });
            embedderPromise = null;
            throw err;
        });
    }
    return embedderPromise;
}

/**
 * Generate 384-dimensional dense vector embedding for text
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
    const embedder = await getEmbedder();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

/**
 * Hash a string (or object) with SHA-256 for compact consistent keys
 * @param {string|object} value 
 * @returns {string}
 */
function sha256(value) {
    const str = typeof value === 'string' ? value : JSON.stringify(value || '');
    return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Extract user prompt text and system prompt from OpenAI chat messages
 * @param {Array<{role: string, content: string}>} messages 
 * @returns {{ promptText: string, systemPrompt: string }}
 */
function extractPrompts(messages = []) {
    let systemPrompt = '';
    const userParts = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemPrompt += (systemPrompt ? '\n' : '') + (msg.content || '');
        } else if (msg.role === 'user') {
            userParts.push(msg.content || '');
        }
    }

    const promptText = userParts.join('\n').trim();
    return { promptText, systemPrompt };
}

/**
 * Build the exact-match cache key scoped by model, temperature, and system prompt hash
 * @param {Object} options
 * @param {string} options.model
 * @param {number} options.temperature
 * @param {string} options.systemPromptHash
 * @param {string} options.messagesJson
 * @returns {string}
 */
function buildExactCacheKey({ model, temperature, systemPromptHash, messagesJson }) {
    const messagesHash = sha256(messagesJson);
    return `exact_cache:${model}:${temperature}:${systemPromptHash}:${messagesHash}`;
}

/**
 * Determines whether the request is eligible for caching:
 * - temperature must be 0 (or null/undefined defaulting to 0)
 * - request must not use tools, tool_choice, functions, or function_call
 * - client did not pass header x-flowops-cache: false
 * 
 * @param {Object} reqBody 
 * @param {Object} headers 
 * @returns {{ eligible: boolean, reason?: string }}
 */
function isCacheEligible(reqBody = {}, headers = {}) {
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
}

/**
 * Lookup cache using two tiers:
 * Tier 1: Exact match in Redis (instant sub-millisecond)
 * Tier 2: Semantic vector match in PostgreSQL pgvector (cosine similarity)
 * 
 * @param {Object} params
 * @param {string} params.model
 * @param {number} params.temperature
 * @param {Array} params.messages
 * @param {string} [params.apiId]
 * @param {number} [params.similarityThreshold=0.88]
 * @returns {Promise<{ hit: boolean, tier: 'exact'|'semantic'|null, data?: any, similarity?: number, promptText?: string }>}
 */
async function lookupTwoTierCache({
    model,
    temperature = 0,
    messages = [],
    apiId = null,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
}) {
    const threshold = clampThreshold(similarityThreshold);
    const { promptText, systemPrompt } = extractPrompts(messages);
    const systemPromptHash = sha256(systemPrompt);
    const messagesJson = JSON.stringify(messages);

    // ─────────────────────────────────────────────
    // Tier 1: Exact Match Lookup (Redis)
    // ─────────────────────────────────────────────
    const exactKey = buildExactCacheKey({ model, temperature, systemPromptHash, messagesJson });
    const scopedRedisKey = buildScopedRedisKey(exactKey, apiId);
    try {
        const cachedRaw = await redis.get(scopedRedisKey);
        if (cachedRaw) {
            logger.info('[Cache Tier 1: Exact HIT] Key hit in Redis', { exactKey: scopedRedisKey });
            return {
                hit: true,
                tier: 'exact',
                similarity: 1.0,
                data: JSON.parse(cachedRaw),
                promptText,
            };
        }
    } catch (err) {
        logger.warn('[Cache Tier 1: Error] Redis exact-match read failed', { error: err.message });
    }

    // If there is no user prompt text, semantic search cannot be computed
    if (!promptText) {
        return { hit: false, tier: null };
    }

    // ─────────────────────────────────────────────
    // Tier 2: Semantic Vector Lookup (PostgreSQL + pgvector)
    // ─────────────────────────────────────────────
    try {
        const promptEmbedding = await generateEmbedding(promptText);

        // Query candidates scoped by model, temperature, systemPromptHash, and non-expired
        // cosine_distance = 1 - cosine_similarity.
        const now = new Date();
        const candidates = await db
            .select({
                id: semanticCache.id,
                promptText: semanticCache.promptText,
                responsePayload: semanticCache.responsePayload,
                tokensUsed: semanticCache.tokensUsed,
                distance: cosineDistance(semanticCache.embedding, promptEmbedding),
            })
            .from(semanticCache)
            .where(
                and(
                    eq(semanticCache.model, model),
                    eq(semanticCache.temperature, temperature),
                    eq(semanticCache.systemPromptHash, systemPromptHash),
                    gt(semanticCache.expiresAt, now),
                    ...(apiId ? [eq(semanticCache.apiId, apiId)] : [])
                )
            )
            .orderBy(cosineDistance(semanticCache.embedding, promptEmbedding))
            .limit(1);

        if (candidates.length > 0) {
            const best = candidates[0];
            const similarity = 1 - Number(best.distance);

            if (similarity >= threshold) {
                logger.info('[Cache Tier 2: Semantic HIT] pgvector semantic match found', {
                    similarity: similarity.toFixed(4),
                    threshold,
                    matchedPrompt: best.promptText.substring(0, 50),
                    queryPrompt: promptText.substring(0, 50),
                });

                // Warm Tier 1 Redis for exact repeats of this phrasing
                try {
                    await redis.setex(scopedRedisKey, 3600, best.responsePayload);
                    if (apiId && typeof redis.sadd === 'function') {
                        await redis.sadd(`exact_cache_index:${apiId}`, scopedRedisKey);
                        await redis.expire(`exact_cache_index:${apiId}`, 3600);
                    }
                } catch {
                    // Best-effort Tier 1 warm-up; never fail the hit
                }

                return {
                    hit: true,
                    tier: 'semantic',
                    similarity,
                    data: JSON.parse(best.responsePayload),
                    promptText: best.promptText,
                };
            }
        }
    } catch (err) {
        logger.warn('[Cache Tier 2: Error] pgvector semantic search failed', { error: err.message });
    }

    return { hit: false, tier: null };
}

/**
 * Save response to both cache tiers:
 * Tier 1: Redis exact-match key with TTL
 * Tier 2: PostgreSQL pgvector semantic table with TTL
 * 
 * @param {Object} params
 * @param {string} params.model
 * @param {number} params.temperature
 * @param {Array} params.messages
 * @param {Object} params.responseData
 * @param {string} [params.apiId]
 * @param {number} [params.ttlSeconds=3600]
 */
async function saveToTwoTierCache({
    model,
    temperature = 0,
    messages = [],
    responseData,
    apiId = null,
    ttlSeconds = 3600,
}) {
    const { promptText, systemPrompt } = extractPrompts(messages);
    const systemPromptHash = sha256(systemPrompt);
    const messagesJson = JSON.stringify(messages);
    const serializedData = JSON.stringify(responseData);

    // 1. Write Tier 1 (Redis exact key)
    try {
        const exactKey = buildExactCacheKey({ model, temperature, systemPromptHash, messagesJson });
        const scopedRedisKey = buildScopedRedisKey(exactKey, apiId);
        await redis.setex(scopedRedisKey, ttlSeconds, serializedData);
        if (apiId && typeof redis.sadd === 'function') {
            await redis.sadd(`exact_cache_index:${apiId}`, scopedRedisKey);
            await redis.expire(`exact_cache_index:${apiId}`, ttlSeconds);
        }
    } catch (err) {
        logger.warn('[Cache Tier 1: Error] Redis exact-match write failed', { error: err.message });
    }

    // 2. Write Tier 2 (PostgreSQL pgvector)
    if (promptText) {
        try {
            const embedding = await generateEmbedding(promptText);
            const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
            const tokensUsed = responseData?.usage?.total_tokens || 0;

            await db.insert(semanticCache).values({
                apiId: apiId || null,
                promptText,
                embedding,
                model,
                temperature,
                systemPromptHash,
                responsePayload: serializedData,
                tokensUsed,
                expiresAt,
            });

            logger.info('[Cache Tier 2: Saved] Semantic embedding persisted to pgvector', {
                model,
                expiresAt,
                promptSlice: promptText.substring(0, 50),
            });
        } catch (err) {
            logger.warn('[Cache Tier 2: Error] pgvector write failed', { error: err.message });
        }
    }
}

/**
 * Flush both Tier 1 (Redis) and Tier 2 (pgvector) entries for given API IDs.
 * @param {string[]} apiIds
 * @returns {Promise<{ deletedSemantic: number, deletedExact: number }>}
 */
async function flushTwoTierCache(apiIds = []) {
    if (!Array.isArray(apiIds) || apiIds.length === 0) {
        return { deletedSemantic: 0, deletedExact: 0 };
    }

    let deletedExact = 0;
    for (const apiId of apiIds) {
        try {
            const indexKey = `exact_cache_index:${apiId}`;
            const keys = await redis.smembers(indexKey);
            if (keys && keys.length > 0) {
                await redis.del(...keys);
                deletedExact += keys.length;
            }
            await redis.del(indexKey);
        } catch (err) {
            logger.warn('[Cache Flush: Redis Error]', { apiId, error: err.message });
        }
    }

    const deletedRows = await db
        .delete(semanticCache)
        .where(inArray(semanticCache.apiId, apiIds))
        .returning({ id: semanticCache.id });

    return {
        deletedSemantic: deletedRows.length,
        deletedExact,
    };
}

/**
 * Return active pgvector semantic cache statistics and recent cached prompts.
 * @param {string[]} apiIds
 */
async function getSemanticCacheStats(apiIds = []) {
    if (!Array.isArray(apiIds) || apiIds.length === 0) {
        return { activeEntries: 0, totalTokensCached: 0, recentEntries: [] };
    }

    const now = new Date();
    const [agg] = await db
        .select({
            activeEntries: sql`count(*)`,
            totalTokensCached: sql`coalesce(sum(${semanticCache.tokensUsed}), 0)`,
        })
        .from(semanticCache)
        .where(and(inArray(semanticCache.apiId, apiIds), gt(semanticCache.expiresAt, now)));

    const recentEntries = await db
        .select({
            id: semanticCache.id,
            apiId: semanticCache.apiId,
            model: semanticCache.model,
            promptText: semanticCache.promptText,
            tokensUsed: semanticCache.tokensUsed,
            createdAt: semanticCache.createdAt,
            expiresAt: semanticCache.expiresAt,
        })
        .from(semanticCache)
        .where(and(inArray(semanticCache.apiId, apiIds), gt(semanticCache.expiresAt, now)))
        .orderBy(desc(semanticCache.createdAt))
        .limit(20);

    return {
        activeEntries: Number(agg?.activeEntries || 0),
        totalTokensCached: Number(agg?.totalTokensCached || 0),
        recentEntries,
    };
}

module.exports = {
    clampThreshold,
    getEmbedder,
    generateEmbedding,
    sha256,
    extractPrompts,
    buildExactCacheKey,
    buildScopedRedisKey,
    isCacheEligible,
    lookupTwoTierCache,
    saveToTwoTierCache,
    flushTwoTierCache,
    getSemanticCacheStats,
};
