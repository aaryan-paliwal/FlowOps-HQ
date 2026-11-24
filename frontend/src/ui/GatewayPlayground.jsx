import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { apiKeysService } from '../services/api';
import { Card } from './Card';
import Icon from './Icon';

const GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_BASE_URL || 'http://localhost:5000/v1';
const TEST_KEY_STORAGE = 'flowops_last_test_key';
const CREDS_STORAGE = 'flowops_playground_creds';

const PROVIDER_OPTIONS = [
    {
        id: 'flowops-smart',
        name: 'FlowOps Smart Router',
        short: 'Smart Auto',
        defaultModel: 'flowops-smart',
        badge: 'Recommended',
        pillClass: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        description: 'Auto-classifies prompt complexity and routes across available providers.',
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        short: 'Gemini',
        defaultModel: 'gemini-3.5-flash',
        badge: 'Free Vault Ready',
        pillClass: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        description: 'Uses BYOK x-gemini-key or server GEMINI_API_KEY fallback.',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        short: 'OpenAI',
        defaultModel: 'gpt-4o',
        badge: 'BYOK / Failover',
        pillClass: 'text-red-400 border-red-500/30 bg-red-500/10',
        description: 'Targets OpenAI GPT models; pairs cleanly with 503 failover testing.',
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        short: 'Anthropic',
        defaultModel: 'claude-3-5-sonnet',
        badge: 'BYOK',
        pillClass: 'text-red-300 border-red-700/30 bg-red-950/20',
        description: 'Routes using Anthropic Messages translation via x-anthropic-key.',
    },
    {
        id: 'openai-compatible',
        name: 'OpenAI-Compatible (Ollama / Groq / vLLM)',
        short: 'Custom / OSS',
        defaultModel: 'llama-3.3-70b-versatile',
        badge: 'Universal URL',
        pillClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-950/20',
        description: 'Calls any OpenAI-compatible HTTP endpoint with SSRF validation.',
    },
];

const DEFAULT_CREDS = {
    openaiKey: '',
    geminiKey: '',
    anthropicKey: '',
    customKey: '',
    targetUrl: 'https://api.groq.com/openai/v1',
    customModel: 'llama-3.3-70b-versatile',
    maxTokens: 500,
};

function loadStoredCreds() {
    try {
        const raw = localStorage.getItem(CREDS_STORAGE);
        if (!raw) return DEFAULT_CREDS;
        return { ...DEFAULT_CREDS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_CREDS;
    }
}

export function GatewayPlayground({ apisList = [], selectedRouteId, onSelectRoute }) {
    const queryClient = useQueryClient();

    const activeRoute = useMemo(() => {
        if (!apisList.length) return null;
        return apisList.find((r) => r.id === selectedRouteId) || apisList[0];
    }, [apisList, selectedRouteId]);

    const [virtualKey, setVirtualKey] = useState(() => sessionStorage.getItem(TEST_KEY_STORAGE) || '');
    const [showKey, setShowKey] = useState(false);
    const [provider, setProvider] = useState('flowops-smart');
    const [creds, setCreds] = useState(loadStoredCreds);
    const [credsDraft, setCredsDraft] = useState(loadStoredCreds);
    const [prompt, setPrompt] = useState('Say hello and tell me which AI model answered this request in one sentence.');
    const [simulateOutage, setSimulateOutage] = useState(false);
    const [forceSmartRouting, setForceSmartRouting] = useState(false);
    const [streamEnabled, setStreamEnabled] = useState(false);
    const [cacheMode, setCacheMode] = useState('auto'); // 'auto' | 'force-refresh' | 'bypass'
    const [activeLang, setActiveLang] = useState('node');
    const [activeModal, setActiveModal] = useState(null); // 'provider' | 'credentials' | null
    const [copiedCode, setCopiedCode] = useState(false);

    const [isExecuting, setIsExecuting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [showRawJson, setShowRawJson] = useState(false);

    useEffect(() => {
        const syncTestKey = () => {
            const latest = sessionStorage.getItem(TEST_KEY_STORAGE);
            if (latest) setVirtualKey(latest);
        };
        window.addEventListener('flowops:test-key-updated', syncTestKey);
        return () => window.removeEventListener('flowops:test-key-updated', syncTestKey);
    }, []);

    const createTestKeyMutation = useMutation({
        mutationFn: (apiId) =>
            apiKeysService.createKey({
                apiId,
                name: `Playground Test Key (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
            }),
        onSuccess: (res) => {
            const rawKey = res?.data?.rawKey;
            if (rawKey) {
                sessionStorage.setItem(TEST_KEY_STORAGE, rawKey);
                setVirtualKey(rawKey);
                window.dispatchEvent(new Event('flowops:test-key-updated'));
            }
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
            toast.success('Test virtual key generated and loaded into Playground.');
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to generate test virtual key.');
        },
    });

    const activeProviderMeta = useMemo(
        () => PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0],
        [provider]
    );

    const requestSpec = useMemo(() => {
        const effectiveModel = simulateOutage
            ? 'gpt-4o'
            : provider === 'openai-compatible'
                ? creds.customModel.trim() || 'llama-3.3-70b-versatile'
                : activeProviderMeta.defaultModel;

        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${virtualKey.trim() || 'YOUR_FLOWOPS_VIRTUAL_KEY'}`,
        };

        if (creds.openaiKey.trim()) headers['x-openai-key'] = creds.openaiKey.trim();
        if (creds.geminiKey.trim()) headers['x-gemini-key'] = creds.geminiKey.trim();
        if (creds.anthropicKey.trim()) headers['x-anthropic-key'] = creds.anthropicKey.trim();

        if (provider === 'openai-compatible') {
            headers['x-flowops-provider'] = 'openai-compatible';
            if (creds.targetUrl.trim()) headers['x-flowops-target-url'] = creds.targetUrl.trim();
            if (creds.customModel.trim()) headers['x-flowops-custom-model'] = creds.customModel.trim();
            if (creds.customKey.trim()) headers['x-custom-key'] = creds.customKey.trim();
        }

        if (cacheMode === 'force-refresh') {
            headers['x-flowops-cache-force-refresh'] = 'true';
        } else if (cacheMode === 'bypass') {
            headers['x-flowops-cache'] = 'false';
        }

        if (simulateOutage) {
            headers['x-flowops-simulate-error'] = '503';
            // Allow FREE-tier workspaces to simulate OpenAI 503 outage without a real paid OpenAI key
            if (!headers['x-openai-key']) {
                headers['x-openai-key'] = 'sk-sim-outage-test';
            }
            if (!activeRoute?.fallbackProviders?.trim()) {
                headers['x-flowops-fallbacks'] = 'gemini,anthropic';
            }
        } else if (forceSmartRouting) {
            headers['x-flowops-smart-routing'] = 'true';
        }

        const payload = {
            model: effectiveModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: Number(creds.maxTokens) || 500,
            ...(streamEnabled ? { stream: true } : {}),
        };

        // Preview-safe headers mask long BYOK/virtual keys visually unless short placeholder
        const redactToken = (val) => {
            if (!val || val.startsWith('YOUR_')) return val;
            if (val.length <= 12) return '••••••';
            return `${val.slice(0, 8)}...${val.slice(-4)}`;
        };

        const previewHeaders = Object.fromEntries(
            Object.entries(headers).map(([k, v]) => {
                if (k === 'Authorization') return [k, virtualKey.trim() ? `Bearer ${redactToken(virtualKey.trim())}` : v];
                if (k.endsWith('-key')) return [k, redactToken(v)];
                return [k, v];
            })
        );

        return {
            endpoint: `${GATEWAY_BASE_URL}/chat/completions`,
            effectiveModel,
            headers,
            previewHeaders,
            payload,
        };
    }, [activeProviderMeta, activeRoute, cacheMode, creds, forceSmartRouting, prompt, provider, simulateOutage, streamEnabled, virtualKey]);

    const codeText = useMemo(() => {
        const extraHeaders = Object.fromEntries(
            Object.entries(requestSpec.previewHeaders).filter(([k]) => k !== 'Content-Type' && k !== 'Authorization')
        );
        const keyDisplay = virtualKey.trim() ? 'process.env.FLOWOPS_API_KEY' : '"YOUR_FLOWOPS_VIRTUAL_KEY"';
        const pyKeyDisplay = virtualKey.trim() ? 'os.environ["FLOWOPS_API_KEY"]' : '"YOUR_FLOWOPS_VIRTUAL_KEY"';
        const escapedPrompt = JSON.stringify(prompt);
        const headersJsonIndented = JSON.stringify(extraHeaders, null, 2)
            .split('\n')
            .map((line, idx) => (idx === 0 ? line : `  ${line}`))
            .join('\n');

        if (activeLang === 'node') {
            if (streamEnabled) {
                return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: ${keyDisplay},
  baseURL: "${GATEWAY_BASE_URL}",${
                    Object.keys(extraHeaders).length > 0
                        ? `\n  defaultHeaders: ${headersJsonIndented},`
                        : ''
                }
});

const stream = await client.chat.completions.create({
  model: "${requestSpec.effectiveModel}",
  messages: [{ role: "user", content: ${escapedPrompt} }],
  max_tokens: ${requestSpec.payload.max_tokens},
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`;
            }

            return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: ${keyDisplay},
  baseURL: "${GATEWAY_BASE_URL}",${
                Object.keys(extraHeaders).length > 0
                    ? `\n  defaultHeaders: ${headersJsonIndented},`
                    : ''
            }
});

const response = await client.chat.completions.create({
  model: "${requestSpec.effectiveModel}",
  messages: [{ role: "user", content: ${escapedPrompt} }],
  max_tokens: ${requestSpec.payload.max_tokens},
});

console.log(response.choices[0].message.content);`;
        }

        if (activeLang === 'python') {
            if (streamEnabled) {
                return `import os
from openai import OpenAI

client = OpenAI(
    api_key=${pyKeyDisplay},
    base_url="${GATEWAY_BASE_URL}",${
                    Object.keys(extraHeaders).length > 0
                        ? `\n    default_headers=${JSON.stringify(extraHeaders, null, 4)},`
                        : ''
                }
)

stream = client.chat.completions.create(
    model="${requestSpec.effectiveModel}",
    messages=[{"role": "user", "content": ${escapedPrompt}}],
    max_tokens=${requestSpec.payload.max_tokens},
    stream=True,
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`;
            }

            return `import os
from openai import OpenAI

client = OpenAI(
    api_key=${pyKeyDisplay},
    base_url="${GATEWAY_BASE_URL}",${
                Object.keys(extraHeaders).length > 0
                    ? `\n    default_headers=${JSON.stringify(extraHeaders, null, 4)},`
                    : ''
            }
)

response = client.chat.completions.create(
    model="${requestSpec.effectiveModel}",
    messages=[{"role": "user", "content": ${escapedPrompt}}],
    max_tokens=${requestSpec.payload.max_tokens},
)

print(response.choices[0].message.content)`;
        }

        if (activeLang === 'powershell') {
            const headerFlags = Object.entries(requestSpec.previewHeaders)
                .map(([k, v]) => `  -H "${k}: ${v}" \``)
                .join('\n');
            const bodyPretty = JSON.stringify(requestSpec.payload, null, 2);
            return `$body = @'
${bodyPretty}
'@

curl.exe ${streamEnabled ? '-N ' : ''}-s -X POST "${requestSpec.endpoint}" \`
${headerFlags}
  -d $body`;
        }

        const bashHeaderFlags = Object.entries(requestSpec.previewHeaders)
            .map(([k, v]) => `  -H "${k}: ${v}" \\`)
            .join('\n');
        return `curl ${streamEnabled ? '-N ' : ''}-X POST "${requestSpec.endpoint}" \\
${bashHeaderFlags}
  -d '${JSON.stringify(requestSpec.payload)}'`;
    }, [activeLang, prompt, requestSpec, streamEnabled, virtualKey]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(codeText);
        setCopiedCode(true);
        toast.success('SDK request snippet copied to clipboard.');
        setTimeout(() => setCopiedCode(false), 1800);
    };

    const handleOpenCredentials = () => {
        setCredsDraft(creds);
        setActiveModal('credentials');
    };

    const handleSaveCredentials = (e) => {
        e.preventDefault();
        localStorage.setItem(CREDS_STORAGE, JSON.stringify(credsDraft));
        setCreds(credsDraft);
        setActiveModal(null);
        toast.success('Playground BYOK credentials saved locally in browser.');
    };

    const handleClearCredentials = () => {
        localStorage.removeItem(CREDS_STORAGE);
        setCreds(DEFAULT_CREDS);
        setCredsDraft(DEFAULT_CREDS);
        toast.success('Browser BYOK test credentials cleared.');
    };

    const handleRunTest = async () => {
        if (!virtualKey.trim()) {
            toast.error('Paste a FlowOps Virtual Key or click "Create Test Key" first.');
            return;
        }
        if (!prompt.trim()) {
            toast.error('Enter a prompt message to test.');
            return;
        }

        setIsExecuting(true);
        const start = performance.now();
        try {
            const res = await fetch(requestSpec.endpoint, {
                method: 'POST',
                headers: requestSpec.headers,
                body: JSON.stringify(requestSpec.payload),
            });

            const readTelemetry = (headers) => ({
                provider: headers.get('x-flowops-provider'),
                modelSelected: headers.get('x-flowops-model-selected'),
                classifierTier: headers.get('x-flowops-classifier-tier'),
                routerReason: headers.get('x-flowops-router-reason'),
                cache: headers.get('x-flowops-cache'),
                cacheTier: headers.get('x-flowops-cache-tier'),
                cacheSimilarity: headers.get('x-flowops-cache-similarity'),
                cacheReason: headers.get('x-flowops-cache-reason'),
                streaming: headers.get('x-flowops-streaming') === 'true',
                retryCount: headers.get('x-flowops-retry-count'),
                fallbackUsed: headers.get('x-flowops-fallback-used') === 'true',
                failoverFrom: headers.get('x-flowops-failover-from'),
                latency: headers.get('x-flowops-latency'),
            });

            const telemetry = readTelemetry(res.headers);
            const contentType = res.headers.get('content-type') || '';

            if (res.ok && (streamEnabled || contentType.includes('text/event-stream')) && res.body) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let lineBuffer = '';
                let streamedText = '';
                let ttftMs = null;
                let chunkCount = 0;
                let lastUsage = null;
                const rawChunks = [];

                setTestResult({
                    ok: true,
                    status: res.status,
                    elapsedMs: 0,
                    ttftMs: null,
                    chunkCount: 0,
                    telemetry,
                    data: { streaming: true, chunks: [] },
                    assistantText: '',
                });

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    lineBuffer += decoder.decode(value, { stream: true });
                    const lines = lineBuffer.split(/\r?\n/);
                    lineBuffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        const dataStr = trimmed.slice(5).trim();
                        if (!dataStr || dataStr === '[DONE]') continue;
                        try {
                            const chunkJson = JSON.parse(dataStr);
                            const deltaContent = chunkJson?.choices?.[0]?.delta?.content;
                            if (typeof deltaContent === 'string' && deltaContent.length > 0) {
                                if (ttftMs === null) ttftMs = Math.round(performance.now() - start);
                                streamedText += deltaContent;
                            }
                            if (chunkJson.usage) lastUsage = chunkJson.usage;
                            chunkCount += 1;
                            rawChunks.push(chunkJson);
                        } catch {
                            // Ignore malformed intermediate frames
                        }
                    }

                    setTestResult({
                        ok: true,
                        status: res.status,
                        elapsedMs: Math.round(performance.now() - start),
                        ttftMs,
                        chunkCount,
                        telemetry,
                        data: { streaming: true, usage: lastUsage, chunks: rawChunks },
                        assistantText: streamedText,
                    });
                }

                toast.success(`Stream finished (${chunkCount} chunks, TTFT ${ttftMs ?? 0}ms) via ${telemetry.provider || telemetry.modelSelected}`);
                return;
            }

            const elapsedMs = Math.round(performance.now() - start);
            const rawText = await res.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch {
                data = { rawText };
            }

            setTestResult({
                ok: res.ok,
                status: res.status,
                elapsedMs,
                telemetry,
                data,
                assistantText: data?.choices?.[0]?.message?.content || data?.error?.message || rawText,
            });

            if (res.ok) {
                toast.success(`200 OK via ${telemetry.provider || telemetry.modelSelected || 'FlowOps Gateway'}`);
            } else {
                toast.error(`Gateway returned HTTP ${res.status}`);
            }
        } catch (err) {
            const elapsedMs = Math.round(performance.now() - start);
            setTestResult({
                ok: false,
                status: 0,
                elapsedMs,
                telemetry: {},
                data: { error: { message: err.message } },
                assistantText: `Network error calling ${requestSpec.endpoint}: ${err.message}`,
            });
            toast.error(`Network error: ${err.message}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const configuredCredsCount = [
        creds.openaiKey,
        creds.geminiKey,
        creds.anthropicKey,
        creds.customKey,
    ].filter((v) => v && v.trim()).length;

    return (
        <Card className="p-0 overflow-hidden border-white/10">
            {/* Portkey Card 1 Header */}
            <div className="p-6 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.015]">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[12px] font-mono font-bold">
                            1
                        </span>
                        <p className="text-[16px] font-bold text-white font-sans">
                            Live Test Request Playground
                        </p>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                            OpenAI SDK Compatible
                        </span>
                    </div>
                    <p className="text-[12px] text-neutral-400 font-sans mt-1">
                        Pick a provider or click highlighted tokens below to test live prompts, Smart Classifier routing, or simulated 503 failover directly from your browser.
                    </p>
                </div>

                {/* Clickable Provider & Credentials Quick Bar */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveModal('provider')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-sans font-bold cursor-pointer transition-all hover:brightness-110 ${activeProviderMeta.pillClass}`}
                    >
                        <Icon name="hub" className="w-3.5 h-3.5" />
                        <span>Provider: {activeProviderMeta.short}</span>
                        <Icon name="expand_more" className="w-3.5 h-3.5 opacity-80" />
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCredentials}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#141414] hover:border-white/25 text-[12px] font-sans font-bold text-neutral-200 cursor-pointer transition-all"
                    >
                        <Icon name="key" className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                            Credentials {configuredCredsCount > 0 ? `(${configuredCredsCount} BYOK)` : '(Server Vault)'}
                        </span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-white/5">
                {/* Left Column: Controls */}
                <div className="xl:col-span-5 p-6 space-y-5 bg-[#0c0c0c]">
                    {/* Route & Virtual Key */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
                                Target Route & Virtual API Key
                            </label>
                            {activeRoute && (
                                <button
                                    type="button"
                                    disabled={createTestKeyMutation.isPending}
                                    onClick={() => createTestKeyMutation.mutate(activeRoute.id)}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer disabled:opacity-50"
                                >
                                    {createTestKeyMutation.isPending ? (
                                        <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Icon name="add" className="w-3.5 h-3.5" />
                                    )}
                                    1-Click Create Test Key
                                </button>
                            )}
                        </div>

                        {apisList.length > 0 && (
                            <select
                                value={activeRoute?.id || ''}
                                onChange={(e) => onSelectRoute?.(e.target.value)}
                                className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-[12px] font-sans text-white focus:outline-none focus:border-cyan-400/50 cursor-pointer"
                                aria-label="Playground Target Route"
                            >
                                {apisList.map((route) => (
                                    <option key={route.id} value={route.id}>
                                        {route.name} (/gateway/{route.slug})
                                    </option>
                                ))}
                            </select>
                        )}

                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={virtualKey}
                                onChange={(e) => {
                                    setVirtualKey(e.target.value);
                                    if (e.target.value.trim()) {
                                        sessionStorage.setItem(TEST_KEY_STORAGE, e.target.value.trim());
                                    }
                                }}
                                placeholder="flw_... (click '1-Click Create Test Key' above)"
                                className="w-full bg-[#121212] border border-white/10 rounded-lg pl-3 pr-10 py-2 text-[12px] font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400/50"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey((prev) => !prev)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200 cursor-pointer"
                                title={showKey ? 'Hide key' : 'Reveal key'}
                            >
                                <Icon name={showKey ? 'visibility_off' : 'visibility'} className="w-4 h-4" />
                            </button>
                        </div>
                        {activeRoute && (
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-neutral-400">
                                <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">
                                    Fallbacks: {activeRoute.fallbackProviders || 'gemini,anthropic'}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/5">
                                    Retries: {activeRoute.retryCount ?? 2}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Provider Pills */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
                                Model / Provider Mode
                            </label>
                            <button
                                type="button"
                                onClick={handleOpenCredentials}
                                className="text-[11px] text-neutral-400 hover:text-white underline decoration-dotted cursor-pointer font-sans"
                            >
                                Configure BYOK / Custom URL
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {PROVIDER_OPTIONS.map((opt) => {
                                const selected = provider === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setProvider(opt.id)}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-sans font-bold transition-all cursor-pointer ${
                                            selected
                                                ? opt.pillClass
                                                : 'border-white/10 bg-[#131313] text-neutral-400 hover:text-white hover:border-white/20'
                                        }`}
                                    >
                                        {opt.short}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Prompt Input & Quick Presets */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
                                User Prompt
                            </label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setPrompt('Say hello and tell me which AI model answered this request in one sentence.')}
                                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-neutral-300 cursor-pointer"
                                >
                                    Simple Prompt
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPrompt(
                                            'Design a fault-tolerant distributed rate limiter and multi-region LLM failover architecture with tradeoffs between Redis token buckets and consistent hashing.'
                                        )
                                    }
                                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-neutral-300 cursor-pointer"
                                >
                                    Complex Prompt
                                </button>
                            </div>
                        </div>
                        <textarea
                            rows={3}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-[12px] font-sans text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400/50 resize-y"
                            placeholder="Ask a question to test live gateway routing..."
                        />
                    </div>

                    {/* Resilience, Streaming, Cache & Smart Classifier Toggles */}
                    <div className="space-y-2 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#121212] border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                                <div className="pr-2">
                                    <span className="text-[12px] font-bold text-white font-sans flex items-center gap-1.5">
                                        <Icon name="bolt" className="w-3.5 h-3.5 text-emerald-400" />
                                        SSE Streaming
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-sans block mt-0.5">
                                        Sets <code className="text-neutral-300">stream: true</code> &amp; measures TTFT.
                                    </span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={streamEnabled}
                                    onChange={(e) => setStreamEnabled(e.target.checked)}
                                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                                />
                            </label>

                            <div className="p-2.5 rounded-lg bg-[#121212] border border-white/10 flex flex-col justify-between">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase font-sans mb-1">
                                    2-Tier Cache Policy
                                </span>
                                <select
                                    value={cacheMode}
                                    onChange={(e) => setCacheMode(e.target.value)}
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white cursor-pointer"
                                    aria-label="Cache Policy"
                                >
                                    <option value="auto">Auto (Redis + pgvector)</option>
                                    <option value="force-refresh">Force Refresh (Recompute)</option>
                                    <option value="bypass">Bypass Cache</option>
                                </select>
                            </div>
                        </div>

                        <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#121212] border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                            <div className="pr-3">
                                <span className="text-[12px] font-bold text-white font-sans flex items-center gap-1.5">
                                    <Icon name="warning" className="w-3.5 h-3.5 text-amber-400" />
                                    Simulate OpenAI 503 Outage
                                </span>
                                <span className="text-[11px] text-neutral-400 font-sans block mt-0.5">
                                    Forces primary <code className="text-neutral-300">gpt-4o</code> with 503 outage to verify auto-failover.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={simulateOutage}
                                onChange={(e) => setSimulateOutage(e.target.checked)}
                                className="w-4 h-4 accent-amber-400 cursor-pointer"
                            />
                        </label>

                        <label
                            className={`flex items-center justify-between p-2.5 rounded-lg bg-[#121212] border border-white/10 transition-colors ${
                                simulateOutage ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-white/20'
                            }`}
                        >
                            <div className="pr-3">
                                <span className="text-[12px] font-bold text-white font-sans flex items-center gap-1.5">
                                    <Icon name="auto_awesome" className="w-3.5 h-3.5 text-cyan-400" />
                                    Force Smart Classifier Header
                                </span>
                                <span className="text-[11px] text-neutral-400 font-sans block mt-0.5">
                                    Sends <code className="text-neutral-300">x-flowops-smart-routing: true</code> on request.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                disabled={simulateOutage}
                                checked={!simulateOutage && forceSmartRouting}
                                onChange={(e) => setForceSmartRouting(e.target.checked)}
                                className="w-4 h-4 accent-cyan-400 cursor-pointer"
                            />
                        </label>
                    </div>

                    {/* Execute Test Request CTA */}
                    <button
                        type="button"
                        disabled={isExecuting}
                        onClick={handleRunTest}
                        className="w-full py-2.5 px-4 bg-white text-black hover:bg-neutral-200 rounded-lg font-sans font-bold text-[13px] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                    >
                        {isExecuting ? (
                            <>
                                <Icon name="autorenew" className="w-4 h-4 animate-spin text-black" />
                                Running Live Gateway Request...
                            </>
                        ) : (
                            <>
                                <Icon name="play_arrow" className="w-4 h-4 text-black" />
                                Test Request Now
                            </>
                        )}
                    </button>
                </div>

                {/* Right Column: Portkey Interactive Snippet + Live Response */}
                <div className="xl:col-span-7 flex flex-col bg-[#080808]">
                    {/* Language Tabs + Interactive Token Hints */}
                    <div className="px-5 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-[#101010]">
                        <div className="flex items-center gap-1">
                            {[
                                { id: 'node', label: 'Node.js SDK' },
                                { id: 'python', label: 'Python SDK' },
                                { id: 'powershell', label: 'cURL (PowerShell)' },
                                { id: 'bash', label: 'cURL (Bash)' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveLang(tab.id)}
                                    className={`px-3 py-1.5 rounded-md text-[11px] font-bold font-sans transition-all cursor-pointer ${
                                        activeLang === tab.id
                                            ? 'bg-white text-black shadow-sm'
                                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setActiveModal('provider')}
                                className="px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[11px] font-mono cursor-pointer hover:bg-cyan-500/20"
                                title="Click to switch target provider/model"
                            >
                                model: {requestSpec.effectiveModel}
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyCode}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-sans font-bold text-white cursor-pointer transition-colors"
                            >
                                <Icon name={copiedCode ? 'check' : 'content_copy'} className="w-3.5 h-3.5" />
                                {copiedCode ? 'Copied' : 'Copy Code'}
                            </button>
                        </div>
                    </div>

                    {/* Generated OpenAI SDK / cURL Code */}
                    <div className="p-5 overflow-x-auto border-b border-white/5 bg-[#060606]">
                        <pre className="text-[12px] leading-relaxed font-mono text-neutral-200 whitespace-pre">
                            {codeText}
                        </pre>
                    </div>

                    {/* Live Response & Routing Telemetry Panel */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        {!testResult ? (
                            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-6 text-center space-y-1.5">
                                <p className="text-[13px] font-bold text-neutral-200 font-sans">
                                    Ready to execute against <span className="font-mono text-cyan-400">{requestSpec.endpoint}</span>
                                </p>
                                <p className="text-[12px] text-neutral-500 font-sans">
                                    Click <strong className="text-neutral-300">Test Request Now</strong> to inspect the real LLM completion, classifier tier, selected provider, and failover headers.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Status + Telemetry Badges */}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                                                testResult.ok
                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                                    : 'bg-red-500/15 border-red-500/30 text-red-400'
                                            }`}
                                        >
                                            HTTP {testResult.status || 'ERR'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300">
                                            {testResult.telemetry.latency ? `${testResult.telemetry.latency}ms` : `${testResult.elapsedMs}ms`}
                                        </span>
                                        {testResult.telemetry.streaming && (
                                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono text-emerald-300">
                                                STREAM • TTFT {testResult.ttftMs ?? testResult.elapsedMs}ms ({testResult.chunkCount || 0} chunks)
                                            </span>
                                        )}
                                        {testResult.telemetry.provider && (
                                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-[11px] font-mono text-cyan-300">
                                                provider: {testResult.telemetry.provider}
                                            </span>
                                        )}
                                        {testResult.telemetry.modelSelected && (
                                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-[11px] font-mono text-cyan-300">
                                                model: {testResult.telemetry.modelSelected}
                                            </span>
                                        )}
                                        {testResult.telemetry.classifierTier && (
                                            <span className="px-2 py-0.5 rounded bg-red-950/40 border border-red-500/30 text-[11px] font-mono text-red-300">
                                                tier: {testResult.telemetry.classifierTier}
                                            </span>
                                        )}
                                        {testResult.telemetry.cache && (
                                            <span className={`px-2 py-0.5 rounded border text-[11px] font-mono ${
                                                testResult.telemetry.cache === 'HIT'
                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                                    : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                                            }`}>
                                                cache: {testResult.telemetry.cache}
                                                {testResult.telemetry.cacheTier ? ` (${testResult.telemetry.cacheTier}${testResult.telemetry.cacheSimilarity ? ` • ${Number(testResult.telemetry.cacheSimilarity).toFixed(2)}` : ''})` : ''}
                                            </span>
                                        )}
                                        {testResult.telemetry.fallbackUsed && (
                                            <span className="px-2 py-0.5 rounded bg-orange-500/15 border border-orange-500/30 text-[11px] font-mono text-orange-300">
                                                FAILOVER: {testResult.telemetry.failoverFrom || 'primary'} → {testResult.telemetry.provider}
                                            </span>
                                        )}
                                        {Number(testResult.telemetry.retryCount || 0) > 0 && (
                                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300">
                                                retries: {testResult.telemetry.retryCount}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowRawJson((prev) => !prev)}
                                        className="text-[11px] font-mono text-neutral-400 hover:text-white cursor-pointer underline decoration-dotted"
                                    >
                                        {showRawJson ? 'Hide Raw JSON' : 'Inspect Raw JSON'}
                                    </button>
                                </div>

                                {testResult.telemetry.routerReason && (
                                    <div className="px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-[11px] font-mono text-cyan-300">
                                        x-flowops-router-reason: {testResult.telemetry.routerReason}
                                    </div>
                                )}

                                {/* Assistant Output */}
                                <div className="rounded-lg border border-white/10 bg-[#111111] p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                                            {testResult.ok ? 'Normalized OpenAI Completion Output' : 'Gateway Error Details'}
                                        </span>
                                        {testResult.data?.usage?.total_tokens != null && (
                                            <span className="text-[11px] font-mono text-neutral-400">
                                                tokens: {testResult.data.usage.prompt_tokens ?? '?'} in / {testResult.data.usage.completion_tokens ?? '?'} out ({testResult.data.usage.total_tokens} total)
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[13px] font-sans text-neutral-100 whitespace-pre-wrap leading-relaxed">
                                        {testResult.assistantText}
                                    </p>
                                </div>

                                {showRawJson && (
                                    <div className="rounded-lg border border-white/10 bg-[#050505] p-4 overflow-x-auto max-h-64">
                                        <pre className="text-[11px] font-mono text-neutral-300 whitespace-pre">
                                            {JSON.stringify(testResult.data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Unified Click-to-Edit Modal (Provider Picker | BYOK Credentials) */}
            {activeModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-[#111111] border border-white/10 rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] max-w-lg w-full overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <p className="text-[15px] font-bold text-white font-sans">
                                {activeModal === 'provider'
                                    ? 'Select Target Provider / Routing Mode'
                                    : 'Configure Browser BYOK & Custom Endpoint'}
                            </p>
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer"
                            >
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>

                        {activeModal === 'provider' ? (
                            <div className="p-5 space-y-2.5">
                                {PROVIDER_OPTIONS.map((opt) => {
                                    const selected = provider === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                setProvider(opt.id);
                                                setActiveModal(null);
                                            }}
                                            className={`w-full text-left p-3.5 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                                                selected
                                                    ? 'border-cyan-500/50 bg-cyan-500/10'
                                                    : 'border-white/10 bg-[#151515] hover:border-white/25'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[13px] font-bold text-white font-sans">{opt.name}</span>
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-neutral-300">
                                                        {opt.badge}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] text-neutral-400 font-sans mt-1">{opt.description}</p>
                                            </div>
                                            {selected && <Icon name="check_circle" className="w-5 h-5 text-cyan-400 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <form onSubmit={handleSaveCredentials} className="p-6 space-y-4">
                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-sans text-amber-200 leading-relaxed">
                                    Keys entered here stay strictly inside your browser&apos;s <code className="font-mono">localStorage</code> and are sent only as request-time BYOK headers during Playground tests. Leave Gemini blank to use the configured server <code className="font-mono">GEMINI_API_KEY</code>.
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">OpenAI Key (x-openai-key)</label>
                                        <input
                                            type="password"
                                            value={credsDraft.openaiKey}
                                            onChange={(e) => setCredsDraft((p) => ({ ...p, openaiKey: e.target.value }))}
                                            placeholder="sk-..."
                                            className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">Gemini Key (x-gemini-key)</label>
                                        <input
                                            type="password"
                                            value={credsDraft.geminiKey}
                                            onChange={(e) => setCredsDraft((p) => ({ ...p, geminiKey: e.target.value }))}
                                            placeholder="AIza... (optional)"
                                            className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">Anthropic Key (x-anthropic-key)</label>
                                        <input
                                            type="password"
                                            value={credsDraft.anthropicKey}
                                            onChange={(e) => setCredsDraft((p) => ({ ...p, anthropicKey: e.target.value }))}
                                            placeholder="sk-ant-..."
                                            className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">Max Tokens</label>
                                        <input
                                            type="number"
                                            min={16}
                                            max={4096}
                                            value={credsDraft.maxTokens}
                                            onChange={(e) => setCredsDraft((p) => ({ ...p, maxTokens: Number(e.target.value) || 500 }))}
                                            className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-white/5 space-y-3">
                                    <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider font-sans">
                                        OpenAI-Compatible / Open-Source Settings (Groq, Ollama, vLLM)
                                    </p>
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">Target Base URL (x-flowops-target-url)</label>
                                        <input
                                            type="url"
                                            value={credsDraft.targetUrl}
                                            onChange={(e) => setCredsDraft((p) => ({ ...p, targetUrl: e.target.value }))}
                                            placeholder="https://api.groq.com/openai/v1 or http://localhost:11434/v1"
                                            className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">Custom Model (x-flowops-custom-model)</label>
                                            <input
                                                type="text"
                                                value={credsDraft.customModel}
                                                onChange={(e) => setCredsDraft((p) => ({ ...p, customModel: e.target.value }))}
                                                placeholder="llama-3.3-70b-versatile"
                                                className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-neutral-400 uppercase font-sans">Custom Bearer Key (x-custom-key)</label>
                                            <input
                                                type="password"
                                                value={credsDraft.customKey}
                                                onChange={(e) => setCredsDraft((p) => ({ ...p, customKey: e.target.value }))}
                                                placeholder="gsk_... or optional for Ollama"
                                                className="mt-1 w-full bg-[#0b0b0b] border border-white/10 rounded px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-cyan-400/50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={handleClearCredentials}
                                        className="px-3 py-2 rounded border border-white/10 text-[12px] font-sans font-bold text-neutral-400 hover:text-red-400 cursor-pointer"
                                    >
                                        Clear Saved Keys
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActiveModal(null)}
                                            className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-[12px] font-sans font-bold text-white cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded bg-white text-black hover:bg-neutral-200 text-[12px] font-sans font-bold cursor-pointer"
                                        >
                                            Save Credentials
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}
