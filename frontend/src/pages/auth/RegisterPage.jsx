import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authService } from '../../services/api';
import { useAuthStore } from '../../state/authStore';
import Icon from '../../ui/Icon';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    const [name, setName] = useState('');
    const [company, setCompany] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [location, setLocation] = useState('');
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsLocationDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const locationOptions = [
        { id: 'IN', name: 'India', flag: '🇮🇳' },
        { id: 'US', name: 'United States', flag: '🇺🇸' },
        { id: 'EU', name: 'Europe', flag: '🇪🇺' },
        { id: 'OTHER', name: 'Global', flag: '🌍' }
    ];
    const activeLocation = locationOptions.find(o => o.id === location);

    useEffect(() => {
        if (isAuthenticated) {
            if (sessionStorage.getItem('just_registered') === 'true') {
                navigate('/onboarding');
            } else {
                navigate('/dashboard');
            }
        }
    }, [isAuthenticated, navigate]);

    const registerMutation = useMutation({
        mutationFn: (registrationData) => authService.register(registrationData),
        onSuccess: (data) => {
            if (data.success && data.data?.token) {
                sessionStorage.setItem('just_registered', 'true');
                setAuth(data.data.token, data.data.user);
                toast.success('Workspace initialized successfully! Welcome to FlowOps HQ.');
                navigate('/onboarding');
            } else {
                toast.error('Unexpected registration response format.');
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Registration failed. Email might already be taken.');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !email || !password) {
            return toast.error('Name, Email and Password are required.');
        }
        if (password.length < 8) {
            return toast.error('Password must be at least 8 characters long.');
        }
        if (!agreeTerms) {
            return toast.error('You must agree to the Terms of Service & Privacy Policy.');
        }
        
        // Mock save for hackathon
        sessionStorage.setItem('just_registered', 'true');
        setAuth('mock_token_123', {
            id: "user_fop_1x9k2m",
            name: name,
            email: email,
            role: "admin",
            company: company || "FlowOps HQ",
            subscriptionTier: "PRO",
            location: location || "US"
        });
        toast.success('Workspace initialized successfully! Welcome to FlowOps HQ.');
        navigate('/onboarding');
    };

    return (
        <div
            className="min-h-screen text-white flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 selection:bg-white selection:text-black font-sans py-12 md:py-8 relative"
            style={{
                background: 'linear-gradient(to right, #000000 35%, #2a0808 100%)'
            }}
        >
            {/* Ambient Red Glow clipped inside an absolute container to prevent horizontal scroll */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[1000px] h-[1000px] bg-red-900/15 rounded-full blur-[140px]"></div>
            </div>
            
            <div className="max-w-[380px] w-full flex flex-col items-center pb-24 pt-8 relative z-10">

                {/* Official FlowOps Logo */}
                <div className="flex items-center justify-center mb-1.5 relative group cursor-pointer select-none">
                    <div className="absolute -inset-1.5 bg-gradient-to-r from-neutral-500/5 via-white/5 to-neutral-500/5 rounded-lg blur-md opacity-75"></div>
                    <img
                        src="/Logo only.png?v=2"
                        alt="FlowOps Logo"
                        className="relative h-10 w-auto object-contain rounded-lg"
                    />
                </div>

                <h2 className="text-center text-[19px] font-extrabold tracking-tight text-white font-sans mb-0">
                    Sign-up to FlowOps HQ
                </h2>
                <p className="text-center text-[11.5px] text-neutral-500 font-sans mb-3">
                    Provision your high-speed unified LLM infrastructure gateway.
                </p>

                {/* Main Auth Card (Enhanced Glassmorphism) */}
                <div className="w-full bg-[#0a0a0a]/40 backdrop-blur-2xl border border-white/10 rounded-xl p-6 shadow-[0_8px_40px_rgb(0,0,0,0.8)] relative ring-1 ring-white/5 mt-2">
                    {/* Inner highlight line at the top to simulate glass edge reflection */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    {/* SSO / Social Logins */}
                    <div className="space-y-2.5">
                        <button type="button" className="w-full flex items-center justify-center gap-2.5 px-3 py-2 bg-[#111] hover:bg-[#1A1A1A] border border-white/5 hover:border-white/10 rounded-lg text-[13px] font-bold text-neutral-300 hover:text-white transition-all duration-200 cursor-pointer">
                            <Icon name="key" className="w-4 h-4 text-neutral-400" />
                            Single sign-on (SSO)
                        </button>
                        <button type="button" className="w-full flex items-center justify-center gap-2.5 px-3 py-2 bg-[#111] hover:bg-[#1A1A1A] border border-white/5 hover:border-white/10 rounded-lg text-[13px] font-bold text-neutral-300 hover:text-white transition-all duration-200 cursor-pointer">
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#EA4335" d="M12 5.04c1.88 0 3.57.65 4.9 1.92l3.66-3.66C18.34 1.25 15.42 0 12 0 7.37 0 3.39 2.67 1.48 6.57l4.28 3.32C6.78 6.94 9.17 5.04 12 5.04z" />
                                <path fill="#4285F4" d="M23.48 12.27c0-.82-.07-1.6-.2-2.37H12v4.51h6.43c-.28 1.48-1.12 2.73-2.38 3.58l3.69 2.87c2.16-1.99 3.74-4.92 3.74-8.59z" />
                                <path fill="#FBBC05" d="M5.76 14.1c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.48 6.2C.54 8.08 0 10.18 0 12.4s.54 4.32 1.48 6.2l4.28-3.3c-.24-.7-.38-1.48-.38-2.2z" />
                                <path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.02.68-2.33 1.09-3.95 1.09-2.83 0-5.22-1.9-6.08-4.47l-4.28 3.3C3.39 21.33 7.37 24 12 24z" />
                            </svg>
                            Sign in with Google
                        </button>
                    </div>

                    {/* Divider Separator */}
                    <div className="relative flex py-3 items-center">
                        <div className="flex-grow border-t border-white/5"></div>
                        <span className="flex-shrink mx-3 text-[11px] font-bold text-neutral-600 tracking-wider uppercase font-mono select-none">— or —</span>
                        <div className="flex-grow border-t border-white/5"></div>
                    </div>

                    {/* Credentials Input Form */}
                    <form className="space-y-3" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="company" className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-1.5">
                                Workspace / Company Name
                            </label>
                            <div className="relative rounded-lg shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Icon name="business" className="h-4 w-4 text-neutral-550" />
                                </div>
                                <input
                                    id="company"
                                    type="text"
                                    value={company}
                                    onChange={e => setCompany(e.target.value)}
                                    className="block w-full rounded-lg border border-white/10 bg-[#111] pl-9 pr-3 py-2 text-white placeholder-white/20 focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors disabled:opacity-50"
                                    placeholder="Enter Your Workspace Name"
                                    disabled={registerMutation.isPending}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="name" className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-1.5">
                                Full Name
                            </label>
                            <div className="relative rounded-lg shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Icon name="person" className="h-4 w-4 text-neutral-550" />
                                </div>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    className="block w-full rounded-lg border border-white/10 bg-[#111] pl-9 pr-3 py-2 text-white placeholder-white/20 focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors disabled:opacity-50"
                                    placeholder="Enter Your Name"
                                    disabled={registerMutation.isPending}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-1.5">
                                Work Email
                            </label>
                            <div className="relative rounded-lg shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Icon name="mail" className="h-4 w-4 text-neutral-550" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="block w-full rounded-lg border border-white/10 bg-[#111] pl-9 pr-3 py-2 text-white placeholder-white/20 focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors disabled:opacity-50"
                                    placeholder="Enter Your Email"
                                    disabled={registerMutation.isPending}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-1.5">
                                Secure Password
                            </label>
                            <div className="relative rounded-lg shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Icon name="lock" className="h-4 w-4 text-neutral-550" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="block w-full rounded-lg border border-white/10 bg-[#111] pl-9 pr-10 py-2 text-white placeholder-white/20 focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors disabled:opacity-50"
                                    placeholder="Enter Your Password"
                                    disabled={registerMutation.isPending}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white transition-colors cursor-pointer"
                                >
                                    <Icon name={showPassword ? "visibility_off" : "visibility"} className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-2">
                                Your Location
                            </label>
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                                    className="flex items-center justify-between w-full bg-[#111] border border-white/10 rounded-lg pl-3 pr-3 py-2 text-white focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors cursor-pointer"
                                >
                                    {activeLocation ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{activeLocation.flag}</span>
                                            <span>{activeLocation.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-white/20">Select your country</span>
                                    )}
                                    <Icon name="expand_more" className="w-4 h-4 text-neutral-500" />
                                </button>

                                {isLocationDropdownOpen && (
                                    <div className="absolute left-0 mt-2 w-full bg-[#111] border border-white/10 rounded-lg shadow-2xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                                        {locationOptions.map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => {
                                                    setLocation(opt.id);
                                                    setIsLocationDropdownOpen(false);
                                                }}
                                                className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors cursor-pointer ${
                                                    location === opt.id 
                                                        ? 'bg-white/10 text-white font-bold' 
                                                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <span className="text-lg">{opt.flag}</span>
                                                <div className="flex-1">
                                                    <span>{opt.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Terms checkbox */}
                        <div className="pt-1">
                            <label className="flex items-start text-[12px] text-neutral-450 hover:text-white cursor-pointer select-none leading-tight">
                                <input
                                    type="checkbox"
                                    checked={agreeTerms}
                                    onChange={e => setAgreeTerms(e.target.checked)}
                                    className="rounded border-white/10 bg-[#111] text-white focus:ring-0 focus:ring-offset-0 mr-2 mt-0.5 h-4 w-4 shrink-0"
                                />
                                <span>
                                    I agree to the <a href="#" className="font-bold text-white hover:underline">Terms</a> & <a href="#" className="font-bold text-white hover:underline">Privacy Policy</a>
                                </span>
                            </label>
                        </div>

                        {/* Submission Trigger */}
                        <button
                            type="submit"
                            disabled={registerMutation.isPending}
                            className="flex w-full justify-center items-center gap-1.5 rounded-lg bg-white hover:bg-neutral-200 py-2.5 px-4 text-[14px] font-bold text-black shadow-sm focus:outline-none transition-all disabled:bg-neutral-600 disabled:text-white cursor-pointer mt-4"
                        >
                            {registerMutation.isPending ? 'Provisioning...' : 'Create with work email'}
                            <Icon name="chevron_right" className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                {/* Alternate Action Prompt */}
                <p className="mt-3 text-center text-[12.5px] text-neutral-500 font-sans">
                    Already have an account? <Link to="/login" className="font-bold text-white hover:underline">Login</Link>
                </p>
            </div>
        </div>
    );
}
