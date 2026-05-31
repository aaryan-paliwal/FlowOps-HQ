/**
 * FlowOps HQ Database Check
 * Quick diagnostic to verify database contents.
 * Usage: node src/check-db.js
 */

require('dotenv').config();
const { count } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const schema = require('./db/schema');

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });
const { users, apis, apiKeys, requestLogs } = schema;

async function check() {
    console.log('--- Database Check ---');
    const allUsers = await db.select({ id: users.id, email: users.email, name: users.name }).from(users);
    console.log('Users:', allUsers);

    const allApis = await db.select({ id: apis.id, name: apis.name, slug: apis.slug }).from(apis);
    console.log('APIs:', allApis);

    const allKeys = await db.select({
        id: apiKeys.id, name: apiKeys.name, keyPrefix: apiKeys.keyPrefix,
        apiId: apiKeys.apiId, revoked: apiKeys.revoked
    }).from(apiKeys);
    console.log('API Keys:', allKeys);

    const [logCount] = await db.select({ count: count() }).from(requestLogs);
    console.log('Total Request Logs:', logCount?.count || 0);
}

check()
    .catch(console.error)
    .finally(() => sql.end());
