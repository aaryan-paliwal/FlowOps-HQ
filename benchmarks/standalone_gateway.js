const http = require('http');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Error: Set GEMINI_API_KEY in environment before starting standalone_gateway.');
  process.exit(1);
}
const PORT = process.env.PORT || 5055;

// In-memory Redis simulation for the exact cache store
const cacheStore = new Map();

const server = http.createServer(async (req, res) => {
  const startTime = performance.now();

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const messages = payload.messages || [];
        
        // Exact Redis cache key computation matching FlowOps HQ universalRouter.js
        const cacheKey = `prompt_cache:${Buffer.from(JSON.stringify(messages)).toString('base64')}`;

        // 1. Exact Cache lookup
        if (cacheStore.has(cacheKey)) {
          const cachedData = cacheStore.get(cacheKey);
          const latencyMs = performance.now() - startTime;
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'x-flowops-cache': 'HIT',
            'x-flowops-latency': latencyMs.toFixed(2),
          });
          return res.end(JSON.stringify(cachedData));
        }

        // 2. Uncached: Call upstream Gemini directly
        const targetModel = 'gemini-3.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${GEMINI_API_KEY}`;
        
        const geminiBody = {
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || '' }]
          })),
          generationConfig: {
            maxOutputTokens: payload.max_tokens || 150,
            temperature: payload.temperature !== undefined ? payload.temperature : 0
          }
        };

        const upstreamRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        });

        const geminiData = await upstreamRes.json();
        if (!upstreamRes.ok) {
          res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(geminiData));
        }

        // 3. Transform to standard OpenAI chat completion format (Portkey adapter logic)
        const responseData = {
          id: `chatcmpl-gemini-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: targetModel,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: geminiData.usageMetadata?.promptTokenCount || 0,
            completion_tokens: geminiData.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: geminiData.usageMetadata?.totalTokenCount || 0
          }
        };

        // 4. Save to cache
        cacheStore.set(cacheKey, responseData);

        const latencyMs = performance.now() - startTime;
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'x-flowops-latency': latencyMs.toFixed(2),
        });
        return res.end(JSON.stringify(responseData));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`FlowOps standalone benchmark gateway active on port ${PORT}`);
});
