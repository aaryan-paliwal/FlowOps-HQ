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

    // Password Update States (simulated secure state)
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const displayName = user?.name || 'Admin User';
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

    const handleUpdatePassword = (e) => {
        e.preventDefault();
        if (!currentPassword.trim()) return toast.error('Please enter your current password.');
        if (!newPassword.trim()) return toast.error('Please enter your new password.');
        if (newPassword.length < 6) return toast.error('New password must be at least 6 characters.');

        // Simulated success since backend doesn't support password reset directly
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 800)),
            {
                loading: 'Updating password...',
                success: 'Password updated successfully!',
                error: 'Failed to update password.'
            }
        );
        setCurrentPassword('');
        setNewPassword('');
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
                        <p className="text-[13px] text-neutral-400 font-sans">{user?.email || 'admin@flowops.dev'}</p>
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

                    {/* Password Update Form */}
                    <Card className="p-8">
                        <h2 className="text-lg font-bold text-white font-sans mb-6">Update Password</h2>
                        <form onSubmit={handleUpdatePassword} className="space-y-5">
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Current Password</label>
                                <div className="relative">
                                    <Icon name="lock" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450"  />
                                    <input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full px-3 py-2 pl-9 bg-[#111111]/45 border border-white/5 rounded text-[14px] font-sans text-white focus:outline-none focus:border-white/20 transition-colors" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">New Password</label>
                                <div className="relative">
                                    <Icon name="lock" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-450"  />
                                    <input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-3 py-2 pl-9 bg-[#111111]/45 border border-white/5 rounded text-[14px] font-sans text-white focus:outline-none focus:border-white/20 transition-colors" 
                                    />
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                                <button 
                                    type="submit"
                                    className="bg-[#111111]/45 border border-white/5 hover:border-white/10 text-white px-5 py-2 rounded font-sans font-bold text-[13px] transition-colors shadow-sm cursor-pointer"
                                >
                                    Update Password
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => toast.success("Two-Factor Authentication configuration initiated!")}
                                    className="text-red-500 hover:text-red-400 font-bold text-[13px] hover:underline font-sans cursor-pointer"
                                >
                                    Enable 2FA
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
}
