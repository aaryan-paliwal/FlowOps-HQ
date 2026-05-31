import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../ui/Icon';
import DocsLayout from '../ui/DocsLayout';
import toast from 'react-hot-toast';

function SectionIntroduction() {
    const handleCopyPage = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Page link copied to clipboard!');
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            {/* Breadcrumb & Header Section */}
            <div className="mb-8 font-sans">
                <div className="flex items-center text-sm font-medium text-neutral-400 mb-4">
                    <span>Introduction</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <Icon name="book" className="text-[28px] text-white" />
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            What is FlowOps HQ?
                        </h1>
                    </div>
                    <button 
                        onClick={handleCopyPage}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-[13px] text-neutral-300 hover:text-white hover:bg-white/5 transition-colors self-start sm:self-auto"
                    >
                        <Icon name="content_copy" className="text-[16px]" />
                        Copy page
                        <Icon name="expand_more" className="text-[16px] ml-1" />
                    </button>
                </div>

                <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                    FlowOps HQ is a unified AI Control Plane built for modern engineering teams. As enterprises scale their AI capabilities, managing multiple LLM providers, ensuring reliability, and maintaining visibility becomes impossibly complex. FlowOps solves this by providing a high-performance routing layer, enterprise-grade observability, and a unified catalog of over 250+ AI models. 
                </p>
                <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                    Our platform empowers you to rapidly prototype, securely deploy, and precisely monitor Generative AI features in production—without getting locked into a single ecosystem.
                </p>
            </div>

            {/* Architecture Overview */}
            <div className="space-y-4 mb-12">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-4 text-white font-sans flex items-center gap-2">
                    <Icon name="architecture" className="text-[24px] text-blue-400" />
                    Platform Architecture
                </h3>
                <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-6">
                    FlowOps operates as a transparent proxy between your application and your AI providers. Our edge-optimized architecture guarantees sub-millisecond overhead while executing advanced features like semantic caching and fallback routing.
                </p>
                
                <div className="relative w-full h-[300px] rounded-2xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center p-6 mb-6">
                    {/* Placeholder for an Architecture Diagram */}
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-8 text-neutral-500">
                            <div className="p-4 border border-white/10 rounded-xl bg-white/5">Your App</div>
                            <Icon name="arrow_forward" className="text-[24px]" />
                            <div className="p-4 border border-cyan-500/30 rounded-xl bg-cyan-500/10 text-cyan-400 font-bold">FlowOps Gateway</div>
                            <Icon name="arrow_forward" className="text-[24px]" />
                            <div className="p-4 border border-white/10 rounded-xl bg-white/5">LLM Providers</div>
                        </div>
                        <p className="text-sm font-mono text-neutral-600 mt-4">Low Latency • High Availability • Total Control</p>
                    </div>
                </div>
            </div>

            {/* Documentation Index */}
            <div className="space-y-4 mb-10">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-white font-sans flex items-center gap-2">
                    <Icon name="list_alt" className="text-[24px] text-yellow-400" />
                    Documentation Index
                </h3>
                <p className="text-[16px] text-neutral-400 leading-relaxed font-sans">
                    Fetch the complete API specification at: <a href="#" className="text-cyan-400 hover:underline">https://docs.flowopshq.com/api/v1/openapi.json</a>
                </p>
                <p className="text-[16px] text-neutral-400 leading-relaxed font-sans">
                    Use our OpenAPI spec to instantly generate client libraries in your preferred language.
                </p>
            </div>
        </div>
    );
}

function SectionFirstRequest() {
    const [activeTab, setActiveTab] = useState('Python');
    
    const handleCopyCode = () => {
        toast.success('Code copied!');
    };

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <div className="mb-8 font-sans">
                <div className="flex items-center text-sm font-medium text-neutral-400 mb-4">
                    <span>Introduction</span>
                    <Icon name="chevron_right" className="text-[16px] mx-1" />
                    <span className="text-white">Make Your First Request</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-6">Make Your First Request</h1>
                <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                    FlowOps HQ is designed to be a drop-in replacement for your existing OpenAI or Anthropic SDKs. By simply changing the base URL and adding our SDK, you gain instant access to our entire suite of gateway features.
                </p>
            </div>

            <div className="space-y-6 mb-12">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-white font-sans flex items-center gap-2">
                    <Icon name="code" className="text-[24px] text-blue-400" />
                    Integrate in 3 Lines of Code
                </h3>

                <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0A0A0A]">
                    {/* Tabs */}
                    <div className="flex items-center gap-6 px-4 border-b border-white/5 bg-[#111] overflow-x-auto text-[13px] font-medium custom-scrollbar">
                        {['Python', 'NodeJS', 'REST API'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-3 px-1 whitespace-nowrap transition-colors relative ${activeTab === tab ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500"></div>
                                )}
                            </button>
                        ))}
                    </div>
                    {/* Code Editor Area */}
                    <div className="relative p-4 font-mono text-[13px] leading-loose text-neutral-300 overflow-x-auto">
                        <button onClick={handleCopyCode} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded border border-white/5">
                            <Icon name="content_copy" className="text-[16px]" />
                        </button>
                        {activeTab === 'Python' && (
<pre>
<span className="text-purple-400">from</span> flowops <span className="text-purple-400">import</span> FlowOps{'\n\n'}
client = FlowOps({'\n'}
    api_key=<span className="text-green-400">"YOUR_FLOWOPS_API_KEY"</span>,{'\n'}
    provider=<span className="text-green-400">"openai"</span>{'\n'}
){'\n\n'}
response = client.chat.completions.create({'\n'}
    model=<span className="text-green-400">"gpt-4"</span>,{'\n'}
    messages=[{'\n'}
        {'{'}<span className="text-cyan-300">"role"</span>: <span className="text-green-400">"system"</span>, <span className="text-cyan-300">"content"</span>: <span className="text-green-400">"You are a helpful assistant."</span>{'}'},{'\n'}
        {'{'}<span className="text-cyan-300">"role"</span>: <span className="text-green-400">"user"</span>, <span className="text-cyan-300">"content"</span>: <span className="text-green-400">"Hello!"</span>{'}'}{'\n'}
    ]{'\n'}
){'\n'}
<span className="text-yellow-200">print</span>(response.choices[<span className="text-orange-400">0</span>].message.content)
</pre>
                        )}
                        {activeTab !== 'Python' && (
                            <pre className="text-neutral-500">
// Example code for {activeTab} is currently being updated.
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionFeatures() {
    const features = [
        { title: "Semantic Caching", desc: "Cache responses based on semantic meaning to reduce latency and costs by up to 90%.", icon: "memory" },
        { title: "Smart Fallbacks", desc: "Automatically route traffic to backup models (e.g., GPT-4 -> Claude 3) when an outage occurs.", icon: "call_split" },
        { title: "Load Balancing", desc: "Distribute your traffic across multiple API keys to bypass rate limits.", icon: "balance" },
        { title: "Prompt Management", desc: "Version control and deploy your prompts without changing code.", icon: "text_snippet" },
    ];

    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">FlowOps Features</h1>
            <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                Explore the powerful built-in features that make FlowOps the ultimate control plane for AI teams.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {features.map(f => (
                    <div key={f.title} className="p-6 border border-white/10 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                        <Icon name={f.icon} className="text-[32px] text-cyan-400 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SectionObservability() {
    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">Observability</h1>
            <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                Gain unprecedented insight into your AI traffic. FlowOps automatically logs every request, response, token count, latency, and cost across all your providers in one unified dashboard.
            </p>
            <div className="space-y-6">
                <div className="p-6 border border-white/10 bg-black/40 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-2">Cost Tracking</h3>
                    <p className="text-sm text-neutral-400 mb-4">Track spend at the user, workspace, and prompt level.</p>
                </div>
                <div className="p-6 border border-white/10 bg-black/40 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-2">Latency Metrics</h3>
                    <p className="text-sm text-neutral-400 mb-4">Identify bottlenecks with P95 and P99 latency charts.</p>
                </div>
            </div>
        </div>
    );
}

function SectionAIGateway() {
    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">AI Gateway</h1>
            <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                The FlowOps AI Gateway is a lightning-fast reverse proxy that intercepts your AI requests to apply middleware like rate-limiting, caching, and PII redaction securely at the edge.
            </p>
        </div>
    );
}

function SectionModelCatalog() {
    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">Model Catalog</h1>
            <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                FlowOps supports over 250+ foundation models out of the box. Use our unified API format to seamlessly switch between OpenAI, Anthropic, Google Gemini, Meta Llama, and more.
            </p>
        </div>
    );
}

function SectionMCPGateway() {
    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">MCP Gateway</h1>
            <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                Deploy and manage Model Context Protocol (MCP) servers securely. Expose local or cloud tools to your agents through our zero-trust proxy layer.
            </p>
        </div>
    );
}

function SectionAgentGateway() {
    return (
        <div className="max-w-7xl mx-auto animate-in fade-in duration-200">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-6">Agent Gateway</h1>
            <p className="text-[16px] text-neutral-400 leading-relaxed font-sans mb-8">
                Govern your autonomous agents. Set guardrails, monitor infinite loops, and enforce human-in-the-loop approvals before sensitive actions are executed by your AI agents.
            </p>
        </div>
    );
}

export default function DocsPage() {
    const { sectionId } = useParams();

    const renderSection = () => {
        switch(sectionId) {
            case 'introduction':
                return <SectionIntroduction />;
            case 'first-request':
                return <SectionFirstRequest />;
            case 'features':
                return <SectionFeatures />;
            case 'observability':
                return <SectionObservability />;
            case 'ai-gateway':
                return <SectionAIGateway />;
            case 'model-catalog':
                return <SectionModelCatalog />;
            case 'mcp-gateway':
                return <SectionMCPGateway />;
            case 'agent-gateway':
                return <SectionAgentGateway />;
            default:
                return (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold text-white mb-2">Section Not Found</h2>
                        <p className="text-neutral-400">The documentation page you are looking for does not exist or is under construction.</p>
                    </div>
                );
        }
    };

    return (
        <DocsLayout>
            {renderSection()}
        </DocsLayout>
    );
}
