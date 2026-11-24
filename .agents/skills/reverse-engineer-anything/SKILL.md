---
name: reverse-engineer-anything
description: >-
  Reverse Engineer Anything (REA) — AI-driven reverse-engineering, system deconstruction, and full-stack software synthesis system inspired by morluto/rea. Takes any target website, web application, API, GitHub repository, or software bundle (e.g. Portkey AI), extracts its complete system design, API contracts, backend pipeline, data models, and UI component hierarchy. Automatically scrapes and evaluates top GitHub repositories for UI inspiration, offers 5 distinct design theme cards (Cyber-Edge Obsidian, Vercel Clean Monochrome, FinTech Bloomberg Hyper-Dense, Aurora Glassmorphic, Modern Bento Stripe), and applies instant end-to-end theme switching, binding frontend and backend into a production-ready, deployable project.
argument-hint: "<target URL or GitHub repo> <optional target project folder>"
license: MIT
metadata:
  author: "Aaryan"
  version: "1.0.0"
---

# Reverse Engineer Anything (REA) Skill

A software deconstruction and clean-room full-stack cloning system for Google Antigravity. Inspired by `morluto/rea` (Reverse Engineer Anything), this skill empowers an AI agent to inspect, analyze, and reverse-engineer any target website, web application, software bundle, or open-source GitHub repository into a production-grade, resume-worthy project.

---

## 1. System Overview & Core Capabilities

```
[Target URL / Web App / GitHub Repo] (e.g., https://portkey.ai/ | portkey-ai/gateway)
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               PHASE 1: REVERSE ENGINEERING & DECONSTRUCTION             │
│  • Network & Protocol Analysis: HAR/REST/SSE/WebSocket endpoint mapping │
│  • Bundle & AST Deobfuscation: Component tree, Zustand/Redux stores     │
│  • Data Layer Derivation: PostgreSQL/Drizzle/Prisma schema inference    │
│  • Business Logic Extraction: Fallbacks, retry policies, cache scoping  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           PHASE 2: GITHUB UI SCRAPING & BENCHMARKING ENGINE             │
│  • Scraping top GitHub component repos (shadcn/ui, Tremor, Radix, Magic)│
│  • Mining UI patterns for developer tools, dashboards, & telemetry      │
│  • Extracting micro-interactions, glow shaders, and responsive grids    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            PHASE 3: 5-THEME DESIGN SYSTEM & LIVE SWITCHER               │
│  Presents 5 distinct, professionally crafted design cards:              │
│  1. Cyber-Edge / Obsidian Glow  (Deep black, glowing cyan/emerald)     │
│  2. Vercel Clean / Monochrome   (Titanium black, razor grayscale lines) │
│  3. FinTech Hyper-Dense         (Bloomberg navy, amber/blue telemetry)  │
│  4. Aurora Glassmorphic         (Deep violet, frosted glass, neon glow) │
│  5. Modern Bento / Stripe       (Slate-950, segmented bento grid cards) │
│  • Instant 1-click live CSS variable & Tailwind token switching         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           PHASE 4: FULL-STACK BINDING & PRODUCTION DEPLOYMENT           │
│  • Unifies Reverse-Engineered Backend APIs with Theme-Selected UI       │
│  • Replaces all mockups with live database records & verified telemetry │
│  • E2E automated test harness, Docker compose setup, & documentation    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 6-Step Execution Protocol

Whenever this skill is triggered with a target URL or GitHub repository:

### Step 1: Target Reconnaissance & Evidence Extraction
1. **Network & Protocol Capture:**
   * Query the target URL / GitHub API to catalog all public API endpoints (`/v1/*`, `/api/*`).
   * Identify streaming protocols (`text/event-stream` SSE, chunked transfer encoding, WebSockets).
   * Map authentication schemes (Bearer tokens, virtual key hashes, BYOK headers).
2. **Schema & Model Reconstruction:**
   * Infer relational database tables (Users, API Keys, Gateways, Logs, Semantic Cache, Metrics).
   * Formulate clean Drizzle ORM / Prisma schema with exact column constraints and indexes.
3. **Core Engine Logic Extraction:**
   * Identify the edge-routing algorithms, retry loops (exponential backoff with jitter), failover mechanisms, and multi-tier caching architectures.

### Step 2: GitHub UI Scraping & Component Benchmarking
1. Query GitHub repositories for the highest-rated UI patterns matching the product domain (e.g., search `shadcn/ui`, `tremor-so/tremor`, `radix-ui/primitives`, `pacocoursey/cmdk`, `magicuidesign/magicui`).
2. Extract the component primitives required for the application:
   * **Telemetry / Metrics Charts:** Responsive sparklines, SVG line charts, latency percentile selectors.
   * **Playground / Studio:** Monaco-style code editors, payload inspectors, live SSE stream chunk reader with Time-To-First-Token (TTFT) counters.
   * **Key Vault / Credentials View:** AI Studio-style one-time modal with dual copy buttons (raw key + full SDK snippet).
   * **Audit Log Table:** Real-time log streamer with filterable columns and badge drawers.

### Step 3: Multi-Theme Engine Generation (5 Themes)
The skill implements an automated **5-Theme Design Engine** with interactive cards allowing instant real-time theme switching:

* **Theme 1: Cyber-Edge / Obsidian Glow (Default Developer Tool):**
  * *Background:* Deep Obsidian `#08080A`, micro-dot grid.
  * *Accents:* Electric Cyan `#06b6d4`, Emerald `#10b981`.
  * *Cards:* `#0e0e11` with `border-white/10` and subtle hover glows.
  * *Best for:* Developer infrastructure, AI gateways, terminal proxies.

* **Theme 2: Vercel Clean / Monochrome Minimalist:**
  * *Background:* Pure Black `#000000`, flat monochrome.
  * *Accents:* High-contrast Pure White `#FFFFFF`, Neutral `#A1A1AA`.
  * *Cards:* `#0A0A0A` with razor-sharp `#262626` borders.
  * *Best for:* Modern SaaS, developer platforms, documentation.

* **Theme 3: FinTech Hyper-Dense / Bloomberg Terminal:**
  * *Background:* Deep Charcoal Navy `#070B12`.
  * *Accents:* Terminal Amber `#F59E0B`, Electric Blue `#3B82F6`.
  * *Cards:* `#0B132B` with compact padding, monospaced tabular numbers, high information density.
  * *Best for:* Telemetry, real-time analytics, cost tracking, high-frequency request monitors.

* **Theme 4: Aurora Glass / Cyberpunk Glassmorphic:**
  * *Background:* Deep Violet-Indigo `#0A051B`, radial purple mesh gradients.
  * *Accents:* Radiant Magenta `#EC4899`, Neon Violet `#8B5CF6`.
  * *Cards:* `bg-white/[0.04]` with `backdrop-blur-xl` and dual-gradient luminous borders.
  * *Best for:* Creative AI, cutting-edge consumer tech, futuristic tools.

* **Theme 5: Modern Bento / Stripe SaaS:**
  * *Background:* Midnight Slate `#020617`, subtle soft radial ambient lights.
  * *Accents:* Royal Indigo `#6366F1`, Sky Blue `#0EA5E9`.
  * *Cards:* `#0F172A` with rounded-2xl corners, segmented bento card layouts, smooth badge chips.
  * *Best for:* Enterprise dashboards, team workspaces, billing portals.

### Step 4: Live Theme Switcher Architecture
1. **Zustand Theme Store:** Store active theme ID in `localStorage` under `flowops_theme` (or `<project>_theme`).
2. **HTML Data-Attribute Injection:** Set `document.documentElement.setAttribute('data-theme', themeId)`.
3. **CSS Variable Binding:** Use CSS variables (`--bg-primary`, `--bg-card`, `--border-color`, `--accent-primary`, `--text-primary`) mapped directly into Tailwind tokens.
4. **Theme Card Selector Modal/Bar:** Render 5 interactive preview cards showing the color palette, typography sample, and instant 1-click preview.

### Step 5: Full-Stack Binding & Real-Life Usability
1. Ensure the frontend connects directly to live backend REST & SSE routes (no mock delays, no fake timeouts).
2. Wire up PostgreSQL relational models via Drizzle ORM / Prisma.
3. Implement Redis for sliding-window rate limiting, distributed locking, and Tier-1 caching.
4. Provide comprehensive unit tests (`Jest` / `Vitest`) and end-to-end integration scripts.

### Step 6: Recruiter-Grade Documentation & Verification
For each reverse-engineered feature, generate a dedicated markdown document inside `dev_docs/`:
* `Feature_N_<Name>.md` with:
  * Executive Summary & Real-World Problem
  * Portkey AI / Target Reference Architecture Mapping Table
  * Core Engineering Concepts & System Design Vocabulary
  * End-to-End Request Lifecycle with ASCII Architecture Diagrams
  * Security & Edge-Case Handling (SSRF guards, full jitter backoff, prompt leakage defense)
  * Recruiter Interview Q&A Cheatsheet
  * Step-by-Step UI Verification Guide

---

## 3. Reference Files & Supporting Documentation

For deeper architectural guidance, consult the references bundled in this skill:
* [Reverse Engineering Methodology](./references/reverse-engineering-methodology.md) — Network sniffing, bundle extraction, AST parsing, and API schema reverse engineering.
* [GitHub UI Benchmarks](./references/github-ui-benchmarks.md) — Curated open-source repositories and component libraries for top-tier developer dashboards.
* [Five-Theme Design System](./references/five-theme-design-system.md) — Complete color tokens, CSS variables, Tailwind configuration, and component styling for the 5 themes.
