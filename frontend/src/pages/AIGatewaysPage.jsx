import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { GatewayPlayground, RoutingConfigStudio } from '../ui';
import { useOrgStore } from '../state/orgStore';
import { toast } from 'react-hot-toast';
import { apisService } from '../services/api';

export default function AIGatewaysPage() {
    const { activeOrgId, organisations } = useOrgStore();
    const activeOrg = organisations.find(o => o.id === activeOrgId) || organisations[0];
    const queryClient = useQueryClient();

    // ─── AI Gateway Route Configurations (Live Backend Data) ───
    const { data: apisResponse, isLoading: apisLoading } = useQuery({
        queryKey: ['apis'],
        queryFn: () => apisService.listApis()
    });
    const apisList = apisResponse?.data?.apis || [];

    // Create Route Mutation States
    const [isCreateRouteOpen, setIsCreateRouteOpen] = useState(false);
    const [newRouteName, setNewRouteName] = useState('');
    const [newRouteSlug, setNewRouteSlug] = useState('');
    const [newRouteUrl, setNewRouteUrl] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [selectedRouteId, setSelectedRouteId] = useState(null);

    const createRouteMutation = useMutation({
        mutationFn: (data) => apisService.createApi(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apis'] });
            toast.success('AI Gateway Route registered successfully!');
            setIsCreateRouteOpen(false);
            setNewRouteName('');
            setNewRouteSlug('');
            setNewRouteUrl('');
        },
        onError: (err) => toast.error(err.message || 'Failed to register route')
    });

    const handleCreateRoute = (e) => {
        e.preventDefault();
        if (!newRouteName.trim()) return toast.error('Please enter a route configuration name.');
        if (!newRouteSlug.trim()) return toast.error('Please enter a unique URL gateway slug.');
        if (!newRouteUrl.trim()) return toast.error('Please enter the target base URL.');

        createRouteMutation.mutate({
            name: newRouteName,
            slug: newRouteSlug.toLowerCase().trim(),
            baseUrl: newRouteUrl.trim()
        });
    };

    // Update Route Mutation (Smart Classifier & Strategy)
    const updateRouteMutation = useMutation({
        mutationFn: ({ id, data }) => apisService.updateApi(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apis'] });
            toast.success('Gateway routing configuration updated!');
        },
        onError: (err) => toast.error(err.message || 'Failed to update route')
    });

    // Delete Route Mutation
    const deleteRouteMutation = useMutation({
        mutationFn: (id) => apisService.deleteApi(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apis'] });
            toast.success('AI Gateway Route successfully deleted!');
            setDeletingId(null);
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to delete route');
            setDeletingId(null);
        }
    });

    return (
        <div className="max-w-[1200px] mx-auto space-y-6">
            {/* Page Header */}
            <div className="mb-8 font-sans">
                <div className="flex items-center gap-3 mb-1">
                    <Icon name="alt_route" className="w-7 h-7 text-white/40" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        AI Gateways
                    </h1>
                </div>
                <p className="text-[15px] text-neutral-450">
                    Register upstream AI provider routes, manage fallback rules, and configure LLM load balancers for <span className="text-white font-semibold">{activeOrg?.name}</span>.
                </p>
            </div>

            {/* Routes Section */}
            <Card className="p-6">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-[15px] font-bold text-white font-sans">AI Gateway Routes</h2>
                        <p className="text-[12.5px] text-neutral-400 font-sans mt-0.5 leading-normal">
                            Register upstream target model endpoints and route contexts to bind client API keys.
                        </p>
                    </div>
                    <button 
                        onClick={() => setIsCreateRouteOpen(true)}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.35)] px-4 py-2 rounded font-sans font-bold text-[12px] transition-all hover:scale-[1.02] cursor-pointer whitespace-nowrap"
                    >
                        <Icon name="add" className="w-3.5 h-3.5"  />
                        Register Route
                    </button>
                </div>

                <div className="space-y-4">
                    {apisLoading ? (
                        <div className="py-12 text-center text-neutral-500 font-sans">
                            <Icon name="autorenew" className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CBFF2E]"  />
                            Loading configured AI routes...
                        </div>
                    ) : apisList.length === 0 ? (
                        <div className="py-10 px-6 text-center font-sans border border-dashed border-[rgba(153,27,27,0.35)] rounded-2xl bg-gradient-to-b from-red-950/20 via-[#0a0608]/60 to-[#060507]/90 space-y-5">
                            <div className="w-12 h-12 mx-auto rounded-xl bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
                                <Icon name="alt_route" className="w-6 h-6 text-red-400" />
                            </div>
                            <div className="max-w-md mx-auto space-y-1.5">
                                <h3 className="text-[16px] font-bold text-white tracking-tight">No Active AI Routing Contexts</h3>
                                <p className="text-[12.5px] text-neutral-400 leading-relaxed">
                                    Configure an upstream AI route to connect your client apps to Gemini, OpenAI, Anthropic, or Groq with automatic failover, load balancing, and smart telemetry.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                                {[
                                    { label: 'Gemini Production Gateway', slug: 'gemini-gateway', url: 'https://generativelanguage.googleapis.com' },
                                    { label: 'OpenAI GPT-4o Gateway', slug: 'openai-gpt4o', url: 'https://api.openai.com' },
                                    { label: 'Groq Llama 3 Gateway', slug: 'groq-llama3', url: 'https://api.groq.com/openai/v1' },
                                ].map((preset) => (
                                    <button
                                        key={preset.slug}
                                        type="button"
                                        onClick={() => {
                                            setNewRouteName(preset.label);
                                            setNewRouteSlug(preset.slug);
                                            setNewRouteUrl(preset.url);
                                            setIsCreateRouteOpen(true);
                                        }}
                                        className="px-3 py-1.5 rounded-lg border border-[rgba(153,27,27,0.3)] bg-red-950/20 hover:bg-red-950/40 hover:border-red-500/40 text-[12px] font-sans font-semibold text-neutral-200 transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Icon name="bolt" className="w-3.5 h-3.5 text-[#CBFF2E]" />
                                        <span>Quickstart: {preset.label.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                            <div>
                                <button
                                    onClick={() => setIsCreateRouteOpen(true)}
                                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.35)] px-4 py-2 rounded-lg font-sans font-bold text-[12px] transition-all hover:scale-[1.02] cursor-pointer"
                                >
                                    <Icon name="add" className="w-3.5 h-3.5" />
                                    Register Custom Route
                                </button>
                            </div>
                        </div>
                    ) : (
                        apisList.map((api) => (
                            <div key={api.id} className="p-4 border border-[var(--theme-border)] rounded-xl bg-[var(--theme-bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-red-500/40 hover:shadow-[0_0_18px_rgba(239,68,68,0.12)] transition-all">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[#CBFF2E] shadow-[0_0_8px_#CBFF2E]"></span>
                                        <h3 className="text-[14px] font-bold text-white font-sans truncate">{api.name}</h3>
                                    </div>
                                    <p className="text-[12px] font-mono text-neutral-400 truncate">
                                        Drop-in OpenAI Base URL: <span className="text-[#CBFF2E]">/v1</span> <span className="text-neutral-600">·</span> <span className="text-neutral-500">Legacy: /gateway/v1/chat/completions</span>
                                    </p>
                                    <p className="text-[11px] font-sans text-neutral-400 truncate">
                                        Target Upstream: {api.baseUrl}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={Boolean(api.smartRoutingEnabled)}
                                        aria-label={`Toggle Smart Classifier for ${api.name}`}
                                        onClick={() =>
                                            updateRouteMutation.mutate({
                                                id: api.id,
                                                data: { smartRoutingEnabled: !api.smartRoutingEnabled }
                                            })
                                        }
                                        className={`flex items-center gap-2.5 text-[12px] font-sans px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                            api.smartRoutingEnabled
                                                ? 'bg-[#CBFF2E]/10 border-[#CBFF2E]/35 text-white hover:border-[#CBFF2E]/60'
                                                : 'bg-white/5 border-white/10 text-neutral-300 hover:border-white/20'
                                        }`}
                                    >
                                        <span className="font-semibold">Smart Classifier</span>
                                        <span
                                            className={`inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${
                                                api.smartRoutingEnabled
                                                    ? 'bg-[#CBFF2E] shadow-[0_0_10px_rgba(203,255,46,0.45)]'
                                                    : 'bg-neutral-700'
                                            }`}
                                        >
                                            <span
                                                className={`w-4 h-4 rounded-full bg-neutral-950 transition-transform duration-200 ${
                                                    api.smartRoutingEnabled ? 'translate-x-4' : 'translate-x-0'
                                                }`}
                                            />
                                        </span>
                                        <span
                                            className={`text-[10px] font-mono font-bold uppercase w-6 text-left ${
                                                api.smartRoutingEnabled ? 'text-[#CBFF2E]' : 'text-neutral-500'
                                            }`}
                                        >
                                            {api.smartRoutingEnabled ? 'ON' : 'OFF'}
                                        </span>
                                    </button>
                                    <select
                                        value={api.routingStrategy || 'cost-optimized'}
                                        onChange={(e) =>
                                            updateRouteMutation.mutate({
                                                id: api.id,
                                                data: { routingStrategy: e.target.value }
                                            })
                                        }
                                        className="bg-[#111111] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] font-sans text-neutral-200 focus:outline-none focus:border-[#CBFF2E]/60 cursor-pointer"
                                        aria-label="Routing Strategy"
                                    >
                                        <option value="cost-optimized">Cost-Optimized</option>
                                        <option value="speed-optimized">Speed-Optimized</option>
                                        <option value="quality-optimized">Quality-Optimized</option>
                                    </select>
                                    <div className="hidden 2xl:flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
                                        <span className="px-2 py-1 rounded bg-white/[0.03] border border-white/5" title="Fallback order">
                                            FB: {api.fallbackProviders || 'gemini,anthropic'}
                                        </span>
                                        <span className="px-2 py-1 rounded bg-white/[0.03] border border-white/5" title="Retry attempts">
                                            Retries: {api.retryCount ?? 2}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRouteId(api.id)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-sans font-bold transition-colors cursor-pointer ${
                                            (selectedRouteId || apisList[0]?.id) === api.id
                                                ? 'border-[#CBFF2E]/50 bg-[#CBFF2E]/15 text-[#CBFF2E]'
                                                : 'border-white/10 bg-[#141414] text-neutral-300 hover:border-white/25 hover:text-white'
                                        }`}
                                    >
                                        <Icon name="tune" className="w-3.5 h-3.5" />
                                        {(selectedRouteId || apisList[0]?.id) === api.id ? 'Selected' : 'Configure & Test'}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (window.confirm(`Are you sure you want to delete route "${api.name}"? All associated API keys will also be revoked.`)) {
                                                setDeletingId(api.id);
                                                deleteRouteMutation.mutate(api.id);
                                            }
                                        }}
                                        disabled={deletingId === api.id}
                                        className="inline-flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-red-400 transition-colors font-bold font-sans cursor-pointer disabled:opacity-50"
                                    >
                                        {deletingId === api.id ? <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin"  /> : <Icon name="delete" className="w-3.5 h-3.5"  />}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {apisList.length > 0 && (
                <div className="space-y-6">
                    <RoutingConfigStudio
                        route={apisList.find((r) => r.id === selectedRouteId) || apisList[0]}
                        isSaving={updateRouteMutation.isPending}
                        onSaveConfig={(id, data) => updateRouteMutation.mutateAsync({ id, data })}
                    />
                    <GatewayPlayground
                        apisList={apisList}
                        selectedRouteId={selectedRouteId || apisList[0]?.id}
                        onSelectRoute={(id) => setSelectedRouteId(id)}
                    />
                </div>
            )}

            {/* Create Route Modal */}
            {isCreateRouteOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#08060a]/95 border border-[rgba(153,27,27,0.3)] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_25px_rgba(239,68,68,0.12)] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col backdrop-blur-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                                    <Icon name="alt_route" className="w-4 h-4 text-red-400"  />
                                </div>
                                <h3 className="font-bold text-[16px] text-white font-sans">Register Upstream Route</h3>
                            </div>
                            <button 
                                onClick={() => setIsCreateRouteOpen(false)}
                                className="text-neutral-400 hover:text-white transition-colors rounded p-1 hover:bg-white/5 cursor-pointer"
                            >
                                <Icon name="close" className="w-5 h-5"  />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRoute} className="p-6 space-y-4">
                            <div>
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-sans block mb-2">
                                    1-Click Provider Templates
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: 'Gemini', name: 'Gemini Production Gateway', slug: 'gemini-gateway', url: 'https://generativelanguage.googleapis.com' },
                                        { label: 'OpenAI', name: 'OpenAI GPT-4o Gateway', slug: 'openai-gpt4o', url: 'https://api.openai.com' },
                                        { label: 'Anthropic', name: 'Anthropic Claude Gateway', slug: 'anthropic-claude', url: 'https://api.anthropic.com' },
                                        { label: 'Groq / OSS', name: 'Groq Llama3 Gateway', slug: 'groq-llama3', url: 'https://api.groq.com/openai/v1' },
                                    ].map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => {
                                                setNewRouteName(preset.name);
                                                setNewRouteSlug(preset.slug);
                                                setNewRouteUrl(preset.url);
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 hover:border-[#CBFF2E]/40 text-[11px] font-sans font-bold text-neutral-200 transition-colors cursor-pointer"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Route Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. OpenAI GPT-4o Gateway"
                                    value={newRouteName}
                                    onChange={(e) => setNewRouteName(e.target.value)}
                                    className="mt-1 w-full bg-[#060507] border border-[rgba(153,27,27,0.3)] focus:border-red-500/50 rounded-lg px-3 py-2 text-[13px] font-sans text-white focus:outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">URL Gateway Slug</label>
                                <div className="flex items-center mt-1">
                                    <span className="px-3 py-2 bg-[#060507] border border-r-0 border-[rgba(153,27,27,0.3)] rounded-l-lg text-[13px] font-mono text-neutral-400 select-none">/gateway/</span>
                                    <input
                                        type="text"
                                        placeholder="openai-gpt4o"
                                        value={newRouteSlug}
                                        onChange={(e) => setNewRouteSlug(e.target.value)}
                                        className="flex-1 bg-[#060507] border border-[rgba(153,27,27,0.3)] focus:border-red-500/50 rounded-r-lg px-3 py-2 text-[13px] font-mono text-white focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Target Base URL</label>
                                <input
                                    type="text"
                                    placeholder="https://api.openai.com"
                                    value={newRouteUrl}
                                    onChange={(e) => setNewRouteUrl(e.target.value)}
                                    className="mt-1 w-full bg-[#060507] border border-[rgba(153,27,27,0.3)] focus:border-red-500/50 rounded-lg px-3 py-2 text-[13px] font-mono text-white focus:outline-none transition-colors"
                                />
                            </div>
                            <div className="pt-4 border-t border-[rgba(153,27,27,0.2)] flex items-center justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsCreateRouteOpen(false)}
                                    className="px-4 py-2 border border-[rgba(153,27,27,0.3)] rounded-lg bg-red-950/20 hover:bg-red-950/40 font-sans font-bold text-[12px] text-white transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={createRouteMutation.isPending}
                                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.35)] rounded-lg font-sans font-bold text-[12px] transition-all hover:scale-[1.02] flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {createRouteMutation.isPending && <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin"  />}
                                    Register Route
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
