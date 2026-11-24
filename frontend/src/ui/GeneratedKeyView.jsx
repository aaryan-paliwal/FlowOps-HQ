import { useState } from 'react';
import { toast } from 'react-hot-toast';
import Icon from './Icon';

/**
 * Google AI Studio-inspired modal body for displaying a newly generated API key once,
 * alongside a prominent primary "Copy API Key" action and readable copyable code snippets.
 */
export function GeneratedKeyView({
    rawKey,
    keyName,
    routeName,
    defaultModel = 'flowops-smart',
    onClose,
}) {
    const [isKeyVisible, setIsKeyVisible] = useState(true);
    const [copiedTarget, setCopiedTarget] = useState(null); // 'key' | 'code' | null
    const [activeTab, setActiveTab] = useState('openai');

    const gatewayBaseUrl = 'http://localhost:5000/v1';
    const chatEndpoint = `${gatewayBaseUrl}/chat/completions`;

    const snippets = {
        openai: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${gatewayBaseUrl}",
  apiKey: "${rawKey}",
});

const response = await client.chat.completions.create({
  model: "${defaultModel}",
  max_tokens: 300,
  messages: [{ role: "user", content: "Hello FlowOps HQ!" }],
});

console.log(response.choices[0].message.content);`,

        powershell: `curl.exe -i -X POST "${chatEndpoint}" \`
  -H "Content-Type: application/json" \`
  -H "Authorization: Bearer ${rawKey}" \`
  -d '{"model":"${defaultModel}","max_tokens":300,"messages":[{"role":"user","content":"Hello FlowOps HQ!"}]}'`,

        bash: `curl -i -X POST ${chatEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${rawKey}" \\
  -d '{
    "model": "${defaultModel}",
    "max_tokens": 300,
    "messages": [{"role": "user", "content": "Hello FlowOps HQ!"}]
  }'`,

        byok: `curl -i -X POST ${chatEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${rawKey}" \\
  -H "x-gemini-key: YOUR_UPSTREAM_GEMINI_KEY" \\
  -d '{
    "model": "${defaultModel}",
    "max_tokens": 300,
    "messages": [{"role": "user", "content": "Hello FlowOps HQ!"}]
  }'`,
    };

    const tabs = [
        { id: 'openai', label: 'OpenAI SDK' },
        { id: 'powershell', label: 'cURL (PowerShell)' },
        { id: 'bash', label: 'cURL (Bash)' },
        { id: 'byok', label: 'BYOK Header' },
    ];

    const copyText = async (text, target, successMsg) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedTarget(target);
            toast.success(successMsg);
            setTimeout(() => {
                setCopiedTarget((prev) => (prev === target ? null : prev));
            }, 2000);
        } catch {
            toast.error('Clipboard permission denied. Please select and copy manually.');
        }
    };

    const maskedDisplay = rawKey
        ? `${rawKey.slice(0, 12)}${'•'.repeat(Math.max(12, rawKey.length - 16))}${rawKey.slice(-4)}`
        : '';

    return (
        <div className="p-6 space-y-5 overflow-y-auto">
            {/* Key Context Metadata Row */}
            {(keyName || routeName) && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold font-sans">
                            <Icon name="check_circle" className="w-3.5 h-3.5 text-emerald-400" />
                            Key active immediately
                        </span>
                        {keyName && (
                            <span className="text-[12.5px] font-semibold text-white font-sans">
                                {keyName}
                            </span>
                        )}
                    </div>
                    {routeName && (
                        <span className="text-[11.5px] font-mono text-neutral-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                            Route: {routeName}
                        </span>
                    )}
                </div>
            )}

            {/* Security Storage Warning Banner */}
            <div className="bg-red-950/30 border border-red-500/35 rounded-xl p-4 flex items-start gap-3 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                <Icon name="warning" className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="font-bold text-[13px] font-sans text-red-300">
                        Secure Key Storage Warning
                    </p>
                    <p className="text-[12.5px] font-sans leading-relaxed text-red-100/90">
                        For security compliance, we do not store this private token key in plaintext.{' '}
                        <strong className="font-bold text-white">
                            You will not be able to retrieve or view it again after closing this window.
                        </strong>{' '}
                        Please copy it immediately to a password manager or your local environment secrets.
                    </p>
                </div>
            </div>

            {/* Primary API Key Field & Copy Action (Google AI Studio style) */}
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <label className="text-[11.5px] font-bold text-neutral-300 uppercase tracking-wider font-sans">
                        Your API Key
                    </label>
                    <span className="text-[11.5px] font-sans text-neutral-400">
                        Shown once · Use as Bearer token
                    </span>
                </div>

                <div className="bg-[#060507] border border-[rgba(153,27,27,0.3)] rounded-xl p-2 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-2 bg-black/60 border border-[rgba(153,27,27,0.2)] rounded-lg px-3 py-2.5">
                        <Icon name="key" className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="flex-1 min-w-0 font-mono text-[13px] text-white overflow-x-auto whitespace-nowrap select-all">
                            {isKeyVisible ? rawKey : maskedDisplay}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsKeyVisible((v) => !v)}
                            className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                            title={isKeyVisible ? 'Hide API key' : 'Show API key'}
                            aria-label={isKeyVisible ? 'Hide API key' : 'Show API key'}
                        >
                            <Icon name={isKeyVisible ? 'visibility_off' : 'visibility'} className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => copyText(rawKey, 'key', 'API key copied to clipboard!')}
                        className={`px-4 py-2.5 rounded-lg font-sans font-bold text-[12.5px] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm hover:scale-[1.02] ${
                            copiedTarget === 'key'
                                ? 'bg-cyan-500 text-black shadow-[0_0_12px_#06b6d4]'
                                : 'bg-cyan-400 text-black hover:bg-cyan-300'
                        }`}
                    >
                        <Icon
                            name={copiedTarget === 'key' ? 'check' : 'content_copy'}
                            className="w-4 h-4"
                        />
                        {copiedTarget === 'key' ? 'Copied Key' : 'Copy API Key'}
                    </button>
                </div>
            </div>

            {/* Quickstart Code Snippet Card with Tabs & Copy Code Button */}
            <div className="space-y-2 border-t border-[rgba(153,27,27,0.2)] pt-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold text-neutral-200 font-sans">
                        <Icon name="terminal" className="w-4 h-4 text-cyan-400" />
                        <span>Quickstart Code</span>
                    </div>
                    <span className="text-[11.5px] font-mono text-neutral-400">
                        Base URL: {gatewayBaseUrl}
                    </span>
                </div>

                <div className="bg-[#060507] border border-[rgba(153,27,27,0.3)] rounded-xl overflow-hidden">
                    <div className="px-3 py-2 bg-[#08060a] border-b border-[rgba(153,27,27,0.2)] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-2.5 py-1 rounded-md text-[11.5px] font-sans font-semibold transition-colors cursor-pointer ${
                                        activeTab === tab.id
                                            ? 'bg-white/15 text-white border border-white/15'
                                            : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                copyText(snippets[activeTab], 'code', 'Code snippet copied to clipboard!')
                            }
                            className={`px-3 py-1.5 rounded-md border text-[12px] font-sans font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                                copiedTarget === 'code'
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
                            }`}
                        >
                            <Icon
                                name={copiedTarget === 'code' ? 'check' : 'content_copy'}
                                className="w-3.5 h-3.5"
                            />
                            {copiedTarget === 'code' ? 'Copied Code' : 'Copy Code'}
                        </button>
                    </div>

                    <pre className="p-4 overflow-x-auto font-mono text-[12.5px] leading-6 text-neutral-100 select-all">
                        {snippets[activeTab]}
                    </pre>
                </div>
            </div>

            {/* Footer Action */}
            <div className="pt-2 border-t border-[rgba(153,27,27,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[11.5px] font-sans text-neutral-400">
                    Need to test multiple customer providers? Pass <code className="font-mono text-cyan-400">x-openai-key</code>, <code className="font-mono text-cyan-400">x-gemini-key</code>, or <code className="font-mono text-cyan-400">x-custom-key</code> headers.
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.35)] rounded-lg font-sans font-bold text-[12.5px] transition-all hover:scale-[1.02] cursor-pointer shrink-0"
                >
                    I Have Safely Stored This Key
                </button>
            </div>
        </div>
    );
}

