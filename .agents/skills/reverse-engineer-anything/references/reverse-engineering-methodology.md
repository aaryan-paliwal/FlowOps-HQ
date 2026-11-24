# Reverse Engineering Methodology & Architecture Deconstruction

This guide details the systematic reverse-engineering process used by the **Reverse Engineer Anything (REA)** skill to deconstruct modern web applications, distributed APIs, and open-source gateways (such as Portkey AI).

---

## 1. Protocol & Network Sniffing (Black-Box & Grey-Box)

### 1.1 HTTP/2 & SSE Streaming Analysis
When reverse-engineering an AI gateway like Portkey AI:
* **Wire Protocol Inspection:** Determine whether endpoints return atomic JSON (`application/json`) or Server-Sent Events (`text/event-stream; charset=utf-8`).
* **Frame Serialization:** Analyze how raw provider frames (Gemini `candidates[0].content.parts`, Anthropic `content_block_delta`, OpenAI `choices[0].delta`) are reshaped into standard OpenAI-compatible `data: {"object":"chat.completion.chunk",...}\n\n` frames ending with `data: [DONE]\n\n`.
* **Header Interception:** Extract custom telemetry and policy headers (e.g., `x-portkey-config`, `x-flowops-cache`, `x-flowops-latency`, `x-flowops-retry-count`).

### 1.2 Authentication & Key Vault Reverse Engineering
* **Virtual Key vs Master Key Pattern:** Analyze how developer API keys (`sk_live_...`) are mapped to internal tenant IDs, checking whether upstream provider keys are stored in database vaults or passed via BYOK headers.
* **Hashing Strategy:** Production gateways never store plain-text keys. Always verify SHA-256 or bcrypt hashing with constant-time equality checks to prevent timing attacks.

---

## 2. Source Code & Bundle Deconstruction (White-Box)

### 2.1 AST & Dependency Mapping
When inspecting target open-source repositories (e.g., `portkey-ai/gateway`):
1. **Entrypoint Discovery:** Trace from the HTTP server listener (`server.ts` or `src/index.ts`) through router middlewares to execution handlers.
2. **Strategy Pattern Isolation:** Identify recursive execution chains (e.g., `tryTargetsRecursively`), load-balancer randomizers, and retry handlers.
3. **Middleware Pipeline:** Deconstruct caching (`CacheService`), logging (`logClients`), and error-handling layers.

### 2.2 Database Schema Derivation
From API contracts and controllers, reconstruct the relational or document data model:
* **Tenant Isolation:** Ensure every table references `userId` and `workspaceSlug` to guarantee zero cross-tenant information leakage.
* **Vector Embeddings (`pgvector`):** Identify vector dimension (`384` for `all-MiniLM-L6-v2`, `1536` for `text-embedding-3-small`) and index types (`HNSW` with `cosineDistance`).
* **Audit Logs:** Partition or index request logs by `apiId`, `statusCode`, and `timestamp` for sub-millisecond analytical aggregations.

---

## 3. Clean-Room Synthesis Rules

1. **Zero Proprietary Code Copying:** Never copy proprietary closed-source code. Instead, capture the functional specification, API contract, and edge-case behavior, then write clean, idiomatic implementation code.
2. **Standardized Interfaces:** Adhere strictly to industry standard specifications (such as OpenAI REST v1 `/v1/chat/completions`) to eliminate migration friction for downstream developers.
3. **Security Hardening:** Always patch discovered vulnerabilities in the target (e.g., adding SSRF filters for custom target URLs and bounding exponential retry jitter).
