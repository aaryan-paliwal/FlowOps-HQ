import { useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { apisService } from '../services/api';
import { Card } from './Card';
import Icon from './Icon';

const ALL_PROVIDERS = [
    { id: 'openai', label: 'OpenAI (GPT-4o / 4o-mini)', color: 'bg-red-500' },
    { id: 'gemini', label: 'Google Gemini (3.5 Flash / Pro)', color: 'bg-[#CBFF2E]' },
    { id: 'anthropic', label: 'Anthropic (Claude 3.5 Sonnet)', color: 'bg-red-700' },
];

const STRATEGY_CARDS = [
    {
        id: 'cost-optimized',
        title: 'Cost-Optimized',
        subtitle: 'Routes simple prompts to low-cost Flash/Mini tiers and complex prompts to flagship models.',
    },
    {
        id: 'speed-optimized',
        title: 'Speed-Optimized',
        subtitle: 'Prioritizes lowest time-to-first-token models (e.g. Gemini Flash) when latency matters.',
    },
    {
        id: 'quality-optimized',
        title: 'Quality-Optimized',
        subtitle: 'Biases routing toward highest reasoning models (GPT-4o / Claude 3.5 Sonnet / Pro).',
    },
];

function parseWeights(raw) {
    const defaults = { openai: 50, gemini: 30, anthropic: 20 };
    if (!raw) return defaults;
    try {
        const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!obj || typeof obj !== 'object') return defaults;
        return {
            openai: Number(obj.openai ?? 0),
            gemini: Number(obj.gemini ?? 0),
            anthropic: Number(obj.anthropic ?? 0),
        };
    } catch {
        return defaults;
    }
}

function parseFallbacks(raw) {
    if (!raw) return ['gemini', 'anthropic'];
    const list = String(raw)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ALL_PROVIDERS.some((p) => p.id === s));
    return list.length > 0 ? Array.from(new Set(list)) : ['gemini', 'anthropic'];
}

export function RoutingConfigStudio({ route, isSaving = false, onSaveConfig }) {
    const [activeTab, setActiveTab] = useState('smart'); // 'smart' | 'fallbacks' | 'lb' | 'retries' | 'alerts'
    const [previewFormat, setPreviewFormat] = useState('json'); // 'json' | 'node' | 'curl'
    const [copiedSnippet, setCopiedSnippet] = useState(false);
    const [isTestingAlert, setIsTestingAlert] = useState(false);

    // Track per-route unsaved overrides without effect-driven setState cascades
    const [draft, setDraft] = useState(null);
    const activeDraft = draft && draft.routeId === route?.id ? draft : {};

    const serverFallbacks = useMemo(() => parseFallbacks(route?.fallbackProviders), [route?.fallbackProviders]);
    const serverWeights = useMemo(() => parseWeights(route?.loadBalancingWeights), [route?.loadBalancingWeights]);

    const smartRoutingEnabled =
        activeDraft.smartRoutingEnabled !== undefined
            ? activeDraft.smartRoutingEnabled
            : Boolean(route?.smartRoutingEnabled);
    const routingStrategy = activeDraft.routingStrategy ?? route?.routingStrategy ?? 'cost-optimized';
    const fallbacks = activeDraft.fallbacks ?? serverFallbacks;
    const weights = activeDraft.weights ?? serverWeights;
    const retryCount = activeDraft.retryCount !== undefined ? activeDraft.retryCount : Number(route?.retryCount ?? 2);
    const slackWebhookUrl = activeDraft.slackWebhookUrl !== undefined ? activeDraft.slackWebhookUrl : (route?.slackWebhookUrl ?? '');
    const errorAlertThreshold = activeDraft.errorAlertThreshold !== undefined ? activeDraft.errorAlertThreshold : Number(route?.errorAlertThreshold ?? 5);
    const alertWindowMinutes = activeDraft.alertWindowMinutes !== undefined ? activeDraft.alertWindowMinutes : Number(route?.alertWindowMinutes ?? 5);
    const costLimitAlert = activeDraft.costLimitAlert !== undefined ? activeDraft.costLimitAlert : Number(route?.costLimitAlert ?? 100);

    const patchDraft = (updates) => {
        if (!route) return;
        setDraft((prev) => ({
            ...(prev && prev.routeId === route.id ? prev : { routeId: route.id }),
            ...updates,
        }));
    };

    const normalizedTotalWeight = useMemo(
        () => Object.values(weights).reduce((acc, v) => acc + Math.max(0, Number(v) || 0), 0),
        [weights]
    );

    const isDirty = useMemo(() => {
        if (!route) return false;
        return (
            smartRoutingEnabled !== Boolean(route.smartRoutingEnabled) ||
            routingStrategy !== (route.routingStrategy || 'cost-optimized') ||
            fallbacks.join(',') !== serverFallbacks.join(',') ||
            Number(retryCount) !== Number(route.retryCount ?? 2) ||
            weights.openai !== serverWeights.openai ||
            weights.gemini !== serverWeights.gemini ||
            weights.anthropic !== serverWeights.anthropic ||
            slackWebhookUrl !== (route.slackWebhookUrl ?? '') ||
            Number(errorAlertThreshold) !== Number(route.errorAlertThreshold ?? 5) ||
            Number(alertWindowMinutes) !== Number(route.alertWindowMinutes ?? 5) ||
            Number(costLimitAlert) !== Number(route.costLimitAlert ?? 100)
        );
    }, [
        alertWindowMinutes,
        costLimitAlert,
        errorAlertThreshold,
        fallbacks,
        retryCount,
        route,
        routingStrategy,
        serverFallbacks,
        serverWeights,
        slackWebhookUrl,
        smartRoutingEnabled,
        weights,
    ]);

    const configPayload = useMemo(
        () => ({
            route_slug: route?.slug || 'prod-gateway',
            smart_routing: {
                enabled: smartRoutingEnabled,
                strategy: routingStrategy,
                model_alias: 'flowops-smart',
            },
            retry: {
                attempts: retryCount,
                on_status_codes: [429, 500, 502, 503, 504],
            },
            fallback_order: fallbacks,
            load_balancing_weights: weights,
            alerts: {
                webhook_configured: Boolean(slackWebhookUrl.trim()),
                error_threshold_percent: Number(errorAlertThreshold),
                window_minutes: Number(alertWindowMinutes),
                monthly_cost_cap_usd: Number(costLimitAlert),
            },
        }),
        [alertWindowMinutes, costLimitAlert, errorAlertThreshold, fallbacks, retryCount, route?.slug, routingStrategy, slackWebhookUrl, smartRoutingEnabled, weights]
    );

    const syncedPreviewText = useMemo(() => {
        if (previewFormat === 'json') {
            return JSON.stringify(configPayload, null, 2);
        }
        if (previewFormat === 'node') {
            return `// Synced client headers reflecting ${route?.slug || 'route'} policy
const response = await client.chat.completions.create(
  {
    model: "${smartRoutingEnabled ? 'flowops-smart' : 'gpt-4o'}",
    messages: [{ role: "user", content: "Summarize Q3 earnings." }],
  },
  {
    headers: {
      "x-flowops-smart-routing": "${smartRoutingEnabled}",
      "x-flowops-strategy": "${routingStrategy}",
      "x-flowops-fallbacks": "${fallbacks.join(',')}",
      "x-flowops-retries": "${retryCount}",
    },
  }
);`;
        }
        return `curl -X POST "http://localhost:5000/v1/chat/completions" \\
  -H "Authorization: Bearer $FLOWOPS_API_KEY" \\
  -H "x-flowops-smart-routing: ${smartRoutingEnabled}" \\
  -H "x-flowops-strategy: ${routingStrategy}" \\
  -H "x-flowops-fallbacks: ${fallbacks.join(',')}" \\
  -H "x-flowops-retries: ${retryCount}" \\
  -d '{"model":"${smartRoutingEnabled ? 'flowops-smart' : 'gpt-4o'}","messages":[{"role":"user","content":"Hello"}]}'`;
    }, [configPayload, fallbacks, previewFormat, retryCount, route?.slug, routingStrategy, smartRoutingEnabled]);

    if (!route) return null;

    const toggleFallbackProvider = (id) => {
        if (fallbacks.includes(id)) {
            if (fallbacks.length === 1) {
                toast.error('Keep at least one fallback provider enabled.');
                return;
            }
            patchDraft({ fallbacks: fallbacks.filter((item) => item !== id) });
        } else {
            patchDraft({ fallbacks: [...fallbacks, id] });
        }
    };

    const moveFallback = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= fallbacks.length) return;
        const copy = [...fallbacks];
        const [moved] = copy.splice(index, 1);
        copy.splice(target, 0, moved);
        patchDraft({ fallbacks: copy });
    };

    const handleSave = async () => {
        await onSaveConfig(route.id, {
            smartRoutingEnabled,
            routingStrategy,
            fallbackProviders: fallbacks.join(','),
            retryCount: Number(retryCount),
            loadBalancingWeights: JSON.stringify(weights),
            slackWebhookUrl: slackWebhookUrl.trim(),
            errorAlertThreshold: Number(errorAlertThreshold),
            alertWindowMinutes: Number(alertWindowMinutes),
            costLimitAlert: Number(costLimitAlert),
        });
        setDraft(null);
    };

    const handleSendTestAlert = async () => {
        if (!slackWebhookUrl.trim()) {
            toast.error('Enter a Slack Webhook URL first.');
            return;
        }
        setIsTestingAlert(true);
        try {
            await apisService.testAlert(route.id, { slackWebhookUrl: slackWebhookUrl.trim() });
            toast.success('Test Slack alert delivered successfully!');
        } catch (err) {
            toast.error(err?.message || 'Failed to deliver test alert.');
        } finally {
            setIsTestingAlert(false);
        }
    };

    const handleCopyPreview = () => {
        navigator.clipboard.writeText(syncedPreviewText);
        setCopiedSnippet(true);
        toast.success('Config snippet copied.');
        setTimeout(() => setCopiedSnippet(false), 1800);
    };

    return (
        <Card className="p-0 overflow-hidden border-white/10">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.015]">
                <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#CBFF2E]/15 border border-[#CBFF2E]/30 text-[#CBFF2E] text-[12px] font-mono font-bold">
                            2
                        </span>
                        <p className="text-[16px] font-bold text-white font-sans">
                            Routing &amp; Resilience Config Studio
                        </p>
                        <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300 text-[11px] font-mono">
                            {route.name} (/gateway/{route.slug})
                        </span>
                        {isDirty && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold uppercase">
                                Unsaved changes
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] text-neutral-400 font-sans mt-1">
                        Configure intelligent routing, fallback order, weighted load balancing, and automatic retries for this route without changing application code.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {isDirty && (
                        <button
                            type="button"
                            onClick={() => setDraft(null)}
                            className="px-3 py-2 rounded-lg border border-white/10 text-neutral-400 hover:text-white text-[12px] font-sans font-bold cursor-pointer"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isSaving || !isDirty}
                        onClick={handleSave}
                        className={`px-4 py-2 rounded-lg font-sans font-bold text-[12px] inline-flex items-center gap-2 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            isDirty
                                ? 'bg-white text-black hover:bg-neutral-200 shadow-sm'
                                : 'bg-white/10 text-neutral-300'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <Icon name="autorenew" className="w-4 h-4 animate-spin" />
                                Saving Config...
                            </>
                        ) : (
                            <>
                                <Icon name="check" className="w-4 h-4" />
                                {isDirty ? 'Save Route Config' : 'Saved'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="px-6 pt-3 border-b border-white/5 flex flex-wrap items-center gap-1 bg-[#0e0e0e]">
                {[
                    { id: 'smart', label: 'Smart Routing', icon: 'auto_awesome' },
                    { id: 'fallbacks', label: 'Fallbacks', icon: 'alt_route' },
                    { id: 'lb', label: 'Load Balancing', icon: 'tune' },
                    { id: 'retries', label: 'Retries & SDK Sync', icon: 'autorenew' },
                    { id: 'alerts', label: 'Alerts & Caching', icon: 'notifications' },
                ].map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-sans font-bold border-b-2 transition-colors cursor-pointer ${
                                active
                                    ? 'border-[#CBFF2E] text-white bg-white/[0.02]'
                                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            <Icon name={tab.icon} className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x divide-white/5">
                {/* Interactive Studio Controls */}
                <div className="xl:col-span-6 p-6 bg-[#0b0b0b]">
                    {activeTab === 'smart' && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-[#121212] border border-white/10">
                                <div>
                                    <p className="text-[14px] font-bold text-white font-sans">
                                        Default Smart Classifier Routing
                                    </p>
                                    <p className="text-[12px] text-neutral-400 font-sans mt-0.5">
                                        Automatically picks the optimal model when requests use <code className="text-[#CBFF2E]">flowops-smart</code>, <code className="text-[#CBFF2E]">auto</code>, or omit <code className="text-[#CBFF2E]">model</code>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={smartRoutingEnabled}
                                    onClick={() => patchDraft({ smartRoutingEnabled: !smartRoutingEnabled })}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
                                        smartRoutingEnabled
                                            ? 'bg-[#CBFF2E]/15 border-[#CBFF2E]/40'
                                            : 'bg-[#1a1a1a] border-white/10'
                                    }`}
                                >
                                    <span
                                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                                            smartRoutingEnabled ? 'bg-[#CBFF2E]' : 'bg-neutral-700'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-3 w-3 transform rounded-full bg-black transition-transform ${
                                                smartRoutingEnabled ? 'translate-x-4' : 'translate-x-1'
                                            }`}
                                        />
                                    </span>
                                    <span
                                        className={`text-[11px] font-mono font-bold uppercase ${
                                            smartRoutingEnabled ? 'text-[#CBFF2E]' : 'text-neutral-500'
                                        }`}
                                    >
                                        {smartRoutingEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-sans">
                                    Classification Objective
                                </label>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {STRATEGY_CARDS.map((card) => {
                                        const selected = routingStrategy === card.id;
                                        return (
                                            <button
                                                key={card.id}
                                                type="button"
                                                onClick={() => patchDraft({ routingStrategy: card.id })}
                                                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-start justify-between gap-3 ${
                                                    selected
                                                        ? 'border-[#CBFF2E]/50 bg-[#CBFF2E]/10'
                                                        : 'border-white/10 bg-[#121212] hover:border-white/25'
                                                }`}
                                            >
                                                <div>
                                                    <p className="text-[13px] font-bold text-white font-sans">{card.title}</p>
                                                    <p className="text-[11px] text-neutral-400 font-sans mt-0.5">{card.subtitle}</p>
                                                </div>
                                                {selected && <Icon name="check_circle" className="w-4 h-4 text-[#CBFF2E] shrink-0 mt-0.5" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fallbacks' && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-[13px] font-bold text-white font-sans">
                                    Ordered Emergency Failover Sequence
                                </p>
                                <p className="text-[12px] text-neutral-400 font-sans mt-0.5">
                                    If the primary provider fails with 429/5xx after exhausting retries, FlowOps cascades down this priority list.
                                </p>
                            </div>

                            <div className="space-y-2">
                                {fallbacks.map((provId, idx) => {
                                    const meta = ALL_PROVIDERS.find((p) => p.id === provId);
                                    return (
                                        <div
                                            key={provId}
                                            className="p-3 rounded-lg bg-[#121212] border border-white/10 flex items-center justify-between gap-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="w-6 h-6 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono font-bold text-[#CBFF2E] flex items-center justify-center">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <p className="text-[13px] font-bold text-white font-sans">
                                                        {meta?.label || provId}
                                                    </p>
                                                    <span className="text-[10px] font-mono text-neutral-500 uppercase">
                                                        Priority #{idx + 1} Fallback
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() => moveFallback(idx, -1)}
                                                    className="p-1.5 rounded border border-white/10 text-neutral-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                                                    title="Move Higher"
                                                >
                                                    <Icon name="expand_less" className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={idx === fallbacks.length - 1}
                                                    onClick={() => moveFallback(idx, 1)}
                                                    className="p-1.5 rounded border border-white/10 text-neutral-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                                                    title="Move Lower"
                                                >
                                                    <Icon name="expand_more" className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-2 border-t border-white/5 space-y-2">
                                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-sans block">
                                    Toggle Eligible Fallback Targets
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_PROVIDERS.map((prov) => {
                                        const active = fallbacks.includes(prov.id);
                                        return (
                                            <button
                                                key={prov.id}
                                                type="button"
                                                onClick={() => toggleFallbackProvider(prov.id)}
                                                className={`px-3 py-1.5 rounded-lg border text-[12px] font-mono transition-all cursor-pointer ${
                                                    active
                                                        ? 'border-[#CBFF2E]/40 bg-[#CBFF2E]/10 text-[#CBFF2E]'
                                                        : 'border-white/10 bg-[#141414] text-neutral-400 hover:text-white'
                                                }`}
                                            >
                                                {active ? '✓ ' : '+ '}
                                                {prov.id}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'lb' && (
                        <div className="space-y-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[13px] font-bold text-white font-sans">
                                        Traffic Split Weights
                                    </p>
                                    <p className="text-[12px] text-neutral-400 font-sans mt-0.5">
                                        Distribute requests proportionally across providers when traffic scaling or canary testing is enabled.
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-300 shrink-0">
                                    Total: {normalizedTotalWeight}
                                </span>
                            </div>

                            {/* Proportion Visual Bar */}
                            <div className="h-3 w-full rounded-full overflow-hidden bg-white/5 flex">
                                {ALL_PROVIDERS.map((prov) => {
                                    const pct =
                                        normalizedTotalWeight > 0
                                            ? Math.round(((weights[prov.id] || 0) / normalizedTotalWeight) * 100)
                                            : 0;
                                    if (pct <= 0) return null;
                                    return (
                                        <div
                                            key={prov.id}
                                            style={{ width: `${pct}%` }}
                                            className={`${prov.color} h-full transition-all`}
                                            title={`${prov.id}: ${pct}%`}
                                        />
                                    );
                                })}
                            </div>

                            <div className="space-y-3">
                                {ALL_PROVIDERS.map((prov) => {
                                    const val = weights[prov.id] ?? 0;
                                    const pct =
                                        normalizedTotalWeight > 0 ? Math.round((val / normalizedTotalWeight) * 100) : 0;
                                    return (
                                        <div
                                            key={prov.id}
                                            className="p-3 rounded-lg bg-[#121212] border border-white/10 flex items-center justify-between gap-4"
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${prov.color}`} />
                                                <span className="text-[12px] font-bold text-white font-sans truncate">
                                                    {prov.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={1000}
                                                    value={val}
                                                    onChange={(e) =>
                                                        patchDraft({
                                                            weights: {
                                                                ...weights,
                                                                [prov.id]: Math.max(0, Number(e.target.value) || 0),
                                                            },
                                                        })
                                                    }
                                                    className="w-20 bg-[#090909] border border-white/10 rounded px-2.5 py-1.5 text-[12px] font-mono text-white text-right focus:outline-none focus:border-[#CBFF2E]/60"
                                                />
                                                <span className="w-10 text-right text-[11px] font-mono text-neutral-400">
                                                    {pct}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => patchDraft({ weights: { openai: 50, gemini: 30, anthropic: 20 } })}
                                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-neutral-300 cursor-pointer"
                                >
                                    Preset 50 / 30 / 20
                                </button>
                                <button
                                    type="button"
                                    onClick={() => patchDraft({ weights: { openai: 0, gemini: 100, anthropic: 0 } })}
                                    className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-neutral-300 cursor-pointer"
                                >
                                    100% Gemini Free Tier
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'retries' && (
                        <div className="space-y-5">
                            <div>
                                <p className="text-[13px] font-bold text-white font-sans">
                                    Automatic Exponential Retries
                                </p>
                                <p className="text-[12px] text-neutral-400 font-sans mt-0.5">
                                    Number of retry attempts on transient upstream failures before engaging the next fallback provider.
                                </p>
                            </div>

                            <div className="grid grid-cols-6 gap-2">
                                {[0, 1, 2, 3, 4, 5].map((count) => (
                                    <button
                                        key={count}
                                        type="button"
                                        onClick={() => patchDraft({ retryCount: count })}
                                        className={`py-2.5 rounded-lg border font-mono font-bold text-[13px] transition-all cursor-pointer ${
                                            retryCount === count
                                                ? 'border-[#CBFF2E] bg-[#CBFF2E]/15 text-[#CBFF2E]'
                                                : 'border-white/10 bg-[#121212] text-neutral-400 hover:text-white'
                                        }`}
                                    >
                                        {count}
                                    </button>
                                ))}
                            </div>

                            <div className="p-3.5 rounded-lg bg-[#121212] border border-white/10 text-[12px] text-neutral-300 font-sans space-y-1">
                                <p className="font-bold text-white">Active Retry Behavior ({retryCount} retries)</p>
                                <p className="text-neutral-400 text-[11px]">
                                    {retryCount === 0
                                        ? 'Zero retries: immediate failover to backup provider on first error (lowest P99 tail latency).'
                                        : `Attempts primary up to ${retryCount} extra time${retryCount > 1 ? 's' : ''} with Full Jitter backoff before cascading to [${fallbacks.join(' -> ')}].`}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'alerts' && (
                        <div className="space-y-5">
                            <div>
                                <p className="text-[13px] font-bold text-white font-sans">
                                    Slack Anomaly &amp; Budget Alerting
                                </p>
                                <p className="text-[12px] text-neutral-400 font-sans mt-0.5">
                                    Monitors rolling error rates and monthly token spend via SSRF-guarded Slack webhooks.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans mb-1.5">
                                    Slack Incoming Webhook URL
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        placeholder="https://hooks.slack.com/services/T.../B.../..."
                                        value={slackWebhookUrl}
                                        onChange={(e) => patchDraft({ slackWebhookUrl: e.target.value })}
                                        className="flex-1 bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-[12px] font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#CBFF2E]/60"
                                    />
                                    <button
                                        type="button"
                                        disabled={isTestingAlert || !slackWebhookUrl.trim()}
                                        onClick={handleSendTestAlert}
                                        className="px-3 py-2 rounded-lg border border-[#CBFF2E]/30 bg-[#CBFF2E]/10 hover:bg-[#CBFF2E]/20 text-[#CBFF2E] text-[11px] font-sans font-bold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                                    >
                                        {isTestingAlert ? 'Sending...' : 'Test Alert'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase font-sans mb-1">
                                        Error Rate (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        max="100"
                                        step="0.5"
                                        value={errorAlertThreshold}
                                        onChange={(e) => patchDraft({ errorAlertThreshold: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-lg px-2.5 py-2 text-[12px] font-mono text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase font-sans mb-1">
                                        Window (Min)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={alertWindowMinutes}
                                        onChange={(e) => patchDraft({ alertWindowMinutes: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-lg px-2.5 py-2 text-[12px] font-mono text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase font-sans mb-1">
                                        Monthly Cap ($)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="5"
                                        value={costLimitAlert}
                                        onChange={(e) => patchDraft({ costLimitAlert: e.target.value })}
                                        className="w-full bg-[#121212] border border-white/10 rounded-lg px-2.5 py-2 text-[12px] font-mono text-white"
                                    />
                                </div>
                            </div>

                            <div className="p-3.5 rounded-lg bg-[#121212] border border-white/10 text-[11px] text-neutral-300 font-sans space-y-1">
                                <p className="font-bold text-white">Two-Tier Cache Headers (Active by Default on temp=0)</p>
                                <p className="text-neutral-400">
                                    Tier 1 (Redis SHA-256) &amp; Tier 2 (PostgreSQL <code className="text-[#CBFF2E]">pgvector</code> MiniLM-L6-v2) run automatically. Override per request via <code className="text-[#CBFF2E]">x-flowops-cache: false</code>, <code className="text-[#CBFF2E]">x-flowops-cache-force-refresh: true</code>, or <code className="text-[#CBFF2E]">x-flowops-cache-threshold: 0.88</code>.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Live Synced Config / Header Preview */}
                <div className="xl:col-span-6 flex flex-col bg-[#080808]">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-2 bg-[#101010]">
                        <div className="flex items-center gap-1">
                            {[
                                { id: 'json', label: 'Config JSON' },
                                { id: 'node', label: 'Node.js Headers' },
                                { id: 'curl', label: 'cURL Overrides' },
                            ].map((fmt) => (
                                <button
                                    key={fmt.id}
                                    type="button"
                                    onClick={() => setPreviewFormat(fmt.id)}
                                    className={`px-3 py-1 rounded text-[11px] font-bold font-sans cursor-pointer transition-colors ${
                                        previewFormat === fmt.id
                                            ? 'bg-white text-black'
                                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {fmt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={handleCopyPreview}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-sans font-bold text-white cursor-pointer"
                        >
                            <Icon name={copiedSnippet ? 'check' : 'content_copy'} className="w-3.5 h-3.5" />
                            {copiedSnippet ? 'Copied' : 'Copy'}
                        </button>
                    </div>

                    <div className="p-5 flex-1 overflow-x-auto bg-[#060606]">
                        <pre className="text-[12px] leading-relaxed font-mono text-neutral-200 whitespace-pre">
                            {syncedPreviewText}
                        </pre>
                    </div>
                </div>
            </div>
        </Card>
    );
}
