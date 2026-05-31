import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';
import { useCurrency } from '../hooks/useCurrency';

export default function BillingUpgradePage() {
    const navigate = useNavigate();
    const [billingCycle, setBillingCycle] = useState('monthly');
    const { formatAmount, currencyCode } = useCurrency();

    // Initialize Lemon.js on mount
    useEffect(() => {
        if (window.createLemonSqueezy) {
            window.createLemonSqueezy();
        }
    }, []);

    const handleCheckout = (e) => {
        e.preventDefault();
        // For the hackathon demo, if you don't have a real link yet, we show a toast.
        // Once you create your store, you literally just paste the URL here.
        const checkoutUrl = 'https://demo.lemonsqueezy.com/checkout/buy/variant_id'; 
        
        if (window.LemonSqueezy) {
            window.LemonSqueezy.Url.Open(checkoutUrl);
            toast.success("Lemon Squeezy Checkout Overlay Triggered! (Test Mode)");
        } else {
            toast.error("Billing system loading...");
        }
    };

    return (
        <div className="text-white flex flex-col items-center px-4 sm:px-6 lg:px-8 selection:bg-white selection:text-black font-sans relative">
            <div className="max-w-[1200px] w-full mx-auto relative z-10 animate-in fade-in duration-500">
                <button 
                    onClick={() => navigate(-1)}
                    className="text-neutral-400 hover:text-white mb-10 transition-colors flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-white/5 active:scale-95"
                >
                    <Icon name="arrow_back" className="w-6 h-6" />
                </button>
                
                <div className="text-center mb-16 px-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight leading-tight py-2 max-w-3xl mx-auto drop-shadow-2xl font-sans" style={{ textWrap: 'balance' }}>
                        Infrastructure that scales with you
                    </h1>
                    <p className="text-neutral-400 font-sans text-lg">Transparent pricing for Gen AI deployments at any scale.</p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
                    
                    {/* Free Tier */}
                    <div className="bg-[#0a0a0a]/60 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col hover:border-white/10 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                        <div className="mb-6">
                            <Icon name="device_hub" className="w-8 h-8 text-neutral-400 mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-1">Hobby</h2>
                            <p className="text-neutral-450 text-sm h-5">Starter API Gateway</p>
                        </div>
                        <div className="mb-8">
                            <div className="flex items-baseline gap-1 h-[48px]">
                                <span className="text-5xl font-black text-white">{formatAmount(0)}</span>
                            </div>
                        </div>
                        <div className="mb-2">
                            <button disabled className="w-full bg-white/5 text-neutral-400 font-bold py-3.5 rounded-xl transition-colors border border-white/5 text-[14px] cursor-not-allowed flex items-center justify-center gap-2">
                                <Icon name="check" className="w-4 h-4" /> Current plan
                            </button>
                        </div>
                        <div className="h-[16px] mb-6"></div>
                        <div className="pt-6 border-t border-white/5 flex-1">
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Up to 100,000 requests / month
                                </li>
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Standard semantic caching
                                </li>
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Basic fallback routing
                                </li>
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    7-day log retention
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Pro Tier (Highlighted) */}
                    <div className="bg-[#110505]/80 backdrop-blur-2xl rounded-3xl border border-red-500/30 p-8 flex flex-col hover:border-red-500/50 transition-all relative shadow-[0_0_50px_rgba(220,38,38,0.15)] ring-1 ring-red-500/10 transform lg:-translate-y-4">
                        {/* Inner highlight line */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-400/50 to-transparent rounded-t-3xl"></div>
                        
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white font-bold text-[10px] uppercase tracking-widest py-1 px-4 rounded-full shadow-lg">
                            Most Popular
                        </div>

                        <div className="absolute top-8 right-8 flex items-center">
                            <div className="flex items-center text-[11px] font-bold bg-black/50 rounded-full p-1 border border-white/10 shadow-inner">
                                <button 
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-3 py-1.5 rounded-full transition-all ${billingCycle === 'monthly' ? 'text-white bg-white/15 shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                                >Monthly</button>
                                <button 
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${billingCycle === 'yearly' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-neutral-500 hover:text-white'}`}
                                >Yearly <span className="text-red-400 font-black">· Save 17%</span></button>
                            </div>
                        </div>

                        <div className="mb-6 mt-2">
                            <Icon name="rocket_launch" className="w-8 h-8 text-red-400 mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-1">Pro</h2>
                            <p className="text-neutral-400 text-sm h-5">Scale your AI workloads</p>
                        </div>
                        <div className="mb-8">
                            <div className="flex items-baseline gap-2 h-[48px]">
                                <span className="text-5xl font-black text-white">{formatAmount(billingCycle === 'yearly' ? 49 : 59)}</span>
                                <span className="text-[12px] text-neutral-450 leading-tight font-medium">{currencyCode} / month<br/>{billingCycle === 'yearly' ? 'billed annually' : 'billed monthly'}</span>
                            </div>
                        </div>
                        <div className="mb-2">
                            <button 
                                onClick={handleCheckout}
                                className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] text-[15px] active:scale-[0.98] cursor-pointer"
                            >
                                Upgrade to Pro
                            </button>
                        </div>
                        <div className="h-[16px] mb-6 flex items-center justify-center">
                            <span className="text-[11px] text-neutral-500 font-medium flex items-center gap-1"><Icon name="lock" className="w-3 h-3"/> Secure checkout via Lemon Squeezy</span>
                        </div>
                        <div className="pt-6 border-t border-red-500/20 flex-1">
                            <p className="text-[13px] font-bold text-white mb-5 uppercase tracking-wide">Everything in Hobby, plus:</p>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3 text-sm text-white font-medium">
                                    <Icon name="check_circle" className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                                    Up to 5,000,000 requests / month
                                </li>
                                <li className="flex items-start gap-3 text-sm text-white font-medium">
                                    <Icon name="check_circle" className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                                    Advanced Guardrails & PII Redaction
                                </li>
                                <li className="flex items-start gap-3 text-sm text-white font-medium">
                                    <Icon name="check_circle" className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                                    Priority LLM model access & routing
                                </li>
                                <li className="flex items-start gap-3 text-sm text-white font-medium">
                                    <Icon name="check_circle" className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                                    30-day analytics & custom alerts
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Enterprise Tier */}
                    <div className="bg-[#0a0a0a]/60 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col hover:border-white/10 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                        <div className="mb-6">
                            <Icon name="diamond" className="w-8 h-8 text-neutral-400 mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-1">Enterprise</h2>
                            <p className="text-neutral-450 text-sm h-5">Mission-critical AI deployments</p>
                        </div>
                        <div className="mb-8">
                            <div className="flex items-baseline gap-2 h-[48px]">
                                <span className="text-4xl font-black text-white">Custom</span>
                            </div>
                        </div>
                        <div className="mb-2">
                            <button 
                                onClick={() => navigate('/contact')}
                                className="w-full bg-[#111] hover:bg-[#1a1a1a] border border-white/10 hover:border-white/20 text-white font-bold py-3.5 rounded-xl transition-all shadow-md text-[14px] active:scale-[0.98] cursor-pointer"
                            >
                                Contact Sales
                            </button>
                        </div>
                        <p className="text-[11px] text-neutral-500 font-medium text-center mb-6 h-[16px] flex items-center justify-center">Volume discounts available</p>
                        
                        <div className="pt-6 border-t border-white/5 flex-1">
                            <p className="text-[13px] font-bold text-white mb-5 uppercase tracking-wide">Everything in Pro, plus:</p>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Unlimited monthly requests & domains
                                </li>
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Dedicated isolated gateway instances
                                </li>
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Custom SLA & 24/7 Priority Support
                                </li>
                                <li className="flex items-start gap-3 text-sm text-neutral-350 font-medium">
                                    <Icon name="check" className="w-4.5 h-4.5 text-neutral-500 shrink-0 mt-0.5" />
                                    Unlimited log retention
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <p className="text-center text-[12px] font-medium text-neutral-500 mt-12 w-full mx-auto whitespace-nowrap">
                    *Usage limits apply. Prices and plans are subject to change at FlowOps HQ's discretion. Secure checkout powered by Lemon Squeezy.
                </p>
            </div>
        </div>
    );
}
