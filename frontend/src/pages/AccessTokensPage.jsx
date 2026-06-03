import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { apiKeysService, apisService } from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../state/authStore';

export default function AccessTokensPage() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [selectedApiId, setSelectedApiId] = useState('');
    const [generatedKeyDetails, setGeneratedKeyDetails] = useState(null); // stores { rawKey, key }
    const [copiedKeyId, setCopiedKeyId] = useState(null);
    const [revokingId, setRevokingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc'

    const displayName = user?.name || 'Black Panther';
    const displayInitial = displayName.charAt(0).toUpperCase();

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        }) + ', ' + d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatKey = (prefix) => {
        if (!prefix) return '';
        if (prefix.length >= 8) {
            return `${prefix.substring(0, 3)}*****${prefix.substring(prefix.length - 3)}`;
        }
        return `${prefix}*****`;
    };

    // 1. Fetch User's APIs (so they can assign a key to an API configuration)
    const { data: apisResponse, isLoading: apisLoading } = useQuery({
        queryKey: ['apis'],
        queryFn: () => apisService.listApis()
    });
    const apisList = apisResponse?.data?.apis || [];

    // 2. Fetch User's Active API Keys
    const { data: keysResponse, isLoading: keysLoading } = useQuery({
        queryKey: ['apiKeys'],
        queryFn: () => apiKeysService.listKeys()
    });
    const keysList = keysResponse?.data?.keys || [];
    const filteredKeys = keysList
        .filter((t) => t.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

    // 3. Create Key Mutation
    const createMutation = useMutation({
        mutationFn: (payload) => apiKeysService.createKey(payload),
        onSuccess: (res) => {
            setGeneratedKeyDetails(res.data);
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
            toast.success('Access Token generated successfully!');
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to generate token.');
        }
    });

    // 4. Revoke Key Mutation
    const revokeMutation = useMutation({
        mutationFn: (id) => apiKeysService.revokeKey(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
            toast.success('Token successfully revoked!');
            setRevokingId(null);
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to revoke token.');
            setRevokingId(null);
        }
    });

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedKeyId(id);
        toast.success('Token copied to clipboard!');
        setTimeout(() => setCopiedKeyId(null), 2000);
    };

    const handleCreateKey = (e) => {
        e.preventDefault();
        if (!selectedApiId) {
            toast.error('Please select an API config context.');
            return;
        }
        if (!newKeyName.trim()) {
            toast.error('Please name your access token.');
            return;
        }
        createMutation.mutate({
            apiId: selectedApiId,
            name: newKeyName
        });
    };

    const handleCloseCreateModal = () => {
        setIsCreateOpen(false);
        setNewKeyName('');
        setSelectedApiId('');
        setGeneratedKeyDetails(null);
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div className="font-sans mb-2">
                    <div className="flex items-center gap-3 mb-1">
                        <Icon name="key" className="w-7 h-7 text-white/40" />
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            API Keys
                        </h1>
                        {(keysLoading || apisLoading) && <Icon name="autorenew" className="w-4 h-4 animate-spin text-neutral-400"  />}
                    </div>
                    <p className="text-[15px] text-neutral-450">Manage secure, hashed API keys for programmatic gateway routing integration.</p>
                </div>
                <button 
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 bg-white hover:bg-neutral-200 text-black px-5 py-2.5 rounded font-sans font-bold text-[13px] transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
                >
                    <Icon name="key" className="w-4 h-4"  />
                    Create New
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative w-full">
                <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"  />
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..." 
                    className="w-full pl-9 pr-4 py-2.5 bg-[#111111]/40 border border-white/5 rounded text-[13px] font-sans text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
                />
            </div>

            <Card className="flex flex-col p-0 overflow-hidden shadow-sm border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px] text-left whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="tag" className="w-3.5 h-3.5 text-neutral-500"  />
                                        NAME
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="key" className="w-3.5 h-3.5 text-neutral-500"  />
                                        KEY
                                    </div>
                                </th>
                                <th 
                                    className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group select-none"
                                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="calendar_today" className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-400"  />
                                        CREATED AT
                                        <Icon 
                                            name={sortOrder === 'desc' ? 'arrow_downward' : 'arrow_upward'} 
                                            className="w-3 h-3 text-neutral-500 group-hover:text-white ml-0.5"  
                                        />
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="person" className="w-3.5 h-3.5 text-neutral-500"  />
                                        CREATED BY
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="person" className="w-3.5 h-3.5 text-neutral-500"  />
                                        OWNED BY
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="schedule" className="w-3.5 h-3.5 text-neutral-500"  />
                                        LAST UPDATE
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="shield" className="w-3.5 h-3.5 text-neutral-500"  />
                                        STATUS
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider">
                                    <div className="flex items-center gap-1.5">
                                        <Icon name="layers" className="w-3.5 h-3.5 text-neutral-500"  />
                                        TYPE
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-sans text-[11px] font-bold text-neutral-450 uppercase tracking-wider text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {keysLoading ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-neutral-500 font-sans">
                                        <Icon name="autorenew" className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400"  />
                                        Loading tokens database...
                                    </td>
                                </tr>
                            ) : filteredKeys.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-neutral-500 font-sans">
                                        {searchQuery ? 'No programmatic keys matched your search.' : 'No active programmatic keys found. Click the button above to generate your first access token.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredKeys.map((t) => (
                                    <tr key={t.id} className="hover:bg-white/2 transition-colors">
                                        <td className="px-6 py-5 font-sans font-bold text-white">{t.name}</td>
                                        <td className="px-6 py-5 font-mono text-neutral-350">
                                            <div className="inline-flex items-center gap-2 bg-white/5 px-2.5 py-1 rounded border border-white/5">
                                                <span>{formatKey(t.keyPrefix)}</span>
                                                <button 
                                                    onClick={() => handleCopy(t.keyPrefix, t.id)}
                                                    className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
                                                    title="Copy key prefix"
                                                >
                                                    {copiedKeyId === t.id ? <Icon name="check" className="w-3.5 h-3.5 text-emerald-500"  /> : <Icon name="content_copy" className="w-3.5 h-3.5"  />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-sans text-neutral-400">{formatDate(t.createdAt)}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold font-mono">
                                                    {displayInitial}
                                                </span>
                                                <span className="text-white font-sans">{displayName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold font-mono">
                                                    {displayInitial}
                                                </span>
                                                <span className="text-white font-sans">{displayName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 font-sans text-neutral-400">{formatDate(t.createdAt)}</td>
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${!t.revoked ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/10' : 'bg-red-950/30 text-red-400 border-red-500/10'}`}>
                                                {!t.revoked ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span> : <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
                                                {!t.revoked ? 'Active' : 'Revoked'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 font-sans text-amber-500/90 font-medium">User</td>
                                        <td className="px-6 py-5 text-right">
                                            {!t.revoked && (
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm(`Are you absolutely sure you want to revoke "${t.name}"? Programmatic apps using this key will immediately start failing.`)) {
                                                            setRevokingId(t.id);
                                                            revokeMutation.mutate(t.id);
                                                        }
                                                    }}
                                                    disabled={revokingId === t.id}
                                                    className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-red-400 transition-colors font-bold font-sans cursor-pointer disabled:opacity-50"
                                                >
                                                    {revokingId === t.id ? <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin"  /> : <Icon name="delete" className="w-3.5 h-3.5"  />}
                                                    Revoke
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Access Token Dialog Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111111] border border-white/5 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black">
                                    <Icon name="auto_awesome" className="w-4 h-4 text-black"  />
                                </div>
                                <h3 className="font-bold text-[16px] text-white font-sans">Generate Gateway Token</h3>
                            </div>
                            <button 
                                onClick={handleCloseCreateModal}
                                className="text-neutral-400 hover:text-white transition-colors rounded p-1 hover:bg-white/5 cursor-pointer animate-in duration-100"
                            >
                                <Icon name="close" className="w-5 h-5"  />
                            </button>
                        </div>

                        {!generatedKeyDetails ? (
                            <form onSubmit={handleCreateKey} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Select Target API Config Context</label>
                                    <select 
                                        value={selectedApiId}
                                        onChange={(e) => setSelectedApiId(e.target.value)}
                                        className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans font-medium text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 cursor-pointer"
                                    >
                                        <option value="" className="bg-[#111111]">-- Choose Configuration Context --</option>
                                        {apisList.map((api) => (
                                            <option key={api.id} value={api.id} className="bg-[#111111]">{api.name} (/gateway/v1/chat/completions)</option>
                                        ))}
                                    </select>
                                    {apisList.length === 0 && !apisLoading && (
                                        <p className="text-[11px] text-amber-500 font-sans font-semibold flex items-center gap-1 mt-1">
                                            <Icon name="warning" className="w-3.5 h-3.5"  />
                                            Please configure a route context on the Managed APIs page first!
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Access Token Name</label>
                                    <input 
                                        type="text"
                                        placeholder="e.g. Production Core WebApp"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans font-medium text-white placeholder-neutral-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20"
                                    />
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                                    <button 
                                        type="button"
                                        onClick={handleCloseCreateModal}
                                        className="px-4 py-2 border border-white/5 rounded bg-white/5 hover:bg-white/10 font-sans font-bold text-[12px] text-white transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={createMutation.isPending || apisList.length === 0}
                                        className="px-5 py-2 bg-white text-black hover:bg-neutral-200 rounded font-sans font-bold text-[12px] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                    >
                                        {createMutation.isPending && <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin"  />}
                                        Generate Token
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="p-6 space-y-5">
                                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-4 flex gap-3 text-amber-400">
                                    <Icon name="warning" className="w-5 h-5 text-amber-550 shrink-0 mt-0.5"  />
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-[12px] font-sans">Secure Key Storage Warning</h4>
                                        <p className="text-[11px] font-sans leading-relaxed text-amber-300">
                                            For security compliance, we do not store this private token key in plaintext. **You will not be able to retrieve or view it again after closing this window.** Please copy it immediately to a password manager or your local environment secrets.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Your Raw Gateway Token</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black rounded border border-white/5 px-4 py-3 flex items-center justify-between text-white font-mono text-[12px]">
                                            <span className="truncate pr-4">{generatedKeyDetails.rawKey}</span>
                                            <button 
                                                onClick={() => handleCopy(generatedKeyDetails.rawKey, 'modal')}
                                                className="text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
                                            >
                                                {copiedKeyId === 'modal' ? <Icon name="check" className="w-4 h-4 text-emerald-500"  /> : <Icon name="content_copy" className="w-4 h-4"  />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5 border-t border-white/5 pt-4 font-sans text-[11px] text-neutral-400">
                                    <div className="flex items-center gap-1.5 font-semibold text-neutral-350 mb-1">
                                        <Icon name="terminal" className="w-3.5 h-3.5 text-neutral-500"  />
                                        Example cURL program usage:
                                    </div>
                                    <pre className="bg-black border border-white/5 rounded p-3 overflow-x-auto font-mono text-[10px] text-neutral-350 leading-relaxed">
{`curl -X POST http://localhost:5000/gateway/v1/chat/completions \\
  -H "x-flowops-api-key: ${generatedKeyDetails.rawKey}" \\
  -H "x-flowops-optimize: true" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello FlowOps HQ!"}]
  }'`}
                                    </pre>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex justify-end">
                                    <button 
                                        type="button"
                                        onClick={handleCloseCreateModal}
                                        className="px-5 py-2.5 bg-white text-black hover:bg-neutral-200 rounded font-sans font-bold text-[12px] transition-colors shadow-sm cursor-pointer"
                                    >
                                        I Have Safely Stored This Key
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
