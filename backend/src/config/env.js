const { z } = require('zod');
require('dotenv').config();

// ─── Validate all env vars at startup (fail fast) ───
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  BODY_SIZE_LIMIT: z.string().default('10kb'),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  console.error(parsed.error.format());
  process.exit(1);
}

module.exports = { env: parsed.data };
