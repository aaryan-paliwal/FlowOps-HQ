-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apis" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_logs" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "ip" TEXT,
    "apiKeyId" TEXT,
    "requestId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 100,
    "requestsPerDay" INTEGER NOT NULL DEFAULT 5000,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_metrics" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "minuteBucket" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalLatency" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "api_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "apis_slug_key" ON "apis"("slug");

-- CreateIndex
CREATE INDEX "apis_userId_idx" ON "apis"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_keyHash_idx" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_apiId_idx" ON "api_keys"("apiId");

-- CreateIndex
CREATE INDEX "request_logs_apiId_timestamp_idx" ON "request_logs"("apiId", "timestamp");

-- CreateIndex
CREATE INDEX "request_logs_statusCode_idx" ON "request_logs"("statusCode");

-- CreateIndex
CREATE INDEX "request_logs_apiId_statusCode_idx" ON "request_logs"("apiId", "statusCode");

-- CreateIndex
CREATE INDEX "request_logs_timestamp_idx" ON "request_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limits_apiId_key" ON "rate_limits"("apiId");

-- CreateIndex
CREATE INDEX "api_metrics_apiId_minuteBucket_idx" ON "api_metrics"("apiId", "minuteBucket");

-- CreateIndex
CREATE UNIQUE INDEX "api_metrics_apiId_minuteBucket_key" ON "api_metrics"("apiId", "minuteBucket");

-- AddForeignKey
ALTER TABLE "apis" ADD CONSTRAINT "apis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_metrics" ADD CONSTRAINT "api_metrics_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "apis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
