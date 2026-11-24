# Feature 1: Drop-in Universal Gateway & FlowOps Smart Classifier

## 1. Executive Summary & Real-World Problem

Engineering teams integrating LLMs into production systems quickly run into three operational bottlenecks:

1. **Vendor Lock-in & SDK Fragmentation:** Hardcoding `@google/genai`, `@anthropic-ai/sdk`, and `openai` SDKs couples application code to single vendors. Switching models or adding fallbacks requires rewriting request serialization, headers, and response parsers across services.
2. **Overspending on Frontier Models ("Denial of Wallet"):** Most production traffic consists of short classification, summarization, extraction, or simple formatting prompts that do not need frontier reasoning models like `gpt-4o` or `claude-3-5-sonnet`.
3. **SSRF & Open-Source Self-Hosting Risks:** Letting teams or tenants supply custom OpenAI-compatible target URLs (`Ollama`, `vLLM`, `Groq`) introduces Server-Side Request Forgery (SSRF) risks against cloud metadata endpoints (`169.254.169.254`) and private VPC networks unless strictly validated.

**FlowOps Feature 1** solves all three via:
* **Drop-in OpenAI-Compatible Proxy (`POST /v1/chat/completions`, `GET /v1/models`):** Standard SDKs only swap `baseURL` to `http://localhost:5000/v1` and pass a FlowOps key (`Authorization: Bearer sk_flowops_...` or `x-flowops-api-key`).
* **Bidirectional Provider Translators (`translators`):** Translates OpenAI chat payloads/responses to/from `openai`, `openai-compatible` (Groq/Ollama/vLLM), `gemini`, and `anthropic`.
* **BYOK + Vault Credential Resolution:** Supports tenant Bring-Your-Own-Key headers (`x-openai-key`, `x-gemini-key`, `x-anthropic-key`, `x-custom-key`) while allowing optional server `.env` fallbacks, so BYOK keys work even for models outside the base tier (`TIER_ACCESS` bypass when `hasByokKey` is true).
* **Deterministic `<1ms` Smart Classifier (`flowops-smart`):** Evaluates prompt token volume, code syntax (`CODE_REGEX`), reasoning keywords (`REASONING_KEYWORDS`), and per-route `routingStrategy` (`cost-optimized`, `speed-optimized`, `quality-optimized`) with zero extra LLM calls.
* **Portkey-Style UI (`RoutingConfigStudio.jsx` + `GatewayPlayground.jsx`):** Visual rule/strategy studio with live JSON/Node/cURL config preview and an interactive browser testbench.

---

## 2. Portkey AI (`portkey-ai/gateway`) Reference Architecture & Comparison

| Dimension | Portkey AI Reference (`src/`) | FlowOps HQ Implementation | Engineering Trade-off |
| :--- | :--- | :--- | :--- |
| **Chat Entrypoint** | `handlers/chatCompletionsHandler.ts` — Edge-compatible Fetch handler parsing `x-portkey-config` and calling `tryTargetsRecursively`. | `backend/src/gateway/gateway.routes.js` — Express handler authenticates SHA-256 hashed `api_keys` in PostgreSQL, checks tier/BYOK access, and invokes `executeAiProxy` / `executeStreamingAiProxy`. | Portkey relies on stateless edge configs per call; FlowOps persists per-route defaults in PostgreSQL (`apis` table) while allowing header overrides. |
| **Target Traversal & Recursive Execution** | `handlers/handlerUtils.ts` (`tryTargetsRecursively`) — Recursively traverses config tree nodes (single target, load-balance, fallback, conditional router). | `backend/src/gateway/gateway.routes.js` + `universalRouter.js` — Sequential pipeline: Smart Classifier -> Weighted LB -> Recursive `executeAiProxy` retry/fallback chain. | Recursive traversal across heterogeneous trees is expressive in Portkey; FlowOps favors an explicit deterministic stage pipeline tied directly to Drizzle DB columns. |
| **Dynamic / Conditional Routing** | `services/conditionalRouter.ts` (`ConditionalRouter`) — Mongo-style query DSL (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$regex`, `$and`, `$or`) over metadata/params. | `backend/src/gateway/core/smartClassifier.js` (`classifyPrompt`) — Pure-JS heuristic router inspecting `CODE_REGEX`, `REASONING_KEYWORDS`, token thresholds, and `availableProviders`. | Portkey's `ConditionalRouter` excels at arbitrary metadata policies (`$in`, `$regex`); FlowOps eliminates policy boilerplate by auto-classifying raw prompt complexity in `<1ms`. |
| **Custom Host / OSS Support & Security** | Provider host overrides via `customHost` / `virtualKey` config fields. | `x-flowops-target-url` header + `ollama/` / `groq/` / `local/` / `custom/` model prefixes guarded by `urlValidator.js` (`validateTargetUrl`). | FlowOps explicitly blocks RFC 1918, loopback (when `allowLocal: false`), link-local metadata IPs (`169.254.169.254`), `.local`/`.internal`, and embedded credentials. |
| **Control Plane UI** | Config Builder JSON editor + API Playground + API Keys vault. | `frontend/src/pages/AIGatewaysPage.jsx`, `frontend/src/ui/RoutingConfigStudio.jsx`, `frontend/src/ui/GatewayPlayground.jsx`, `frontend/src/ui/GeneratedKeyView.jsx`. | FlowOps provides 1-click provider route templates, live Smart Classifier toggle, and dual-copy API key modal modeled after AI Studio. |

---

## 3. Core Engineering Concepts & Vocabulary

* **Reverse Proxy API Contract Normalization:** Presenting a single canonical HTTP/JSON contract (`model`, `messages`, `temperature`, `choices[0].message`, `usage`) to downstream callers regardless of upstream vendor schemas.
* **Gang of Four Adapter Pattern:** `translators.gemini.transformRequest` converts OpenAI `role: 'system'` into Gemini's `systemInstruction` and maps `assistant` -> `model`; `translators.anthropic.transformRequest` extracts `system` as a top-level string and translates `input_tokens` / `output_tokens` back into `prompt_tokens` / `completion_tokens`.
* **Defense-in-Depth SSRF Filtering (`urlValidator.js`):** Sanitizes URLs for length (`<= 2048`), ASCII control characters/whitespace, protocol allowlist (`http:`/`https:` only), credential stripping (`user:pass@`), IPv4/IPv6 CIDR private-network checks (`10.0.0.0/8`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`, `fe80::/10`, IPv4-mapped `::ffff:`), and internal hostname blocks (`metadata.google.internal`, `*.local`, `*.internal`).
* **Token-Based Rate Limiting:** `enforceTpmRateLimit` in `universalRouter.js` uses atomic Redis `MULTI` (`INCRBY` + `EXPIRE` 60s) against a 50,000 TPM budget before dispatching upstream provider calls.

---

## 4. End-to-End Request Lifecycle

```
Client SDK (OpenAI contract, baseURL = http://localhost:5000/v1)
   │  Authorization: Bearer sk_flowops_...
   ▼
[gateway.routes.js :: POST /v1/chat/completions]
   ├─ 1. SHA-256 hash key -> Lookup `api_keys` -> Load `apis` & `users` row
   ├─ 2. Resolve BYOK headers (`x-openai-key`, `x-gemini-key`, `x-anthropic-key`, `x-custom-key`)
   ├─ 3. If `x-flowops-target-url` present -> `validateTargetUrl()` SSRF check
   ├─ 4. Model Resolution:
   │     ├─ `flowops-smart` / `auto` / `x-flowops-smart-routing: true` -> `classifyPrompt()`
   │     │     ├─ `quality-optimized` -> `reasoning` tier (gpt-4o / claude-3-5-sonnet / gemini-3.5-flash)
   │     │     ├─ `speed-optimized` (<1500 tokens) -> `fast` tier
   │     │     └─ `cost-optimized` -> `CODE_REGEX` / `REASONING_KEYWORDS` / tokens -> `fast` vs `reasoning`
   │     └─ Explicit model (`gpt-4o`, `gemini-3.5-flash`, `ollama/llama3`, etc.) -> map via `MODEL_TO_PROVIDER`
   ├─ 5. Enforce `TIER_ACCESS` (unless user supplies BYOK header for target provider)
   └─ 6. Dispatch to `universalRouter.js` -> Provider HTTP -> Normalized OpenAI Response + Telemetry Headers
```

### Key Observability Response Headers
* `x-flowops-provider`: Resolved upstream adapter (`gemini`, `openai`, `anthropic`, `openai-compatible`)
* `x-flowops-model-selected`: Concrete upstream model invoked
* `x-flowops-classifier-tier`: `'fast'` or `'reasoning'` (when `classifyPrompt` runs)
* `x-flowops-router-reason`: Human-readable heuristic trigger (e.g., `"Detected code syntax or technical implementation markers"`)
* `x-flowops-latency`: Total gateway turnaround latency in milliseconds

---

## 5. UI Control Plane & Verification

* **Route Creation (`AIGatewaysPage.jsx`):** Users register blank routes or select 1-click provider presets (`Google Gemini`, `OpenAI`, `Anthropic Claude`, `Groq / Llama`) persisted cleanly to PostgreSQL via `POST /api/v1/apis` — zero auto-seeded demo routes exist.
* **Routing Config Studio (`RoutingConfigStudio.jsx`):** Configures Smart Classifier on/off toggle, strategy card (`cost-optimized`, `speed-optimized`, `quality-optimized`), fallback providers, weighted LB percentages, retries, and live Config/Node/cURL code generation.
* **Interactive Playground (`GatewayPlayground.jsx`):** Lets users generate/bind a real token, paste optional BYOK keys into local browser storage, and fire real prompts while inspecting decoded response headers and telemetry pills.

### Verification Criteria
* Unit tests in `backend/src/gateway/core/universalRouter.test.js` verify `classifyPrompt` tiers/strategies, bidirectional `gemini`/`anthropic`/`openai-compatible` translations, BYOK header forwarding, `validateTargetUrl` SSRF rejection, and Zod schema validation.
* `GET /v1/models` returns the standardized OpenAI `{ object: "list", data: [...] }` catalog including `flowops-smart`.
* Newly registered users start with `apis: []` until explicitly creating a route via UI or `POST /api/v1/apis`.
