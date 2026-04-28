# Frontend Optimization Backlog

Items deferred from the senior code review on 2026-04-28. Pick these up **after
the production launch is stable** and the team has bandwidth for non-blocking
improvements. Each item is scoped to be a standalone PR — do not bundle.

Last updated: 2026-04-28
Companion review: see git history around commit `feat: frontend P0/P1 cleanup`
(lint, code-splitting, SEO, a11y baseline).

---

## How to read this file

Each entry has:

- **Owner** — the person who picks the item up. `TBD` until scheduled.
- **Tracking issue** — link to the GitHub issue once filed. `TBD` until then.
- **Why deferred** — what the trade-off was at the time
- **Effort** — rough sizing (hours / days / weeks)
- **Touches** — files / components / config that would change
- **Success criteria** — how we know it's done
- **Notes** — gotchas, ordering hints, prior art

Order is roughly *highest leverage → lowest*. Re-prioritize before each sprint.

> **Migration note for the in-session "What was DONE" list:**
> The closing section recaps what shipped via PRs #17–#21 in the same review
> pass that produced this backlog. It exists so that a future contributor
> doesn't redo work, but it duplicates information that's already in
> `git log`. When in doubt, `git log --oneline 459c87c..main` is the source
> of truth — this file just provides the human-readable framing.

---

## 1. TypeScript point-of-entry (`.tsx` for new code)
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — Multi-week migration. Touches every component eventually.
The product is a *legal-risk OS* sold to GCs; long-term, dynamic typing is a
liability for maintenance.

**Effort** — 2-3 weeks for incremental adoption (new files only, then opt-in
file by file). Full conversion 6-8 weeks.

**Touches**
- Add `typescript`, `@types/react`, `@types/react-dom`, `@types/react-router-dom`
- `tsconfig.json` with `allowJs: true`, `strict: true`, `jsx: "react-jsx"`
- `vite.config.js` already supports TS via `@vitejs/plugin-react`
- ESLint: add `@typescript-eslint/parser` + recommended plugin
- CI: add `tsc --noEmit` step
- New components / new files: `.tsx` only
- Existing `.jsx` files: leave until touched, then convert during the change

**Success criteria**
- `tsc --noEmit` passes in CI with no `any` in new code
- API client (`src/api/client.js`) typed against backend response shapes
- `LangProvider` value typed (`{ lang: 'ko' | 'en'; setLang; t: (path: string) => string }`)

**Notes**
- Start with the lowest-risk files (utilities, contexts, api/client) before
  touching component trees.
- Generate response types from FastAPI OpenAPI spec via `openapi-typescript` to
  avoid manual drift.

---

## 2. Server-state library (TanStack Query or SWR)
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — 5+ components currently hand-roll `useEffect + setState +
try/catch + AbortController`. Migration is invasive but each component is
similar enough to template.

**Effort** — 3-4 days for first 5 components. Library swap-in is 1 day.

**Touches**
- Components currently fetching directly: `RiskIntelligence`, `ComplianceTracker`,
  `OntologyGraph`, `OntologyStudio`, `ReplyGuide`, `RiskPlaybook`
- `App.jsx` gets a `QueryClientProvider` wrapper
- `api/client.js` stays as-is; queries call into it

**Success criteria**
- No raw `useEffect` / `useState` for fetch state in new code
- Cache, dedupe, retry-with-backoff out of the box
- Page-leaving requests cancel automatically (AbortController integration)

**Notes**
- TanStack Query v5 is preferred over SWR for the richer cache + mutation API,
  given OntoReview's per-tenant invalidation needs.
- Pair with #1 (TypeScript) — typed query keys + return types are where most
  of the value lives.

---

## 3. Tailwind v4 `@theme` + `tokens.css` unification
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — The project mixes Tailwind utilities (AppSidebar, Dashboard)
with hand-written BEM in `marketing.css` (744 lines). `tokens.css` defines CSS
variables but Tailwind doesn't know about them, so `bg-navy` / `text-ink-2`
utilities don't exist.

**Effort** — 2-3 days for theme integration; full BEM → Tailwind migration is
a separate multi-week task and may not be worth it.

**Touches**
- `src/styles/tokens.css` — wrap variables in Tailwind v4 `@theme { ... }`
- `src/index.css` — import order matters
- New code can use `bg-navy`, `text-ink-3`, `font-mono` utilities directly
- Existing `lp-*` BEM classes stay; migrate opportunistically as files change

**Success criteria**
- Tailwind utilities resolve design tokens (verify with `bg-navy` rendering as
  `#1E3A8A`)
- New components don't introduce new BEM classes
- A short `docs/styling.md` explaining the convention

**Notes**
- Tailwind v4 syntax: `@theme { --color-navy: #1E3A8A; }` inside a CSS file.
- See https://tailwindcss.com/docs/theme for current syntax. Verify against
  the version in `package.json` before writing the migration.

---

## 4. `LandingPage.jsx` decomposition
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — 611 lines, but mostly static marketing content. Splitting
is mechanical but invasive. Risky to do alongside copy changes.

**Effort** — 1 day if done as pure refactor (no copy changes).

**Touches**
- `src/pages/LandingPage.jsx` → orchestrator only
- Create `src/pages/landing/sections/` with one file per section:
  - `Nav.jsx`, `Hero.jsx`, `HeroPreviewCard.jsx`, `Casestudy.jsx`,
    `Trust.jsx`, `Problem.jsx`, `HowItWorks.jsx`, `Product.jsx`, `Stack.jsx`,
    `Market.jsx`, `Pricing.jsx`, `FAQ.jsx`, `Closing.jsx`, `Footer.jsx`
- Pull data into `src/pages/landing/content/`:
  - `faqs.ts`, `pricing-tiers.ts`, `timeline.ts`, `competitor-rows.ts`,
    `how-it-works-steps.ts`
- Reuse `<Button />` component (see #6)

**Success criteria**
- No section file > 150 lines
- Marketing copy edits land as 1-line changes in `content/`, no JSX touched
- Visual diff is zero (use Percy or manual screenshot before/after)

**Notes**
- Do this BEFORE #5 (i18n on landing) — translating a single 600-line file is
  worse than translating 14 small ones.

---

## 5. i18n on landing + onboarding
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — `src/i18n.js` already has 635 lines of KR/EN translations,
but only the dashboard uses them. Marketing is English-only despite K-Brand
positioning.

**Effort** — 2 days. Bulk of the work is writing the KR copy for marketing.

**Touches**
- All landing section files (after #4)
- `src/pages/OnboardingPage.jsx`
- Extend `src/i18n.js` with `landing.*` and `onboarding.*` keys
- `LangProvider` is already at App level (done in this session) — no new wiring

**Success criteria**
- Toggle in nav switches landing copy without route reload
- Browser language detection chooses `ko` for Korean visitors (already wired)
- Translation keys never fall through to the English fallback in CI

**Notes**
- Consider migrating from the hand-rolled `t()` to `react-i18next` if the key
  count grows past ~200. Today's 635 lines is fine, but pluralization +
  interpolation will start to pinch.

---

## 6. Reusable `<Button />` + small UI primitives
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — Today the same `lp-btn lp-btn--pri lp-btn--lg` class trio
is hand-typed in 7+ places. The CTA-unification PR earlier in this session had
to touch each call site individually.

**Effort** — half a day.

**Touches**
- New `src/components/ui/Button.jsx` with variants (`primary`, `secondary`,
  `ghost`) + sizes (`md`, `lg`) + optional `as={Link} to=...` prop
- Replace inline class strings in `LandingPage.jsx`, `OnboardingPage.jsx`,
  `AppSidebar.jsx`, pricing CTAs, footer
- Add `Button.test.jsx` for variant/size matrix

**Success criteria**
- No raw `<a className="lp-btn ...">` or `<button className="lp-btn ...">` in
  page-level code
- One change to `Button.jsx` propagates everywhere

**Notes**
- Pair with #3 (Tailwind theme) so the variants use design tokens, not BEM.
- Same exercise for `<Pill />`, `<Card />`, `<Stat />` if patterns repeat.

---

## 7. Comprehensive component test coverage
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — Currently 24 tests across 4 components + 1 utility. Critical
flows untested.

**Effort** — 1-2 days for the priority list below.

**Touches** — new test files under `src/__tests__/` or co-located:

- `LandingPage.test.jsx` — Hero CTA → `/dashboard` route, FAQ default-open 3,
  pricing CTA labels match spec
- `AppSidebar.test.jsx` — tab change, language toggle, coming-soon disabled state
- `ErrorBoundary.test.jsx` — child throws → fallback renders → retry recovers
- `RiskIntelligence.test.jsx` — happy-path mock fetch → KPI renders
- `LangProvider.test.jsx` — localStorage persistence, browser language detection
- `client.test.js` — extend with `withLongTimeout`, default timeout, base URL
  fallback

**Success criteria**
- ≥ 70% line coverage on critical components (RiskIntelligence, LandingPage,
  AppSidebar, ErrorBoundary, LangProvider)
- A Playwright e2e covering Landing → Onboarding → Dashboard happy path

**Notes**
- Use `msw` for API mocking; matches what the production code does.
- e2e: add Playwright as a separate workflow, not in the unit test path.

---

## 8. Brand assets (favicon, OG image, manifest)
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


**Why deferred** — Requires design assets, not just code.

**Effort** — 1 day once assets land.

**Touches**
- Replace `public/vite.svg` with branded favicon SVG + ICO fallback + Apple
  touch icon set
- Add `public/og-image.png` (1200×630) referenced from `index.html`
- Add `public/manifest.json` (PWA-ready, even if not installable yet)
- `index.html` — add `<link rel="apple-touch-icon">`, `<link rel="manifest">`,
  reference `og-image.png`

**Success criteria**
- Lighthouse PWA section ≥ 70
- Slack / iMessage / Twitter unfurl shows the brand image

**Notes**
- Park until #5 ships, since brand voice + logo will likely tighten alongside
  the i18n / KR launch.

---

## 9. Misc smaller items
**Owner:** TBD &nbsp;·&nbsp; **Tracking issue:** TBD


The cleanup list — group these into a single "frontend hygiene" PR if/when
someone has half a day.

- **AppSidebar text sizes** — currently `text-[7px]`, `text-[6px]`, `text-[9px]`.
  WCAG body-text minimum is 12px. Either bump sizes or commit to icon-only with
  proper `aria-label`s and `<title>` tooltips.
- **`aria-disabled="true"` buttons that still register clicks** — e.g. coming-soon
  CTAs in `LandingPage.jsx` and `AppSidebar.jsx`. Either use the real `disabled`
  attribute or wrap the click handler in a no-op when `aria-disabled` is set.
- **Sitemap.xml** — referenced in `public/robots.txt` but the file itself
  doesn't exist yet. Add a static `public/sitemap.xml` listing `/`, or generate
  it at build time once routing grows.
- **Self-host Inter + IBM Plex Mono** — currently loaded from Google Fonts via
  `@import url(...)`. Self-hosting + `font-display: swap` shaves 200-500ms LCP
  in cold loads.
- **`AppSidebar` color contrast** — `text-zinc-500` on `bg-zinc-900` is below
  WCAG AA for normal text. Bump to `text-zinc-400` or `text-zinc-300` for the
  inactive state.
- **`HeroPreviewCard` extraction** — currently inlined in `LandingPage.jsx`.
  Pulls into its own file when #4 happens.
- **`LangProvider` value memoized** — done in this session, but verify nothing
  consumes `setLang` directly without the destructure (would re-render on every
  parent change).

---

## What was DONE in this session (do not redo)

For context — these are the production-readiness items shipped before this
backlog was written:

- ESLint: 15 errors / 3 warnings → 0 / 0
- Code splitting: main bundle 1,103.81 KB → **58.88 KB** entry; heavy deps
  (`jspdf` + `html2canvas`, `@xyflow`, `recharts`) lazy-loaded on dashboard
  navigation only
- `OntologyGraph.jsx` hardcoded `localhost:8000/api` → `/api` (matches `client.js`)
- Axios global timeout 120s → 30s + `withLongTimeout` opt-in helper for scans
- `index.html` SEO meta: title, description, canonical, OG, Twitter, theme-color,
  font preconnect, robots
- `public/robots.txt` (`Disallow: /dashboard`, `/onboarding`)
- A11y baseline: global `:focus-visible`, `.lp-skiplink`, `prefers-reduced-motion`,
  `<main id="main-content">` landmarks on Landing + Dashboard
- App-level `ErrorBoundary` wraps all routes
- `LangProvider` hoisted to App, with localStorage persistence + browser
  language auto-detection + `<html lang>` sync
- `LangContext.jsx` split into `LangContext.js` (Context + hook) +
  `LangProvider.jsx` (Provider) — fast-refresh compliant
