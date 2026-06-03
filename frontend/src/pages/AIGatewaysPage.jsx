import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
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
            <Card className="p-6 border border-white/5 bg-white/2">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-[15px] font-bold text-white font-sans">AI Gateway Routes</h2>
                        <p className="text-[12.5px] text-neutral-400 font-sans mt-0.5 leading-normal">
                            Register upstream target model endpoints and route contexts to bind client API keys.
                        </p>
                    </div>
                    <button 
                        onClick={() => setIsCreateRouteOpen(true)}
                        className="flex items-center gap-1.5 bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded font-sans font-bold text-[12px] transition-all hover:scale-[1.02] shadow-sm cursor-pointer whitespace-nowrap"
                    >
                        <Icon name="add" className="w-3.5 h-3.5"  />
                        Register Route
                    </button>
                </div>

                <div className="space-y-4">
                    {apisLoading ? (
                        <div className="py-12 text-center text-neutral-500 font-sans">
                            <Icon name="autorenew" className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400"  />
                            Loading configured AI routes...
                        </div>
                    ) : apisList.length === 0 ? (
                        <div className="py-12 text-center text-neutral-400 font-sans border border-dashed border-white/5 rounded-xl bg-black/10">
                            No active AI routing contexts found. Click register above to set up your first route.
                        </div>
                    ) : (
                        apisList.map((api) => (
                            <div key={api.id} className="p-4 border border-white/5 rounded-xl bg-[#0e0e0e]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/10 transition-colors">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
                                        <h3 className="text-[14px] font-bold text-white font-sans truncate">{api.name}</h3>
                                    </div>
                                    <p className="text-[12px] font-mono text-neutral-400 truncate">
                                        Gateway Endpoint: <span className="text-cyan-400">/gateway/v1/chat/completions</span>
                                    </p>
                                    <p className="text-[11px] font-sans text-neutral-550 truncate">
                                        Target Upstream: {api.baseUrl}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
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

            {/* Create Route Modal */}
            {isCreateRouteOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111111] border border-white/5 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black">
                                    <Icon name="alt_route" className="w-4 h-4 text-black"  />
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
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Route Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. OpenAI GPT-4o Gateway"
                                    value={newRouteName}
                                    onChange={(e) => setNewRouteName(e.target.value)}
                                    className="mt-1 w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans text-white focus:outline-none focus:border-white/20 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">URL Gateway Slug</label>
                                <div className="flex items-center mt-1">
                                    <span className="px-3 py-2 bg-[#111111]/60 border border-r-0 border-white/5 rounded-l text-[13px] font-mono text-neutral-400 select-none">/gateway/</span>
                                    <input
                                        type="text"
                                        placeholder="openai-gpt4o"
                                        value={newRouteSlug}
                                        onChange={(e) => setNewRouteSlug(e.target.value)}
                                        className="flex-1 bg-[#111111]/45 border border-white/5 rounded-r px-3 py-2 text-[13px] font-mono text-white focus:outline-none focus:border-white/20 transition-colors"
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
                                    className="mt-1 w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-mono text-white focus:outline-none focus:border-white/20 transition-colors"
                                />
                            </div>
                            <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsCreateRouteOpen(false)}
                                    className="px-4 py-2 border border-white/5 rounded bg-white/5 hover:bg-white/10 font-sans font-bold text-[12px] text-white transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={createRouteMutation.isPending}
                                    className="px-5 py-2 bg-white text-black hover:bg-neutral-200 rounded font-sans font-bold text-[12px] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
