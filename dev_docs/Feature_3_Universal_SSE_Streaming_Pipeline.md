# Feature 3: Universal SSE Streaming Pipeline

## 1. Executive Summary & Real-World Problem

LLM completions frequently generate hundreds of tokens, taking 2–15 seconds to finish. Waiting for the entire JSON completion before responding causes terrible perceived responsiveness (high Time-To-First-Token, or TTFT) and HTTP proxy timeouts in interactive chat apps.

However, streaming across heterogeneous providers breaks client code because **every vendor emits incompatible Server-Sent Events (SSE) wire formats**:
* **OpenAI / Groq / Ollama:** `data: {"object":"chat.completion.chunk","choices":[{"delta":{"content":"Hi"}}]}\n\n` terminated by `data: [DONE]\n\n`.
* **Google Gemini (`:streamGenerateContent?alt=sse`):** `data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}],"usageMetadata":{...}}` — uses `candidates` and `usageMetadata` rather than `choices[0].delta`.
* **Anthropic Claude (`stream: true` on `/v1/messages`):** Typed event objects (`message_start`, `content_block_delta` with `delta.text_delta`, `message_delta`, `message_stop`).

**FlowOps Feature 3** solves this transparently via a **Universal SSE Streaming Pipeline** (`backend/src/gateway/core/universalRouter.js`): clients send standard OpenAI `{ stream: true }` requests and always consume identical OpenAI `chat.completion.chunk` SSE frames ending in `data: [DONE]`, whether served live from Gemini, Anthropic, OpenAI, or replayed from the Two-Tier Cache!

---

## 2. Portkey AI (`portkey-ai/gateway`) Reference Architecture & Comparison

| Dimension | Portkey AI Reference (`src/`) | FlowOps HQ Implementation | Engineering Trade-off |
| :--- | :--- | :--- | :--- |
| **Stream Orchestrator** | `handlers/streamHandler.ts` (`readStream`) — Wraps Fetch `ReadableStream` using Web `TransformStream` and provider-specific chunk transforms. | `universalRouter.js` (`executeStreamingAiProxy`) — Uses Axios `responseType: 'stream'`, buffered line splitter (`lineBuffer`), and `parseProviderStreamLine()` piped directly to Express `res.write()`. | Web `TransformStream` fits Cloudflare Workers/Deno; Node/Express chunked buffering handles backpressure and partial UTF-8 TCP chunk splits cleanly without runtime shims. |
| **Provider Stream Transforms** | `providers/google/chatComplete.ts` (`GoogleChatCompleteStreamChunkTransform`) and `providers/anthropic/chatComplete.ts` (`getAnthropicStreamChunkTransform`). | `parseProviderStreamLine()` + `translators.<provider>.getStreamUrl` / `transformStreamRequest` inside `universalRouter.js`. | Consolidates provider chunk normalizers into one testable pure function (`parseProviderStreamLine`) alongside `translators`. |
| **Cached Stream Replay** | `handlers/streamHandler.ts` (`handleJSONToStreamResponse`) — Emits cached JSON response as SSE chunks so streaming SDKs don't crash on cache hits. | `replayResponseAsSseStream(res, cachedData, extraHeaders)` — Slices cached `message.content` into 24-char OpenAI `chat.completion.chunk` frames followed by `finish_reason: 'stop'` and `data: [DONE]`. | Streaming clients always receive valid SSE MIME type and incremental delta events even when answered in milliseconds from Redis or `pgvector`. |
| **Abort Propagation** | Stream cancellation propagates downstream abort signals when readers close. | `AbortController` attached to Axios `{ signal: abortController.signal }` wired to `req.on('close', onClose)` listener (cleaned up in `finally` / `catch`). | Prevents orphaned billing upstream when browser users click "Stop Generating" or close tabs mid-stream. |

---

## 3. Core Engineering Concepts & Vocabulary

* **TCP Chunk Reassembly (`lineBuffer` Framing):** Network packets (`upstream.data.on('data', ...)`) frequently split a single JSON SSE line across two buffers or combine multiple `data:` lines into one buffer. FlowOps maintains `lineBuffer += rawChunk.toString('utf8')`, splits on `/\r?\n/`, retains incomplete trailing fragments via `lineBuffer = lines.pop() || ''`, and flushes any remaining line on `end`.
* **Wire Header Requirements for Proxies:** `writeSseHeaders(res, extraHeaders)` sets:
  * `Content-Type: text/event-stream; charset=utf-8`
  * `Cache-Control: no-cache, no-transform`
  * `Connection: keep-alive`
  * `X-Accel-Buffering: no` (disables nginx/reverse-proxy buffering so chunks flush immediately)
  * `res.flushHeaders()` to transmit HTTP 200 headers before the first token arrives.
* **Stateful Stream Reconstruction & Post-Stream Write-Back:** While forwarding normalized chunks to the client in real time, `parseProviderStreamLine` accumulates `state.fullText`, `state.promptTokens`, and `state.completionTokens`. Once `upstream.data` finishes (`end`), if `elig.eligible && state.fullText` is true, FlowOps synthesizes a standard OpenAI completion object and asynchronously calls `saveToTwoTierCache(...)` so subsequent identical or semantically similar requests hit Tier 1 / Tier 2 cache!
* **Headers-Sent Safety:** `gateway.routes.js` inspects `if (res.headersSent)` in its `catch` block so mid-stream upstream drops cleanly close `res.end()` instead of crashing Node with `ERR_HTTP_HEADERS_SENT`.
* **CORS Exposure (`app.js`):** Explicit `exposedHeaders` includes `x-flowops-streaming`, `x-flowops-cache-tier`, `x-flowops-cache-similarity`, `x-flowops-retry-count`, `x-flowops-fallback-used`, and `x-flowops-failover-from` so browser `fetch()` readers (`GatewayPlayground.jsx`) inspect stream metadata before reading chunks.

---

## 4. End-to-End Streaming Lifecycle

```
Client sends POST /v1/chat/completions { stream: true, ... }
   │
   ▼
[gateway.routes.js] sets `isStreamRequested = true` -> calls `executeStreamingAiProxy(req, res, ...)`
   ├─ Step A: Enforce Redis TPM rate limit
   ├─ Step B: Lookup Two-Tier Cache (if eligible & not force-refresh)
   │    └─ HIT? -> `replayResponseAsSseStream(res, cached.data)` -> streams 24-char delta chunks + [DONE]
   ├─ Step C: On MISS -> Bind `req.on('close', () => abortController.abort())`
   ├─ Step D: Request upstream stream (`gemini`: `?alt=sse`, `anthropic`/`openai`: `{ stream: true }`)
   ├─ Step E: Pre-header failure (429 / 5xx before `writeSseHeaders`)?
   │    └─ Retries with Full Jitter or seamlessly fails over to `fallbackProviders`!
   └─ Step F: Stream connected -> `writeSseHeaders()` -> normalize each line via `parseProviderStreamLine()`
        └─ On EOF -> `data: [DONE]\n\n` -> async `saveToTwoTierCache()` + `logRequestAsync({ isStreaming: true })`
```

---

## 5. Interactive Frontend & Observability Integration

* **`GatewayPlayground.jsx`:** Includes an interactive **SSE Streaming (`stream: true`)** toggle. When enabled, it parses `res.body.getReader()` chunks incrementally, renders tokens live as they arrive, measures **Time-To-First-Token (`ttftMs`)** alongside total latency and chunk count, and falls back smoothly to `replayResponseAsSseStream` if a cache hit occurs!
* **`LiveLogsPage.jsx`:** Requests processed via streaming are tagged `request_logs.isStreaming = true`, surfaced with a cyan **`STREAM`** badge in the logs table and detailed inspection drawer.
* **`AnalyticsPage.jsx`:** Aggregates `streamingRequests` across workspace gateways.

---

## 6. Verification & Interview Q&A

### Key Interview Talking Point
> *"How do you support caching when clients use `stream: true`? Aren't SSE streams stateful chunks rather than a single JSON object?"*
> **Answer:** *"Two mechanisms work together: during a stream miss, our stream normalizer (`parseProviderStreamLine`) passively accumulates `delta.content` and token usage into an in-memory buffer and, after emitting `data: [DONE]`, persists the reconstructed OpenAI completion object into Redis and `pgvector`. On any subsequent stream hit, `replayResponseAsSseStream` reads that stored JSON payload and emits standard `chat.completion.chunk` SSE events ending in `[DONE]`, preserving full client SSE compatibility."*

### Verification Criteria
* Unit tests in `universalRouter.test.js` test `parseProviderStreamLine` across `gemini` (`finishReason: 'STOP'`, `usageMetadata`), `anthropic` (`content_block_delta`, `message_stop`), and `replayResponseAsSseStream` (`Content-Type: text/event-stream`, chunk framing, `data: [DONE]\n\n`).
* End-to-end streaming call with `{ stream: true }` against Gemini returns `Content-Type: text/event-stream`, `x-flowops-streaming: true`, incremental `chat.completion.chunk` frames, `data: [DONE]\n\n`, and `isStreaming: true` logged in `request_logs`.
