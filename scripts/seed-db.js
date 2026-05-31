/**
 * FlowOps HQ Database Seeder
 * Creates sample data for development.
 * Usage: node scripts/seed-db.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding FlowOps HQ database...\n');

    // 1. Create test user
    const passwordHash = await bcrypt.hash('password123', 12);
    const user = await prisma.user.upsert({
        where: { email: 'developer@flowops.dev' },
        update: {},
        create: {
            email: 'developer@flowops.dev',
            name: 'FlowOps HQ Developer',
            passwordHash,
        },
    });
    console.log(`✅ User: ${user.email}`);

    // 2. Create sample APIs
    const apisData = [
        { name: 'Payments API', slug: 'payments', baseUrl: 'https://jsonplaceholder.typicode.com' },
        { name: 'Users API', slug: 'users', baseUrl: 'https://jsonplaceholder.typicode.com' },
        { name: 'Orders API', slug: 'orders', baseUrl: 'https://jsonplaceholder.typicode.com' },
    ];

    for (const apiData of apisData) {
        const api = await prisma.api.upsert({
            where: { slug: apiData.slug },
            update: {},
            create: { ...apiData, userId: user.id },
        });

        // Create rate limit
        await prisma.rateLimit.upsert({
            where: { apiId: api.id },
            update: {},
            create: { apiId: api.id, requestsPerMinute: 100, requestsPerDay: 5000 },
        });

        // Create API key
        const rawKey = `sk_live_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        await prisma.apiKey.upsert({
            where: { keyHash },
            update: {},
            create: {
                apiId: api.id,
                name: `${apiData.name} - Dev Key`,
                keyHash,
                keyPrefix: rawKey.substring(0, 16),
            },
        });

        console.log(`✅ API: ${apiData.name} | Key: ${rawKey.substring(0, 20)}...`);

        // Create sample logs
        const methods = ['GET', 'POST', 'PUT', 'DELETE'];
        const endpoints = ['/users', '/orders', '/products', '/payments'];
        const statuses = [200, 200, 200, 200, 201, 400, 404, 500];

        for (let i = 0; i < 50; i++) {
            const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
            const statusCode = statuses[Math.floor(Math.random() * statuses.length)];
            const latencyMs = Math.floor(Math.random() * 400) + 50;

            await prisma.requestLog.create({
                data: {
                    apiId: api.id,
                    endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
                    method: methods[Math.floor(Math.random() * methods.length)],
                    statusCode,
                    latencyMs,
                    timestamp,
                },
            });

            // Also seed metrics
            const minuteBucket = new Date(timestamp);
            minuteBucket.setSeconds(0, 0);

            await prisma.apiMetrics.upsert({
                where: { apiId_minuteBucket: { apiId: api.id, minuteBucket } },
                update: {
                    requestCount: { increment: 1 },
                    errorCount: statusCode >= 400 ? { increment: 1 } : undefined,
                    totalLatency: { increment: latencyMs },
                },
                create: {
                    apiId: api.id,
                    minuteBucket,
                    requestCount: 1,
                    errorCount: statusCode >= 400 ? 1 : 0,
                    totalLatency: latencyMs,
                },
            });
        }
        console.log(`   📊 50 sample logs created`);
    }

    console.log('\n✅ Seed complete!');
    console.log('\n📧 Login: developer@flowops.dev / password123');
}

seed()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
