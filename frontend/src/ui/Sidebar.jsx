import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../state/authStore';
import { useOrgStore } from '../state/orgStore';
import Icon from './Icon';
import toast from 'react-hot-toast';

export function Sidebar({ orgSlug }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
    const [orgSearchQuery, setOrgSearchQuery] = useState('');
    const orgDropdownRef = useRef(null);
    const [isHelpDropdownOpen, setIsHelpDropdownOpen] = useState(false);
    const helpDropdownRef = useRef(null);

    // Invite Modal State
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteRole, setInviteRole] = useState('admin');
    const [inviteEmail, setInviteEmail] = useState('');

    const handleSendInvite = () => {
        if (!inviteEmail) {
            toast.error("Please enter an email address");
            return;
        }
        toast.success(`Invited ${inviteEmail} as ${inviteRole}`);
        setIsInviteModalOpen(false);
        setInviteEmail('');
    };

    // Sidebar collapse state initialized from localStorage
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem('flowops_sidebar_collapsed');
            return saved ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('flowops_sidebar_collapsed', JSON.stringify(isCollapsed));
        } catch {
            // Ignore localStorage write failures.
        }
    }, [isCollapsed]);

    const { organisations, activeOrgId, addOrganisation, setActiveOrgId } = useOrgStore();
    
    // Create Org Modal State
    const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgUseCase, setNewOrgUseCase] = useState('Personal Project');
    const [newOrgEnv, setNewOrgEnv] = useState('Development');

    const handleCreateOrg = () => {
        if (!newOrgName.trim()) {
            toast.error("Please enter a workspace name");
            return;
        }
        const newOrg = { 
            id: Date.now(), 
            name: newOrgName.trim(),
            useCase: newOrgUseCase,
            environment: newOrgEnv
        };
        addOrganisation(newOrg);
        toast.success(`Workspace ${newOrg.name} created!`);
        setIsCreateOrgModalOpen(false);
        setNewOrgName('');
        setNewOrgUseCase('Personal Project');
        setNewOrgEnv('Development');
    };

    const activeOrg = organisations.find(o => o.id === activeOrgId) || organisations[0];
    const companyName = activeOrg.name;
    const workspaceInitial = companyName.charAt(0).toUpperCase();

    useEffect(() => {
        function handleClickOutside(event) {
            if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target)) {
                setIsOrgDropdownOpen(false);
            }
            if (helpDropdownRef.current && !helpDropdownRef.current.contains(event.target)) {
                setIsHelpDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [orgDropdownRef, helpDropdownRef]);

    const isActive = (path) => {
        return location.pathname === path;
    };

    const linkClass = (path) =>
        `flex items-center gap-2.5 px-3 py-1 text-[12.5px] rounded-lg transition-colors ${isActive(path)
            ? 'text-white bg-white/10 font-medium'
            : 'text-white/60 hover:text-white hover:bg-white/5'
        }`;

    const renderNavLink = (rawTo, iconName, label, disabled = false) => {
        // Prefix with workspace slug for URL-based routing
        const to = `/ws/${orgSlug || 'workspace'}${rawTo}`;
        const active = isActive(to);

        if (disabled) {
            if (isCollapsed) {
                return (
                    <div key={label} className="group relative flex justify-center py-0">
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 cursor-not-allowed">
                            <Icon name={iconName} className="w-[18px] h-[18px]" />
                        </div>
                        <div className="absolute left-full ml-3 px-2 py-1 bg-[#18181B] border border-white/10 text-white/60 text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                            {label} (Coming Soon)
                        </div>
                    </div>
                );
            }
            return (
                <a key={label} className="flex items-center gap-2.5 px-3 py-1 text-[12.5px] text-white/40 hover:text-white/60 rounded-lg cursor-not-allowed" href="#/">
                    <Icon name={iconName} className="w-4 h-4" />
                    <span>{label}</span>
                </a>
            );
        }

        if (isCollapsed) {
            return (
                <div key={to} className="group relative flex justify-center py-0">
                    <Link
                        to={to}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${active
                            ? 'text-white bg-white/10 font-medium'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Icon name={iconName} className="w-[18px] h-[18px]" />
                    </Link>
                    <div className="absolute left-full ml-3 px-2 py-1 bg-[#18181B] border border-white/10 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                        {label}
                    </div>
                </div>
            );
        }

        return (
            <Link key={to} to={to} className={linkClass(to)}>
                <Icon name={iconName} className="w-4 h-4" />
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <aside className={`h-screen sticky top-0 z-40 border-r border-white/5 flex flex-col bg-[#0C0C0C] shrink-0 font-sans select-none transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-60'}`}>
            <div className={`flex flex-col h-full gap-2 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-3'}`}>

                {/* Branding Header with Dropdown Trigger */}
                <div
                    className={`flex relative mb-2.5 transition-all duration-300 ${isCollapsed
                        ? 'flex-col items-center gap-4 py-1.5'
                        : 'flex-row items-center justify-between px-1.5 py-1.5'
                        }`}
                    ref={orgDropdownRef}
                >
                    {isCollapsed ? (
                        <>
                            {/* Toggle Button at top */}
                            <button
                                onClick={() => setIsCollapsed(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 border border-white/5 bg-white/[0.02] transition-colors cursor-pointer active:scale-[0.98]"
                            >
                                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M9 3v18" />
                                </svg>
                            </button>

                            {/* Hexagonal logo */}
                            <button
                                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#12141a] to-[#0c0c0c] border border-white/5 hover:border-white/10 transition-all duration-200 active:scale-[0.95] cursor-pointer"
                            >
                                <img
                                    src="/Logo only.png?v=2"
                                    alt="FlowOps HQ"
                                    className="h-5 w-auto object-contain rounded"
                                />
                            </button>

                            {/* Workspace initial */}
                            <button
                                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                                className="w-8 h-8 rounded-full bg-amber-950/20 border border-amber-500/10 hover:border-amber-500/30 flex items-center justify-center text-amber-500/70 hover:text-amber-500 text-[12.5px] font-bold transition-all cursor-pointer hover:bg-amber-950/30"
                            >
                                {workspaceInitial}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
                                className="flex items-center gap-2 text-left cursor-pointer hover:bg-white/5 px-2 py-1.5 rounded-lg transition-all duration-200 group active:scale-[0.98]"
                            >
                                <img
                                    src="/Logo only.png?v=2"
                                    alt="FlowOps HQ"
                                    className="h-5.5 w-auto object-contain rounded"
                                />
                                <span className="font-bold text-[14.5px] tracking-tight text-white flex items-center gap-1.5 font-sans">
                                    {companyName}
                                    <Icon name="expand_more" className={`w-3.5 h-3.5 text-white/40 group-hover:text-white/60 transition-transform duration-200 ${isOrgDropdownOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {/* Panel Toggle Button */}
                            <button
                                onClick={() => setIsCollapsed(true)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 border border-white/5 bg-white/[0.02] transition-colors cursor-pointer active:scale-[0.98]"
                            >
                                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M9 3v18" />
                                </svg>
                            </button>
                        </>
                    )}

                    {/* Dropdown Menu */}
                    {isOrgDropdownOpen && (
                        <div className={`absolute w-80 bg-[#18181B] border border-white/10 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans ${isCollapsed ? 'left-16 top-10' : 'left-1.5 top-12'
                            }`}>
                            <div className="space-y-2.5">
                                {/* Section Header */}
                                <div className="px-1 pt-0.5 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-neutral-450 font-sans tracking-wide">Workspaces</span>
                                    <button 
                                        onClick={() => {
                                            setIsOrgDropdownOpen(false);
                                            setIsCreateOrgModalOpen(true);
                                        }}
                                        className="text-neutral-500 hover:text-white transition-colors cursor-pointer rounded hover:bg-white/5 p-0.5"
                                        title="Create new workspace"
                                    >
                                        <Icon name="add" className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Search input */}
                                <div className="relative">
                                    <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                                    <input
                                        type="text"
                                        placeholder="Search workspaces..."
                                        value={orgSearchQuery}
                                        onChange={(e) => setOrgSearchQuery(e.target.value)}
                                        className="w-full bg-[#0E0E10] border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-white placeholder-neutral-500 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/5 font-sans"
                                    />
                                </div>

                                {/* Organisation list */}
                                <div className="space-y-1">
                                    {organisations.map(org => (
                                        <div 
                                            key={org.id}
                                            onClick={() => {
                                                setActiveOrgId(org.id);
                                                setIsOrgDropdownOpen(false);
                                                toast.success(`Switched to ${org.name}`);
                                                // Navigate to the same relative path in the new workspace
                                                const currentSubPath = location.pathname.split('/').slice(3).join('/');
                                                navigate(`/ws/${org.slug || org.id}/${currentSubPath || 'dashboard'}`);
                                            }}
                                            className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer transition-colors ${activeOrgId === org.id ? 'bg-white/[0.05] border-white/10' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-5.5 h-5.5 rounded-md flex items-center justify-center text-white text-[11px] font-bold ${activeOrgId === org.id ? 'bg-blue-600' : 'bg-neutral-800'}`}>
                                                    {org.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[13px] truncate max-w-[130px] font-sans ${activeOrgId === org.id ? 'font-bold text-white' : 'font-medium text-neutral-300'}`}>
                                                            {org.name}
                                                        </span>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${org.environment === 'Production' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                            {org.environment === 'Production' ? 'PROD' : 'DEV'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-neutral-500">{org.useCase}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {activeOrgId === org.id && (
                                                    <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsOrgDropdownOpen(false);
                                                        navigate('/settings');
                                                    }}
                                                    className="text-neutral-500 hover:text-white p-0.5 rounded hover:bg-white/5 transition-colors cursor-pointer"
                                                >
                                                    <Icon name="settings" className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <hr className="border-white/5 -mx-2.5" />

                                {/* Settings, Invite, Theme items */}
                                <div className="space-y-0.5">
                                    <button
                                        type="button"
                                        onClick={(e) => e.preventDefault()}
                                        className="flex items-center gap-2.5 px-2.5 py-1 text-[13px] text-neutral-500 rounded-lg cursor-not-allowed w-full text-left"
                                    >
                                        <Icon name="settings" className="w-4 h-4 text-neutral-500" />
                                        <span className="font-semibold text-neutral-500">Admin Settings</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsOrgDropdownOpen(false);
                                            setIsInviteModalOpen(true);
                                        }}
                                        className="flex items-center gap-2.5 px-2.5 py-1 text-[13px] text-neutral-350 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer w-full text-left"
                                    >
                                        <Icon name="person_add" className="w-4 h-4 text-neutral-450" />
                                        <span className="font-semibold text-neutral-300">Invite Member</span>
                                    </button>
                                </div>

                                <hr className="border-white/5 -mx-2.5" />

                                {/* User Profile Info section */}
                                <div className="flex items-center gap-3 px-2 py-0.5">
                                    <div className="w-7 h-7 rounded-full bg-red-800 flex items-center justify-center text-white font-bold text-[11px] shadow-sm select-none shrink-0 font-sans">
                                        {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-[12px] font-bold text-white truncate leading-none mb-1 font-sans">{user?.name || 'Admin User'}</p>
                                        <p className="text-[10px] text-neutral-500 truncate leading-none font-sans">{user?.email || 'admin@flowops.dev'}</p>
                                    </div>
                                </div>

                                {/* Logout Item */}
                                <button
                                    onClick={() => {
                                        setIsOrgDropdownOpen(false);
                                        logout();
                                        navigate('/login');
                                    }}
                                    className="flex items-center gap-2.5 px-2.5 py-1 text-[13px] text-red-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer w-full text-left font-sans font-semibold"
                                >
                                    <Icon name="logout" className="w-4 h-4" />
                                    <span>Logout</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Scroll Container */}
                <nav className="flex-grow overflow-y-hidden space-y-[2px] pr-1">
                    {renderNavLink("/dashboard", "rocket_launch", "Getting Started")}
                    {renderNavLink("/keys", "key", "API Keys")}
                    {renderNavLink("/workspace", "memory", "Workspace Control")}

                    {isCollapsed ? (
                        <hr className="border-white/5 my-2 mx-1" />
                    ) : (
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-3 mb-1 px-3">Observability</p>
                    )}
                    {renderNavLink("/analytics", "bar_chart", "Analytics")}
                    {renderNavLink("/logs", "list", "Logs")}

                    {isCollapsed ? (
                        <hr className="border-white/5 my-2 mx-1" />
                    ) : (
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-3 mb-1 px-3">AI Gateway & Tuning</p>
                    )}
                    {renderNavLink("/ai-gateways", "alt_route", "AI Gateways")}
                    {renderNavLink("#/catalog", "description", "Model Catalog", true)}
                    {renderNavLink("#/mcp", "link", "MCP", true)}
                    {renderNavLink("#/agents", "chat", "Agents", true)}
                    {renderNavLink("#/guardrails", "shield", "Guardrails", true)}
                    {renderNavLink("#/configs", "tune", "Configs", true)}

                    {isCollapsed ? (
                        <hr className="border-white/5 my-2 mx-1" />
                    ) : (
                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-3 mb-1 px-3">Integrations</p>
                    )}
                    {renderNavLink("#/llm", "alt_route", "LLM Integrations", true)}
                    {renderNavLink("#/registry", "inventory_2", "MCP Registry", true)}
                    {renderNavLink("#/agent-ints", "smart_toy", "Agent Integrations", true)}
                </nav>

                {/* Footer Controls & User Dropdown */}
                <div className={`mt-auto pt-4 relative ${isCollapsed ? 'space-y-3' : 'space-y-4'}`}>

                    {/* Pro Upgrade Promotion */}
                    {isCollapsed ? (
                        <div className="group relative flex justify-center">
                            <Link 
                                to={`/ws/${orgSlug}/billing/upgrade`}
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 hover:border-white/20 hover:bg-white/5 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all shadow-[0_0_10px_rgba(255,255,255,0.05)]"
                            >
                                <Icon name="emoji_events" className="w-5 h-5 text-amber-500" />
                            </Link>
                            <div className="absolute left-full ml-3 px-2 py-1 bg-[#18181B] border border-white/10 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                                Upgrade to Pro (Limit Exceeded)
                            </div>
                        </div>
                    ) : (
                        <Link 
                            to={`/ws/${orgSlug}/billing/upgrade`}
                            className="block bg-gradient-to-br from-white/10 to-transparent border border-white/5 hover:border-white/20 p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] active:scale-[0.98]"
                        >
                            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                                <Icon name="emoji_events" className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[12px] font-bold text-white leading-normal">Upgrade to Pro</p>
                                <p className="text-[10px] text-white/40 leading-tight">You've exceeded the prompts limit</p>
                            </div>
                        </Link>
                    )}

                    {/* Bottom Controls */}
                    <div ref={helpDropdownRef} className="relative">
                        {isCollapsed ? (
                            <div className="flex flex-col items-center gap-2 pb-1">
                                <div className="group relative flex justify-center">
                                    <button onClick={() => setIsHelpDropdownOpen(!isHelpDropdownOpen)} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer">
                                        <Icon name="help" className="w-4.5 h-4.5" />
                                    </button>
                                    {!isHelpDropdownOpen && (
                                        <div className="absolute left-full ml-3 px-2 py-1 bg-[#18181B] border border-white/10 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                                            Help & Support
                                        </div>
                                    )}
                                </div>
                                <div className="group relative flex justify-center">
                                    <Link to={`/ws/${orgSlug}/settings`} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer">
                                        <Icon name="settings" className="w-4.5 h-4.5" />
                                    </Link>
                                    <div className="absolute left-full ml-3 px-2 py-1 bg-[#18181B] border border-white/10 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-md">
                                        Workspace Settings
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between px-1 pb-1">
                                <button onClick={() => setIsHelpDropdownOpen(!isHelpDropdownOpen)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer" title="Help & Support">
                                    <Icon name="help" className="w-4.5 h-4.5" />
                                </button>
                                <Link to={`/ws/${orgSlug}/settings`} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors cursor-pointer" title="Workspace Settings">
                                    <Icon name="settings" className="w-4.5 h-4.5" />
                                </Link>
                            </div>
                        )}

                        {/* Help Dropdown Menu */}
                        {isHelpDropdownOpen && (
                            <div className={`absolute bottom-12 ${isCollapsed ? 'left-full ml-2' : 'left-8'} w-48 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 origin-bottom-left`}>
                                <Link
                                    to="/docs/introduction"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setIsHelpDropdownOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-neutral-300 hover:text-white hover:bg-white/5 transition-all font-sans cursor-pointer group"
                                >
                                    <Icon name="book" className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                                    <span>Docs</span>
                                </Link>
                                <Link
                                    to={`/ws/${orgSlug || 'workspace'}/contact`}
                                    onClick={() => setIsHelpDropdownOpen(false)}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-neutral-300 hover:text-white hover:bg-white/5 transition-all font-sans cursor-pointer group"
                                >
                                    <Icon name="headphones" className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                                    <span>Contact Us</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-xl shadow-2xl w-full max-w-[550px] overflow-hidden flex flex-col font-sans relative transform scale-100">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4">
                            <div>
                                <h2 className="text-[16px] font-bold text-white mb-1">Add Team Member</h2>
                                <p className="text-[13px] text-neutral-400">Invite people to collaborate in this Organisation</p>
                            </div>
                            <button onClick={() => setIsInviteModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors cursor-pointer p-1">
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 pt-2 space-y-6">
                            <div>
                                <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Organisation Role</h3>
                                <div className="flex gap-4">
                                    {/* Admin Radio */}
                                    <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'admin' ? 'bg-[#06242e]/40 border-cyan-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                                        <div className="mt-0.5 shrink-0">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${inviteRole === 'admin' ? 'border-cyan-400 bg-cyan-400' : 'border-neutral-500'}`}>
                                                {inviteRole === 'admin' && <div className="w-1.5 h-1.5 bg-[#06242e] rounded-full"></div>}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Icon name="shield" className={`w-4 h-4 ${inviteRole === 'admin' ? 'text-cyan-400' : 'text-neutral-400'}`} />
                                                <span className="text-[14px] font-bold text-white">Admin</span>
                                            </div>
                                            <div className="text-[12px] text-neutral-400 leading-tight mt-1">Full access to manage the organisation</div>
                                        </div>
                                        <input type="radio" className="hidden" name="role" checked={inviteRole === 'admin'} onChange={() => setInviteRole('admin')} />
                                    </label>

                                    {/* Member Radio */}
                                    <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'member' ? 'bg-[#06242e]/40 border-cyan-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                                        <div className="mt-0.5 shrink-0">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${inviteRole === 'member' ? 'border-cyan-400 bg-cyan-400' : 'border-neutral-500'}`}>
                                                {inviteRole === 'member' && <div className="w-1.5 h-1.5 bg-[#06242e] rounded-full"></div>}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Icon name="person" className={`w-4 h-4 ${inviteRole === 'member' ? 'text-cyan-400' : 'text-neutral-400'}`} />
                                                <span className="text-[14px] font-bold text-white">Member</span>
                                            </div>
                                            <div className="text-[12px] text-neutral-400 leading-tight mt-1">Access to assigned workspaces only</div>
                                        </div>
                                        <input type="radio" className="hidden" name="role" checked={inviteRole === 'member'} onChange={() => setInviteRole('member')} />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Invite via email</h3>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                        <input
                                            type="email"
                                            placeholder="user@example.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendInvite}
                                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2.5 rounded-lg transition-colors text-[13px] shadow-md cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                    >
                                        Send Invite
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Create Org Modal */}
            {isCreateOrgModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden flex flex-col font-sans relative">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4">
                            <div>
                                <h2 className="text-[16px] font-bold text-white mb-1">Create Workspace</h2>
                                <p className="text-[13px] text-neutral-400">Set up a new workspace for your team</p>
                            </div>
                            <button onClick={() => setIsCreateOrgModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors cursor-pointer p-1">
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 pt-2 space-y-6">
                            <div>
                                <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Workspace Name</h3>
                                <div className="relative">
                                    <Icon name="domain" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                    <input
                                        type="text"
                                        placeholder="e.g. Acme Corp"
                                        value={newOrgName}
                                        onChange={(e) => setNewOrgName(e.target.value)}
                                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Primary Use Case</h3>
                                    <select 
                                        value={newOrgUseCase} 
                                        onChange={(e) => setNewOrgUseCase(e.target.value)}
                                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 appearance-none"
                                    >
                                        <option value="Personal Project">Personal Project</option>
                                        <option value="Client Agency">Client Agency</option>
                                        <option value="Company Department">Company Department</option>
                                    </select>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Environment</h3>
                                    <select 
                                        value={newOrgEnv} 
                                        onChange={(e) => setNewOrgEnv(e.target.value)}
                                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 appearance-none"
                                    >
                                        <option value="Development">Development / Staging</option>
                                        <option value="Production">Production</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <button
                                    onClick={handleCreateOrg}
                                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2.5 rounded-lg transition-colors text-[13px] shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    Create Workspace
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
