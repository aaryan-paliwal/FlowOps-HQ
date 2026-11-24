# The Five-Theme Design System & CSS Token Architecture

The **Reverse Engineer Anything (REA)** skill equips projects with an interactive **5-Theme Design System**. Users can switch between 5 distinct, high-polish themes with a single click, transforming the visual identity of the entire application.

---

## 1. The 5 Theme Specifications

### Theme 1: Cyber-Edge / Obsidian Glow (Default)
* **Inspiration:** Linear, Supabase, Raycast.
* **Visual Identity:** Deep Obsidian black background, micro-dot grid pattern, electric cyan and emerald accents, glowing borders on hover.
* **Design Tokens:**
  * Background: `#08080A` (Body), `#0E0E12` (Card)
  * Border: `rgba(255, 255, 255, 0.08)` / Active: `#06B6D4` (Cyan)
  * Primary Accent: `#06B6D4` (Cyan 500)
  * Secondary Accent: `#10B981` (Emerald 500)
  * Glow Effect: `0 0 20px rgba(6, 182, 212, 0.15)`

### Theme 2: Vercel Clean / Monochrome Minimalist
* **Inspiration:** Vercel Dashboard, Next.js, Geist Design.
* **Visual Identity:** Pure black and titanium contrast, razor-sharp 1px grayscale borders, zero colored glows, crisp white typography.
* **Design Tokens:**
  * Background: `#000000` (Body), `#0A0A0A` (Card)
  * Border: `#262626` (Neutral 800) / Active: `#FFFFFF`
  * Primary Accent: `#FFFFFF` (Pure White)
  * Secondary Accent: `#A1A1AA` (Zinc 400)
  * Glow Effect: `none` (Strict flat minimalism)

### Theme 3: FinTech Hyper-Dense / Bloomberg Terminal
* **Inspiration:** Bloomberg Terminal, Datadog, TradingView.
* **Visual Identity:** Deep charcoal navy, high information density, tabular monospaced numbers, terminal amber and electric blue accents.
* **Design Tokens:**
  * Background: `#070B12` (Body), `#0B132B` (Card)
  * Border: `rgba(59, 130, 246, 0.15)` / Active: `#F59E0B` (Amber)
  * Primary Accent: `#F59E0B` (Amber 500)
  * Secondary Accent: `#3B82F6` (Blue 500)
  * Glow Effect: `0 0 15px rgba(245, 158, 11, 0.12)`

### Theme 4: Aurora Glass / Cyberpunk Glassmorphic
* **Inspiration:** macOS Sonoma, Raycast Pro, Linear Horizons.
* **Visual Identity:** Deep midnight purple-indigo background, ambient radial gradient meshes, frosted glass cards (`backdrop-blur-xl`), radiant magenta and violet glows.
* **Design Tokens:**
  * Background: `#0A051B` (Body), `rgba(255, 255, 255, 0.03)` (Glass Card)
  * Border: `rgba(139, 92, 246, 0.25)` / Active: `#EC4899` (Magenta)
  * Primary Accent: `#EC4899` (Pink 500)
  * Secondary Accent: `#8B5CF6` (Violet 500)
  * Glow Effect: `0 0 25px rgba(236, 72, 153, 0.25)`

### Theme 5: Modern Bento / Stripe SaaS
* **Inspiration:** Stripe Dashboard, Apple Bento grids, Tailwind UI.
* **Visual Identity:** Neutral midnight slate, rounded-2xl bento cards, soft subtle ambient highlights, royal indigo and sky blue chips.
* **Design Tokens:**
  * Background: `#020617` (Body), `#0F172A` (Card)
  * Border: `rgba(255, 255, 255, 0.06)` / Active: `#6366F1` (Indigo)
  * Primary Accent: `#6366F1` (Indigo 500)
  * Secondary Accent: `#0EA5E9` (Sky 500)
  * Glow Effect: `0 4px 20px rgba(99, 102, 241, 0.15)`

---

## 2. CSS Variable Architecture

Define global CSS variables scoped to `[data-theme="..."]`:

```css
:root, [data-theme="cyber-edge"] {
  --bg-app: #08080a;
  --bg-card: #0e0e12;
  --bg-surface: #14141a;
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-active: #06b6d4;
  --accent-primary: #06b6d4;
  --accent-secondary: #10b981;
  --text-primary: #ffffff;
  --text-muted: #94a3b8;
  --glow-shadow: 0 0 20px rgba(6, 182, 212, 0.15);
}

[data-theme="vercel-clean"] {
  --bg-app: #000000;
  --bg-card: #0a0a0a;
  --bg-surface: #121212;
  --border-subtle: #262626;
  --border-active: #ffffff;
  --accent-primary: #ffffff;
  --accent-secondary: #a1a1aa;
  --text-primary: #ffffff;
  --text-muted: #a1a1aa;
  --glow-shadow: none;
}

[data-theme="fintech-dense"] {
  --bg-app: #070b12;
  --bg-card: #0b132b;
  --bg-surface: #101c3d;
  --border-subtle: rgba(59, 130, 246, 0.15);
  --border-active: #f59e0b;
  --accent-primary: #f59e0b;
  --accent-secondary: #3b82f6;
  --text-primary: #f8fafc;
  --text-muted: #64748b;
  --glow-shadow: 0 0 15px rgba(245, 158, 11, 0.12);
}

[data-theme="aurora-glass"] {
  --bg-app: #0a051b;
  --bg-card: rgba(255, 255, 255, 0.04);
  --bg-surface: rgba(255, 255, 255, 0.07);
  --border-subtle: rgba(139, 92, 246, 0.2);
  --border-active: #ec4899;
  --accent-primary: #ec4899;
  --accent-secondary: #8b5cf6;
  --text-primary: #ffffff;
  --text-muted: #cbd5e1;
  --glow-shadow: 0 0 25px rgba(236, 72, 153, 0.25);
}

[data-theme="modern-bento"] {
  --bg-app: #020617;
  --bg-card: #0f172a;
  --bg-surface: #1e293b;
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-active: #6366f1;
  --accent-primary: #6366f1;
  --accent-secondary: #0ea5e9;
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --glow-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
}
```

---

## 3. Zustand Theme Store (`themeStore.js`)

```javascript
import { create } from 'zustand';

export const THEMES = [
  { id: 'cyber-edge', name: 'Cyber-Edge', desc: 'Obsidian glow & cyan accents', color: '#06b6d4' },
  { id: 'vercel-clean', name: 'Vercel Clean', desc: 'Monochrome high-contrast minimalist', color: '#ffffff' },
  { id: 'fintech-dense', name: 'FinTech Dense', desc: 'Bloomberg navy & amber terminal', color: '#f59e0b' },
  { id: 'aurora-glass', name: 'Aurora Glass', desc: 'Frosted blur & magenta cyberpunk', color: '#ec4899' },
  { id: 'modern-bento', name: 'Modern Bento', desc: 'Stripe slate & royal indigo cards', color: '#6366f1' },
];

export const useThemeStore = create((set) => ({
  activeTheme: localStorage.getItem('flowops_theme') || 'cyber-edge',
  setTheme: (themeId) => {
    localStorage.setItem('flowops_theme', themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    set({ activeTheme: themeId });
  },
}));
```
