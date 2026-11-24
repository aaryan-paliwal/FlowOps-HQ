import { create } from 'zustand';

export const THEMES = [
    {
        id: 'cyber-edge',
        name: 'Cyber-Edge',
        tagline: 'Obsidian Glow & Cyan Accent',
        description: 'Linear & Raycast-inspired developer tool aesthetic. Deep obsidian surface with electric cyan and emerald active glows.',
        badge: 'Default',
        primaryColor: '#06b6d4',      // Cyan 500
        secondaryColor: '#10b981',    // Emerald 500
        bgBody: '#070709',
        bgCard: '#0d0e12',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        activeBorder: '#06b6d4',
        accentGlow: 'rgba(6, 182, 212, 0.35)',
        fontLabel: 'Hanken Grotesk',
        previewTags: ['AI Gateway', 'Edge Proxy', 'Sub-1ms'],
    },
    {
        id: 'vercel-clean',
        name: 'Vercel Clean',
        tagline: 'Monochrome High-Contrast',
        description: 'Vercel & Next.js-inspired monochrome minimalism. Pure black titanium canvas with razor-sharp grayscale 1px borders.',
        badge: 'Minimalist',
        primaryColor: '#ffffff',      // Pure White
        secondaryColor: '#a1a1aa',    // Zinc 400
        bgBody: '#000000',
        bgCard: '#0a0a0a',
        borderColor: '#262626',
        activeBorder: '#ffffff',
        accentGlow: 'rgba(255, 255, 255, 0.15)',
        fontLabel: 'Geist Sans',
        previewTags: ['Pure Black', 'Zero Glow', 'High Contrast'],
    },
    {
        id: 'fintech-dense',
        name: 'FinTech Dense',
        tagline: 'Bloomberg Navy & Amber Terminal',
        description: 'Datadog & Bloomberg-inspired high information density. Navy canvas with terminal amber callouts and blue telemetry sparklines.',
        badge: 'Data-Dense',
        primaryColor: '#f59e0b',      // Amber 500
        secondaryColor: '#3b82f6',    // Blue 500
        bgBody: '#070b12',
        bgCard: '#0b1224',
        borderColor: 'rgba(59, 130, 246, 0.20)',
        activeBorder: '#f59e0b',
        accentGlow: 'rgba(245, 158, 11, 0.30)',
        fontLabel: 'JetBrains Mono',
        previewTags: ['P99 Latency', 'Token Billing', 'Real-Time'],
    },
    {
        id: 'aurora-glass',
        name: 'Aurora Glass (Crimson Obsidian)',
        tagline: 'Obsidian Black, Dual Crimson & Cyber Cyan',
        description: 'Raycast & macOS Pro frosted glassmorphism. Deep obsidian black glass canvas with dual-shade wine/crimson glow and complementary electric cyan telemetry.',
        badge: 'Default',
        primaryColor: '#ef4444',      // Electric Crimson Red
        secondaryColor: '#991b1b',    // Deep Wine / Ruby Red
        complementaryColor: '#06b6d4', // Cyber Cyan (complementary to red)
        bgBody: '#060507',            // Pitch Black
        bgCard: 'rgba(16, 10, 14, 0.72)',
        borderColor: 'rgba(153, 27, 27, 0.32)',
        activeBorder: '#ef4444',
        accentGlow: 'rgba(239, 68, 68, 0.35)',
        fontLabel: 'Modern Glass',
        previewTags: ['Pitch Black', 'Dual Crimson', 'Cyber Cyan'],
    },
    {
        id: 'modern-bento',
        name: 'Modern Bento',
        tagline: 'Stripe SaaS & Royal Indigo Grid',
        description: 'Stripe Dashboard & Apple Bento grid layout. Deep slate-950 canvas with rounded card geometry and electric indigo highlights.',
        badge: 'Enterprise',
        primaryColor: '#6366f1',      // Indigo 500
        secondaryColor: '#0ea5e9',    // Sky 500
        bgBody: '#020617',
        bgCard: '#0f172a',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        activeBorder: '#6366f1',
        accentGlow: 'rgba(99, 102, 241, 0.35)',
        fontLabel: 'Inter Modern',
        previewTags: ['Bento Grid', 'SaaS Clean', 'Team Portals'],
    },
];

const STORAGE_KEY = 'flowops_theme';

export const useThemeStore = create((set, get) => {
    // Initialize theme from localStorage or default to aurora-glass
    const getInitialTheme = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && THEMES.some((t) => t.id === saved)) {
                return saved;
            }
        } catch {
            // Ignore localStorage access failures
        }
        return 'aurora-glass';
    };

    const initialThemeId = getInitialTheme();

    // Set HTML attribute on boot
    if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', initialThemeId);
    }

    return {
        activeThemeId: initialThemeId,
        isSwitcherOpen: false,

        openSwitcher: () => set({ isSwitcherOpen: true }),
        closeSwitcher: () => set({ isSwitcherOpen: false }),
        toggleSwitcher: () => set((state) => ({ isSwitcherOpen: !state.isSwitcherOpen })),

        setTheme: (themeId) => {
            if (!THEMES.some((t) => t.id === themeId)) return;
            try {
                localStorage.setItem(STORAGE_KEY, themeId);
            } catch {
                // Ignore storage errors
            }
            if (typeof document !== 'undefined') {
                document.documentElement.setAttribute('data-theme', themeId);
            }
            set({ activeThemeId: themeId });
        },

        getActiveTheme: () => {
            const id = get().activeThemeId;
            return THEMES.find((t) => t.id === id) || THEMES[0];
        },
    };
});
