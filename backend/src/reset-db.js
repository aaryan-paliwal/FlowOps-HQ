require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function reset() {
    console.log('Dropping all tables...');
    await sql`DROP SCHEMA public CASCADE`;
    await sql`CREATE SCHEMA public`;
    console.log('Database reset complete.');
    process.exit(0);
}

reset().catch(console.error);
