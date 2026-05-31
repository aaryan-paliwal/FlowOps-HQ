const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Database Check ---');
    const users = await prisma.user.findMany();
    console.log('Users:', users.map(u => ({ id: u.id, email: u.email, name: u.name })));

    const apis = await prisma.api.findMany();
    console.log('APIs:', apis.map(a => ({ id: a.id, name: a.name, slug: a.slug })));

    const keys = await prisma.apiKey.findMany();
    console.log('API Keys:', keys.map(k => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, apiId: k.apiId, revoked: k.revoked })));

    const logsCount = await prisma.requestLog.count();
    console.log('Total Request Logs:', logsCount);
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
