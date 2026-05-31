# FlowOps HQ Project Documentation

## 1. Project Overview

FlowOps HQ is an AI infrastructure control plane for teams building applications on top of large language models. The project combines an AI gateway, API key management, request logging, rate limiting, analytics, and a React dashboard into one local-first developer platform.

At a high level, FlowOps HQ sits between a client application and upstream AI providers. Instead of sending prompts directly to OpenAI, Anthropic, or Google Gemini, the client sends requests to FlowOps HQ. FlowOps HQ authenticates the caller, validates model access, optionally chooses a provider, forwards the request, records telemetry, and exposes the results in a dashboard.

The repository is a multi-service JavaScript/Node.js project:

- `backend/`: Express API server, gateway logic, authentication, analytics APIs, Drizzle database access.
- `frontend/`: React 19 + Vite dashboard for developers and teams.
- `worker/`: BullMQ background workers for queued log processing and analytics aggregation.
- `docker/`: Dockerfiles and Nginx config for containerized deployment.
- `scripts/`: database utility scripts.
- `logos/` and `frontend/public/`: product branding assets.

The product is branded as "FlowOps HQ - The AI Control Plane" and focuses on routing prompts, controlling LLM spend, managing API keys, and observing AI traffic.

## 2. Main Problem It Solves

Teams using LLMs often face several operational problems:

- Each provider has a different API shape.
- Provider outages or throttling can break production AI workflows.
- Token usage and LLM cost can grow without visibility.
- API keys are difficult to manage safely across environments.
- Repeated prompts waste money if they are sent to providers again and again.
- Teams need dashboards for request volume, latency, errors, cache usage, and token usage.

FlowOps HQ addresses these problems by acting as an intermediate gateway and dashboard. It provides a single control point for authentication, routing, fallback behavior, rate limits, request logs, and analytics.

## 3. Current Tech Stack

### Backend

- Node.js
- Express.js
- Drizzle ORM
- postgres.js PostgreSQL driver
- PostgreSQL
- Redis
- BullMQ
- Axios
- Zod validation
- JWT authentication
- bcryptjs password hashing
- Winston logging
- js-tiktoken / tiktoken token counting
- Jest + Supertest for tests

### Frontend

- React 19
- Vite
- React Router
- TanStack React Query
- Zustand
- Axios
- Tailwind CSS v4
- Recharts
- react-hot-toast

### Worker

- Node.js
- BullMQ
- Redis
- Drizzle database access through the backend database bridge
- Winston logging

### Infrastructure

- Docker Compose
- PostgreSQL container
- Redis container
- Backend container
- Worker container
- Frontend container served through Nginx

## 4. Repository Structure

```text
FlowOps/
  backend/
    src/
      app.js
      server.js
      config/
      db/
      gateway/
      middleware/
      modules/
      routes/
      utils/
    drizzle.config.js
    package.json
  frontend/
    src/
      pages/
      services/
      state/
      ui/
      App.jsx
      main.jsx
    vite.config.js
    package.json
  worker/
    src/
      config/
      processors/
      utils/
      index.js
    package.json
  docker/
  scripts/
  logos/
  docker-compose.yml
  package.json
  README.md
  ROADMAP.md
```

## 5. Backend Architecture

The backend is an Express application built around a modular route structure.

### Startup Flow

The backend starts from `backend/src/server.js`.

1. Imports the Express app from `backend/src/app.js`.
2. Loads validated environment variables from `backend/src/config/env.js`.
3. Starts listening on `env.PORT`.
4. Registers graceful shutdown handlers for `SIGTERM` and `SIGINT`.
5. On shutdown, closes the HTTP server, PostgreSQL connection, and Redis connection.
6. Logs unhandled rejections and uncaught exceptions.

### Express App Setup

`backend/src/app.js` configures:

- Helmet security headers.
- CORS with `env.CORS_ORIGIN`.
- JSON and URL-encoded body parsing with `env.BODY_SIZE_LIMIT`.
- Request ID middleware.
- Request logging middleware.
- Application routes through `registerRoutes(app)`.
- Centralized error handling.

### Registered Backend Routes

Routes are assembled in `backend/src/routes/index.js`.

Public/system routes:

- `GET /health`: checks PostgreSQL and Redis connectivity.
- `GET /metrics`: returns process uptime and memory usage.

Versioned API routes:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/apis`
- `/api/v1/keys`
- `/api/v1/rate-limits`
- `/api/v1/logs`
- `/api/v1/analytics`

Gateway route:

- `/gateway`

Fallback:

- Any unmatched route returns a 404 JSON error.

## 6. Authentication and User Management

Authentication lives under `backend/src/modules/auth`.

### Auth Endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

Registration:

- Validates request data with Zod.
- Checks if the email already exists.
- Hashes the password using bcrypt with 12 salt rounds.
- Inserts a new user into PostgreSQL.
- Returns the user profile and a JWT.

Login:

- Looks up the user by email.
- Compares the submitted password with the stored password hash.
- Returns a JWT if credentials are valid.

JWT payload:

- `userId`
- `email`

The JWT is signed with `JWT_SECRET` and expires according to `JWT_EXPIRES_IN`.

### User Endpoints

- `GET /api/v1/users/me`
- `PUT /api/v1/users/me`

These routes use `authMiddleware`, so the caller must provide a valid bearer token.

## 7. Database Model

The current backend uses Drizzle ORM. The Drizzle schema is in `backend/src/db/schema.js`.

Important note: the README still mentions Prisma in some places, but the active backend code has moved to Drizzle.

### `users`

Stores developer accounts.

Fields include:

- `id`
- `email`
- `name`
- `passwordHash`
- `subscriptionTier`
- `createdAt`
- `updatedAt`

Subscription tier defaults to `FREE`.

### `apis`

Stores gateway/API configurations owned by users.

Fields include:

- `id`
- `name`
- `slug`
- `baseUrl`
- `userId`
- `isActive`
- `fallbackProviders`
- `retryCount`
- `loadBalancingWeights`
- `slackWebhookUrl`
- `errorAlertThreshold`
- `alertWindowMinutes`
- `costLimitAlert`
- timestamps

This table is used both for dashboard-managed API configurations and alert settings.

### `api_keys`

Stores FlowOps-generated API keys.

Fields include:

- `id`
- `apiId`
- `name`
- `keyHash`
- `keyPrefix`
- `revoked`
- `createdAt`

Raw keys are returned only once when created. The database stores a hash and prefix, not the full plaintext key.

### `request_logs`

Stores gateway request telemetry.

Fields include:

- `apiId`
- `endpoint`
- `method`
- `statusCode`
- `latencyMs`
- `ip`
- `apiKeyId`
- `requestId`
- `tokensUsed`
- `promptTokens`
- `completionTokens`
- `cacheHit`
- `provider`
- `model`
- prompt optimization metrics
- `timestamp`

This table powers logs, analytics, model/provider metrics, cache metrics, and alert calculations.

### `rate_limits`

Stores per-API request limits.

Fields include:

- `apiId`
- `requestsPerMinute`
- `requestsPerDay`

### `api_metrics`

Stores minute-level aggregated metrics.

Fields include:

- `apiId`
- `minuteBucket`
- `requestCount`
- `errorCount`
- `totalLatency`

The worker updates this table from queued request-log jobs.

## 8. API Configuration Features

API configuration routes live under `backend/src/modules/apis`.

Endpoints:

- `GET /api/v1/apis`: list the authenticated user's API configurations.
- `GET /api/v1/apis/:id`: get one API configuration.
- `POST /api/v1/apis`: create a new API configuration.
- `PUT /api/v1/apis/:id`: update an API configuration.
- `DELETE /api/v1/apis/:id`: delete an API configuration.

When an API configuration is created, the backend also creates a default rate-limit record.

API records can configure:

- A display name.
- A unique slug.
- A target base URL.
- Whether the API is active.
- Retry count.
- Fallback provider order.
- Weighted load balancing configuration.
- Slack webhook alert target.
- Error-rate alert threshold.
- Alert evaluation window.
- Cost limit alert threshold.

## 9. API Key Management

API key routes live under `backend/src/modules/apiKeys`.

Endpoints:

- `GET /api/v1/keys`
- `POST /api/v1/keys`
- `DELETE /api/v1/keys/:id`

Features:

- List keys across all APIs owned by the current user.
- Filter keys by `apiId`.
- Generate a new key for a specific API.
- Return the raw key once at creation time.
- Store only a hashed key and visible prefix.
- Revoke keys without deleting historical request logs.

The gateway hashes incoming keys and compares the hash against `api_keys.keyHash`.

## 10. Rate Limiting

There are two rate-limit concepts in the codebase.

### Dashboard API Rate Limits

The `rate_limits` table stores request-per-minute and request-per-day settings for configured APIs.

Endpoints:

- `GET /api/v1/rate-limits/:apiId`
- `PUT /api/v1/rate-limits/:apiId`

### Gateway Token Budget Limit

The LLM gateway enforces a token-per-minute budget in Redis.

In `backend/src/gateway/core/universalRouter.js`:

- Calculates prompt tokens using `js-tiktoken`.
- Uses a Redis key named `tpm_limit:<identifier>`.
- Enforces a hard-coded 50,000 token-per-minute budget.
- Increments the used token count before forwarding to a provider.
- Expires the Redis token budget key after 60 seconds.

## 11. Gateway Architecture

The gateway code lives under `backend/src/gateway`.

There are two gateway styles in the codebase:

1. Active SaaS LLM gateway mounted at `/gateway/v1/chat/completions`.
2. Generic slug-based proxy pipeline in `gateway.middleware.js`, currently present in code but not visibly mounted from `gateway.routes.js`.

### Active LLM Gateway

Endpoint:

```text
POST /gateway/v1/chat/completions
```

This endpoint expects an OpenAI-style chat completion body:

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

Authentication can use:

- `Authorization: Bearer <flowops-key>`
- `x-flowops-api-key: <flowops-key>`
- special sandbox key: `mock-key`

The gateway flow:

1. Reads the FlowOps key from headers.
2. Supports `mock-key` sandbox mode.
3. For real keys, hashes the key and checks `api_keys`.
4. Loads the associated API and user.
5. Determines the user's subscription tier.
6. Validates the requested model against tier access.
7. Maps model to provider.
8. Optionally applies database-driven weighted provider selection.
9. Injects upstream provider keys from environment variables.
10. Resolves retry count.
11. Resolves fallback provider chain.
12. Calls the universal router.
13. Logs request telemetry asynchronously.
14. Returns the provider-shaped response normalized to OpenAI chat format where possible.

### Tier-Based Model Access

Current tier rules:

- `FREE`: `gemini-1.5-flash`
- `PRO`: `gemini-1.5-flash`, `gpt-4o-mini`
- `MAX`: `gemini-1.5-flash`, `gpt-4o-mini`, `gpt-4o`, `anthropic/claude-3-5-sonnet`

### Provider Mapping

Current model/provider mapping:

- `gemini-1.5-flash` -> `gemini`
- `gpt-4o-mini` -> `openai`
- `gpt-4o` -> `openai`
- `anthropic/claude-3-5-sonnet` -> `anthropic`

### Universal Router

`backend/src/gateway/core/universalRouter.js` is the main provider abstraction.

It defines translators for:

- OpenAI
- Anthropic
- Gemini

The router handles:

- OpenAI-compatible request input.
- Provider-specific request translation.
- Provider-specific response normalization.
- Redis prompt cache.
- Token-per-minute limiting.
- Retry with exponential backoff.
- Provider fallback routing.
- Mock provider responses for sandbox/testing.

### Semantic Cache

The cache is currently implemented as exact prompt-message caching in Redis.

Cache key:

```text
prompt_cache:<base64 JSON of messages>
```

Behavior:

- If `x-flowops-cache` is not `false`, the gateway checks Redis before calling the provider.
- Cache hits return the stored response.
- Provider responses are cached for 1 hour.

Important distinction: README language says "semantic caching", but the current implementation is exact serialized-message caching, not vector similarity search.

### Retry and Fallback

The universal router retries transient failures:

- HTTP 429
- HTTP 5xx

Retry delay uses exponential backoff capped at 8 seconds.

If retries are exhausted and fallback providers exist, the router switches providers and selects a compatible fallback model.

### Mock Mode

If the upstream provider key is `mock-key`, the router does not call external providers. It waits about 1 second and returns a simulated chat completion response.

This is useful for local demos, dashboard population, and testing cache/fallback behavior without provider billing.

## 12. Prompt Optimizer

`backend/src/gateway/core/promptOptimizer.js` implements prompt compression logic.

It can:

- Count original prompt tokens.
- Skip short prompts.
- Cache optimized prompts in Redis for 24 hours.
- Use OpenAI `gpt-4o-mini` to compress long user messages.
- Return mock optimization stats in sandbox mode.
- Gracefully fall back to original prompts if optimization fails.

Current implementation note: the optimizer module exists, but a search did not show it being wired into the active `/gateway/v1/chat/completions` request flow. The database schema and observability layer already include fields for optimization metrics, but the active gateway route currently logs default optimization values unless this integration is added.

## 13. Observability and Logging

FlowOps has two logging paths.

### Active LLM Gateway Logging

`backend/src/gateway/core/observability.js` provides `logRequestAsync`.

It inserts request telemetry into `request_logs` without awaiting the insert in the HTTP response path. After the insert succeeds, it triggers alert checks asynchronously.

Captured data includes:

- API ID
- endpoint
- method
- status code
- latency
- IP
- API key ID
- request ID
- prompt tokens
- completion tokens
- total tokens
- cache hit
- provider
- model
- optimization metrics

### Queued Proxy Logging

`backend/src/gateway/gateway.middleware.js` pushes `process-log` jobs into a BullMQ queue named `request-logs`.

The worker consumes that queue and writes request logs plus minute-level metrics. This path appears intended for the slug-based generic proxy pipeline.

## 14. Analytics Features

Analytics routes live under `backend/src/modules/analytics`.

Endpoints:

- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/traffic`
- `GET /api/v1/analytics/endpoints`
- `GET /api/v1/analytics/errors`
- `GET /api/v1/analytics/llm-metrics`
- `GET /api/v1/analytics/cache`
- `GET /api/v1/analytics/users`
- `GET /api/v1/analytics/feedback`
- `GET /api/v1/analytics/summary`

Analytics capabilities:

- Total request count.
- Error rate.
- Average latency.
- Active API count.
- Total token count.
- Cache hit ratio.
- Traffic over time.
- Top endpoints.
- Error distribution by status code.
- Provider and model distribution.
- Cache hit count and estimated savings.
- Approximate user count based on unique IPs.
- Heuristic quality/sentiment score based on success, latency, and cache hits.
- Summary grouping by provider, model, status code, API key, config, or prompt.

The analytics API enforces ownership by only aggregating logs for APIs owned by the authenticated user.

## 15. Alerts

Alert logic lives in `backend/src/gateway/core/alerts.js`.

Supported alert types:

- High gateway error rate.
- Monthly cost cap.

The alert evaluator:

1. Loads the API configuration.
2. Returns immediately if no Slack webhook is configured.
3. Checks recent request volume and error count.
4. Sends a Slack webhook if error rate exceeds the configured threshold.
5. Calculates month-to-date cost from token usage and model/provider rates.
6. Sends a Slack webhook if the monthly cost estimate exceeds the configured cap.
7. Uses Redis cooldown keys to avoid alert spam.

Default alert-related API fields:

- `errorAlertThreshold`: 5 percent
- `alertWindowMinutes`: 5 minutes
- `costLimitAlert`: 100 dollars

## 16. Worker Service

The worker starts from `worker/src/index.js`.

It defines three BullMQ workers:

- `request-logs`
- `analytics`
- `cleanup`

### Request Log Processor

`worker/src/processors/logProcessor.js`:

- Consumes `process-log` jobs.
- Inserts a request log into `request_logs`.
- Updates or creates a minute bucket in `api_metrics`.

### Analytics Processor

`worker/src/processors/analyticsProcessor.js`:

- Aggregates request count and average latency for an API over a date range.
- Returns the aggregate result.

### Cleanup Processor

The cleanup processor exists in the worker structure and is intended for periodic cleanup jobs such as rate-limit cleanup.

### Worker Implementation Note

`worker/src/config/database.js` re-exports the backend database config. However, `worker/src/index.js` imports `{ prisma }` and calls `prisma.$disconnect()` during shutdown. The active backend database bridge exports Drizzle objects, not Prisma. This shutdown path likely needs updating to use `sql.end()` instead.

## 17. Frontend Architecture

The frontend is a Vite React application.

Entry points:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

Routing is handled by React Router. Data fetching and mutations use TanStack React Query. Global auth and organization state use Zustand.

The Vite dev server proxies `/api` to `http://localhost:5000`, so frontend service calls can use `/api/v1`.

### Main Frontend Routes

- `/`: landing page.
- `/dashboard`: getting started and integration dashboard.
- `/analytics`: analytics dashboard.
- `/apis`: managed API/workspace control page.
- `/keys`: access token management.
- `/logs`: live request logs.
- `/settings`: organization/settings page.
- `/billing/upgrade`: upgrade page.
- `/profile`: user profile page.
- `/login`: login page.
- `/register`: registration page.
- `/onboarding`: onboarding page.
- `/contact`: contact/support page.
- `/docs`: documentation area.

Protected routes are wrapped in `ProtectedRoute`.

### Auth Store

`frontend/src/state/authStore.js` currently initializes with a mock token and mock user and sets `isAuthenticated: true`. This makes the dashboard accessible in demo mode even before strict login is completed.

This is useful for product demos, but production auth should remove the default mock authentication bypass.

### API Client

`frontend/src/services/api.js` defines:

- Axios base URL: `/api/v1`
- JSON request headers.
- 10 second timeout.
- Request interceptor that injects `Authorization: Bearer <token>` from local storage.
- Response interceptor that unwraps `response.data`.

Service modules:

- `authService`
- `gatewayService`
- `analyticsService`
- `logsService`
- `apisService`
- `apiKeysService`

### Sidebar and Navigation

The sidebar provides navigation for:

- Gateway onboarding / dashboard.
- Access tokens.
- Workspace control.
- Analytics.
- Logs.
- Documentation/contact through help menu.

It also includes UI for:

- Collapsing/expanding the sidebar.
- Switching organizations.
- Creating local organization records.
- Inviting team members in a modal.
- Upgrade prompt.

Several future sections are shown as disabled/coming soon:

- Model Catalog
- MCP
- Agents
- Guardrails
- Configs
- LLM Integrations
- MCP Registry
- Agent Integrations

## 18. Frontend Feature Pages

### Landing Page

Marketing/product entry page for FlowOps HQ.

### Dashboard Page

The dashboard focuses on first-run integration.

Features include:

- Welcome/getting started panel.
- Current organization context.
- API key visibility toggle.
- Copy-to-clipboard for key and code snippets.
- Provider quick integration flow.
- Creates an API config and key through backend mutations.
- Shows integration snippets for Node.js, Python, and curl.
- Lets the user choose a model and integration language.

### Managed APIs Page

Manages API configurations through the `apisService`.

Core operations:

- List APIs.
- Create API configuration.
- Delete API configuration.

### Access Tokens Page

Manages FlowOps API keys.

Core operations:

- List APIs for key association.
- List API keys.
- Create key.
- Revoke key.
- Shows raw key only after creation.

### Analytics Page

Fetches and visualizes multiple analytics endpoints.

Data sources:

- Overview metrics.
- Traffic metrics.
- Endpoint metrics.
- LLM provider/model metrics.
- Error metrics.
- Logs.
- Cache metrics.
- User metrics.
- Feedback metrics.
- Summary metrics.

### Live Logs Page

Displays request logs from `GET /api/v1/logs` with filters such as API, status, method, date range, page, and limit.

### Docs Page

Provides in-app documentation with language tabs. Python appears to have the most complete example, while other language tabs show placeholder update text in the current code.

### Settings, Profile, Billing, Contact, Onboarding

These pages round out the product experience around account management, organization setup, upgrade flow, support, and onboarding.

## 19. Docker and Deployment

`docker-compose.yml` defines the full stack:

- `postgres`: PostgreSQL 16 Alpine.
- `redis`: Redis 7 Alpine.
- `backend`: Express backend on port 5000.
- `worker`: BullMQ background worker.
- `frontend`: built frontend served on port 5173 through Nginx.

Backend container environment includes:

- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `BODY_SIZE_LIMIT`
- `LOG_LEVEL`

Health checks:

- PostgreSQL uses `pg_isready`.
- Redis uses `redis-cli ping`.
- Backend checks `GET /health`.
- Frontend checks HTTP availability.

## 20. Environment Variables

Important environment variables:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `BODY_SIZE_LIMIT`
- `SENTRY_DSN`
- `LOG_LEVEL`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

The backend validates core environment variables at startup with Zod in `backend/src/config/env.js`.

Current `.env.example` includes `OPENAI_API_KEY`, but does not list `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`, even though the gateway reads them from `process.env`.

## 21. Local Development Commands

From the repository root:

```bash
npm run dev
```

This runs:

- backend dev server
- frontend dev server
- worker dev process

Other useful root scripts:

```bash
npm run build
npm run lint
npm run test
npm run db:push
npm run db:seed
npm run db:studio
npm run docker:up
npm run docker:down
```

Backend scripts:

```bash
npm run dev
npm run start
npm run lint
npm run test
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

Frontend scripts:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Worker scripts:

```bash
npm run dev
npm run start
```

## 22. Testing

The backend has Jest and Supertest configured.

Current test file:

- `backend/src/app.test.js`

Current covered behavior:

- `GET /metrics` returns process metrics successfully.

The test mocks:

- database config
- Redis config

The current test suite is minimal. More tests would be useful for:

- auth registration/login
- API ownership checks
- API key generation/revocation
- gateway model-tier restrictions
- mock-key gateway flow
- cache hit behavior
- fallback behavior
- analytics aggregation
- alert threshold logic

## 23. Important Current Gaps and Implementation Notes

These are not criticisms of the project; they are important details for anyone trying to understand or continue it.

### Drizzle vs Prisma Documentation Drift

The README and roadmap still mention Prisma in several places. The active backend code uses Drizzle ORM and postgres.js.

### Exact Cache vs Semantic Cache

The README describes semantic similarity caching. The current router uses exact Redis caching based on serialized messages. There is no vector embedding or similarity search layer in the active code.

### Prompt Optimizer Not Wired Into Active Gateway

The optimizer module exists and is reasonably complete, but it does not appear connected to the active gateway route. The schema supports optimization metrics, but the active logging path does not currently populate them from optimizer output.

### Generic Proxy Pipeline Not Mounted

`gateway.middleware.js` implements a slug-based generic proxy pipeline with API-key validation, request-per-minute limiting, proxy forwarding, and queued logging. The active `gateway.routes.js` currently mounts only `/v1/chat/completions`.

### Worker Shutdown Uses Old Prisma Name

The worker imports `{ prisma }` from database config and calls `prisma.$disconnect()`, but the shared database config exports Drizzle/postgres.js objects. This should be updated before relying on graceful worker shutdown.

### Frontend Auth Is Demo-Friendly

The frontend auth store initializes with a mock token, mock user, and `isAuthenticated: true`. This is helpful for demos but should be tightened for production.

### Missing Provider Environment Examples

The gateway reads `OPENAI_API_KEY`, `GEMINI_API_KEY`, and `ANTHROPIC_API_KEY`. `.env.example` currently only lists `OPENAI_API_KEY`.

### Documentation Encoding Artifacts

Some existing Markdown and code comments contain mojibake/encoding artifacts, likely from emoji or special characters being saved or rendered with the wrong encoding.

## 24. End-to-End Request Example

A typical LLM request flow looks like this:

1. A client sends `POST /gateway/v1/chat/completions`.
2. The request contains a model and messages.
3. The client authenticates with a FlowOps API key.
4. FlowOps hashes the key and finds the matching key record.
5. FlowOps loads the associated API and user.
6. FlowOps checks the user's subscription tier.
7. FlowOps determines the provider for the requested model.
8. FlowOps applies retry/fallback/load-balancing settings.
9. The universal router counts prompt tokens.
10. Redis token budget is checked.
11. Redis prompt cache is checked.
12. On cache miss, the request is translated to provider format.
13. Provider is called, or mock response is generated in sandbox mode.
14. Response is normalized.
15. Response is cached in Redis for future identical prompts.
16. Request telemetry is inserted into PostgreSQL asynchronously.
17. Alert checks run after telemetry insertion.
18. Client receives the chat completion response.

## 25. Product Feature Summary

Implemented or partially implemented features:

- User registration and login.
- JWT authentication.
- API configuration management.
- API key generation and revocation.
- Hashed key storage.
- React dashboard.
- Organization-style UI state.
- LLM gateway endpoint.
- Model access by subscription tier.
- Provider abstraction for OpenAI, Anthropic, and Gemini.
- Mock gateway mode.
- Redis prompt cache.
- Token-per-minute Redis limiter.
- Retry with exponential backoff.
- Provider fallback chains.
- Weighted provider selection from database config.
- Request logging.
- Analytics endpoints.
- Live logs endpoint.
- Slack webhook alert logic.
- Docker Compose stack.
- Worker queue processors for generic proxy logs and metrics.

Planned or shown as future-facing:

- True semantic/vector caching.
- Fully wired prompt optimizer.
- SDK packages.
- Team collaboration and RBAC.
- Model catalog.
- MCP and agent integrations.
- Guardrails/config management.
- Cloud deployment.

## 26. How to Explain This Project Simply

FlowOps HQ is like an operations dashboard and gateway for AI apps. Developers connect their applications to FlowOps instead of connecting directly to every LLM provider. FlowOps then decides how to route requests, protects usage with keys and limits, records everything that happened, and shows the team analytics about cost, speed, errors, cache hits, and provider usage.

It is part API gateway, part LLM router, part observability dashboard, and part developer console.

