import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authService } from '../../services/api';
import { useAuthStore } from '../../state/authStore';
import Icon from '../../ui/Icon';

export default function LoginPage() {
    const navigate = useNavigate();
    const setAuth = useAuthStore(state => state.setAuth);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    const loginMutation = useMutation({
        mutationFn: (credentials) => authService.login(credentials),
        onSuccess: (data) => {
            if (data.success && data.data?.token) {
                setAuth(data.data.token, data.data.user);
                toast.success('Welcome back to FlowOps HQ!');
                navigate('/dashboard');
            } else {
                toast.error('Unexpected response format.');
            }
        },
        onError: (error) => {
            toast.error(error.message || 'Invalid email or password.');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!email || !password) return toast.error('All fields are required.');
        
        // Hackathon mock bypass: immediately log the user in with a dummy token
        setAuth('mock_token_123', {
            id: "user_fop_1x9k2m",
            name: "FlowOps HQ Developer",
            email: email,
            role: "admin",
            company: "FlowOps HQ",
            subscriptionTier: "PRO",
            location: "US"
        });
        toast.success('Welcome back to FlowOps HQ!');
        navigate('/dashboard');
    };

    return (
        <div 
            className="min-h-screen text-white flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 selection:bg-white selection:text-black font-sans py-2 relative overflow-hidden"
            style={{
                background: 'linear-gradient(to right, #000000 35%, #2a0808 100%)'
            }}
        >
            {/* Ambient Red Glow expanded to reach behind the card */}
            <div className="absolute top-1/2 right-[-5%] -translate-y-1/2 w-[1000px] h-[1000px] bg-red-900/15 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="max-w-[380px] w-full flex flex-col items-center">
                
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
                    Sign-in to FlowOps HQ
                </h2>
                <p className="text-center text-[11.5px] text-neutral-500 font-sans mb-3">
                    Welcome back.
                </p>

                {/* Main Auth Card (Enhanced Glassmorphism) */}
                <div className="w-full bg-[#0a0a0a]/40 backdrop-blur-2xl border border-white/10 rounded-xl p-6 shadow-[0_8px_40px_rgb(0,0,0,0.8)] relative ring-1 ring-white/5 mt-2">
                    {/* Inner highlight line at the top to simulate glass edge reflection */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    
                    {/* SSO / Social Logins */}
                    <div className="space-y-2.5">
                        <button type="button" className="w-full flex items-center justify-center gap-2.5 px-3 py-2 bg-[#111] hover:bg-[#1A1A1A] border border-white/5 hover:border-white/10 rounded-lg text-[13px] font-bold text-neutral-300 hover:text-white transition-all duration-200 cursor-pointer">
                            <Icon name="key" className="w-4 h-4 text-neutral-400"  />
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
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-1.5">
                                Work Email
                            </label>
                            <div className="relative rounded-lg shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Icon name="mail" className="h-4 w-4 text-neutral-500"  />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    className="block w-full rounded-lg border border-white/10 bg-[#111] pl-9 pr-3 py-2.5 text-white placeholder-white/20 focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors disabled:opacity-50"
                                    placeholder="Enter Your Email"
                                    disabled={loginMutation.isPending}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-[11px] font-bold text-neutral-400 font-mono tracking-wider uppercase mb-1.5">
                                Password
                            </label>
                            <div className="relative rounded-lg shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Icon name="lock" className="h-4 w-4 text-neutral-500"  />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="block w-full rounded-lg border border-white/10 bg-[#111] pl-9 pr-10 py-2.5 text-white placeholder-white/20 focus:border-white focus:outline-none focus:ring-1 focus:ring-white text-[14px] font-sans transition-colors disabled:opacity-50"
                                    placeholder="Enter Your Password"
                                    disabled={loginMutation.isPending}
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

                        {/* Remembers and forgot password options */}
                        <div className="flex items-center justify-between text-[12px] pt-1">
                            <label className="flex items-center text-neutral-400 hover:text-white cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-white/10 bg-[#111] text-white focus:ring-0 focus:ring-offset-0 mr-2 h-4 w-4" 
                                />
                                Remember me
                            </label>
                            <a href="#" className="font-bold text-white hover:underline transition-all">
                                Forgot password?
                            </a>
                        </div>

                        {/* Submission Trigger */}
                        <button 
                            type="submit" 
                            disabled={loginMutation.isPending}
                            className="flex w-full justify-center items-center gap-1.5 rounded-lg bg-white hover:bg-neutral-200 py-2.5 px-4 text-[14px] font-bold text-black shadow-sm focus:outline-none transition-all disabled:bg-neutral-600 disabled:text-white cursor-pointer mt-5"
                        >
                            {loginMutation.isPending ? 'Authenticating...' : 'Sign in with email'}
                            <Icon name="chevron_right" className="w-4 h-4"  />
                        </button>
                    </form>
                </div>

                {/* Alternate Action Prompt */}
                <p className="mt-3 text-center text-[12.5px] text-neutral-500 font-sans">
                    Don't have an account? <Link to="/register" className="font-bold text-white hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
