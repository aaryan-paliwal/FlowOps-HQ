# GitHub UI Benchmarks & Design System Scraping

This reference catalogs the premier open-source GitHub repositories and design systems mined by the **Reverse Engineer Anything (REA)** skill to generate world-class, professional frontends for developer tools and AI infrastructure.

---

## 1. Curated GitHub Repository Benchmarks

| Repository | GitHub Stars / Origin | Core Strength / UI Pattern Mined |
| :--- | :--- | :--- |
| **`shadcn/ui`** (`shadcn-ui/ui`) | 70k+ / Vercel Community | Accessible Radix UI primitives, copy-paste Tailwind components, tokenized dark mode styling. |
| **`tremor-so/tremor`** (`tremor-so/tremor`) | 16k+ / Tremor | High-density analytical charts, KPI cards, metric callouts, and latency distribution visualizations. |
| **`magicuidesign/magicui`** (`magicuidesign/magicui`) | 12k+ / Magic UI | Modern landing page and dashboard effects: Bento grids, animated border beams, subtle radial glows, particle backgrounds. |
| **`aceternity/ui`** (`aceternity/ui`) | 15k+ / Aceternity | Canvas reveals, 3D card tilts, spotlight cursors, and glowing background shaders. |
| **`pacocoursey/cmdk`** (`pacocoursey/cmdk`) | 8k+ / Paco Coursey | Command palette (`⌘K`), fast keyboard-first routing, quick search dropdowns. |
| **`portkey-ai/gateway`** (`portkey-ai/gateway`) | 7k+ / Portkey | Gateway routing studio, virtual key vaults, live log streams, and provider fallback matrix. |

---

## 2. Essential Component Primitives for Infrastructure Platforms

When reverse-engineering developer tools, the frontend must incorporate these core component primitives:

### 2.1 The Routing Config Studio
* **Interactive Strategy Cards:** Clean radio/toggle cards with subtle borders and active glowing accents representing routing algorithms (`cost-optimized`, `speed-optimized`, `quality-optimized`).
* **Multi-Tab Policy Editor:** Segmented tabs for Smart Routing, Fallback Provider Chains, Weighted Load Balancing, Exponential Retries, and Alert Webhooks.
* **Live Synced Code Generator:** Three-way code switcher (JSON, Node.js SDK, cURL) dynamically updating as the user adjusts form sliders and toggles.

### 2.2 The Gateway Live Playground
* **Split-Pane Testbench:** Left pane for prompt editing, provider selection, and BYOK credentials; right pane for live streaming output, telemetry chips, and JSON inspection.
* **Live Stream Token Visualizer:** Incremental text rendering displaying live Time-To-First-Token (TTFT) counters and chunk throughput.
* **Resilience Testing Controls:** One-click "Simulate 503 Provider Outage" toggle to visually observe live failover in action.

### 2.3 One-Time Key Generation Modal (AI Studio Pattern)
* Prominent security banner warning that keys are displayed only once.
* Instant one-click "Copy API Key" primary button.
* Tabbed integration code snippets (OpenAI SDK, cURL PowerShell, cURL Bash, BYOK header).

---

## 3. UI Quality Standards

* **No Mockup Fallbacks in Production:** UI components must bind directly to live REST and SSE endpoints with clean empty states when no data exists.
* **Responsive Density:** High information density with legible typography (`JetBrains Mono` for code/telemetry, `Inter` or `Hanken Grotesk` for UI text).
* **Keyboard-First Controls:** Esc to dismiss modals, Enter to submit forms, accessible focus rings.
