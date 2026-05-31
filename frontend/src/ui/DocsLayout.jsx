import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icon';

export default function DocsLayout({ children }) {
    const location = useLocation();

    useEffect(() => {
        document.title = "FlowOps HQ -- Docs";
        return () => {
            document.title = "FlowOps HQ";
        };
    }, []);

    return (
        <div className="min-h-screen text-white flex flex-col font-sans bg-transparent">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-white/5 bg-[#030000]/60 backdrop-blur-xl">
                {/* Left */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center gap-2">
                        <img src="/logo_bck.jpeg" alt="FlowOps HQ" className="w-7 h-7 rounded-md" />
                        <span className="font-bold text-lg tracking-tight">FlowOps HQ</span>
                    </Link>
                </div>

                {/* Center */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-3 py-1.5 w-64 transition-colors cursor-text">
                        <Icon name="search" className="text-[16px] text-neutral-400" />
                        <span className="text-sm text-neutral-400 flex-1 text-left">Search...</span>
                        <span className="text-xs font-mono text-neutral-500 bg-white/10 px-1.5 rounded border border-white/10">Ctrl K</span>
                    </div>

                    <button className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-3 py-1.5 text-sm transition-colors text-neutral-300">
                        <Icon name="auto_awesome" className="text-[16px]" />
                        Ask Assistant
                    </button>
                </div>

                {/* Right */}
                <div className="flex items-center gap-6">
                    <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-neutral-400">
                        <Link to="#models" className="hover:text-white transition-colors">Models</Link>
                        <Link to="#support" className="hover:text-white transition-colors">Support</Link>
                        <Link to="#demo" className="hover:text-white transition-colors">Book Demo</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link to="/login" className="bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1">
                            Sign In <Icon name="chevron_right" className="text-[16px]" />
                        </Link>
                        <a href="https://github.com/aaryan-paliwal/FlowOps-HQ" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors p-1.5 flex items-center justify-center" aria-label="GitHub">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
                                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.814 1.102.814 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                            </svg>
                        </a>
                    </div>
                </div>
            </header>
            
            {/* Secondary Navigation (Tabs) */}
            <div className="sticky top-14 z-40 flex items-center gap-8 px-6 h-12 border-b border-white/5 text-sm font-medium overflow-x-auto shrink-0 bg-[#030000]/60 backdrop-blur-xl">
                <Link to="/docs/introduction" className="text-white border-b-2 border-cyan-500 py-3 h-full flex items-center">Docs</Link>
                <Link to="#integrations" className="text-neutral-400 hover:text-white transition-colors py-3 h-full flex items-center border-b-2 border-transparent">Integrations</Link>
                <Link to="#gateway-apis" className="text-neutral-400 hover:text-white transition-colors py-3 h-full flex items-center border-b-2 border-transparent">Gateway APIs</Link>
                <Link to="#admin-apis" className="text-neutral-400 hover:text-white transition-colors py-3 h-full flex items-center border-b-2 border-transparent">Admin APIs</Link>
                <Link to="#cookbooks" className="text-neutral-400 hover:text-white transition-colors py-3 h-full flex items-center border-b-2 border-transparent">Cookbooks</Link>
                <Link to="#changelog" className="text-neutral-400 hover:text-white transition-colors py-3 h-full flex items-center border-b-2 border-transparent">Changelog</Link>
                <Link to="#help-center" className="text-neutral-400 hover:text-white transition-colors py-3 h-full flex items-center border-b-2 border-transparent">Help Center</Link>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex">
                {/* Docs Sidebar */}
                <aside className="sticky top-[104px] h-[calc(100vh-104px)] w-[280px] shrink-0 border-r border-white/5 overflow-y-auto hidden lg:block custom-scrollbar bg-transparent">
                    <div className="p-4 space-y-8 mt-2">
                        {/* Section: Introduction */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 px-3 mb-3">
                                <Icon name="rocket_launch" className="text-[14px] text-neutral-400" />
                                <h4 className="text-sm font-bold text-white">Introduction</h4>
                            </div>
                            <Link to="/docs/introduction" className={`block px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/introduction' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                What is FlowOps HQ?
                            </Link>
                            <Link to="/docs/first-request" className={`block px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/first-request' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                Make Your First Request
                            </Link>
                            <Link to="/docs/features" className={`block px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/features' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                FlowOps Features
                            </Link>
                        </div>

                        {/* Section: Product */}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 px-3 mb-3">
                                <Icon name="view_in_ar" className="text-[14px] text-neutral-400" />
                                <h4 className="text-sm font-bold text-white">Product</h4>
                            </div>
                            <Link to="/docs/observability" className={`flex items-center justify-between px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/observability' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                <span>Observability</span>
                                <Icon name="chevron_right" className="text-[16px] text-neutral-600" />
                            </Link>
                            <Link to="/docs/ai-gateway" className={`flex items-center justify-between px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/ai-gateway' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                <span>AI Gateway</span>
                                <Icon name="chevron_right" className="text-[16px] text-neutral-600" />
                            </Link>
                            <Link to="/docs/model-catalog" className={`flex items-center justify-between px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/model-catalog' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                <span>Model Catalog</span>
                                <Icon name="chevron_right" className="text-[16px] text-neutral-600" />
                            </Link>
                            <Link to="/docs/mcp-gateway" className={`flex items-center justify-between px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/mcp-gateway' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                <span>MCP Gateway</span>
                                <Icon name="chevron_right" className="text-[16px] text-neutral-600" />
                            </Link>
                            <Link to="/docs/agent-gateway" className={`flex items-center justify-between px-3 py-1.5 ml-[18px] text-[13.5px] rounded-lg font-medium transition-colors ${location.pathname === '/docs/agent-gateway' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'}`}>
                                <span>Agent Gateway</span>
                                <Icon name="chevron_right" className="text-[16px] text-neutral-600" />
                            </Link>
                        </div>
                    </div>
                </aside>

                {/* Content */}
                <main className="flex-1 bg-transparent pb-32">
                    <div className="max-w-4xl px-8 py-10 lg:px-12">
                        {children}
                    </div>
                </main>
            </div>
            
            {/* Floating Assistant Chatbox */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-50">
                <div className="bg-[#111111]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-1.5 flex items-center gap-3 w-full">
                    <input 
                        type="text" 
                        placeholder="Ask a question..." 
                        className="flex-1 bg-transparent border-none text-white text-[14px] placeholder-neutral-500 px-4 py-2 outline-none font-sans"
                    />
                    <div className="flex items-center gap-3 pr-2 shrink-0">
                        <span className="text-xs font-mono text-neutral-500 hidden sm:block">Ctrl+I</span>
                        <button className="w-8 h-8 rounded-full bg-cyan-900/30 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 flex items-center justify-center transition-colors">
                            <Icon name="arrow_upward" className="text-[18px]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
