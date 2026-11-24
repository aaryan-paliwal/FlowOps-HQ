import { useThemeStore } from '../state/themeStore';
import Icon from './Icon';

export function ThemeSelectorButton({ className = "" }) {
    const { getActiveTheme, openSwitcher } = useThemeStore();
    const currentTheme = getActiveTheme();

    return (
        <button
            type="button"
            onClick={openSwitcher}
            className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer font-sans text-[12px] text-neutral-300 ${className}`}
            title="Switch project UI theme (Reverse Engineer Anything 5-Theme Engine)"
        >
            <span
                className="w-2.5 h-2.5 rounded-full border border-white/25 shadow-sm transition-transform group-hover:scale-110"
                style={{
                    backgroundColor: currentTheme.primaryColor,
                    boxShadow: `0 0 8px ${currentTheme.primaryColor}`,
                }}
            />
            <span className="font-semibold text-white/90 truncate max-w-[100px]">
                {currentTheme.name}
            </span>
            <Icon name="palette" className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
        </button>
    );
}
