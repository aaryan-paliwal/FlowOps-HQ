require('dotenv').config();
const bcrypt = require('bcryptjs');
const { eq, and } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const schema = require('./db/schema');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });
const { users, apis, apiKeys, requestLogs } = schema;

async function main() {
    console.log('Seeding beautiful real-time dashboard logs...');

    // 1. Create or Find Developer User
    const email = 'developer@flowops.dev';
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
        const passwordHash = await bcrypt.hash('password123', 12);
        [user] = await db.insert(users).values({
            email,
            name: 'FlowOps HQ Developer',
            passwordHash,
            subscriptionTier: 'MAX'
        }).returning();
        console.log('Created User developer@flowops.dev / password123');
    }

    // 2. Create Sandbox API
    let [sandboxApi] = await db.select().from(apis)
        .where(and(eq(apis.userId, user.id), eq(apis.name, 'FlowOps HQ Sandbox API')))
        .limit(1);
    if (!sandboxApi) {
        [sandboxApi] = await db.insert(apis).values({
            name: 'FlowOps HQ Sandbox API',
            slug: 'sandbox',
            baseUrl: 'http://localhost:5000',
            userId: user.id
        }).returning();
    }

    // 3. Create Sandbox API Key
    let [sandboxKey] = await db.select().from(apiKeys)
        .where(eq(apiKeys.apiId, sandboxApi.id))
        .limit(1);
    if (!sandboxKey) {
        [sandboxKey] = await db.insert(apiKeys).values({
            apiId: sandboxApi.id,
            name: 'Sandbox Key',
            keyHash: 'sandbox-hash',
            keyPrefix: 'fl_live_sandbox'
        }).returning();
    }

    // Clear old sandbox logs to prevent bloat but keep it fresh
    await db.delete(requestLogs).where(eq(requestLogs.apiId, sandboxApi.id));

    // 4. Generate 60 realistic requests over the last 24 hours
    const models = [
        { name: 'gemini-1.5-flash', provider: 'gemini', rate: 0.075 },
        { name: 'gpt-4o-mini', provider: 'openai', rate: 0.15 },
        { name: 'gpt-4o', provider: 'openai', rate: 2.5 },
        { name: 'anthropic/claude-3-5-sonnet', provider: 'anthropic', rate: 3.0 }
    ];

    const logs = [];
    const now = Date.now();

    for (let i = 0; i < 60; i++) {
        // Space requests out evenly in the last 24 hours
        const timestamp = new Date(now - (60 - i) * 24 * 60 * 1000 / 60);

        const modelObj = models[Math.floor(Math.random() * models.length)];
        const cacheHit = Math.random() < 0.35; // 35% cache hits
        const isError = Math.random() < 0.03;  // 3% error rate

        const statusCode = isError ? 403 : 200;
        const latencyMs = cacheHit ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 1200) + 300;
        const promptTokens = Math.floor(Math.random() * 600) + 100;
        const completionTokens = isError ? 0 : Math.floor(Math.random() * 200) + 50;

        logs.push({
            apiId: sandboxApi.id,
            apiKeyId: sandboxKey.id,
            endpoint: '/v1/chat/completions',
            method: 'POST',
            statusCode,
            latencyMs,
            ip: '127.0.0.1',
            requestId: `req-seed-${i}-${Date.now()}`,
            promptTokens,
            completionTokens,
            tokensUsed: promptTokens + completionTokens,
            cacheHit,
            provider: modelObj.provider,
            model: modelObj.name,
            timestamp
        });
    }

    await db.insert(requestLogs).values(logs);

    console.log('Successfully seeded 60 advanced request metrics!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await sql.end();
    });
