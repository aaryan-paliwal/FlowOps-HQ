const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const logger = require('../utils/logger');
const schema = require('./schema');

// ─── Create postgres.js connection (ultra-fast, no Rust binary overhead) ───
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    logger.error('DATABASE_URL is not set. Cannot initialize database.');
    process.exit(1);
}

const sql = postgres(connectionString, {
    max: 20,              // connection pool size
    idle_timeout: 20,     // seconds before idle connections are closed
    connect_timeout: 10,  // seconds to wait for a connection
    onnotice: () => {},   // suppress NOTICE messages
});

// ─── Initialize Drizzle ORM with full schema for relational queries ───
const db = drizzle(sql, { schema });

logger.info('Drizzle ORM initialized with postgres.js driver');

module.exports = { db, sql, schema };
