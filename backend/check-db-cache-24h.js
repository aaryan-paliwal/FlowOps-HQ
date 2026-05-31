require('dotenv').config();
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
async function run() {
    const res = await sql`SELECT "cacheHit", COUNT(*) as count, AVG("latencyMs") as avg_latency FROM request_logs WHERE timestamp >= NOW() - INTERVAL '24 hours' GROUP BY "cacheHit"`;
    console.log(res);
    process.exit(0);
}
run();
