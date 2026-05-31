const axios = require('axios');
const logger = require('../../utils/logger');
const { redis } = require('../../config/redis');
const { calculatePromptTokens } = require('./tokenCounter');

// ─── Codex-Powered Prompt Optimizer ───
// Uses OpenAI GPT-4o to intelligently compress prompts before routing,
// reducing token consumption by up to 40% while preserving semantic intent.

const OPTIMIZER_SYSTEM_PROMPT = `You are a prompt compression engine. Your job is to rewrite user prompts to be maximally concise while preserving the EXACT intent, context, and expected output format.

Rules:
1. Remove filler words, redundant phrases, and unnecessary politeness
2. Preserve all technical terms, code snippets, and specific requirements
3. Keep the same language and tone intent
4. Never change the meaning or add new information
5. If the prompt is already optimal (under 50 tokens), return it unchanged
6. Return ONLY the optimized prompt text, nothing else`;

/**
 * Optimizes an array of messages by compressing verbose user prompts
 * using OpenAI's GPT-4o model. Caches optimization results in Redis.
 *
 * @param {Array} messages - The chat messages array [{role, content}]
 * @param {string} openaiKey - The OpenAI API key
 * @returns {Object} { optimizedMessages, stats }
 */
async function optimizePrompt(messages, openaiKey) {
    if (!openaiKey) {
        throw new Error('OpenAI API key is required for prompt optimization.');
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return {
            optimizedMessages: messages,
            stats: { originalTokens: 0, optimizedTokens: 0, savedTokens: 0, savingsPercent: 0, cached: false }
        };
    }

    const originalTokens = calculatePromptTokens(messages);

    // Skip optimization for very short prompts (not worth the overhead)
    if (originalTokens < 50) {
        logger.info('[Prompt Optimizer] Prompt already concise, skipping optimization', { tokens: originalTokens });
        return {
            optimizedMessages: messages,
            stats: { originalTokens, optimizedTokens: originalTokens, savedTokens: 0, savingsPercent: 0, cached: false, skipped: true }
        };
    }

    // Check Redis cache for previously optimized prompts
    const cacheKey = `prompt_opt:${Buffer.from(JSON.stringify(messages)).toString('base64').slice(0, 128)}`;
    try {
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult) {
            const parsed = JSON.parse(cachedResult);
            logger.info('[Prompt Optimizer] Cache HIT — serving optimized prompt from Redis', { 
                savedTokens: parsed.stats.savedTokens 
            });
            return { ...parsed, stats: { ...parsed.stats, cached: true } };
        }
    } catch (err) {
        logger.warn('[Prompt Optimizer] Cache read error, proceeding without cache', { error: err.message });
    }

    // Optimize each user message with GPT-4o
    try {
        const optimizedMessages = await Promise.all(
            messages.map(async (msg) => {
                // Only optimize user messages that are long enough
                if (msg.role !== 'user' || !msg.content || msg.content.length < 100) {
                    return msg;
                }

                const response = await axios.post(
                    'https://api.openai.com/v1/chat/completions',
                    {
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: OPTIMIZER_SYSTEM_PROMPT },
                            { role: 'user', content: msg.content }
                        ],
                        max_tokens: Math.ceil(msg.content.length / 2),
                        temperature: 0.1
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${openaiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );

                const optimizedContent = response.data?.choices?.[0]?.message?.content;
                if (optimizedContent && optimizedContent.length < msg.content.length) {
                    return { ...msg, content: optimizedContent };
                }
                return msg;
            })
        );

        const optimizedTokens = calculatePromptTokens(optimizedMessages);
        const savedTokens = originalTokens - optimizedTokens;
        const savingsPercent = originalTokens > 0 ? Math.round((savedTokens / originalTokens) * 100) : 0;

        const stats = {
            originalTokens,
            optimizedTokens,
            savedTokens: Math.max(0, savedTokens),
            savingsPercent: Math.max(0, savingsPercent),
            cached: false,
            skipped: false
        };

        logger.info('[Prompt Optimizer] Optimization complete', stats);

        // Cache the result for 24 hours
        const result = { optimizedMessages, stats };
        try {
            await redis.setex(cacheKey, 86400, JSON.stringify(result));
        } catch (err) {
            logger.warn('[Prompt Optimizer] Cache write error', { error: err.message });
        }

        return result;

    } catch (error) {
        logger.error('[Prompt Optimizer] Optimization failed, using original prompt', { 
            error: error.message,
            status: error.response?.status 
        });

        // Graceful degradation: return original messages if optimization fails
        return {
            optimizedMessages: messages,
            stats: { originalTokens, optimizedTokens: originalTokens, savedTokens: 0, savingsPercent: 0, cached: false, error: error.message }
        };
    }
}


module.exports = { optimizePrompt };
