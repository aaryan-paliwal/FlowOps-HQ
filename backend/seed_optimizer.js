require('dotenv').config();
const { db, apis, requestLogs } = require('./src/config/database');
const { inArray } = require('drizzle-orm');

const models = ['gpt-4o-mini', 'gpt-4o', 'gemini-1.5-flash', 'anthropic/claude-3-5-sonnet'];
const providers = ['openai', 'openai', 'gemini', 'anthropic'];

async function seedVariedLogs() {
    console.log('Clearing old mock logs...');
    
    // Just delete all mock logs where requestId starts with 'mock-req'
    const allApis = await db.select().from(apis);
    const apiIds = allApis.map(a => a.id);
    
    if (apiIds.length > 0) {
        // delete all logs for these APIs to have a clean slate (or just mock ones if we can, but since it's a sandbox, let's just wipe and rebuild)
        await db.delete(requestLogs).where(inArray(requestLogs.apiId, apiIds));
    }
    
    console.log('Seeding varied mock optimizer logs for all APIs...');
    const now = Date.now();
    
    for (const api of allApis) {
        // Insert 45 varied logs over the last 24 hours
        for (let i = 0; i < 45; i++) {
            // Random time in the last 24 hours
            const randomTimeOffset = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
            const logTime = new Date(now - randomTimeOffset);
            
            // Randomly pick if it was optimized (say 75% of the time)
            const isOptimized = Math.random() > 0.25;
            
            // Random models
            const modelIndex = Math.floor(Math.random() * models.length);
            const model = models[modelIndex];
            const provider = providers[modelIndex];
            
            // Random tokens
            const originalPromptTokens = Math.floor(Math.random() * 2000) + 150; 
            const completionTokens = Math.floor(Math.random() * 500) + 50;
            
            let tokensSaved = 0;
            let promptTokens = originalPromptTokens;
            let optimizationPercent = 0;
            
            if (isOptimized) {
                // Save between 10% and 55%
                const savePercent = 0.10 + Math.random() * 0.45;
                tokensSaved = Math.floor(originalPromptTokens * savePercent);
                promptTokens = originalPromptTokens - tokensSaved;
                optimizationPercent = parseFloat((savePercent * 100).toFixed(2));
            }
            
            await db.insert(requestLogs).values({
                apiId: api.id,
                endpoint: '/v1/chat/completions',
                method: 'POST',
                statusCode: Math.random() > 0.95 ? 500 : 200,
                latencyMs: Math.floor(150 + Math.random() * 800),
                ip: '127.0.0.1',
                requestId: `mock-req-${now}-${i}`,
                promptTokens: promptTokens,
                completionTokens: completionTokens,
                tokensUsed: promptTokens + completionTokens,
                cacheHit: Math.random() > 0.8,
                provider: provider,
                model: model,
                promptOptimized: isOptimized,
                originalPromptTokens: originalPromptTokens,
                tokensSaved: tokensSaved,
                optimizationPercent: optimizationPercent,
                timestamp: logTime
            });
        }
    }
    console.log('Done seeding varied data!');
    process.exit(0);
}
seedVariedLogs().catch(console.error);
