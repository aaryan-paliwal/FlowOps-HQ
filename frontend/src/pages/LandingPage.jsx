import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';

export default function LandingPage() {
    // Suffix text rotator
    const [suffixIndex, setSuffixIndex] = useState(0);
    const suffixes = ['GenAI Builders', 'LLM Teams', 'AI Developers', 'Enterprise Scale'];
    const suffixCount = suffixes.length;

    useEffect(() => {
        const interval = setInterval(() => {
            setSuffixIndex((prev) => (prev + 1) % suffixCount);
        }, 3000);
        return () => clearInterval(interval);
    }, [suffixCount]);

    // Interactive Code Snippet Tabs
    const [activeCodeTab, setActiveCodeTab] = useState('python');

    const codeSnippets = {
        python: `from flowops import FlowOpsClient

client = FlowOpsClient(api_key="fo_live_9a2...x3")

# Start routing traffic through FlowOps HQ Edge
response = client.chat.completions.create(
  model="gpt-4-turbo",
  messages=[{
    "role": "user", 
    "content": "Analyze traffic"
  }]
)`,
        nodejs: `import { FlowOpsClient } from "flowops";

const client = new FlowOpsClient({
  apiKey: "fo_live_9a2...x3"
});

// Start routing traffic through FlowOps HQ Edge
const response = await client.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [{
    role: "user",
    content: "Analyze traffic"
  }]
});`,
        curl: `curl -X POST https://api.flowops.dev/gateway/v1/chat/completions \\
  -H "Authorization: Bearer fo_live_9a2...x3" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4-turbo",
    "messages": [{"role": "user", "content": "Analyze traffic"}]
  }'`
    };

    // Live Gateway Request Simulator
    const [simMode, setSimMode] = useState('fallback'); // fallback, loadbalance, cache
    const [simStatus, setSimStatus] = useState('idle'); // idle, sending, gateway, openai_error, success
    const [simLogs, setSimLogs] = useState(['Select a routing mode and click "Run Simulation"']);

    const triggerSimulation = () => {
        setSimStatus('sending');
        setSimLogs(['[Client] Preparing query payload...', '[Client] Injecting auth access token...', '[Client] Directing connection to FlowOps HQ Gateway Proxy...']);
        
        setTimeout(() => {
            setSimStatus('gateway');
            if (simMode === 'cache') {
                setSimLogs(prev => [
                    ...prev,
                    '[Gateway] Analyzing prompt semantic context...',
                    '[Gateway] Prompt similarity score: 96.5% (Threshold: 90%)',
                    '[Gateway] Cache HIT! Skipping upstream LLM query.',
                    '[Client] Request completed in 12ms (Cost Saved: 100%)'
                ]);
                setSimStatus('success');
            } else if (simMode === 'fallback') {
                setSimLogs(prev => [
                    ...prev,
                    '[Gateway] Match context: Route "/payments/charge"',
                    '[Gateway] Forwarding payload to primary provider (OpenAI GPT-4o)...'
                ]);
                setTimeout(() => {
                    setSimStatus('openai_error');
                    setSimLogs(prev => [
                        ...prev,
                        '[Gateway] OpenAI endpoint returned HTTP 503 (Service Unavailable)',
                        '[Gateway] Resilience logic triggered: sequential fallback to backup provider.',
                        '[Gateway] Re-routing query payload to Anthropic Claude 3.5...'
                    ]);
                    setTimeout(() => {
                        setSimStatus('success');
                        setSimLogs(prev => [
                            ...prev,
                            '[Gateway] Anthropic responded HTTP 200 (OK)',
                            '[Client] Request completed successfully in 840ms'
                        ]);
                    }, 1200);
                }, 1000);
            } else if (simMode === 'loadbalance') {
                const target = Math.random() > 0.4 ? 'OpenAI GPT-4o (Weight 60%)' : 'Google Gemini Pro (Weight 40%)';
                setSimLogs(prev => [
                    ...prev,
                    '[Gateway] Evaluating weight matrix constraints...',
                    `[Gateway] Weighted balancer selected: ${target}`,
                    `[Gateway] Routing client request...`
                ]);
                setTimeout(() => {
                    setSimStatus('success');
                    setSimLogs(prev => [
                        ...prev,
                        `[Gateway] Target responded HTTP 200 (OK)`,
                        '[Client] Request completed successfully'
                    ]);
                }, 1200);
            }
        }, 1000);
    };

    // Live Stream Inspector Table Rows
    const [tableLogs, setTableLogs] = useState([
        { id: 1, method: 'POST', path: '/v1/chat/completions', status: '200 OK', statusColor: 'bg-green-500', latency: '124ms', timestamp: '10:34:21.042' },
        { id: 2, method: 'GET', path: '/v1/models', status: '200 OK', statusColor: 'bg-green-500', latency: '32ms', timestamp: '10:34:20.912' },
        { id: 3, method: 'POST', path: '/v1/embeddings', status: '429 Limit', statusColor: 'bg-yellow-500', latency: '18ms', timestamp: '10:34:19.456' },
        { id: 4, method: 'POST', path: '/v1/chat/completions', status: '200 OK', statusColor: 'bg-green-500', latency: '142ms', timestamp: '10:34:18.890' },
        { id: 5, method: 'POST', path: '/v1/moderations', status: '200 OK', statusColor: 'bg-green-500', latency: '54ms', timestamp: '10:34:17.320' }
    ]);

    useEffect(() => {
        const paths = [
            '/v1/chat/completions',
            '/v1/models',
            '/v1/embeddings',
            '/v1/moderations',
            '/v1/images/generations'
        ];
        const methods = ['POST', 'GET', 'POST', 'POST', 'POST'];
        const statuses = [
            { text: '200 OK', color: 'bg-green-500' },
            { text: '200 OK', color: 'bg-green-500' },
            { text: '429 Limit', color: 'bg-yellow-500' },
            { text: '503 Error', color: 'bg-red-500' }
        ];

        const interval = setInterval(() => {
            const idx = Math.floor(Math.random() * paths.length);
            const statusIdx = Math.floor(Math.random() * statuses.length);
            const latency = Math.floor(Math.random() * 150) + 12;
            const now = new Date();
            const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
            
            setTableLogs((prev) => {
                const newLog = {
                    id: Date.now(),
                    method: methods[idx],
                    path: paths[idx],
                    status: statuses[statusIdx].text,
                    statusColor: statuses[statusIdx].color,
                    latency: `${latency}ms`,
                    timestamp
                };
                return [newLog, ...prev.slice(0, 4)];
            });
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black font-sans antialiased overflow-x-hidden relative">
            {/* Nav Grid Background effect */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_0)] bg-[size:32px_32px] pointer-events-none z-0"></div>

            {/* BEGIN: Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass-nav" data-purpose="main-navigation">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link className="text-xl font-bold tracking-tighter flex items-center select-none" to="/">
                            <img
                                src="/Logo 1.png?v=2"
                                alt="FlowOps Logo"
                                className="h-[76px] w-auto object-contain"
                            />
                        </Link>
                        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400 font-medium">
                            <a className="hover:text-white transition-colors" href="#features">Platform</a>
                            <a className="hover:text-white transition-colors" href="#simulator">Simulator</a>
                            <a className="hover:text-white transition-colors" href="#integration">Docs</a>
                            <a className="hover:text-white transition-colors" href="#logs">Live Inspector</a>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link className="text-sm font-medium text-zinc-400 hover:text-white" to="/login">Sign In</Link>
                        <Link className="bg-white text-black text-sm font-semibold px-4 py-2 rounded hover:bg-zinc-200 transition-all" to="/register">Get Started</Link>
                    </div>
                </div>
            </nav>
            {/* END: Navigation */}

            {/* BEGIN: Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden hero-gradient" data-purpose="hero-section">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 mb-8">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        v2.4.0 Now Live: Enhanced Edge Caching
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                        The AI Control Plane <br className="hidden md:block" /> for {suffixes[suffixIndex]}
                    </h1>
                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
                        Route prompts, manage API keys, cache semantic queries, and cut token costs in real-time with FlowOps HQ' low-latency gateway.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <Link to="/register" className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold rounded-md hover:scale-105 transition-transform text-center">
                            Start Free Trial
                        </Link>
                        <a href="#simulator" className="w-full sm:w-auto px-8 py-4 bg-zinc-900 text-white border border-zinc-800 font-bold rounded-md hover:bg-zinc-800 transition-colors text-center">
                            Run Console Demo
                        </a>
                    </div>

                    {/* Dashboard Mockup */}
                    <div className="relative max-w-6xl mx-auto">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-red-500/20 blur-2xl opacity-50"></div>
                        <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
                            {/* Mockup Header */}
                            <div className="border-b border-zinc-900 p-4 flex items-center justify-between bg-zinc-900/50">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                                    <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                                    <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                                </div>
                                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Dashboard // Live Traffic Analysis</div>
                                <div className="w-12"></div>
                            </div>
                            {/* Mockup Content */}
                            <div className="p-6 grid grid-cols-12 gap-6">
                                {/* Stats */}
                                <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-4">
                                    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg text-left">
                                        <div className="text-zinc-500 text-xs mb-1">Total Requests</div>
                                        <div className="text-xl font-mono">1.28M</div>
                                    </div>
                                    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg text-left">
                                        <div className="text-zinc-500 text-xs mb-1">Avg Latency</div>
                                        <div className="text-xl font-mono text-green-400">42ms</div>
                                    </div>
                                </div>
                                {/* Main Chart Placeholder */}
                                <div className="col-span-12 md:col-span-8 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 h-48 relative overflow-hidden">
                                    <div className="absolute inset-x-0 bottom-0 h-32 flex items-end justify-between px-2 gap-1.5">
                                        {/* Dynamic Bar chart visual */}
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[40%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[60%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[55%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[80%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[75%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[90%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[85%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[95%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[70%] transition-all duration-1000"></div>
                                        <div className="w-full bg-blue-500/20 border-t border-blue-500/40 h-[60%] transition-all duration-1000"></div>
                                    </div>
                                    <div className="relative text-[10px] font-mono text-zinc-650">Requests per Minute (Live)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            {/* END: Hero Section */}

            {/* BEGIN: Stats Bar */}
            <section className="border-y border-zinc-900 bg-zinc-950/50 py-12" data-purpose="trust-metrics">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-3xl font-bold mb-1">2.4T+</div>
                            <div className="text-zinc-500 text-sm uppercase tracking-wider">APIs Routed</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold mb-1">11,200+</div>
                            <div className="text-zinc-500 text-sm uppercase tracking-wider">Active Teams</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold mb-1">99.99%</div>
                            <div className="text-zinc-500 text-sm uppercase tracking-wider">Uptime SLA</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold mb-1">&lt; 5ms</div>
                            <div className="text-zinc-500 text-sm uppercase tracking-wider">P99 Overhead</div>
                        </div>
                    </div>
                </div>
            </section>
            {/* END: Stats Bar */}

            {/* BEGIN: Features Grid */}
            <section className="py-24" data-purpose="features-grid" id="features">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="mb-16 text-left">
                        <h2 className="text-3xl font-bold mb-4">Built for Scale. <br />Designed for Developers.</h2>
                        <p className="text-zinc-400 max-w-xl">Everything you need to observe, secure, and manage your API ecosystem in one unified control plane.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Feature 1 */}
                        <div className="p-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                            <div className="w-10 h-10 bg-blue-500/10 rounded flex items-center justify-center mb-6">
                                <Icon name="bolt" className="w-5 h-5 text-blue-500"  />
                            </div>
                            <h3 className="text-xl font-bold mb-3">AI Gateway Pattern</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-4">Unified interface for LLM orchestration. Route prompts, manage rate limits, and track token usage across multiple providers.</p>
                            <a className="text-white text-xs font-mono flex items-center gap-2 hover:underline" href="#simulator">LEARN_MORE →</a>
                        </div>
                        {/* Feature 2 */}
                        <div className="p-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                            <div className="w-10 h-10 bg-red-500/10 rounded flex items-center justify-center mb-6">
                                <Icon name="shield" className="w-5 h-5 text-red-500"  />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Governance & Security</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-4">Enforce RBAC, rotate API keys automatically, and block malicious traffic patterns before they hit your upstream.</p>
                            <a className="text-white text-xs font-mono flex items-center gap-2 hover:underline" href="#integration">VIEW_DOCS →</a>
                        </div>
                        {/* Feature 3 */}
                        <div className="p-8 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                            <div className="w-10 h-10 bg-green-500/10 rounded flex items-center justify-center mb-6">
                                <Icon name="monitoring" className="w-5 h-5 text-green-500"  />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Real-time Analytics</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed mb-4">Inspect every request and response. Visualize performance bottlenecks with high-resolution traces and P99 metrics.</p>
                            <a className="text-white text-xs font-mono flex items-center gap-2 hover:underline" href="#logs">EXPLORE_CHARTS →</a>
                        </div>
                    </div>
                </div>
            </section>
            {/* END: Features Grid */}

            {/* BEGIN: INTERACTIVE GATEWAY REQUEST ROUTER SIMULATOR */}
            <section id="simulator" className="py-16 px-4 max-w-7xl mx-auto z-10 relative">
                <div className="border border-white/5 bg-[#111111]/30 backdrop-blur-md rounded-2xl p-6 md:p-8 shadow-2xl">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        
                        {/* Simulation controls */}
                        <div className="lg:col-span-4 flex flex-col justify-between">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 tracking-wider uppercase mb-5">
                                    <Icon name="auto_awesome" className="w-3.5 h-3.5"  /> INTERACTIVE CONSOLE
                                </div>
                                <h3 className="text-2xl font-extrabold text-white mb-2">Gateway Simulation</h3>
                                <p className="text-zinc-400 text-[13px] leading-relaxed mb-6">
                                    Test fallback retry logic, semantic caching, or load balancing. Select a mode to run a simulated client request and see how FlowOps HQ proxies it.
                                </p>
                            </div>

                            {/* Mode select buttons */}
                            <div className="space-y-3">
                                <button 
                                    onClick={() => { setSimMode('fallback'); setSimStatus('idle'); setSimLogs(['Select routing mode and run simulation']); }}
                                    className={`w-full text-left p-3.5 rounded-lg border text-[13px] font-mono transition-all flex items-center justify-between cursor-pointer ${simMode === 'fallback' ? 'bg-white text-black border-white font-bold' : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'}`}
                                >
                                    <span>Sequential Failover</span>
                                    <Icon name="shuffle" className="w-4 h-4"  />
                                </button>
                                <button 
                                    onClick={() => { setSimMode('loadbalance'); setSimStatus('idle'); setSimLogs(['Select routing mode and run simulation']); }}
                                    className={`w-full text-left p-3.5 rounded-lg border text-[13px] font-mono transition-all flex items-center justify-between cursor-pointer ${simMode === 'loadbalance' ? 'bg-white text-black border-white font-bold' : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'}`}
                                >
                                    <span>Load Balancer</span>
                                    <Icon name="layers" className="w-4 h-4"  />
                                </button>
                                <button 
                                    onClick={() => { setSimMode('cache'); setSimStatus('idle'); setSimLogs(['Select routing mode and run simulation']); }}
                                    className={`w-full text-left p-3.5 rounded-lg border text-[13px] font-mono transition-all flex items-center justify-between cursor-pointer ${simMode === 'cache' ? 'bg-white text-black border-white font-bold' : 'bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'}`}
                                >
                                    <span>Semantic Cache</span>
                                    <Icon name="bolt" className="w-4 h-4"  />
                                </button>

                                <button 
                                    onClick={triggerSimulation}
                                    disabled={simStatus === 'sending' || simStatus === 'gateway' || simStatus === 'openai_error'}
                                    className="w-full mt-4 py-3 bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-900 disabled:text-zinc-650 font-bold text-[13px] rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer select-none"
                                >
                                    <Icon name="play_arrow" className="w-4 h-4 fill-black"  />
                                    Run Request Simulation
                                </button>
                            </div>
                        </div>

                        {/* Interactive flow visualization pane */}
                        <div className="lg:col-span-8 bg-[#0a0a0a]/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between min-h-[360px] relative overflow-hidden font-mono">
                            
                            {/* Pipeline nodes */}
                            <div className="grid grid-cols-3 gap-2 items-center text-center relative z-10 border-b border-zinc-900 pb-5">
                                {/* App Node */}
                                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col items-center justify-center">
                                    <Icon name="memory" className="w-5 h-5 text-zinc-500 mb-1"  />
                                    <span className="text-[10px] font-bold text-white uppercase">App Client</span>
                                    <span className="text-[8px] text-zinc-500">localhost:3000</span>
                                </div>

                                {/* Gateway Proxy Node */}
                                <div className={`p-3 border rounded-lg flex flex-col items-center justify-center transition-all ${simStatus === 'gateway' || simStatus === 'openai_error' || simStatus === 'success' ? 'bg-blue-950/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-zinc-900 border-zinc-800'}`}>
                                    <Icon name="terminal" className={`w-5 h-5 mb-1 transition-colors ${simStatus === 'gateway' || simStatus === 'openai_error' || simStatus === 'success' ? 'text-blue-450' : 'text-zinc-500'}`}  />
                                    <span className="text-[10px] font-bold text-white uppercase">FlowOps HQ Proxy</span>
                                    <span className="text-[8px] text-zinc-500">api.flowops.dev</span>
                                </div>

                                {/* Upstream Providers Node */}
                                <div className="space-y-1.5">
                                    <div className={`p-1.5 border text-[9px] rounded flex justify-between items-center transition-colors ${simStatus === 'openai_error' ? 'bg-red-950/30 border-red-500/50 text-red-400' : simStatus === 'success' && simMode === 'loadbalance' ? 'bg-green-950/30 border-green-500/50 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                        <span>OpenAI API</span>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                    </div>
                                    <div className={`p-1.5 border text-[9px] rounded flex justify-between items-center transition-colors ${simStatus === 'success' && simMode === 'fallback' ? 'bg-green-950/30 border-green-500/50 text-green-400 animate-pulse' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                        <span>Claude API</span>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                    </div>
                                    <div className={`p-1.5 border text-[9px] rounded flex justify-between items-center transition-colors ${simStatus === 'success' && simMode === 'cache' ? 'bg-green-950/30 border-green-500/50 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                                        <span>Semantic Cache</span>
                                        <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                                    </div>
                                </div>
                            </div>

                            {/* Console Logging stream output */}
                            <div className="flex-1 mt-4 bg-black/40 border border-zinc-900 p-4 rounded-lg overflow-y-auto text-[11px] text-zinc-400 space-y-1 min-h-[160px] max-h-[220px]">
                                {simLogs.map((log, idx) => {
                                    let textColor = 'text-zinc-400';
                                    if (log.includes('HTTP 503') || log.includes('returned:')) textColor = 'text-red-400 font-bold';
                                    if (log.includes('HTTP 200') || log.includes('Success') || log.includes('Cache HIT!')) textColor = 'text-green-400 font-bold';
                                    if (log.includes('[Gateway]')) textColor = 'text-blue-300';
                                    return (
                                        <div key={idx} className={`${textColor} leading-relaxed`}>
                                            <span className="text-zinc-650 mr-2 select-none">&gt;</span>
                                            {log}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </section>
            {/* END: Simulator Section */}

            {/* BEGIN: Code Integration Section */}
            <section className="py-24 bg-zinc-950 border-y border-zinc-900" data-purpose="integration-section" id="integration">
                <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="inline-block px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-450 mb-4 uppercase">INTEGRATION</div>
                        <h2 className="text-4xl font-bold mb-6">Integrate in 60 seconds</h2>
                        <p className="text-zinc-400 mb-8">Deploy FlowOps HQ via Docker, Kubernetes, or our managed cloud. Simply change your API endpoint URL and we handle the rest.</p>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] text-white">1</div>
                                <p className="text-zinc-300 text-sm">Initialize the FlowOps HQ client with your project key.</p>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] text-white">2</div>
                                <p className="text-zinc-300 text-sm">Configure your upstream microservice routes in the dashboard.</p>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] text-white">3</div>
                                <p className="text-zinc-300 text-sm">Enable caching and security rules with a single click.</p>
                            </li>
                        </ul>
                    </div>

                    <div className="code-window shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-zinc-950/60">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setActiveCodeTab('python')}
                                    className={`px-3 py-1.5 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${activeCodeTab === 'python' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    Python
                                </button>
                                <button 
                                    onClick={() => setActiveCodeTab('nodejs')}
                                    className={`px-3 py-1.5 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${activeCodeTab === 'nodejs' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    Node.js
                                </button>
                                <button 
                                    onClick={() => setActiveCodeTab('curl')}
                                    className={`px-3 py-1.5 rounded text-[11px] font-bold font-mono transition-colors cursor-pointer ${activeCodeTab === 'curl' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    cURL
                                </button>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest select-none">flowops-sdk</span>
                        </div>
                        <div className="p-6 text-sm font-mono leading-relaxed overflow-x-auto bg-[#0a0a0a] min-h-[220px]">
                            <pre className="text-zinc-300 select-text whitespace-pre">
                                {codeSnippets[activeCodeTab]}
                            </pre>
                        </div>
                    </div>
                </div>
            </section>
            {/* END: Code Integration Section */}

            {/* BEGIN: Logs Preview */}
            <section className="py-24" data-purpose="live-logs-preview" id="logs">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-end justify-between mb-12">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">Live Stream Inspector</h2>
                            <p className="text-zinc-400">Deep observability into every request and response payload.</p>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded border border-green-500/20">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-mono text-green-500 font-bold uppercase tracking-widest">Live Logs</span>
                        </div>
                    </div>
                    
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr class="bg-zinc-900/50 text-[10px] uppercase font-mono tracking-widest text-zinc-500 border-b border-zinc-850">
                                        <th className="px-6 py-3">Method</th>
                                        <th className="px-6 py-3">Path</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">Latency</th>
                                        <th className="px-6 py-3 text-right">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs font-mono">
                                    {tableLogs.map((log) => (
                                        <tr key={log.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors animate-pulse-once">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${log.method === 'GET' ? 'bg-zinc-905 text-zinc-400 border-zinc-800' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                    {log.method}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-zinc-300 font-mono">{log.path}</td>
                                            <td className="px-6 py-4">
                                                <span className="flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${log.statusColor}`}></span>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-zinc-400">{log.latency}</td>
                                            <td className="px-6 py-4 text-right text-zinc-600">{log.timestamp}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-zinc-900/20 text-center border-t border-zinc-900">
                            <Link to="/login" className="text-[10px] font-mono text-zinc-500 hover:text-white transition-colors">
                                VIEW_ALL_TRAFFIC_LOGS →
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
            {/* END: Logs Preview */}

            {/* BEGIN: Call to Action */}
            <section className="py-32 relative overflow-hidden" data-purpose="cta-section">
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full"></div>
                <div className="relative max-w-7xl mx-auto px-4 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold mb-8">The last platform you'll need <br />in your API stack.</h2>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/register" className="bg-white text-black px-8 py-3 font-bold rounded hover:bg-zinc-200 transition-colors w-full sm:w-auto text-center">
                            Get Started for Free
                        </Link>
                        <a href="mailto:engineering@flowops.dev" className="border border-zinc-800 text-white px-8 py-3 font-bold rounded hover:bg-zinc-900 transition-colors w-full sm:w-auto text-center">
                            Talk to Engineering
                        </a>
                    </div>
                    <p className="mt-8 text-zinc-500 text-sm">No credit card required. Up to 1M requests/month free.</p>
                </div>
            </section>
            {/* END: Call to Action */}

            {/* BEGIN: Footer */}
            <footer className="py-20 border-t border-zinc-900 bg-zinc-950" data-purpose="main-footer">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
                        <div className="col-span-2 lg:col-span-1">
                            <Link className="text-xl font-bold tracking-tighter flex items-center select-none mb-6" to="/">
                                <img
                                    src="/Logo only.png?v=2"
                                    alt="FlowOps HQ"
                                    className="h-[28px] w-auto object-contain"
                                />
                                <span className="ml-2 font-sans tracking-tight">FlowOps HQ</span>
                            </Link>
                            <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                                Building the infrastructure for the next generation of reliable, secure, and observable APIs.
                            </p>
                            <div className="flex gap-4">
                                <a className="text-zinc-500 hover:text-white" href="https://github.com/aaryan-paliwal/FlowOps-HQ" aria-label="GitHub">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path></svg>
                                </a>
                                <a className="text-zinc-500 hover:text-white" href="#" aria-label="Twitter">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"></path></svg>
                                </a>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Platform</h4>
                            <ul className="space-y-3 text-sm text-zinc-500">
                                <li><a className="hover:text-white transition-colors" href="#features">API Gateway</a></li>
                                <li><a className="hover:text-white transition-colors" href="#simulator">Orchestration</a></li>
                                <li><a className="hover:text-white transition-colors" href="#logs">Analytics</a></li>
                                <li><a className="hover:text-white transition-colors" href="#features">Edge Caching</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Resources</h4>
                            <ul className="space-y-3 text-sm text-zinc-500">
                                <li><a className="hover:text-white transition-colors" href="#integration">Documentation</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Changelog</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Community</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Status</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Company</h4>
                            <ul className="space-y-3 text-sm text-zinc-500">
                                <li><a className="hover:text-white transition-colors" href="#">About Us</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Blog</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Careers</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Contact</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-bold mb-4">Legal</h4>
                            <ul className="space-y-3 text-sm text-zinc-500">
                                <li><a className="hover:text-white transition-colors" href="#">Privacy Policy</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Terms of Service</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">DPA</a></li>
                            </ul>
                        </div>
                    </div>
                    
                    <div className="pt-8 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-zinc-600">
                        <div>© 2026 FLOWOPS INC. SYSTEM_READY</div>
                        <div className="flex gap-6">
                            <span>LATENCY: 12ms</span>
                            <span>UPTIME: 99.999%</span>
                            <span>REGION: GLOBAL_EDGE</span>
                        </div>
                    </div>
                </div>
            </footer>
            {/* END: Footer */}
        </div>
    );
}
