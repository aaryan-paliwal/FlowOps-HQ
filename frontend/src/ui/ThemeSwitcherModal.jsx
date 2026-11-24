import { useEffect } from 'react';
import { useThemeStore, THEMES } from '../state/themeStore';
import Icon from './Icon';
import toast from 'react-hot-toast';

export function ThemeSwitcherModal() {
    const { activeThemeId, isSwitcherOpen, closeSwitcher, setTheme } = useThemeStore();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isSwitcherOpen) {
                closeSwitcher();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSwitcherOpen, closeSwitcher]);

    if (!isSwitcherOpen) return null;

    const handleSelectTheme = (theme) => {
        setTheme(theme.id);
        toast.success(`Theme switched to "${theme.name}"!`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
            <div 
                className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0C0C0E] border border-white/10 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner">
                            <Icon name="palette" className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-[17px] font-bold text-white font-sans tracking-tight">
                                Reverse Engineer Anything — 5-Theme Engine
                            </h2>
                            <p className="text-[12.5px] text-neutral-400 font-sans mt-0.5">
                                Select a design card below to dynamically transform the entire project's theme, colors, and layout aesthetics.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={closeSwitcher}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Close switcher (Esc)"
                    >
                        <Icon name="close" className="w-5 h-5" />
                    </button>
                </div>

                {/* 5 Theme Cards Grid */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {THEMES.map((theme) => {
                            const isSelected = activeThemeId === theme.id;

                            return (
                                <div
                                    key={theme.id}
                                    onClick={() => handleSelectTheme(theme)}
                                    className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                                        isSelected
                                            ? 'bg-white/[0.06] shadow-xl scale-[1.01]'
                                            : 'bg-[#121216] border-white/8 hover:border-white/20 hover:bg-white/[0.03]'
                                    }`}
                                    style={{
                                        borderColor: isSelected ? theme.primaryColor : undefined,
                                        boxShadow: isSelected ? `0 0 25px ${theme.accentGlow}` : undefined,
                                    }}
                                >
                                    {/* Top Status & Badge */}
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                            <span 
                                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border"
                                                style={{
                                                    color: theme.primaryColor,
                                                    backgroundColor: `${theme.primaryColor}15`,
                                                    borderColor: `${theme.primaryColor}30`,
                                                }}
                                            >
                                                {theme.badge}
                                            </span>
                                            {isSelected ? (
                                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    <Icon name="check" className="w-3 h-3 text-emerald-400" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-neutral-500 group-hover:text-neutral-300 transition-colors">
                                                    Click to apply
                                                </span>
                                            )}
                                        </div>

                                        {/* Theme Title & Tagline */}
                                        <h3 className="text-[15px] font-bold text-white font-sans tracking-tight">
                                            {theme.name}
                                        </h3>
                                        <p className="text-[11.5px] font-medium text-neutral-400 mb-2 font-sans">
                                            {theme.tagline}
                                        </p>
                                        <p className="text-[11px] text-neutral-500 leading-relaxed font-sans mb-3 line-clamp-2">
                                            {theme.description}
                                        </p>
                                    </div>

                                    {/* Mini Interactive Preview Box */}
                                    <div 
                                        className="rounded-lg p-2.5 border mb-3 relative overflow-hidden transition-all duration-300"
                                        style={{
                                            backgroundColor: theme.bgCard,
                                            borderColor: theme.borderColor,
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <div 
                                                    className="w-2 h-2 rounded-full shadow-sm"
                                                    style={{ backgroundColor: theme.primaryColor }}
                                                />
                                                <span className="text-[10px] font-mono text-white/80 font-bold">
                                                    /v1/chat
                                                </span>
                                            </div>
                                            <span 
                                                className="text-[9px] font-mono px-1.5 py-0.2 rounded"
                                                style={{
                                                    color: theme.primaryColor,
                                                    backgroundColor: `${theme.primaryColor}20`,
                                                }}
                                            >
                                                200 OK
                                            </span>
                                        </div>

                                        {/* Mock preview bars */}
                                        <div className="space-y-1">
                                            <div className="h-1.5 rounded-full bg-white/20 w-3/4" />
                                            <div className="h-1.5 rounded-full bg-white/10 w-1/2" />
                                        </div>

                                        {/* Accent bottom border line */}
                                        <div 
                                            className="absolute bottom-0 left-0 right-0 h-0.5"
                                            style={{ backgroundColor: theme.primaryColor }}
                                        />
                                    </div>

                                    {/* Color Swatches & Tags */}
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span 
                                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                                style={{ backgroundColor: theme.primaryColor }}
                                                title={`Primary: ${theme.primaryColor}`}
                                            />
                                            <span 
                                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                                style={{ backgroundColor: theme.secondaryColor }}
                                                title={`Secondary: ${theme.secondaryColor}`}
                                            />
                                            <span 
                                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                                                style={{ backgroundColor: theme.bgBody }}
                                                title={`Background: ${theme.bgBody}`}
                                            />
                                        </div>
                                        <span className="text-[10px] font-mono text-neutral-400">
                                            {theme.fontLabel}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02] text-[12px] text-neutral-400 font-sans">
                    <div className="flex items-center gap-2">
                        <Icon name="auto_awesome" className="w-4 h-4 text-cyan-400" />
                        <span>Theme selection persists automatically across sessions in localStorage.</span>
                    </div>
                    <button
                        onClick={closeSwitcher}
                        className="px-4 py-2 bg-white text-black font-bold text-[12px] rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
