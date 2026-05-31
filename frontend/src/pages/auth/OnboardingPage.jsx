import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../../ui/Icon';
import { useAuthStore } from '../../state/authStore';

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user, setAuth, token } = useAuthStore();
    const [orgName, setOrgName] = useState('');
    const [allowDomainJoin, setAllowDomainJoin] = useState(false);
    const [selectedUseCases, setSelectedUseCases] = useState([]);

    const useCases = [
        { id: 'costs', label: 'Track LLM costs' },
        { id: 'routing', label: 'Route between multiple LLMs' },
        { id: 'cache', label: 'Cache requests' },
        { id: 'fallbacks', label: 'Set up fallbacks / loadbalancing' },
        { id: 'guardrails', label: 'Enforce guardrails' },
        { id: 'prompts', label: 'Build prompt templates' }
    ];

    const toggleUseCase = (id) => {
        setSelectedUseCases(prev => 
            prev.includes(id) 
                ? prev.filter(item => item !== id) 
                : [...prev, id]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!orgName.trim()) {
            return toast.error("Please enter your organization's name.");
        }
        if (selectedUseCases.length === 0) {
            return toast.error("Please select at least one way you look to use FlowOps HQ.");
        }

        // Save organization and setup info locally
        const onboardingData = {
            orgName,
            allowDomainJoin,
            selectedUseCases,
            completedAt: new Date().toISOString()
        };
        localStorage.setItem(`flowops_onboarding_${user?.id || 'default'}`, JSON.stringify(onboardingData));

        // Update company name in local state if possible to enhance user feel
        if (user) {
            const updatedUser = { ...user, company: orgName };
            setAuth(token, updatedUser);
        }

        // Clear the registration redirection flag
        sessionStorage.removeItem('just_registered');

        toast.success("Welcome to FlowOps HQ! Let's get building.");
        navigate('/dashboard');
    };

    return (
        <div 
            className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 selection:bg-white selection:text-black font-sans py-12 relative overflow-hidden"
            style={{
                backgroundImage: 'radial-gradient(circle at center, #171513 0%, #0A0A0A 100%)'
            }}
        >
            {/* Ambient Background Blur */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neutral-800/10 rounded-full blur-[120px] pointer-events-none select-none"></div>

            <div className="max-w-[620px] w-full flex flex-col items-center relative z-10">
                {/* FlowOps HQ Miniature Icon */}
                <div className="flex items-center justify-center mb-6 relative group cursor-pointer select-none">
                    <img 
                        src="/Logo only.png?v=2" 
                        alt="FlowOps Logo" 
                        className="h-10 w-auto object-contain rounded-lg"
                    />
                </div>

                <div className="text-center mb-8">
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                        Get started on FlowOps HQ!
                    </h2>
                    <p className="text-[14px] sm:text-[15px] text-neutral-450 font-medium">
                        Lets setup your organisation
                    </p>
                </div>

                {/* Onboarding Form Card */}
                <form onSubmit={handleSubmit} className="w-full space-y-7">
                    
                    {/* Organization Name Input */}
                    <div>
                        <input
                            type="text"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            placeholder="Type your awesome organisation's name here..."
                            className="block w-full rounded-lg border border-white/10 bg-[#111111]/80 px-4 py-3.5 text-white placeholder-neutral-500 focus:border-white/30 focus:bg-[#151515] focus:outline-none focus:ring-1 focus:ring-white/20 text-[14px] font-sans transition-all duration-200 shadow-inner"
                        />
                    </div>

                    {/* Domain Joining Toggle Switch */}
                    <div className="flex items-center justify-between p-4 bg-[#111111]/40 border border-white/5 rounded-xl hover:border-white/10 transition-all duration-250">
                        <div className="flex flex-col pr-4">
                            <span className="text-[13.5px] font-bold text-neutral-200 leading-normal">
                                Allow users with same domain to join your organisation.
                            </span>
                            <span className="text-[11.5px] text-neutral-550 mt-0.5 leading-normal">
                                Users with similar emails will be able to join your org automatically.
                            </span>
                        </div>
                        
                        {/* Custom Animated Toggle Switch */}
                        <button
                            type="button"
                            onClick={() => setAllowDomainJoin(!allowDomainJoin)}
                            className={`w-11 h-6 shrink-0 flex items-center rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${
                                allowDomainJoin ? 'bg-[#0f766e]' : 'bg-neutral-800'
                            }`}
                        >
                            <div
                                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${
                                    allowDomainJoin ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Use Case Multi-Select Chips */}
                    <div className="space-y-3">
                        <label className="block text-[13px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                            How are you looking to use FlowOps HQ?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {useCases.map((uc) => {
                                const isSelected = selectedUseCases.includes(uc.id);
                                return (
                                    <button
                                        key={uc.id}
                                        type="button"
                                        onClick={() => toggleUseCase(uc.id)}
                                        className={`flex items-center text-left gap-3.5 p-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                                            isSelected 
                                                ? 'bg-[#111827]/60 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.02)]' 
                                                : 'bg-[#111111]/40 border-white/5 hover:border-white/10 hover:bg-[#111111]/60'
                                        }`}
                                    >
                                        {/* Circular indicator checkbox */}
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                            isSelected 
                                                ? 'border-white bg-white text-black' 
                                                : 'border-neutral-700 bg-transparent'
                                        }`}>
                                            {isSelected && <Icon name="check" className="w-2.5 h-2.5 stroke-[4]"  />}
                                        </div>
                                        <span className={`text-[12.5px] font-bold transition-colors ${
                                            isSelected ? 'text-white' : 'text-neutral-400'
                                        }`}>
                                            {uc.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0066cc] hover:bg-[#0052a3] px-4 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-[#0066cc]/10 hover:shadow-[#0066cc]/20 transition-all duration-200 cursor-pointer"
                        >
                            Let's get started
                            <Icon name="arrow_forward" className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"  />
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
