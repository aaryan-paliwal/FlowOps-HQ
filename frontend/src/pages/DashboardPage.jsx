import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { useAuthStore } from '../state/authStore';
import { useOrgStore } from '../state/orgStore';
import { apiKeysService, apisService } from '../services/api';


const GithubIcon = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
);

export default function DashboardPage() {
    const { user } = useAuthStore();
    const { activeOrgId, organisations } = useOrgStore();
    const activeOrg = organisations.find(o => o.id === activeOrgId) || organisations[0];
    const queryClient = useQueryClient();

    // API Key states
    const [showKey, setShowKey] = useState(false);

    // Fetch keys & APIs
    const { data: keysResponse } = useQuery({
        queryKey: ['apiKeys'],
        queryFn: () => apiKeysService.listKeys()
    });
    const keysList = keysResponse?.data?.keys || [];
    const activeKey = keysList.find(k => !k.revoked);
    const activeKeyPrefix = activeKey ? activeKey.keyPrefix : 'sk_live_mock_key_prefix_only';
    const displayedKey = showKey ? activeKeyPrefix : `${activeKeyPrefix.substring(0, 16)}************************`;

    const { data: apisResponse } = useQuery({
        queryKey: ['apis'],
        queryFn: () => apisService.listApis()
    });
    const apisList = apisResponse?.data?.apis || [];

    // Step states
    const [selectedProvider, setSelectedProvider] = useState('Select new AI provider to integrate');
    const [integrationLang, setIntegrationLang] = useState('NodeJS');
    const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

    // Quick Integration States
    const [isIntegrateOpen, setIsIntegrateOpen] = useState(false);
    const [integratingProvider, setIntegratingProvider] = useState('');
    const [quickCreatedKey, setQuickCreatedKey] = useState(null);

    const [providerBaseUrls] = useState({
        'OpenAI': 'https://api.openai.com',
        'Anthropic': 'https://api.anthropic.com',
        'Azure OpenAI': 'https://azure.openai.com',
        'Google Gemini': 'https://generativelanguage.googleapis.com'
    });

    const createApiMutation = useMutation({
        mutationFn: (payload) => apisService.createApi(payload),
        onSuccess: (apiRes) => {
            const api = apiRes.data.api;
            // Now generate key for this new API context
            createKeyMutation.mutate({
                apiId: api.id,
                name: `${integratingProvider} Quickstart Key`
            });
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to register gateway route.');
            setIsIntegrateOpen(false);
        }
    });

    const createKeyMutation = useMutation({
        mutationFn: (payload) => apiKeysService.createKey(payload),
        onSuccess: (keyRes) => {
            setQuickCreatedKey(keyRes.data);
            queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
            queryClient.invalidateQueries({ queryKey: ['apis'] });
            toast.success(`${integratingProvider} integration registered successfully!`);
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to generate quickstart access token.');
            setIsIntegrateOpen(false);
        }
    });

    const handleQuickIntegrate = (provider) => {
        setIntegratingProvider(provider);
        setQuickCreatedKey(null);
        setIsIntegrateOpen(true);
    };

    const confirmQuickIntegrate = () => {
        const slug = integratingProvider.toLowerCase().replace(/\s+/g, '-');

        // Check if an API with this slug already exists
        const exists = apisList.find(a => a.slug === slug);
        if (exists) {
            // Just create a key for the existing API
            createKeyMutation.mutate({
                apiId: exists.id,
                name: `${integratingProvider} Quickstart Key`
            });
        } else {
            // Create a new API first
            createApiMutation.mutate({
                name: `${integratingProvider} Gateway`,
                slug,
                baseUrl: providerBaseUrls[integratingProvider] || 'https://api.openai.com'
            });
        }
    };

    // Clipboard handlers
    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    // Code snippets
    const codeSnippets = {
        NodeJS: `import { FlowOpsClient } from "flowops";

const client = new FlowOpsClient({
  apiKey: "${displayedKey}"
});

// Route traffic through FlowOps HQ Edge
const response = await client.chat.completions.create({
  model: "${selectedModel}",
  messages: [{
    role: "user",
    content: "Hello FlowOps HQ!"
  }]
});`,
        Python: `from flowops import FlowOpsClient

client = FlowOpsClient(api_key="${displayedKey}")

# Route traffic through FlowOps HQ Edge
response = client.chat.completions.create(
  model="${selectedModel}",
  messages=[{
    "role": "user", 
    "content": "Hello FlowOps HQ!"
  }]
)`,
        Curl: `curl -X POST http://localhost:5000/gateway/v1/chat/completions \\
  -H "Authorization: Bearer ${displayedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [{"role": "user", "content": "Hello FlowOps HQ!"}]
  }'`
    };

    return (
        <div className="space-y-12">

            {/* Premium Welcome Header */}
            <div className="relative bg-gradient-to-br from-[#12141a] via-[#0a0a0a] to-[#0c0c0c] border border-white/5 rounded-2xl p-8 sm:p-12 flex flex-col md:flex-row justify-between items-start md:items-center shadow-2xl overflow-hidden gap-6">
                <div className="relative z-10 flex-grow pr-0 md:pr-8">
                    <div className="mb-4 font-sans">
                        <div className="flex items-center gap-3 mb-1">
                            <Icon name="rocket_launch" className="w-7 h-7 text-white/40" />
                            <h1 className="text-3xl font-bold tracking-tight text-white">
                                Getting Started
                            </h1>
                        </div>
                        <p className="text-[15px] text-neutral-400 max-w-lg leading-relaxed mt-2">
                            Hi {user?.name || 'Developer'}, welcome to <span className="text-white font-bold">{activeOrg?.name}</span>! Take your Gen AI apps to production <span className="text-white italic font-semibold">confidently</span> in just a few steps.
                        </p>
                    </div>

                    <div className="flex gap-4 mb-8">
                        <div className="bg-black/40 border border-white/5 px-4 py-2.5 rounded-xl shadow-inner backdrop-blur-sm">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">Use Case</span>
                            <span className="text-[13px] text-white font-semibold">{activeOrg?.useCase}</span>
                        </div>
                        <div className="bg-black/40 border border-white/5 px-4 py-2.5 rounded-xl shadow-inner backdrop-blur-sm">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">Environment</span>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${activeOrg?.environment === 'Production' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`}></div>
                                <span className="text-[13px] text-white font-semibold">{activeOrg?.environment}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-5 text-[12.5px] font-bold text-neutral-400">
                        <a className="flex items-center gap-2 hover:text-white transition-colors" href="/docs/introduction" target="_blank" rel="noreferrer">
                            <Icon name="book" className="w-4 h-4" />
                            Developer Docs
                        </a>
                        <a className="flex items-center gap-2 hover:text-white transition-colors" href="https://github.com/aaryan-paliwal/FlowOps-HQ" target="_blank" rel="noreferrer">
                            <GithubIcon className="w-4 h-4" />
                            View GitHub
                        </a>
                    </div>
                </div>

                {/* Video Preview with Polish */}
                <div className="relative z-10 shrink-0 self-center md:self-auto">
                    <div className="w-64 h-36 sm:w-72 sm:h-40 rounded-xl overflow-hidden border border-white/10 group cursor-pointer relative shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <img
                            alt="Demo Thumbnail"
                            className="w-full h-full object-cover grayscale opacity-40 group-hover:opacity-60 transition-all duration-500 scale-105 group-hover:scale-100"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAz-X3Qg9aXtictOTGjdDmLAl_GNI5lLUciGzsIdfPwIxjbg51GG4lDYbXRTCzZkBzlsDcZt9yRDKHRX0QCCAtGjILyCx_MxB_ihjKiA5BmPjuJgxe5tlqnLLbQmA4yKLVY9WWcUQuulxW-X-w0JUxRXiK6cHj5ar_rk1oUmFHlZ-iJI5UYRJK1vc6SGwPXYgf7dGR_5bgXjh6aAJL2tTfSIUnwL2_rtik61DXpK565nKsfQFLYaQeCNVx3jjp1dLi_aap1U1wiFCY"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] group-hover:bg-black/20 transition-all duration-300">
                            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                                <Icon name="play_arrow" className="w-5 h-5 text-white fill-white stroke-none translate-x-[1.5px]" />
                            </div>
                            <span className="text-white font-bold text-[9px] tracking-[0.2em] uppercase mt-2.5 opacity-80 font-mono">Product Demo</span>
                        </div>
                    </div>
                </div>

                {/* Subtle Gradient Glow */}
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/5 blur-[80px] rounded-full pointer-events-none"></div>
            </div>

            {/* Setup Steps Section */}
            <div className="space-y-10 relative">

                {/* Step 1: Setup Environment */}
                <div className="relative pl-14 sm:pl-16 border-l border-white/5 pb-10">
                    {/* Circle Indicator */}
                    <div className="absolute left-0 top-0 -translate-x-[20px] w-10 h-10 rounded-full border border-white/10 bg-[#0A0A0A] flex items-center justify-center shrink-0 shadow-inner z-10">
                        <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                    </div>

                    <div className="pt-1">
                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-white font-sans">Setup your environment</h3>
                        <p className="text-neutral-400 text-[14px] sm:text-[15px] mb-5 font-sans">Get your FlowOps HQ API key & create a new LLM integration</p>

                        <div className="bg-[#111111]/40 border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                            {/* API Key Part */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Icon name="check_circle" className="w-5 h-5 text-emerald-500 fill-emerald-500/20" />
                                    <h4 className="font-bold text-[13.5px] text-white font-sans">Your FlowOps HQ API key is ready to use</h4>
                                </div>
                                <p className="text-[12.5px] text-neutral-450 font-sans">Use this to authenticate all your requests to FlowOps HQ</p>

                                <div className="flex items-center gap-3 bg-black/60 border border-white/10 rounded-lg px-4 py-3 font-mono text-[13px] group hover:border-white/20 transition-colors shadow-inner">
                                    <span className="flex-grow text-neutral-450 tracking-wider">
                                        {displayedKey}
                                    </span>
                                    <div className="flex items-center gap-3 text-neutral-500">
                                        <button
                                            onClick={() => setShowKey(!showKey)}
                                            className="hover:text-white transition-colors cursor-pointer"
                                        >
                                            {showKey ? <Icon name="visibility_off" className="w-4.5 h-4.5" /> : <Icon name="visibility" className="w-4.5 h-4.5" />}
                                        </button>
                                        <button
                                            onClick={() => copyToClipboard(activeKeyPrefix, 'API Key')}
                                            className="hover:text-white transition-colors cursor-pointer"
                                        >
                                            <Icon name="content_copy" className="w-4.5 h-4.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-white/5" />

                            {/* LLM Connect Part */}
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-bold text-[13.5px] text-white font-sans mb-1">Securely connect to your LLM</h4>
                                    <p className="text-[12.5px] text-neutral-450 font-sans leading-relaxed">
                                        We encrypt your original API keys and generate <span className="underline underline-offset-4 decoration-white/10 cursor-help hover:text-white transition-colors font-medium">disposable keys</span>
                                    </p>
                                </div>
                                <div className="relative group">
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => {
                                            const provider = e.target.value;
                                            if (provider !== 'Select new AI provider to integrate') {
                                                handleQuickIntegrate(provider);
                                                setSelectedProvider('Select new AI provider to integrate');
                                            }
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 appearance-none text-neutral-400 text-[13px] focus:ring-1 focus:ring-white/20 focus:border-white/30 cursor-pointer transition-all hover:bg-black/60 font-sans"
                                    >
                                        <option value="Select new AI provider to integrate">Select new AI provider to integrate</option>
                                        <option value="OpenAI">OpenAI</option>
                                        <option value="Anthropic">Anthropic</option>
                                        <option value="Azure OpenAI">Azure OpenAI</option>
                                        <option value="Google Gemini">Google Gemini</option>
                                    </select>
                                    <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/60 transition-colors w-4.5 h-4.5" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 2: Integrate FlowOps HQ */}
                <div className="relative pl-14 sm:pl-16">
                    {/* Circle Indicator */}
                    <div className="absolute left-0 top-0 -translate-x-[20px] w-10 h-10 rounded-full border border-white/10 bg-[#0A0A0A] flex items-center justify-center shrink-0 shadow-inner z-10">
                        <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                    </div>

                    <div className="pt-1">
                        <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-white font-sans">Integrate FlowOps HQ</h3>
                        <p className="text-neutral-400 text-[14px] sm:text-[15px] mb-5 font-sans">Choose a framework to integrate FlowOps HQ with. Then, make a test request from your AI app.</p>

                        <div className="bg-[#111111]/40 border border-white/5 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
                                    <span className="text-white/60 font-medium text-[12.5px] font-sans">Listening for requests from your app...</span>
                                </div>
                                <a className="text-[12px] flex items-center gap-1.5 text-neutral-450 hover:text-white transition-colors font-bold font-sans" href="#/help">
                                    Need Help? <Icon name="help" className="w-4 h-4" />
                                </a>
                            </div>

                            {/* Options Selectors */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative group">
                                    <select
                                        value={integrationLang}
                                        onChange={(e) => setIntegrationLang(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 appearance-none text-white text-[13px] hover:border-white/20 focus:border-white/30 focus:outline-none transition-all font-sans cursor-pointer"
                                    >
                                        <option value="NodeJS">NodeJS</option>
                                        <option value="Python">Python</option>
                                        <option value="Curl">Curl</option>
                                    </select>
                                    <Icon name="expand_more" className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 w-4 h-4" />
                                </div>
                                <div className="relative group">
                                    <select
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 appearance-none text-white text-[13px] hover:border-white/20 focus:border-white/30 focus:outline-none transition-all font-sans cursor-pointer"
                                    >
                                        <option value="gpt-4o">gpt-4o</option>
                                        <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                                        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                    </select>
                                    <Icon name="expand_more" className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 w-4 h-4" />
                                </div>
                            </div>

                            {/* Code Snippet Box */}
                            <div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden font-mono shadow-inner group relative">
                                <div className="flex justify-between items-center px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-wider">{integrationLang} Snippet</span>
                                    <button
                                        onClick={() => copyToClipboard(codeSnippets[integrationLang], 'Integration code')}
                                        className="text-neutral-500 hover:text-white p-1 hover:bg-white/5 rounded transition-all cursor-pointer"
                                    >
                                        <Icon name="content_copy" className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <pre className="p-5 text-[12.5px] leading-relaxed text-neutral-300 overflow-x-auto whitespace-pre-wrap font-mono">
                                    <code>{codeSnippets[integrationLang]}</code>
                                </pre>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button className="text-[12.5px] text-neutral-500 hover:text-white transition-colors cursor-pointer font-bold font-sans">
                                    Skip this step
                                </button>
                            </div>

                            {/* Help Banner */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex gap-4 items-start hover:border-white/10 transition-colors">
                                <Icon name="help" className="w-5 h-5 text-neutral-500 shrink-0 mt-0.5" />
                                <p className="text-[13px] text-neutral-405 leading-relaxed font-sans">
                                    Having trouble? Check out our documentation for help with a specific integration.
                                    <a className="text-white hover:underline ml-1 font-semibold flex-inline items-center gap-0.5 inline-flex" href="#/docs">
                                        View Docs <Icon name="open_in_new" className="w-3 h-3" />
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Quick Integration Dialog Modal */}
            {isIntegrateOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111111] border border-white/5 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black">
                                    <Icon name="auto_awesome" className="w-4 h-4 text-black" />
                                </div>
                                <h3 className="font-bold text-[16px] text-white font-sans">Connect {integratingProvider}</h3>
                            </div>
                            <button
                                onClick={() => setIsIntegrateOpen(false)}
                                className="text-neutral-400 hover:text-white transition-colors rounded p-1 hover:bg-white/5 cursor-pointer"
                            >
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>

                        {!quickCreatedKey ? (
                            <div className="p-6 space-y-4 font-sans text-[13px] text-neutral-350">
                                <p className="leading-relaxed">
                                    FlowOps HQ will instantly register a live gateway route context and generate a fresh API key for your <strong>{integratingProvider}</strong> apps.
                                </p>
                                <div className="p-4 rounded-lg bg-white/2 border border-white/5 space-y-2.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">Gateway Context Route</span>
                                        <span className="font-mono text-cyan-400">/gateway/v1/chat/completions</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">Target Upstream URL</span>
                                        <span className="font-mono text-neutral-400 text-xs">{providerBaseUrls[integratingProvider]}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsIntegrateOpen(false)}
                                        className="px-4 py-2 border border-white/5 rounded bg-white/5 hover:bg-white/10 font-sans font-bold text-[12px] text-white transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmQuickIntegrate}
                                        disabled={createApiMutation.isPending || createKeyMutation.isPending}
                                        className="px-5 py-2 bg-white text-black hover:bg-neutral-200 rounded font-sans font-bold text-[12px] transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                    >
                                        {(createApiMutation.isPending || createKeyMutation.isPending) && <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin" />}
                                        Activate Route & Key
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-6 space-y-5">
                                <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-4 flex gap-3 text-amber-400">
                                    <Icon name="warning" className="w-5 h-5 text-amber-550 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-[12px] font-sans">Secure Key Storage Warning</h4>
                                        <p className="text-[11px] font-sans leading-relaxed text-amber-300">
                                            For security compliance, we do not store this private token key in plaintext. <strong>You will not be able to retrieve or view it again after closing this window.</strong> Please copy it immediately to a password manager or your local environment secrets.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide font-sans">Your Raw Gateway Token</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-black rounded border border-white/5 px-4 py-3 flex items-center justify-between text-white font-mono text-[12px]">
                                            <span className="truncate pr-4">{quickCreatedKey.rawKey}</span>
                                            <button
                                                onClick={() => copyToClipboard(quickCreatedKey.rawKey, 'modal')}
                                                className="text-neutral-400 hover:text-white transition-colors cursor-pointer shrink-0"
                                            >
                                                <Icon name="content_copy" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5 border-t border-white/5 pt-4 font-sans text-[11px] text-neutral-400">
                                    <div className="flex items-center gap-1.5 font-semibold text-neutral-350 mb-1">
                                        <Icon name="terminal" className="w-3.5 h-3.5 text-neutral-500" />
                                        Example cURL program usage:
                                    </div>
                                    <pre className="bg-black border border-white/5 rounded p-3 overflow-x-auto font-mono text-[10px] text-neutral-350 leading-relaxed">
                                        {`curl -X POST http://localhost:5000/gateway/v1/chat/completions \\
  -H "Authorization: Bearer ${quickCreatedKey.rawKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel}",
    "messages": [{"role": "user", "content": "Hello FlowOps HQ!"}]
  }'`}
                                    </pre>
                                </div>

                                <div className="pt-4 border-t border-white/5 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsIntegrateOpen(false)}
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
