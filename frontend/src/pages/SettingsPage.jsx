import { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import { Card } from '../ui/Card';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../state/authStore';
import { toast } from 'react-hot-toast';

const timezoneByLocation = {
    IN: '(UTC+05:30) Indian Standard Time (Asia/Kolkata)',
    US: '(UTC-08:00) Pacific Time (US and Canada) (America/Los_Angeles)',
    EU: '(UTC+01:00) Central European Time (Europe/Paris)',
    OTHER: '(UTC+00:00) Coordinated Universal Time (UTC)'
};

export default function SettingsPage() {
    const { user, updateUser } = useAuthStore();
    const [activeTab, setActiveTab] = useState('preferences');
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const [timezone, setTimezone] = useState(() => timezoneByLocation[user?.location || 'US'] || timezoneByLocation.OTHER);
    const [isTimezoneDropdownOpen, setIsTimezoneDropdownOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteRole, setInviteRole] = useState('admin');
    const [inviteEmail, setInviteEmail] = useState('');

    const [teamMembers, setTeamMembers] = useState(() => [{
        id: 'owner',
        name: user?.name || 'Admin User',
        email: user?.email || 'admin@flowops.dev',
        role: 'owner',
        initials: user?.name ? user.name.charAt(0).toUpperCase() : 'A',
        color: 'bg-red-800'
    }]);

    const handleSendInvite = () => {
        if (!inviteEmail) return toast.error("Please enter an email address");
        toast.success(`Invite sent to ${inviteEmail} as ${inviteRole}`);
        
        const newMember = {
            id: Date.now().toString(),
            name: 'Pending User',
            email: inviteEmail,
            role: inviteRole,
            initials: inviteEmail.charAt(0).toUpperCase(),
            color: 'bg-neutral-600',
            status: 'pending'
        };
        setTeamMembers(prev => [...prev, newMember]);
        
        setIsInviteModalOpen(false);
        setInviteEmail('');
    };

    const handleRemoveMember = (id) => {
        setTeamMembers(prev => prev.filter(m => m.id !== id));
        toast.success("Team member removed successfully");
    };
    
    const dropdownRef = useRef(null);
    const timezoneDropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsLocationDropdownOpen(false);
            }
            if (timezoneDropdownRef.current && !timezoneDropdownRef.current.contains(event.target)) {
                setIsTimezoneDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const locationOptions = [
        { id: 'IN', name: 'India', currency: '₹ INR', flag: '🇮🇳' },
        { id: 'US', name: 'United States', currency: '$ USD', flag: '🇺🇸' },
        { id: 'EU', name: 'Europe', currency: '€ EUR', flag: '🇪🇺' },
        { id: 'OTHER', name: 'Other Global', currency: '$ USD', flag: '🌍' }
    ];
    
    const timezoneOptions = [
        '(UTC-08:00) Pacific Time (US and Canada) (America/Los_Angeles)',
        '(UTC-05:00) Eastern Time (US and Canada) (America/New_York)',
        '(UTC+00:00) Coordinated Universal Time (UTC)',
        '(UTC+01:00) Central European Time (Europe/Paris)',
        '(UTC+05:30) Indian Standard Time (Asia/Kolkata)'
    ];

    const activeLocation = locationOptions.find(o => o.id === (user?.location || 'US')) || locationOptions[1];

    return (
        <div className="max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-200">
            <div className="mb-8 font-sans">
                <div className="flex items-center gap-3 mb-1">
                    <Icon name="settings" className="w-7 h-7 text-white/40" />
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Account Settings
                    </h1>
                </div>
                <p className="text-[15px] text-neutral-450">
                    Manage your account security, team members, and billing.
                </p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Side Navigation */}
                <div className="w-full md:w-64 flex-shrink-0 font-sans">
                    <nav className="flex flex-col space-y-1">
                        <button 
                            onClick={() => setActiveTab('preferences')}
                            className={`${activeTab === 'preferences' ? 'bg-white/5 border border-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'} px-4 py-2.5 rounded text-[13px] font-bold text-left flex items-center gap-3 w-full cursor-pointer transition-colors`}
                        >
                            <Icon name="public" className="w-4 h-4"  /> Preferences & Locale
                        </button>
                        <button 
                            onClick={() => setActiveTab('security')}
                            className={`${activeTab === 'security' ? 'bg-white/5 border border-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'} px-4 py-2.5 rounded text-[13px] font-bold text-left flex items-center gap-3 w-full cursor-pointer transition-colors`}
                        >
                            <Icon name="shield" className="w-4 h-4"  /> Security
                        </button>
                        <button 
                            onClick={() => setActiveTab('team')}
                            className={`${activeTab === 'team' ? 'bg-white/5 border border-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'} px-4 py-2.5 rounded text-[13px] font-bold text-left flex items-center gap-3 w-full cursor-pointer transition-colors`}
                        >
                            <Icon name="group" className="w-4 h-4"  /> Team Members
                        </button>
                        <button 
                            onClick={() => setActiveTab('billing')}
                            className={`${activeTab === 'billing' ? 'bg-white/5 border border-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'} px-4 py-2.5 rounded text-[13px] font-bold text-left flex items-center gap-3 w-full cursor-pointer transition-colors`}
                        >
                            <Icon name="credit_card" className="w-4 h-4"  /> Billing
                        </button>
                    </nav>
                </div>

                {/* Settings Form */}
                <div className="flex-1 space-y-6">

                    {/* Preferences Section */}
                    {activeTab === 'preferences' && (
                        <div className="animate-in fade-in duration-200 space-y-6">
                            <Card className="p-8">
                                <h2 className="text-lg font-bold text-white font-sans mb-2">Regional Preferences</h2>
                                <p className="text-[13px] text-neutral-400 font-sans mb-6">Set your region. This will automatically adjust currency displays across the application.</p>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Billing Location</label>
                                        <p className="text-xs text-neutral-500 mb-2">Select your country to see pricing and analytics in your local currency (e.g. INR for India).</p>
                                        <div className="relative mt-4" ref={dropdownRef}>
                                            <button 
                                                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                                                className="flex items-center justify-between w-full sm:max-w-md px-4 py-3 bg-[#0C0C0C] border border-white/5 rounded-lg text-[13px] font-sans text-neutral-300 hover:border-white/10 hover:text-white transition-colors cursor-pointer font-semibold shadow-sm"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{activeLocation.flag}</span>
                                                    <span>{activeLocation.name}</span>
                                                    <span className="text-neutral-500 font-normal ml-1">({activeLocation.currency})</span>
                                                </div>
                                                <Icon name="expand_more" className="w-4 h-4 text-neutral-500" />
                                            </button>
                                            {isLocationDropdownOpen && (
                                                <div className="absolute left-0 mt-2 w-full sm:max-w-md bg-[#111111] border border-white/5 rounded-lg shadow-xl z-30 p-1.5 animate-in fade-in zoom-in-95 duration-100">
                                                    {locationOptions.map(opt => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => {
                                                                updateUser({ location: opt.id });
                                                                setTimezone(timezoneByLocation[opt.id] || timezoneByLocation.OTHER);
                                                                setIsLocationDropdownOpen(false);
                                                                toast.success('Location & currency preferences updated');
                                                            }}
                                                            className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors cursor-pointer ${
                                                                (user?.location || 'US') === opt.id 
                                                                    ? 'bg-white/10 text-white font-bold' 
                                                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <span className="text-lg">{opt.flag}</span>
                                                            <div className="flex-1">
                                                                <span>{opt.name}</span>
                                                            </div>
                                                            <span className="text-neutral-500 font-mono text-[11px]">{opt.currency}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Security Section */}
                    {activeTab === 'security' && (
                        <div className="animate-in fade-in duration-200 space-y-6">
                            <Card className="p-8 relative z-20">
                                <h2 className="text-lg font-bold text-white font-sans mb-2">Security & Domains</h2>
                                <p className="text-[13px] text-neutral-400 font-sans mb-6">Manage domain-based access rules and allow people from allowed domains to join automatically.</p>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Allowed Domains</label>
                                        <p className="text-xs text-neutral-500 mb-2">Users with emails from these domains can join your organization.</p>
                                        <div className="flex items-center justify-between border border-white/5 bg-[#111111]/45 p-4 rounded-lg">
                                            <p className="text-neutral-400 text-sm italic">No domains configured.</p>
                                            <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded font-sans font-bold text-xs transition-colors border border-white/10 flex items-center gap-2">
                                                <Icon name="add" className="w-4 h-4" /> Add Domains
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-neutral-400 font-sans tracking-wide uppercase mb-2">Timezone</label>
                                        <div className="relative" ref={timezoneDropdownRef}>
                                            <button 
                                                onClick={() => setIsTimezoneDropdownOpen(!isTimezoneDropdownOpen)}
                                                className="flex items-center justify-between w-full sm:max-w-md px-4 py-3 bg-[#0C0C0C] border border-white/5 rounded-lg text-[13px] font-sans text-neutral-300 hover:border-white/10 hover:text-white transition-colors cursor-pointer font-semibold shadow-sm"
                                            >
                                                <span>{timezone}</span>
                                                <Icon name="expand_more" className="w-4 h-4 text-neutral-500" />
                                            </button>
                                            {isTimezoneDropdownOpen && (
                                                <div className="absolute left-0 mt-2 w-full sm:max-w-md bg-[#111111] border border-white/5 rounded-lg shadow-xl z-30 p-1.5 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
                                                    {timezoneOptions.map(tz => (
                                                        <button
                                                            key={tz}
                                                            onClick={() => {
                                                                setTimezone(tz);
                                                                setIsTimezoneDropdownOpen(false);
                                                            }}
                                                            className={`flex items-center w-full text-left px-3 py-2.5 rounded-md text-[13px] transition-colors cursor-pointer ${
                                                                timezone === tz 
                                                                    ? 'bg-white/10 text-white font-bold' 
                                                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <span>{tz}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-8">
                                <h2 className="text-lg font-bold text-white font-sans mb-2">Two-Factor Authentication (2FA)</h2>
                                <p className="text-[13px] text-neutral-400 font-sans mb-6">Add an extra layer of security to your account.</p>
                                <div className="flex items-center justify-between border border-white/5 bg-[#111111]/45 p-4 rounded-lg">
                                    <div>
                                        <p className="text-white font-bold text-sm">Authenticator App</p>
                                        <p className="text-neutral-400 text-xs mt-1">Use an app like Google Authenticator or 1Password.</p>
                                    </div>
                                    <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded font-sans font-bold text-xs transition-colors border border-white/10">
                                        Enable 2FA
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Team Members Section */}
                    {activeTab === 'team' && (
                        <div className="animate-in fade-in duration-200 space-y-6">
                            <Card className="p-8">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-lg font-bold text-white font-sans mb-1">Team Members</h2>
                                        <p className="text-[13px] text-neutral-400 font-sans">Manage who has access to this workspace.</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsInviteModalOpen(true)}
                                        className="bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded font-sans font-bold text-[13px] transition-all flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer shadow-sm active:scale-95"
                                    >
                                        <Icon name="person_add" className="w-4 h-4" /> Invite Member
                                    </button>
                                </div>
                                <div className="border border-white/5 rounded-lg overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[500px]">
                                        <thead>
                                            <tr className="bg-[#111111]/80 border-b border-white/5 text-xs text-neutral-400 uppercase tracking-wider">
                                                <th className="px-4 py-3 font-medium">User</th>
                                                <th className="px-4 py-3 font-medium">Role</th>
                                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-[#111111]/45 divide-y divide-white/5">
                                            {teamMembers.map((member) => (
                                                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${member.color}`}>
                                                                {member.initials}
                                                            </div>
                                                            <div>
                                                                <p className="text-white text-sm font-medium">{member.name}</p>
                                                                <p className="text-neutral-500 text-xs">{member.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="bg-white/10 text-white px-2 py-1 rounded text-[11px] font-bold tracking-wide uppercase border border-white/5">
                                                            {member.role}
                                                        </span>
                                                        {member.status === 'pending' && (
                                                            <span className="ml-2 text-[10px] text-amber-500 font-bold border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {member.role !== 'owner' ? (
                                                            <button 
                                                                onClick={() => handleRemoveMember(member.id)}
                                                                className="text-red-400 hover:text-red-300 transition-colors p-1 text-xs font-bold bg-red-400/10 hover:bg-red-400/20 px-2 py-1 rounded"
                                                            >
                                                                Remove
                                                            </button>
                                                        ) : (
                                                            <button className="text-neutral-700 p-1 cursor-not-allowed" disabled title="Cannot remove owner">
                                                                <Icon name="lock" className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Billing Section */}
                    {activeTab === 'billing' && (
                        <div className="animate-in fade-in duration-200 space-y-6">
                            <Card className="p-8">
                                <h2 className="text-lg font-bold text-white font-sans mb-2">Current Plan</h2>
                                <p className="text-[13px] text-neutral-400 font-sans mb-6">You are currently on the Free Plan.</p>
                                <div className="border border-white/10 bg-white/5 p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="w-full">
                                        <h3 className="text-white font-bold text-xl mb-1">Free</h3>
                                        <p className="text-neutral-300 text-sm mb-4">10,000 requests per month included.</p>
                                        <div className="w-full bg-[#111] rounded-full h-2.5 border border-white/5 max-w-sm mb-2">
                                            <div className="bg-white/20 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                                        </div>
                                        <p className="text-xs text-neutral-500 font-mono">4,500 / 10,000 requests used</p>
                                    </div>
                                    <Link to="/billing/upgrade" className="bg-white hover:bg-neutral-200 text-black px-6 py-2.5 rounded font-sans font-bold text-[13px] transition-all hover:scale-[1.02] shadow-sm cursor-pointer whitespace-nowrap block">
                                        Upgrade to Pro
                                    </Link>
                                </div>
                            </Card>
                            
                            <Card className="p-8">
                                <h2 className="text-lg font-bold text-white font-sans mb-2">Payment Methods</h2>
                                <p className="text-[13px] text-neutral-400 font-sans mb-6">Manage your saved credit cards and billing information.</p>
                                <div className="flex items-center justify-between border border-white/5 bg-[#111111]/45 p-4 rounded-lg">
                                    <p className="text-neutral-400 text-sm italic">No payment methods saved.</p>
                                    <button className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded font-sans font-bold text-xs transition-colors border border-white/10 flex items-center gap-2">
                                        <Icon name="add" className="w-4 h-4" /> Add Payment Method
                                    </button>
                                </div>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-white/10 rounded-xl shadow-2xl w-full max-w-[550px] overflow-hidden flex flex-col font-sans relative transform scale-100">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 pb-4">
                            <div>
                                <h2 className="text-[16px] font-bold text-white mb-1">Add Team Member</h2>
                                <p className="text-[13px] text-neutral-400">Invite people to collaborate in this Organisation</p>
                            </div>
                            <button onClick={() => setIsInviteModalOpen(false)} className="text-neutral-500 hover:text-white transition-colors cursor-pointer p-1">
                                <Icon name="close" className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 pt-2 space-y-6">
                            <div>
                                <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Organisation Role</h3>
                                <div className="flex gap-4">
                                    {/* Admin Radio */}
                                    <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'admin' ? 'bg-[#06242e]/40 border-cyan-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                                        <div className="mt-0.5 shrink-0">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${inviteRole === 'admin' ? 'border-cyan-400 bg-cyan-400' : 'border-neutral-500'}`}>
                                                {inviteRole === 'admin' && <div className="w-1.5 h-1.5 bg-[#06242e] rounded-full"></div>}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Icon name="shield" className={`w-4 h-4 ${inviteRole === 'admin' ? 'text-cyan-400' : 'text-neutral-400'}`} />
                                                <span className="text-[14px] font-bold text-white">Admin</span>
                                            </div>
                                            <div className="text-[12px] text-neutral-400 leading-tight mt-1">Full access to manage the organisation</div>
                                        </div>
                                        <input type="radio" className="hidden" name="role" checked={inviteRole === 'admin'} onChange={() => setInviteRole('admin')} />
                                    </label>

                                    {/* Member Radio */}
                                    <label className={`flex-1 flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${inviteRole === 'member' ? 'bg-[#06242e]/40 border-cyan-500/50' : 'bg-transparent border-white/10 hover:border-white/20'}`}>
                                        <div className="mt-0.5 shrink-0">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${inviteRole === 'member' ? 'border-cyan-400 bg-cyan-400' : 'border-neutral-500'}`}>
                                                {inviteRole === 'member' && <div className="w-1.5 h-1.5 bg-[#06242e] rounded-full"></div>}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Icon name="person" className={`w-4 h-4 ${inviteRole === 'member' ? 'text-cyan-400' : 'text-neutral-400'}`} />
                                                <span className="text-[14px] font-bold text-white">Member</span>
                                            </div>
                                            <div className="text-[12px] text-neutral-400 leading-tight mt-1">Access to assigned workspaces only</div>
                                        </div>
                                        <input type="radio" className="hidden" name="role" checked={inviteRole === 'member'} onChange={() => setInviteRole('member')} />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[13px] font-semibold text-neutral-300 mb-3">Invite via email</h3>
                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <Icon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                        <input
                                            type="email"
                                            placeholder="user@example.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendInvite}
                                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-6 py-2.5 rounded-lg transition-colors text-[13px] shadow-md cursor-pointer disabled:opacity-50 whitespace-nowrap"
                                    >
                                        Send Invite
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
