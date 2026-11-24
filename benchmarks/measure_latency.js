const URL = process.env.FLOWOPS_URL;
const KEY = process.env.FLOWOPS_KEY;
const MODEL = process.env.MODEL || 'gemini-1.5-flash';
const N = parseInt(process.env.N || '30', 10); // pairs; keep low for free-tier rate limits
const DELAY_MS = parseInt(process.env.DELAY_MS || '4200', 10); // 15 RPM limit -> ~4.2s delay between cold calls

if (!URL || !KEY) {
  console.error('Set FLOWOPS_URL and FLOWOPS_KEY env vars. (MODEL defaults to gemini-1.5-flash)');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const body = (p) => JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 150, messages: [{ role: 'user', content: p }] });

async function call(p) {
  const t = performance.now();
  let r;
  try {
    r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: body(p) });
  } catch (err) {
    return { ms: performance.now() - t, status: 500, error: err.message, hit: null };
  }
  const text = await r.text();
  return { ms: performance.now() - t, status: r.status, hit: r.headers.get('x-flowops-cache'), text };
}

const pct = (a, q) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.ceil(q * a.length) - 1)];

(async () => {
  console.log(`Starting benchmark against ${URL} using ${MODEL} (${N} pairs)...`);
  const cold = [], warm = [];
  
  for (let i = 0; i < N; i++) {
    const p = `Explain REST API concept number ${i} in two sentences. run=${Date.now()}`;
    
    // Cold call (uncached)
    const c = await call(p);
    if (c.status === 200 && c.hit !== 'HIT') {
      cold.push(c.ms);
      console.log(`[Pair ${i + 1}/${N}] Cold: ${c.ms.toFixed(0)} ms (Status: ${c.status})`);
    } else {
      console.warn(`[Pair ${i + 1}/${N}] Cold call warning: Status ${c.status}, Cache: ${c.hit}`);
    }

    // Warm call (immediate exact cache hit from Redis)
    const w = await call(p);
    if (w.status === 200 && w.hit === 'HIT') {
      warm.push(w.ms);
      console.log(`[Pair ${i + 1}/${N}] Warm: ${w.ms.toFixed(0)} ms (Cache: HIT)`);
    } else {
      console.warn(`[Pair ${i + 1}/${N}] Warm call warning: Status ${w.status}, Cache: ${w.hit}`);
    }

    // Pacing delay between pairs to respect Gemini Free Tier 15 RPM limits (only needed on cold/uncached hits)
    if (i < N - 1 && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  const results = {
    model: MODEL,
    cold_n: cold.length,
    cold_p50: cold.length ? Math.round(pct(cold, .5)) : 0,
    cold_p95: cold.length ? Math.round(pct(cold, .95)) : 0,
    warm_n: warm.length,
    warm_p50: warm.length ? Math.round(pct(warm, .5)) : 0,
    warm_p95: warm.length ? Math.round(pct(warm, .95)) : 0
  };

  console.log('\n=== Benchmark Summary ===');
  console.log(JSON.stringify(results, null, 2));
})();
