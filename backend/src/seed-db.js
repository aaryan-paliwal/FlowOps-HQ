/**
 * FlowOps HQ Database Seeder
 * Creates sample data for development.
 * Usage: node src/seed-db.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { eq } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const schema = require('./db/schema');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });
const { users, apis, rateLimits, apiKeys, requestLogs, apiMetrics } = schema;

async function seed() {
    console.log('🌱 Seeding FlowOps HQ database...\n');

    // 1. Create test user (upsert pattern: check then insert/update)
    const passwordHash = await bcrypt.hash('password123', 12);
    let [user] = await db.select().from(users).where(eq(users.email, 'developer@flowops.dev')).limit(1);
    if (!user) {
        [user] = await db.insert(users).values({
            email: 'developer@flowops.dev',
            name: 'FlowOps HQ Developer',
            passwordHash,
        }).returning();
    }
    console.log(`✅ User: ${user.email}`);

    // 2. Create sample APIs
    const apisData = [
        { name: 'Payments API', slug: 'payments', baseUrl: 'https://jsonplaceholder.typicode.com' },
        { name: 'Users API', slug: 'users', baseUrl: 'https://jsonplaceholder.typicode.com' },
        { name: 'Orders API', slug: 'orders', baseUrl: 'https://jsonplaceholder.typicode.com' },
    ];

    for (const apiData of apisData) {
        let [api] = await db.select().from(apis).where(eq(apis.slug, apiData.slug)).limit(1);
        if (!api) {
            [api] = await db.insert(apis).values({ ...apiData, userId: user.id }).returning();
        }

        // Create rate limit
        const [existingRL] = await db.select().from(rateLimits).where(eq(rateLimits.apiId, api.id)).limit(1);
        if (!existingRL) {
            await db.insert(rateLimits).values({ apiId: api.id, requestsPerMinute: 100, requestsPerDay: 5000 });
        }

        // Create API key
        const rawKey = `sk_live_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const [existingKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
        if (!existingKey) {
            await db.insert(apiKeys).values({
                apiId: api.id,
                name: `${apiData.name} - Dev Key`,
                keyHash,
                keyPrefix: rawKey.substring(0, 16),
            });
        }

        console.log(`✅ API: ${apiData.name} | Key: ${rawKey.substring(0, 20)}...`);

        // Create sample logs
        const methods = ['GET', 'POST', 'PUT', 'DELETE'];
        const endpoints = ['/users', '/orders', '/products', '/payments'];
        const statuses = [200, 200, 200, 200, 201, 400, 404, 500];

        for (let i = 0; i < 50; i++) {
            const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
            const statusCode = statuses[Math.floor(Math.random() * statuses.length)];
            const latencyMs = Math.floor(Math.random() * 400) + 50;

            await db.insert(requestLogs).values({
                apiId: api.id,
                endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
                method: methods[Math.floor(Math.random() * methods.length)],
                statusCode,
                latencyMs,
                timestamp,
            });

            // Also seed metrics
            const minuteBucket = new Date(timestamp);
            minuteBucket.setSeconds(0, 0);

            // Check if metric exists for this bucket
            const [existingMetric] = await db.select().from(apiMetrics)
                .where(eq(apiMetrics.apiId, api.id))
                .limit(1);

            if (existingMetric) {
                await db.update(apiMetrics)
                    .set({
                        requestCount: existingMetric.requestCount + 1,
                        errorCount: statusCode >= 400 ? existingMetric.errorCount + 1 : existingMetric.errorCount,
                        totalLatency: existingMetric.totalLatency + latencyMs,
                    })
                    .where(eq(apiMetrics.id, existingMetric.id));
            } else {
                await db.insert(apiMetrics).values({
                    apiId: api.id,
                    minuteBucket,
                    requestCount: 1,
                    errorCount: statusCode >= 400 ? 1 : 0,
                    totalLatency: latencyMs,
                });
            }
        }
        console.log('   📊 50 sample logs created');
    }

    console.log('\n✅ Seed complete!');
    console.log('\n📧 Login: developer@flowops.dev / password123');
}

seed()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(() => sql.end());
