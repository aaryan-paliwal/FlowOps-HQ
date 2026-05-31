import { useState } from 'react';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { useAuthStore } from '../state/authStore';
import { useOrgStore } from '../state/orgStore';
import { toast } from 'react-hot-toast';

export default function ManagedApisPage() {
    const { user, token, setAuth } = useAuthStore();
    const { activeOrgId, organisations, updateOrganisation } = useOrgStore();
    const activeOrg = organisations.find(o => o.id === activeOrgId) || organisations[0];
    const [activeTab, setActiveTab] = useState('general'); // 'general' or 'guardrails'

    // Scope the storage key strictly to this active workspace to prevent data bleeding
    const onboardingKey = `flowops_workspace_data_${user?.id || 'default'}_${activeOrg.id}`;
    const savedOnboarding = (() => {
        try {
            const stored = localStorage.getItem(onboardingKey);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    })();

    // Initial states loaded from orgStore (source of truth) or localstorage
    const [workspaceName, setWorkspaceName] = useState(activeOrg?.name || 'My Workspace');
    const [workspaceLogo, setWorkspaceLogo] = useState(savedOnboarding?.logo || '🦄');
    const [description, setDescription] = useState(savedOnboarding?.description || '');
    const [metadata, setMetadata] = useState(savedOnboarding?.metadata || '{\n  "project": "sample project"\n}');
    const [inputGuardrail, setInputGuardrail] = useState(savedOnboarding?.inputGuardrail || '');
    const [outputGuardrail, setOutputGuardrail] = useState(savedOnboarding?.outputGuardrail || '');

    const workspaceSlug = savedOnboarding?.slug || `ws-shared-${user?.id?.substring(0, 6) || '4ba976'}`;

    const displayName = user?.name || 'Black Panther';
    const displayInitial = displayName.charAt(0).toUpperCase();

    const handleUpdate = (e) => {
        e?.preventDefault();
        try {
            // Validate metadata if it's JSON
            if (metadata.trim()) {
                JSON.parse(metadata);
            }
        } catch {
            return toast.error("Invalid Metadata JSON syntax. Please verify.");
        }

        const onboardingData = {
            ...savedOnboarding,
            orgName: workspaceName,
            logo: workspaceLogo,
            description,
            metadata,
            inputGuardrail,
            outputGuardrail,
            slug: workspaceSlug
        };
        localStorage.setItem(onboardingKey, JSON.stringify(onboardingData));

        // Sync workspace name to global state
        updateOrganisation(activeOrgId, { name: workspaceName });

        // Also sync to auth store for consistency
        if (user) {
            setAuth(token, { ...user, company: workspaceName });
        }
        toast.success('Workspace settings updated successfully!');
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            {/* Page Header */}
            <div className="mb-8 font-sans">
                <div className="flex items-center gap-3 mb-1">
                    <Icon name="memory" className="w-7 h-7 text-white/40" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Workspace Control: {activeOrg?.name}
                    </h1>
                </div>
                <p className="text-[15px] text-neutral-450">
                    Manage your workspace identity, guardrails, and team policies.
                </p>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Tabs Column */}
                <div className="lg:col-span-3 xl:col-span-2 flex flex-col space-y-1.5 font-sans">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-[13px] font-bold font-sans transition-all text-left cursor-pointer border ${
                            activeTab === 'general'
                                ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-400'
                                : 'border-transparent text-neutral-400 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Icon name="tune" className="w-4 h-4 shrink-0"  />
                            <span>General</span>
                        </div>
                        {activeTab === 'general' && <Icon name="chevron_right" className="w-3.5 h-3.5 text-cyan-400"  />}
                    </button>
                    <button
                        onClick={() => setActiveTab('guardrails')}
                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-[13px] font-bold font-sans transition-all text-left cursor-pointer border ${
                            activeTab === 'guardrails'
                                ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-400'
                                : 'border-transparent text-neutral-400 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Icon name="shield" className="w-4 h-4 shrink-0"  />
                            <span>Workspace Guardrails</span>
                        </div>
                        {activeTab === 'guardrails' && <Icon name="chevron_right" className="w-3.5 h-3.5 text-cyan-400"  />}
                    </button>
                </div>

                {/* Center Settings Column */}
                <div className="lg:col-span-6 xl:col-span-7 space-y-6">
                    {activeTab === 'general' && (
                        <Card className="p-6 space-y-6 border border-white/5 bg-white/2">
                            <div>
                                <h2 className="text-[15px] font-bold text-white font-sans">General Settings</h2>
                                <p className="text-[12.5px] text-neutral-400 font-sans mt-0.5 leading-normal">
                                    Manage your workspace settings and allow people from allowed domains to join automatically.
                                </p>
                            </div>

                            {/* Logo Selector */}
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Workspace Logo</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-[#111111]/80 border border-white/10 flex items-center justify-center text-2xl shadow-inner select-none">
                                        {workspaceLogo}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {['🦄', '💪', '🍩', '🌳', '🌴', '🐬', '🌍'].map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setWorkspaceLogo(emoji)}
                                                className={`w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all hover:bg-white/10 cursor-pointer ${
                                                    workspaceLogo === emoji 
                                                        ? 'bg-white/10 border border-white/20' 
                                                        : 'bg-transparent border border-transparent'
                                                }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const custom = prompt("Enter any character or emoji for your logo:");
                                                if (custom) setWorkspaceLogo(custom.substring(0, 2));
                                            }}
                                            className="w-8 h-8 rounded-md bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer font-bold text-sm"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Workspace Name */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Workspace Name</label>
                                <input 
                                    type="text"
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    placeholder="Workspace Name"
                                    className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans font-medium text-white focus:outline-none focus:border-white/20 transition-colors"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Description</label>
                                <input 
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Enter Workspace Description"
                                    className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans font-medium text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-colors"
                                />
                            </div>

                            {/* Metadata Editor */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Metadata</label>
                                <textarea
                                    value={metadata}
                                    onChange={(e) => setMetadata(e.target.value)}
                                    rows={5}
                                    className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-colors leading-relaxed"
                                />
                            </div>
                        </Card>
                    )}

                    {activeTab === 'guardrails' && (
                        <Card className="p-6 space-y-6 border border-white/5 bg-white/2">
                            <div>
                                <h2 className="text-[15px] font-bold text-white font-sans">Workspace Guardrails</h2>
                                <p className="text-[12.5px] text-neutral-400 font-sans mt-0.5 leading-normal">
                                    Enforce guardrails at the workspace level. Ensure all AI communications within your workspace comply with security, governance, and compliance standards.
                                </p>
                            </div>

                            {/* Input Guardrail Selection */}
                            <div className="p-4 border border-white/5 rounded-lg bg-white/2 space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-[13px] font-bold text-white font-sans">Input Guardrail</h3>
                                    <p className="text-[11.5px] text-neutral-400 font-sans leading-relaxed">
                                        Pre-scan prompts to block sensitive data, enforce policies, and protect your systems. Automatically redact PII, deny risky requests, or reroute based on your security rules.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Select Input Guardrail</label>
                                    <div className="relative">
                                        <select 
                                            value={inputGuardrail}
                                            onChange={(e) => setInputGuardrail(e.target.value)}
                                            className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans font-medium text-white appearance-none pr-10 focus:outline-none focus:border-white/20 cursor-pointer"
                                        >
                                            <option value="" className="bg-[#111111]">Select</option>
                                            <option value="pii-redaction" className="bg-[#111111]">Redact PII & Sensitive Info</option>
                                            <option value="toxic-jailbreak" className="bg-[#111111]">Block Toxic Prompts & Jailbreaks</option>
                                            <option value="compliance" className="bg-[#111111]">Enforce Compliance Check</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                                            <Icon name="unfold_more" className="w-3.5 h-3.5"  />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Output Guardrail Selection */}
                            <div className="p-4 border border-white/5 rounded-lg bg-white/2 space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-[13px] font-bold text-white font-sans">Output Guardrail</h3>
                                    <p className="text-[11.5px] text-neutral-400 font-sans leading-relaxed">
                                        Screen LLM responses to ensure safety, compliance, and quality. Redact sensitive content, block unsafe outputs, or reroute based on your policies.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans block">Select Output Guardrail</label>
                                    <div className="relative">
                                        <select 
                                            value={outputGuardrail}
                                            onChange={(e) => setOutputGuardrail(e.target.value)}
                                            className="w-full bg-[#111111]/45 border border-white/5 rounded px-3 py-2 text-[13px] font-sans font-medium text-white appearance-none pr-10 focus:outline-none focus:border-white/20 cursor-pointer"
                                        >
                                            <option value="" className="bg-[#111111]">Select</option>
                                            <option value="toxic-hallucination" className="bg-[#111111]">Block Toxic Outputs & Hallucinations</option>
                                            <option value="pii-sanitization" className="bg-[#111111]">PII Sanitization</option>
                                            <option value="brand-guidelines" className="bg-[#111111]">Brand Guidelines Check</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                                            <Icon name="unfold_more" className="w-3.5 h-3.5"  />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Bottom Update Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleUpdate}
                            className="px-6 py-2 bg-[#1C1C1F] border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white rounded font-sans font-semibold text-[13px] transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                        >
                            Update
                        </button>
                    </div>
                </div>

                {/* Right More Details Column */}
                <div className="lg:col-span-3 space-y-6">
                    <Card className="p-6 border border-white/5 bg-white/2 flex flex-col space-y-6">
                        <div>
                            <h3 className="text-[14px] font-bold text-white font-sans">More Details</h3>
                        </div>

                        {/* Workspace Slug */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Workspace Slug</label>
                            <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded px-3 py-2 font-mono text-[11px] text-neutral-350 select-all">
                                <span className="truncate pr-2">{workspaceSlug}</span>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(workspaceSlug);
                                        toast.success("Slug copied to clipboard!");
                                    }}
                                    className="text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
                                    title="Copy Slug"
                                >
                                    <Icon name="content_copy" className="w-3.5 h-3.5"  />
                                </button>
                            </div>
                        </div>

                        {/* Number of Members */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Number of Members</label>
                            <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-full px-3 py-1 text-[11px] text-neutral-350 w-fit">
                                <Icon name="person" className="w-3.5 h-3.5 text-neutral-400"  />
                                <span>1 Members</span>
                            </div>
                        </div>

                        {/* Created By */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Created By</label>
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-[10px] font-bold font-mono">
                                    {displayInitial}
                                </span>
                                <span className="text-white font-sans text-[12px]">{displayName}</span>
                            </div>
                        </div>

                        {/* Created On */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Created On</label>
                            <p className="text-[12px] text-white font-sans font-medium">May 21, 11:17 AM</p>
                        </div>
                    </Card>

                    {/* Need Help Card */}
                    <Card className="p-5 border border-white/5 bg-white/2 flex gap-3.5">
                        <Icon name="help" className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5"  />
                        <div className="space-y-1 text-[11.5px] font-sans">
                            <h4 className="font-bold text-white leading-normal">Need Help?</h4>
                            <p className="text-neutral-400 leading-relaxed">
                                Need help or facing issues? Our <a href="#/support" className="text-indigo-400 hover:text-indigo-350 transition-colors font-semibold">support team</a> is here to help.
                            </p>
                        </div>
                    </Card>
                </div>

            </div>
        </div>
    );
}
