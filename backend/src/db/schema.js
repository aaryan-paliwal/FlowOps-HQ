const { pgTable, uuid, varchar, text, boolean, integer, doublePrecision, timestamp, index, uniqueIndex } = require('drizzle-orm/pg-core');

// ─── Users ──────────────────────────────────────
const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: text('passwordHash').notNull(),
    subscriptionTier: varchar('subscriptionTier', { length: 20 }).default('FREE').notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
});

// ─── APIs ───────────────────────────────────────
const apis = pgTable('apis', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    baseUrl: text('baseUrl').notNull(),
    userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    workspaceSlug: varchar('workspaceSlug', { length: 255 }).default('workspace-1').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    fallbackProviders: varchar('fallbackProviders', { length: 255 }).default('gemini,anthropic'),
    retryCount: integer('retryCount').default(2),
    loadBalancingWeights: text('loadBalancingWeights').default('{"openai":50,"gemini":30,"anthropic":20}'),
    slackWebhookUrl: text('slackWebhookUrl').default(''),
    errorAlertThreshold: doublePrecision('errorAlertThreshold').default(5.0),
    alertWindowMinutes: integer('alertWindowMinutes').default(5),
    costLimitAlert: doublePrecision('costLimitAlert').default(100.0),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('apis_userId_idx').on(table.userId),
    index('apis_workspaceSlug_idx').on(table.workspaceSlug),
]);

// ─── API Keys ───────────────────────────────────
const apiKeys = pgTable('api_keys', {
    id: uuid('id').defaultRandom().primaryKey(),
    apiId: uuid('apiId').notNull().references(() => apis.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: varchar('keyHash', { length: 255 }).notNull().unique(),
    keyPrefix: varchar('keyPrefix', { length: 50 }).notNull(),
    revoked: boolean('revoked').default(false).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('api_keys_keyHash_idx').on(table.keyHash),
    index('api_keys_apiId_idx').on(table.apiId),
]);

// ─── Request Logs ───────────────────────────────
const requestLogs = pgTable('request_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    apiId: uuid('apiId').notNull().references(() => apis.id, { onDelete: 'cascade' }),
    endpoint: varchar('endpoint', { length: 500 }).notNull(),
    method: varchar('method', { length: 10 }).notNull(),
    statusCode: integer('statusCode').notNull(),
    latencyMs: integer('latencyMs').notNull(),
    ip: varchar('ip', { length: 45 }),
    apiKeyId: varchar('apiKeyId', { length: 255 }),
    requestId: varchar('requestId', { length: 255 }),
    tokensUsed: integer('tokensUsed').default(0).notNull(),
    promptTokens: integer('promptTokens').default(0).notNull(),
    completionTokens: integer('completionTokens').default(0).notNull(),
    cacheHit: boolean('cacheHit').default(false).notNull(),
    provider: varchar('provider', { length: 50 }),
    model: varchar('model', { length: 100 }),
    promptOptimized: boolean('promptOptimized').default(false).notNull(),
    originalPromptTokens: integer('originalPromptTokens').default(0).notNull(),
    tokensSaved: integer('tokensSaved').default(0).notNull(),
    optimizationPercent: doublePrecision('optimizationPercent').default(0).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('request_logs_apiId_timestamp_idx').on(table.apiId, table.timestamp),
    index('request_logs_statusCode_idx').on(table.statusCode),
    index('request_logs_apiId_statusCode_idx').on(table.apiId, table.statusCode),
    index('request_logs_timestamp_idx').on(table.timestamp),
]);

// ─── Rate Limits ────────────────────────────────
const rateLimits = pgTable('rate_limits', {
    id: uuid('id').defaultRandom().primaryKey(),
    apiId: uuid('apiId').notNull().unique().references(() => apis.id, { onDelete: 'cascade' }),
    requestsPerMinute: integer('requestsPerMinute').default(100).notNull(),
    requestsPerDay: integer('requestsPerDay').default(5000).notNull(),
});

// ─── API Metrics (Aggregated by Worker) ─────────
const apiMetrics = pgTable('api_metrics', {
    id: uuid('id').defaultRandom().primaryKey(),
    apiId: uuid('apiId').notNull().references(() => apis.id, { onDelete: 'cascade' }),
    minuteBucket: timestamp('minuteBucket', { withTimezone: true }).notNull(),
    requestCount: integer('requestCount').default(0).notNull(),
    errorCount: integer('errorCount').default(0).notNull(),
    totalLatency: integer('totalLatency').default(0).notNull(),
}, (table) => [
    uniqueIndex('api_metrics_apiId_minuteBucket_idx').on(table.apiId, table.minuteBucket),
    index('api_metrics_apiId_minuteBucket_lookup_idx').on(table.apiId, table.minuteBucket),
]);

module.exports = {
    users,
    apis,
    apiKeys,
    requestLogs,
    rateLimits,
    apiMetrics,
};
