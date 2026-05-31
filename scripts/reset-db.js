/**
 * FlowOps HQ Database Reset
 * Drops all data and re-seeds.
 * Usage: node scripts/reset-db.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
    console.log('🗑️  Resetting FlowOps HQ database...\n');

    // Delete in reverse dependency order
    await prisma.apiMetrics.deleteMany({});
    console.log('✅ Cleared api_metrics');
    await prisma.requestLog.deleteMany({});
    console.log('✅ Cleared request_logs');
    await prisma.apiKey.deleteMany({});
    console.log('✅ Cleared api_keys');
    await prisma.rateLimit.deleteMany({});
    console.log('✅ Cleared rate_limits');
    await prisma.api.deleteMany({});
    console.log('✅ Cleared apis');
    await prisma.user.deleteMany({});
    console.log('✅ Cleared users');

    console.log('\n✅ Database reset complete!');
    console.log('Run "node scripts/seed-db.js" to re-seed data.');
}

reset()
    .catch((e) => { console.error('❌ Reset failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
