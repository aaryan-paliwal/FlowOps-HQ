#!/usr/bin/env node
/**
 * benchmarks/run_live_benchmark.js
 *
 * Live end-to-end FlowOps HQ benchmark against the running gateway server
 * (Redis Tier 1 exact cache + PostgreSQL pgvector Tier 2 semantic cache + SSE TTFT).
 *
 * Usage:
 *   $env:FLOWOPS_KEY="sk_flowops_..."
 *   $env:FLOWOPS_URL="http://localhost:5000"   # optional
 *   $env:N="10"                                # optional sample count per tier
 *   node benchmarks/run_live_benchmark.js
 */

const fs = require('fs');
const path = require('path');

const GATEWAY_URL = (process.env.FLOWOPS_URL || 'http://localhost:5000').replace(/\/+$/, '');
const FLOWOPS_KEY = process.env.FLOWOPS_KEY;
const N = Math.max(1, parseInt(process.env.N || '5', 10));
const MODEL = process.env.BENCH_MODEL || 'gemini-3.5-flash';

if (!FLOWOPS_KEY) {
    console.error('Error: Set FLOWOPS_KEY (real FlowOps API token from the dashboard) to run live benchmarks.');
    process.exit(1);
}

function stats(arr) {
    if (!arr.length) return { n: 0, mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    return {
        n: sorted.length,
        mean: Number((sum / sorted.length).toFixed(2)),
        p50: Number(pct(50).toFixed(2)),
        p95: Number(pct(95).toFixed(2)),
        p99: Number(pct(99).toFixed(2)),
        min: Number(sorted[0].toFixed(2)),
        max: Number(sorted[sorted.length - 1].toFixed(2)),
    };
}

async function callGateway(messages, extraHeaders = {}, stream = false) {
    const start = performance.now();
    const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${FLOWOPS_KEY}`,
            ...extraHeaders,
        },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0,
            max_tokens: 64,
            stream,
            messages,
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }

    if (!stream) {
        await res.json();
        return {
            latencyMs: performance.now() - start,
            cache: res.headers.get('x-flowops-cache'),
            tier: res.headers.get('x-flowops-cache-tier'),
            similarity: res.headers.get('x-flowops-cache-similarity'),
        };
    }

    let ttftMs = null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (ttftMs === null && text.includes('data:')) {
            ttftMs = performance.now() - start;
        }
    }
    return {
        latencyMs: performance.now() - start,
        ttftMs: ttftMs ?? (performance.now() - start),
        streaming: res.headers.get('x-flowops-streaming'),
    };
}

async function main() {
    const nonce = Date.now();
    const basePrompt = `Explain what an API gateway reverse proxy does in one short sentence (bench-${nonce}).`;
    const semanticParaphrase = `In one short sentence, describe what an API gateway reverse proxy does (bench-${nonce}).`;

    const coldLatencies = [];
    const tier1Latencies = [];
    const tier2Latencies = [];
    const streamTtft = [];

    console.log(`Running live FlowOps benchmark (N=${N}) against ${GATEWAY_URL} using model=${MODEL}...`);

    for (let i = 0; i < N; i++) {
        const coldRes = await callGateway(
            [{ role: 'user', content: `${basePrompt} [sample ${i}]` }],
            { 'x-flowops-cache-force-refresh': 'true' }
        );
        coldLatencies.push(coldRes.latencyMs);

        const exactRes = await callGateway([{ role: 'user', content: `${basePrompt} [sample ${i}]` }]);
        tier1Latencies.push(exactRes.latencyMs);

        const semanticRes = await callGateway([{ role: 'user', content: `${semanticParaphrase} [sample ${i}]` }]);
        if (semanticRes.cache === 'HIT') tier2Latencies.push(semanticRes.latencyMs);
    }

    const sseRes = await callGateway(
        [{ role: 'user', content: `Stream check ${nonce}: reply with three short words.` }],
        { 'x-flowops-cache': 'false' },
        true
    );
    streamTtft.push(sseRes.ttftMs);

    const report = {
        timestamp: new Date().toISOString(),
        gatewayUrl: GATEWAY_URL,
        model: MODEL,
        coldUpstream: stats(coldLatencies),
        tier1ExactRedis: stats(tier1Latencies),
        tier2SemanticPgVector: stats(tier2Latencies),
        streamingTtftMs: stats(streamTtft),
    };

    const outPath = path.join(__dirname, 'latency_run.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
    console.error('Benchmark failed:', err.message);
    process.exit(1);
});
