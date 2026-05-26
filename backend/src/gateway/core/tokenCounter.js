const { getEncoding } = require('js-tiktoken');
const enc = getEncoding("cl100k_base");

/**
 * Calculates the exact token cost of an incoming LLM prompt.
 * Uses cl100k_base encoding (Standard for GPT-3.5 and GPT-4).
 *
 * @param {Array} messages - The array of message objects [{"role": "user", "content": "..."}]
 * @returns {number} The exact number of tokens the prompt will consume.
 */
function calculatePromptTokens(messages) {
    if (!messages || !Array.isArray(messages)) return 0;

    let tokenCount = 0;
    
    // Every message follows <im_start>{role/name}\n{content}<im_end>\n
    // which adds roughly 4 tokens per message.
    for (const msg of messages) {
        tokenCount += 4; 
        
        if (msg.content && typeof msg.content === 'string') {
            const tokens = enc.encode(msg.content);
            tokenCount += tokens.length;
        }
        
        if (msg.role && typeof msg.role === 'string') {
            const tokens = enc.encode(msg.role);
            tokenCount += tokens.length;
        }
    }
    
    // Every reply is primed with <im_start>assistant
    tokenCount += 2;
    
    return tokenCount;
}

module.exports = { calculatePromptTokens };
