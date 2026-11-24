# Feature 5: Production Observability, SQL Latency Percentiles & Reproducible Benchmarks

## 1. Executive Summary & Real-World Problem

Monitoring an AI gateway using only simple averages (`AVG(latencyMs)`) and hardcoded sample metrics misleads operators:
* **Tail Latency Blindness:** A 95% Redis cache hit rate can pull mean latency below `100ms`, completely hiding `P95`/`P99` cold upstream tail stalls (`2,500ms+`) affecting uncached users.
* **Synthetic / Mock Telemetry Pollution:** Auto-seeded sample logs, hardcoded fake non-cache baseline numbers (`1200ms`), and frontend mock fallbacks make demos look populated while preventing teams from trusting empty states or validating real traffic.
* **No Provenance Breakdown:** Without knowing whether cache hits came from Redis (exact) vs `pgvector` (semantic), how many requests used SSE streaming, or how many relied on retries/failovers, engineers cannot tune thresholds or provider budgets accurately.

**FlowOps Feature 5** eliminates all seeded/mock data across backend and UI while providing exact, live database telemetry:
1. **True PostgreSQL Ordered-Set Latency Percentiles (`P50`, `P90`, `P95`, `P99`):** Computed server-side via `percentile_cont(...) within group (order by "latencyMs")` in `analytics.controller.js` — never estimated or faked.
2. **Enriched Schema & Async Pipeline (`schema.js`, `observability.js`, `worker/src/processors/logProcessor.js`):** Captures `cacheTier`, `isStreaming`, `retryAttempts`, and `failoverUsed` on every request alongside token counts and optimization savings.
3. **Zero-Mock Clean-Slate Workspace Behavior:** No auto-seeded APIs, users, or frontend fallback charts; brand-new users register cleanly with 0 routes and build live telemetry as real gateway traffic flows.
4. **Reproducible Live Benchmark Harness (`benchmarks/run_live_benchmark.js`):** Credential-free harness measuring cold upstream latency, Tier 1 Redis exact hits, Tier 2 `pgvector` semantic hits, and live SSE Time-To-First-Token (`ttftMs`) against the user's real FlowOps token (`FLOWOPS_KEY`).

---

## 2. Portkey AI (`portkey-ai/gateway`) Reference Architecture & Comparison

| Dimension | Portkey AI Reference (`src/`) | FlowOps HQ Implementation | Engineering Trade-off |
| :--- | :--- | :--- | :--- |
| **Live Log Pipeline & Redaction** | `middlewares/log/index.ts` (`logClients` SSE broadcast + header sanitization `[REDACTED]`). | `observability.js` (`logRequestAsync`) batches AI gateway logs (`BATCH_SIZE=50`, `FLUSH_INTERVAL_MS=5000`) into PostgreSQL `request_logs`; `gateway.middleware.js` pushes REST proxy logs via BullMQ `"request-logs"` to `worker/src/processors/logProcessor.js` (`api_metrics` minute rollups). | Portkey broadcasts ephemeral SSE streams to log UI sockets; FlowOps persists durable relational audit rows in batches (for AI routes) and BullMQ worker jobs (for REST routes) for SQL percentile analytics. |
| **Tail Latency Metrics** | Analytics control plane aggregations (hosted SaaS). | `analytics.controller.js` (`getOverview` & `getCacheMetrics`) using native PostgreSQL `percentile_cont(0.50/0.90/0.95/0.99)`. | Exact database-level percentile math in PostgreSQL avoids pulling thousands of raw latency integers into Node memory. |
| **Cost Modeling** | Per-provider token rate calculation. | `MODEL_RATES` map (`alerts.js`, imported by `analytics.controller.js` and mirrored in `LiveLogsPage.jsx`) computes USD spend from actual token counts (`promptTokens + completionTokens`) per model. | Accurate differentiation between `gemini-3.5-flash` (`$0.075/1M`) and `gpt-4o` (`$2.50/1M`) / `claude-3-5-sonnet` (`$3.00/1M`). |
| **Security & Repo Hygiene** | Zero hardcoded credentials; middleware redacts auth headers. | Deleted all seed scripts (`seed-db.js`, `populate_logs.js`, `seed_optimizer.js`), stripped hardcoded keys from benchmarks, removed frontend `mockFallbackEnabled` paths and fake login hints. | Repository starts 100% clean for real users with zero synthetic noise. |

---

## 3. Core Engineering Concepts & Vocabulary

* **Ordered-Set Aggregate Percentiles (`percentile_cont`):** Standard SQL `AVG()` is skewed by outliers or bimodal cache-hit distributions. `percentile_cont(0.95) within group (order by "latencyMs")` interpolates exact continuous 95th percentile boundaries across `request_logs` directly inside PostgreSQL:
  * **P50 (Median):** Typical user experience.
  * **P90 / P95:** Performance seen by the slowest 5–10% of requests (uncached cold upstream calls).
  * **P99:** Worst-case tail latency (cold start, retries, failover hops).
* **Actual Savings Calculation vs. Hardcoded Baselines:** `getCacheMetrics()` computes live average cached latency (`avgCacheLatency`) vs live uncached upstream latency (`avgNonCacheLatency`) directly from `request_logs` (`AVG(...) FILTER (WHERE "cacheHit" = false)`), returning `0ms` instead of fake constants when uncached samples do not yet exist.
* **Asynchronous Fire-and-Forget Telemetry & BullMQ Worker:** AI gateway responses flush to callers first; `logRequestAsync` pushes telemetry onto an in-memory batch buffer (`BATCH_SIZE = 50`, `FLUSH_INTERVAL_MS = 5000`) for bulk PostgreSQL `request_logs` inserts and triggers `checkAndTriggerAlerts(apiId)` out-of-band, while REST proxy traffic routes asynchronously via BullMQ `"request-logs"` -> `logProcessor.js` -> `api_metrics` minute-bucket rollups.
* **Strict Workspace & User Isolation:** All `analytics.controller.js` and `logs.controller.js` queries scope strictly by `req.user.userId` and `x-workspace-slug` (`workspace-1` primary sync in `orgStore.js`).

---

## 4. Observability Architecture & UI Surfaces

```
Gateway Request (/v1/chat/completions)
   │  captures latencyMs, statusCode, provider, model, tokens, cacheHit, cacheTier, isStreaming, retryAttempts, failoverUsed
   ▼
[observability.js :: logRequestAsync]
   ├──► Batch Queue (`BATCH_SIZE = 50`, `FLUSH_INTERVAL_MS = 5000`) -> PostgreSQL `request_logs`
   ├──► REST Proxy Middleware -> BullMQ ("request-logs") -> [worker :: logProcessor.js] -> `api_metrics`
   └──► [alerts.js :: checkAndTriggerAlerts] -> Redis cooldown + Slack Webhook on threshold breach
         │
         ▼
Control Plane Analytics & Logs API (`/api/v1/analytics/*`, `/api/v1/logs`)
   ├──► `AnalyticsPage.jsx` : P50 / P90 / P95 / P99 interactive latency selector,
   │                          Tier 1 Exact vs Tier 2 pgvector vs SSE vs Failover KPIs,
   │                          Active Vector Cache table + Flush 2-Tier Cache control
   └──► `LiveLogsPage.jsx`  : Real-time table & drawer with `EXACT HIT`, `SEMANTIC HIT`,
                              `STREAM`, `FAILOVER` badges and accurate per-model USD cost
```

---

## 5. Reproducible Live Benchmark Harness & Verification

### Running `benchmarks/run_live_benchmark.js`
Once you register a user, create a gateway route, and generate an API key in the UI:
```powershell
$env:FLOWOPS_KEY = "sk_flowops_your_real_key"
$env:FLOWOPS_URL = "http://localhost:5000"
$env:N = "5"
node benchmarks/run_live_benchmark.js
```
The script runs `N` iterations per scenario with unique per-run nonces:
1. **Cold Upstream (`x-flowops-cache-force-refresh: true`):** Forces upstream provider call + populates Tier 1 Redis & Tier 2 `pgvector`.
2. **Tier 1 Exact Match:** Repeats identical payload to measure Redis exact hit latency.
3. **Tier 2 Semantic Match:** Sends paraphrased prompt (`In one short sentence, describe what an API gateway reverse proxy does...`) to measure `pgvector` HNSW cosine hit latency.
4. **Live SSE Streaming TTFT (`stream: true`, `x-flowops-cache: false`):** Measures time to first `data:` chunk via Web `ReadableStream` reader.

Outputs structured percentiles (`mean`, `p50`, `p95`, `p99`, `min`, `max`) to stdout and `benchmarks/latency_run.json`.

### Verification Criteria
* Fresh startup shows empty analytics states (`0` requests, `0ms` percentiles) until real gateway calls occur.
* `GET /api/v1/analytics/overview` returns real SQL `p50Latency`, `p90Latency`, `p95Latency`, `p99Latency`, `exactCacheHits`, `semanticCacheHits`, `streamingRequests`, `failoverRequests`, and `totalRetries`.
* `LiveLogsPage.jsx` accurately labels exact cache hits, semantic vector hits, streaming completions, retries, and fallbacks with zero mock fallback data.

