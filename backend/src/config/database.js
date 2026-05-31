// ─── Database Bridge ───
// This file re-exports the Drizzle ORM instance under `db`
// and provides access to the raw SQL driver and schema tables.
//
// Migration Note: Previously exported `prisma` (Prisma Client).
// Now exports `db` (Drizzle ORM) for near-zero overhead SQL queries.

const { db, sql, schema } = require('../db');

module.exports = { db, sql, ...schema };
