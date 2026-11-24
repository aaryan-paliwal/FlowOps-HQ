import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { useAuthStore } from '../state/authStore';
import { authService } from '../services/api';
import { toast } from 'react-hot-toast';

export default function ProfilePage() {
    const { user, token, setAuth } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const email = user?.email || '';

    const displayName = user?.name || 'Developer';
    const displayInitial = displayName.charAt(0).toUpperCase();

    // 1. Profile Update Mutation
    const updateProfileMutation = useMutation({
        mutationFn: (payload) => authService.updateProfile(payload),
        onSuccess: (res) => {
            if (res.success && res.data?.user) {
                setAuth(token, res.data.user);
                toast.success('Profile details saved successfully!');
            }
        },
        onError: (err) => {
            toast.error(err.message || 'Failed to update profile.');
        }
    });

    const handleSaveProfile = (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('Please enter your full name.');
        
        updateProfileMutation.mutate({ name });
    };

    return (
        <div className="max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-200">
            <div className="mb-8 font-sans">
                <div className="flex items-center gap-3 mb-1">
                    <Icon name="person" className="w-7 h-7 text-white/40" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Your Profile
                    </h1>
                </div>
                <p className="text-[15px] text-neutral-450">
                    Manage your personal account settings and security.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <Card className="p-8 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-[#111111] mb-4 overflow-hidden border-4 border-white/5 shadow-sm">
                            <div className="w-full h-full bg-[#222222] flex items-center justify-center text-white text-3xl font-bold font-mono">
                                {displayInitial}/
                            </div>
                        </div>
                        <h2 className="text-lg font-bold text-white font-sans">{displayName}</h2>
                        <p className="text-[13px] text-neutral-400 font-sans">{user?.email || 'No email available'}</p>
                        <span className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-cyan-950/20 text-cyan-400 border border-cyan-500/10">
                            {user?.subscriptionTier || 'FREE'} Developer
                        </span>
                    </Card>
                </div>

                <div className="md:col-span-2 space-y-6">
                    {/* Personal Information Form */}
                    <Card className="p-8">
                        <h2 className="text-lg font-bold text-white font-sans mb-6">Personal Information</h2>
                        <form onSubmit={handleSaveProfile} className="space-y-5">
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Full Name</label>
                                <div className="relative">
                                    <Icon name="person" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450"  />
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-3 py-2 pl-9 bg-[#111111]/45 border border-white/5 rounded text-[14px] font-sans text-white focus:outline-none focus:border-white/20 transition-colors" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Email Address</label>
                                <div className="relative">
                                    <Icon name="mail" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450"  />
                                    <input 
                                        type="email" 
                                        value={email} 
                                        disabled
                                        className="w-full px-3 py-2 pl-9 bg-white/2 border border-white/5 rounded text-[14px] font-sans text-neutral-500 cursor-not-allowed" 
                                    />
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-white/5">
                                <button 
                                    type="submit"
                                    disabled={updateProfileMutation.isPending}
                                    className="bg-white hover:bg-neutral-200 text-black px-5 py-2 rounded font-sans font-bold text-[13px] transition-colors shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
                                >
                                    {updateProfileMutation.isPending && <Icon name="autorenew" className="w-3.5 h-3.5 animate-spin"  />}
                                    Save Profile
                                </button>
                            </div>
                        </form>
                    </Card>

                    {/* Security Info Card */}
                    <Card className="p-8">
                        <h2 className="text-lg font-bold text-white font-sans mb-2">Authentication & Security</h2>
                        <p className="text-[13px] text-neutral-400 font-sans leading-relaxed">
                            Your account authenticates using bcrypt-hashed credentials and signed JWT sessions.
                            Self-service password resets and MFA require an external SMTP / identity provider configuration.
                        </p>
                    </Card>
                </div>
            </div>
        </div>
    );
}
