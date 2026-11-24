const { calculatePromptTokens } = require('./tokenCounter');

/**
 * FlowOps Smart Classifier
 * Deterministic, <1ms heuristics engine that classifies incoming prompts
 * into 'fast' (cost/speed) or 'reasoning' (complex/flagship) tiers,
 * then resolves the optimal concrete model based on routing strategy and
 * available upstream provider credentials.
 */

const CODE_REGEX = /(```|function\s+\w+|class\s+\w+|def\s+\w+|import\s+[\w{]|const\s+\w+\s*=|async\s+function|SELECT\s+.+\s+FROM)/i;
const REASONING_KEYWORDS = [
    'analyze',
    'analyse',
    'compare and contrast',
    'step-by-step',
    'step by step',
    'architecture',
    'architect',
    'refactor',
    'debug',
    'derive',
    'proof',
    'legal agreement',
    'contract',
    'comprehensive',
    'evaluate trade-offs',
    'tradeoffs',
];

/**
 * Resolve available models based on configured provider credentials (BYOK or env)
 */
function resolveAvailableTargets(availableProviders = {}) {
    const hasOpenAI = Boolean(availableProviders.openai);
    const hasAnthropic = Boolean(availableProviders.anthropic);
    const hasGemini = Boolean(availableProviders.gemini);
    const hasCustom = Boolean(availableProviders.customTargetUrl);

    // Default Fast Tier model
    let fastModel = 'gemini-3.5-flash';
    if (hasGemini) fastModel = 'gemini-3.5-flash';
    else if (hasOpenAI) fastModel = 'gpt-4o-mini';
    else if (hasAnthropic) fastModel = 'anthropic/claude-3-5-sonnet';
    else if (hasCustom) fastModel = availableProviders.customModel || 'llama3';

    // Default Reasoning Tier model
    let reasoningModel = 'gpt-4o';
    if (hasOpenAI) reasoningModel = 'gpt-4o';
    else if (hasAnthropic) reasoningModel = 'anthropic/claude-3-5-sonnet';
    else if (hasGemini) reasoningModel = 'gemini-3.5-flash'; // graceful fallback when only Gemini key exists
    else if (hasCustom) reasoningModel = availableProviders.customModel || 'llama3';

    return { fastModel, reasoningModel };
}

/**
 * Classify prompt complexity and select target model.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} options
 * @param {'cost-optimized'|'speed-optimized'|'quality-optimized'} [options.strategy='cost-optimized']
 * @param {Object} [options.availableProviders] - booleans/keys indicating configured providers
 * @returns {{ selectedModel: string, tier: 'fast'|'reasoning', reason: string, promptTokens: number }}
 */
function classifyPrompt(messages = [], options = {}) {
    const strategy = (options.strategy || 'cost-optimized').toLowerCase();
    const promptTokens = calculatePromptTokens(messages);
    const combinedText = messages.map((m) => m.content || '').join('\n');
    const lowerText = combinedText.toLowerCase();

    const { fastModel, reasoningModel } = resolveAvailableTargets(options.availableProviders);

    // Strategy override: Quality-Optimized always uses flagship reasoning tier
    if (strategy === 'quality-optimized') {
        return {
            selectedModel: reasoningModel,
            tier: 'reasoning',
            reason: 'Strategy set to quality-optimized',
            promptTokens,
        };
    }

    // Strategy override: Speed-Optimized prefers lowest TTFT fast tier unless massive context
    if (strategy === 'speed-optimized' && promptTokens < 1500) {
        return {
            selectedModel: fastModel,
            tier: 'fast',
            reason: 'Strategy set to speed-optimized',
            promptTokens,
        };
    }

    // Check complexity indicators for cost-optimized (default) routing
    if (CODE_REGEX.test(combinedText)) {
        return {
            selectedModel: reasoningModel,
            tier: 'reasoning',
            reason: 'Detected code syntax or technical implementation markers',
            promptTokens,
        };
    }

    const matchedKeyword = REASONING_KEYWORDS.find((kw) => lowerText.includes(kw));
    if (matchedKeyword) {
        return {
            selectedModel: reasoningModel,
            tier: 'reasoning',
            reason: `Detected reasoning trigger keyword: "${matchedKeyword}"`,
            promptTokens,
        };
    }

    if (promptTokens > 600) {
        return {
            selectedModel: reasoningModel,
            tier: 'reasoning',
            reason: `Long-context prompt (${promptTokens} tokens > 600 threshold)`,
            promptTokens,
        };
    }

    return {
        selectedModel: fastModel,
        tier: 'fast',
        reason: `Lightweight query (${promptTokens} tokens, no heavy reasoning markers)`,
        promptTokens,
    };
}

module.exports = {
    classifyPrompt,
    resolveAvailableTargets,
    CODE_REGEX,
    REASONING_KEYWORDS,
};

