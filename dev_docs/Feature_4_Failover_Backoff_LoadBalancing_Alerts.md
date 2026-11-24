# Feature 4: Deterministic Failover, Full Jitter Exponential Backoff, Weighted Load Balancing & Alerting

## 1. Executive Summary & Real-World Problem

Relying on a single AI provider API in production creates three brittle failure modes:
1. **Transient Capacity Spikes & `HTTP 429` Throttling:** Instant retries hammer rate-limited endpoints in lockstep ("thundering herd"), compounding failures instead of allowing congestion to drain.
2. **Regional / Model Outages (`HTTP 5xx`):** Even with retries, an upstream provider outage leaves downstream users broken unless traffic automatically reroutes to an alternative vendor (e.g., OpenAI -> Google Gemini -> Anthropic).
3. **Silent Cost Runaways & Elevated Error Rates:** Without proactive threshold monitoring and Slack webhook alerts, runaway recursive agent loops or degraded endpoints burn budgets before engineers notice.

**FlowOps Feature 4** delivers production resilience across the gateway, background alerts, and control plane UI:
* **Full Jitter Exponential Backoff (`computeBackoffDelayMs`):** Decorrelates retries across concurrent callers on `HTTP 429` and `5xx` errors (`[100ms, min(1000 * 2^attempt, 8000ms)]`).
* **Deterministic Ordered Fallback Chain (`fallbackProviders`):** Transparently cascades failed primary calls (with translated payloads and default target models via `DEFAULT_FALLBACK_MODELS`) while allowing BYOK headers to unlock fallbacks on any tier.
* **Cumulative Weighted Load Balancing (`loadBalancingWeights`):** Splits traffic proportionally across configured providers in PostgreSQL (`apis.loadBalancingWeights`).
* **SSRF-Safe Slack Webhook Alerting & Test Endpoint (`alerts.js` + `POST /api/v1/apis/:id/test-alert`):** Evaluates sliding-window error rates and monthly model-aware cost caps with Redis cooldown locks, guarding outbound webhook URLs via `validateTargetUrl(url, { allowLocal: false })`.

---

## 2. Portkey AI (`portkey-ai/gateway`) Reference Architecture & Comparison

| Dimension | Portkey AI Reference (`src/`) | FlowOps HQ Implementation | Engineering Trade-off |
| :--- | :--- | :--- | :--- |
| **Retry Policy & Backoff** | `handlers/retryHandler.ts` (`retryRequest`) — Uses `async-retry` over `statusCodesToRetry`, honors upstream `retry-after` headers, capped by `MAX_RETRY_LIMIT_MS`. | `universalRouter.js` (`computeBackoffDelayMs`) — Retries `statusCode === 429 || statusCode >= 500` up to `retryCount` (`0`–`5`) with bounded Full Jitter `[100ms, min(1000 * 2^attempt, 8000ms)]`. | Zero dependency (`Math.random() * min(cap, 2^attempt * 1000)`) ensures uniform retry spread; honors configurable route/header retry budget (`x-flowops-retries`). |
| **Fallback & Load Balancing Modes** | `handlers/handlerUtils.ts` (`tryTargetsRecursively`) — Supports `StrategyModes.FALLBACK` (sequential chain) and `StrategyModes.LOADBALANCE` (`Math.random() * totalWeight`). | `gateway.routes.js` (weighted random selection when providers have keys) + `universalRouter.js` (`buildFallbackRequest` across `fallbackProviders` / `x-flowops-fallbacks`). | FlowOps applies BYOK credential checks before swapping or failing over so free-tier or missing-key providers never poison load balancing or fallback selection. |
| **Failover & Retry Telemetry** | Internal trace metadata (`x-portkey-retry-count`, target index tracking). | `x-flowops-retry-count`, `x-flowops-fallback-used`, `x-flowops-failover-from` response headers + PostgreSQL `request_logs.retryAttempts` & `request_logs.failoverUsed`. | Every log row carries retry and failover provenance cleanly into `AnalyticsPage.jsx` and `LiveLogsPage.jsx`. |
| **Budget & Error Alerting** | Enterprise control plane dashboards/webhooks outside OSS gateway worker. | `backend/src/gateway/core/alerts.js` (`checkAndTriggerAlerts`, `sendTestSlackAlert`) + `RoutingConfigStudio.jsx` **Alerts & Caching** tab. | Integrated directly into asynchronous gateway logging with Redis cooldown keys (`alert_cooldown:error:<apiId>`, `alert_cooldown:cost:<apiId>`). |

---

## 3. Core Engineering Concepts & Vocabulary

* **Full Jitter Exponential Backoff:** Standard exponential backoff retries at deterministic intervals (`1s`, `2s`, `4s`), causing synchronized bursts across failing clients. Full Jitter samples uniformly in `[100ms, min(8000ms, 1000 * 2^attempt)]`, minimizing collision variance under heavy concurrency.
* **Resilience vs. Client Error Classification:** FlowOps only retries transient failures (`statusCode === 429 || statusCode >= 500`), never blindly retrying `400 Bad Request` or `401 Unauthorized` payloads (except failing over cleanly when configured/simulated in test flows).
* **Cumulative Distribution Weighting (`loadBalancingWeights`):** Given `{ openai: 50, gemini: 30, anthropic: 20 }`, draws `r = Math.random() * totalWeight` and subtracts weights iteratively until `r <= 0`, routing traffic only if the chosen provider has valid BYOK or server `.env` credentials (`selectedHasKey`).
* **BYOK Fallback Override (`gateway.routes.js`):** Previously restricted fallback targets to subscription `TIER_ACCESS`. FlowOps checks `allowedProvidersInTier.has(prov) || hasByok`, so even a `FREE` user supplying `x-openai-key` / `x-gemini-key` / `x-anthropic-key` / `x-flowops-target-url` can exercise multi-provider fallback chains cleanly.
* **Cooldown-Guarded Alerting & SSRF Protection:**
  * Error-rate checks require at least 5 samples (`totalRequests >= 5`) in `alertWindowMinutes` before firing Slack cards, debounced with a 15-minute Redis key (`alert_cooldown:error:<apiId>`).
  * Monthly spend uses `MODEL_RATES` (`gemini-3.5-flash` at `$0.075/1M`, `gpt-4o-mini` at `$0.15/1M`, `gpt-4o` at `$2.50/1M`, `claude-3-5-sonnet` at `$3.00/1M`), debounced for 24 hours (`alert_cooldown:cost:<apiId>`).
  * Both `apis.schema.js` (`slackWebhookUrlSchema`) and `postSlackAlert()` enforce `validateTargetUrl(url, { allowLocal: false })` so attackers cannot pivot gateway servers into VPC/localhost webhook endpoints.

---

## 4. End-to-End Resilience & Alert Flow

```
POST /v1/chat/completions
   │  model: "gpt-4o", x-flowops-fallbacks: "gemini,anthropic", retryCount: 2
   ▼
[gateway.routes.js]
   ├─ Resolve `retryCount` (`x-flowops-retries` -> DB `api.retryCount` -> 2)
   ├─ Resolve `fallbackChain` (`x-flowops-fallbacks` -> DB `api.fallbackProviders` -> tier/BYOK defaults)
   └─ Apply Weighted LB if active & provider keys exist
        │
        ▼
[universalRouter.js] Attempt 0..N
   ├─ `HTTP 429` or `HTTP 5xx` (or `x-flowops-simulate-error: 503` matching `x-flowops-simulate-provider`)
   │    ├─ `attempt < retryCount` -> increment `meta.retryAttempts`, sleep `computeBackoffDelayMs(attempt)`, retry
   │    └─ Retries exhausted -> pop next provider from `fallbackChain`
   │         ├─ Set `failoverUsed = true`, `failoverFrom = primaryProvider`
   │         ├─ Map `fallbackModel` via `DEFAULT_FALLBACK_MODELS` & re-translate body
   │         └─ Execute secondary provider -> HTTP 200 OK with `x-flowops-fallback-used: true`
   │
   └─ Post-request `logRequestAsync` -> Queue BullMQ job + fire-and-forget `checkAndTriggerAlerts(apiId)`
```

---

## 5. Control Plane & Verification

* **`apis.controller.js` Mass-Assignment Guard & Test Alert:**
  * `updateApi` strictly filters incoming keys through `ALLOWED_UPDATE_FIELDS` (`name`, `baseUrl`, `isActive`, `smartRoutingEnabled`, `routingStrategy`, `fallbackProviders`, `retryCount`, `loadBalancingWeights`, `slackWebhookUrl`, `errorAlertThreshold`, `alertWindowMinutes`, `costLimitAlert`).
  * `POST /api/v1/apis/:id/test-alert` (`testAlert`) dispatches an immediate verified test attachment to Slack via `sendTestSlackAlert`.
* **UI Controls (`RoutingConfigStudio.jsx` + `GatewayPlayground.jsx`):**
  * **Fallbacks**, **Load Balancing**, **Retries**, and **Alerts & Caching** tabs configure and persist rules via `PUT /api/v1/apis/:id`.
  * **Test Alert** button invokes `apisService.testAlert(route.id, { slackWebhookUrl })`.
  * `GatewayPlayground.jsx` offers a one-click **Simulate Primary Failure (503 Failover Test)** toggle sending `x-flowops-simulate-error: 503` and `x-flowops-fallbacks: gemini`, displaying **`RETRY xN`** and **`FAILOVER FROM ...`** badges directly in the playground response card and in `LiveLogsPage.jsx`.

### Verification Criteria
* Unit tests in `universalRouter.test.js` verify `computeBackoffDelayMs` stays within `[100, min(8000, 1000 * 2^attempt)]`, simulated OpenAI `503` populates `failoverUsed: true` + `failoverFrom: 'openai'`, and `updateApiSchema` rejects internal `slackWebhookUrl` (`localhost`, `169.254.169.254`) while accepting HTTPS Slack webhooks.

