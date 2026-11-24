# Feature 2: Two-Tier Caching (Redis Exact Match + PostgreSQL `pgvector` Semantic Similarity)

## 1. Executive Summary & Real-World Problem

Production AI workloads frequently exhibit high prompt repetition alongside near-duplicate paraphrases:
* Customer support queries (*"How do I reset my API key?"* vs. *"Steps to regenerate an API key"*).
* Coding assistants asked the same question with minor wording variance.
* Automated pipelines polling deterministic summaries (`temperature: 0`).

Without caching, every semantically equivalent prompt pays full token costs ($1x$–$15x$ upstream billing) and incurs multi-second LLM generation latency. Conversely, naive exact-string caching misses paraphrases entirely, and external managed vector databases (Pinecone, Weaviate, Qdrant) add infrastructure sprawl, network hops, and SaaS bills.

**FlowOps Feature 2** implements a unified **Two-Tier Cache Engine** inside the gateway (`backend/src/gateway/core/cacheManager.js`):
1. **Tier 1 (Exact Match in Redis):** Sub-millisecond SHA-256 keyed lookup scoped by `apiId`, `model`, `temperature`, and `systemPromptHash`, tracked via `exact_cache_index:<apiId>` Redis sets for instant scoped invalidation.
2. **Tier 2 (Semantic Vector Match in PostgreSQL `pgvector`):** Local in-process `Xenova/all-MiniLM-L6-v2` quantized ONNX embeddings (`384` dimensions) queried against an **HNSW** (`vector_cosine_ops`) index in `semantic_cache` (`1 - cosineDistance >= similarityThreshold`). On a semantic hit, Tier 1 Redis is automatically warmed for future exact repeats of that phrasing.

---

## 2. Portkey AI (`portkey-ai/gateway`) Reference Architecture & Comparison

| Dimension | Portkey AI Reference (`src/`) | FlowOps HQ Implementation | Engineering Trade-off |
| :--- | :--- | :--- | :--- |
| **Cache Service & Middleware** | `middlewares/cache/index.ts` & `handlers/services/cacheService.ts` (`CacheService`, `getFromCache`, `CACHE_STATUS`). | `backend/src/gateway/core/cacheManager.js` (`lookupTwoTierCache`, `saveToTwoTierCache`) invoked directly in `universalRouter.js`. | Portkey isolates caching into edge middleware; FlowOps embeds Two-Tier Cache inside both unary and SSE streaming paths so cache misses seamlessly write back final normalized payloads. |
| **Force Refresh Header** | `x-portkey-cache-force-refresh` header triggers bypass on read while overwriting cached entry on upstream success. | `x-flowops-cache-force-refresh: true` sets `{ eligible: true, forceRefresh: true }` in `isCacheEligible()`, skipping lookup and saving fresh output. | Identical refresh semantics adapted cleanly to FlowOps headers. |
| **Cache Bypass Conditions** | Cache status tracking (`MISS`, `HIT`, `SEMANTIC HIT`, `DISABLED`) based on config and request determinism. | `isCacheEligible(reqBody, headers)` disables caching when `x-flowops-cache: false`, `temperature > 0`, `tools[]` non-empty, `functions[]` non-empty, or `tool_choice !== 'none'`. | Prevents poisoning the cache with non-deterministic outputs or stateful tool/function-calling turns. |
| **Semantic Similarity Store** | Delegates vector search to external/cloud storage providers in hosted Portkey setups. | Embedded PostgreSQL 16 + `pgvector` (`semantic_cache.embedding` `vector(384)` + HNSW index) using local `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`). | Zero external embedding API cost and zero extra vector database service to deploy or maintain. |
| **Threshold & Invalidation Control** | Cache threshold and TTL rules inside gateway config. | Per-request `x-flowops-cache-threshold` clamped safely via `clampThreshold()` (`0.70`–`0.99`, default `0.88`), plus UI-triggered `DELETE /api/v1/analytics/cache` (`flushTwoTierCache`). | Guarantees tenants cannot disable safety floor (`< 0.70` false positives) while allowing instant two-tier cache purges from the dashboard. |

---

## 3. Core Engineering Concepts & Vocabulary

* **Normalized Mean-Pooled Dense Embeddings:** `generateEmbedding(text)` runs `Xenova/all-MiniLM-L6-v2` (`quantized: true`) with `{ pooling: 'mean', normalize: true }`, yielding unit-norm `384`-dimensional vectors so cosine distance directly reflects semantic similarity in `[0, 1]`.
* **HNSW (Hierarchical Navigable Small World) ANN Index:** Declared in `backend/src/db/schema.js` as `index('semantic_cache_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops'))`, giving sub-linear approximate nearest neighbor vector retrieval inside PostgreSQL.
* **Strict Tenant & Prompt Scoping (Zero Cross-Contamination):** Every Tier 1 and Tier 2 lookup scopes strictly by:
  * `apiId` (`exact_cache_index:<apiId>` / `eq(semanticCache.apiId, apiId)`) — tenants never leak cached answers across gateways.
  * `model` and `temperature` — requests to different models or sampling regimes remain isolated.
  * `systemPromptHash` (`sha256(systemPrompt)`) — changing persona/instructions invalidates prior hits even for identical user messages.
  * `expiresAt > now` (`ttlSeconds = 3600` default) — stale entries expire cleanly.
* **Tier 1 Cache Warm-Up on Tier 2 HIT:** When `lookupTwoTierCache` scores a `semantic` hit above threshold, it executes a best-effort `redis.setex(scopedRedisKey, 3600, best.responsePayload)` + `sadd` index registration so repeated exact phrasing skips even vector inference.

---

## 4. End-to-End Request Lifecycle & Cache Decision Matrix

```
Incoming Messages + Headers
   │
   ▼
isCacheEligible(req.body, req.headers)
   ├─ temperature > 0 / tools[] / functions[] / tool_choice / x-flowops-cache: false
   │    ──► Bypass Cache -> Execute Upstream -> Header: `x-flowops-cache: BYPASS` + `x-flowops-cache-reason`
   ├─ x-flowops-cache-force-refresh: true
   │    ──► Skip Lookup -> Execute Upstream -> Overwrite Tier 1 & Tier 2 -> `x-flowops-cache: MISS` + reason
   └─ Eligible
        │
        ├─► Tier 1: `redis.get(exact_cache:<model>:<temp>:<sysHash>:<msgsHash>:<apiId>)`
        │      └─ Found -> Return immediately (`x-flowops-cache: HIT`, `x-flowops-cache-tier: exact`, similarity `1.0000`)
        │
        └─► Tier 2: `generateEmbedding(promptText)` -> PostgreSQL `pgvector` cosine distance (`1 - distance`)
               ├─ `similarity >= clampThreshold(header ?? 0.88)`
               │      ──► Warm Tier 1 Redis -> Return (`x-flowops-cache: HIT`, `x-flowops-cache-tier: semantic`, similarity)
               └─ Miss -> Call Upstream -> On 200 OK, write Tier 1 Redis + Tier 2 `semantic_cache` -> `x-flowops-cache: MISS`
```

---

## 5. Cache Management API & Dashboard Controls

* **`GET /api/v1/analytics/cache` & `GET /api/v1/analytics/cache/entries`:** Owned by `analytics.controller.js`, returning Tier 1 exact hit count, Tier 2 semantic hit count, `pgvector` `activeEntries`, `totalTokensCached`, and the latest 20 active cached prompts (`getSemanticCacheStats(apiIds)`).
* **`DELETE /api/v1/analytics/cache`:** Calls `flushTwoTierCache(apiIds)`, reading every tracked key from `exact_cache_index:<apiId>` in Redis, deleting those keys + the index set, and deleting matching rows in PostgreSQL `semantic_cache`.
* **Frontend UI:**
  * `GatewayPlayground.jsx`: Cache Policy selector (`Auto (2-Tier)`, `Force Refresh`, `Bypass Cache`) + Similarity Threshold slider (`0.70`–`0.99`) + result pills (`EXACT HIT`, `SEMANTIC HIT`, similarity score).
  * `AnalyticsPage.jsx`: Displays Tier 1 vs Tier 2 hit breakdown, active vector cache table, and `Flush 2-Tier Cache` button.
  * `LiveLogsPage.jsx`: Renders `EXACT HIT` / `SEMANTIC HIT` badges from `request_logs.cacheHit` and `request_logs.cacheTier`.

---

## 6. Verification & Interview Q&A

### Key Interview Talking Point
> *"If a user passes a system prompt like `'Answer in Pirate speak'` vs `'Answer formally'`, wouldn't semantic caching confuse them?"*
> **Answer:** *"No. Only the user prompt text is embedded for vector search, while the query predicates strictly require matching `apiId`, `model`, `temperature`, `systemPromptHash` (SHA-256 of concatenated system instructions), and `expiresAt > now`. Both prompt isolation and multi-tenant isolation are enforced at both Redis and SQL query layers."*

### Verification Criteria
* Unit tests in `backend/src/gateway/core/cacheManager.test.js` verify eligibility rules (`temperature > 0`, `tools`, `functions`, `tool_choice`, `x-flowops-cache: false`, `x-flowops-cache-force-refresh: true`), threshold clamping (`0.70`–`0.99`), key scoping, and `flushTwoTierCache`.
* Repeating a deterministic (`temperature: 0`) query yields `x-flowops-cache: HIT` + `x-flowops-cache-tier: exact`; paraphrasing it yields `x-flowops-cache: HIT` + `x-flowops-cache-tier: semantic` with similarity reported in `x-flowops-cache-similarity`.

