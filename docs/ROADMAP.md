# hive.ausbit.dev roadmap

Last updated: 2026-11-18

This is the active roadmap. Completed work is recorded in
`docs/workstreams/`; the previous priority list was retired after W21.

## Current state

The explorer is feature-complete through W25, with W27 UI polish and W22
performance work delivered early and W23 resilience, W24 runtime polish and
W25 governance intelligence layered on top.

- Verified W16–W21 baseline: `7b82f97`.
- W27 UI polish: `docs/workstreams/W27-ui-polish.md`.
- Issue triage #30–#42: `docs/workstreams/W27b-issue-triage.md`.
- W22 performance: `docs/workstreams/W22-performance.md`.
- W23 network and data resilience:
  `docs/workstreams/W23-network-resilience.md`.
- W24 runtime polish and startup: `docs/workstreams/W24-runtime-polish.md`.
- W25 governance and community intelligence:
  `docs/workstreams/W25-governance-intelligence.md`.
- Fast E2E through Obscura: `docs/workstreams/W25b-e2e-obscura.md`.
- W16–W21 delivered wallet, witnesses/health/nodes, markets, queue/login/
  notifications, the data layer and the hardening pass.
- 47 unit-test files / 333 tests, 40 Playwright E2E tests, green build.
- Fast local E2E: 16 functional tests through Obscura (~35s); the full
  Chromium suite remains the CI/release gate. See `docs/e2e.md`.
- Performance dashboard: `docs/performance/README.md`.
- Production is deployed from the W25 build with the nginx header/metadata policy.

The next phase is W26 — drafts and creator workflow. Search and discovery remain
planned on top of the measured, resilient foundation.

## Vision

Make hive.ausbit.dev the fastest, most trustworthy Hive explorer for people who
use the chain every day: quick to open, resilient on weak or dead API nodes,
comfortable on mobile, and deep enough for governance, discovery and publishing
workflows.

## Product principles

1. **Fast by default.** Measure before changing. Enforce route and bundle budgets
   in CI. Prefer fewer requests, smaller payloads and progressive loading.
2. **Reliable under failure.** Every network path has a timeout, a fallback and a
   clear stale/error state. A dead node must not become a dead page.
3. **Evidence over guesses.** New behaviour gets unit tests, E2E coverage where it
   matters, and axe checks at desktop and mobile widths.
4. **Least privilege.** Posting keys stay posting; active actions stay active.
   Signing intent must be visible before broadcast.
5. **Accessible and mobile-first.** One page-level `h1`, semantic tables, visible
   focus, reduced-motion support and no horizontal overflow.
6. **No unbounded scope.** Each workstream ships independently with a documented
   verification record.

## North-star metrics

| Area | Target |
| --- | --- |
| Initial route JavaScript | Define a CI budget, then keep it below the agreed ceiling |
| Route chunks | Each route-owned chunk stays within its budget |
| LCP / INP / CLS | LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1 at p75 |
| API reliability | p95 read latency ≤ 1.5s; failed-request rate < 1% |
| Cache efficiency | > 70% of repeat reads served without a network call |
| Resilience | Dead-node failover, offline shell and queue survive smoke tests |
| Accessibility | Zero axe WCAG A/AA violations on key routes at 1440px and 390px |
| Quality gate | Lint + unit + E2E + build + live smoke green for every workstream |

## Track 1 — Performance and reliability (primary)

This track comes first. It unlocks every later feature by making the app faster
and safer to extend.

### W22 — Performance measurement, dashboard and hard-reload startup

**Status: complete (2026-11-18).** See
`docs/workstreams/W22-performance.md` and `docs/performance/`.

- Add repeatable performance baselines: Lighthouse/Playwright runs for home,
  browse, block, post, wallet and market surfaces.
- Publish a performance dashboard for key routes: CI Lighthouse reports, route
  chunk sizes, budgets and trend history, linked from the README/docs.
- Fix the hard-reload flash of unstyled/prerendered content introduced by the
  crawler snapshots. Choose one: metadata-only prerender, hydration-safe
  hiding of the prerendered body, or remove body snapshots. Verify on production
  with Cloudflare Rocket Loader enabled and throttled network profiles.
- Analyse the current bundle (largest route/vendor chunks, duplicate
  dependencies, heavy libraries).
- Split route-level code, defer non-critical dialogs/editors and prefetch likely
  next routes on intent.
- Optimise images, fonts, icons and third-party embeds.
- Add CI budgets for initial JS, route chunks, CSS and total transfer size.
- Record before/after numbers in the workstream doc.

### W23 — Network and data resilience

**Status: complete (2026-11-18).** See
`docs/workstreams/W23-network-resilience.md`.

- Add structured telemetry for the central API client: success rate, latency,
  retries, failover events and cache hit/miss.
- Harden timeouts, retry policy, cancellation and node rotation.
- Add error boundaries and consistent stale-data fallbacks across remaining
  pages.
- Verify every cache has an invalidation path after writes.
- Add offline data snapshots for selected read-only views while keeping signing
  actions blocked offline.
- Make service-worker updates explicit: update-available prompt and safe reload.

### W24 — Runtime polish and startup

**Status: complete (2026-11-18).** See
`docs/workstreams/W24-runtime-polish.md`.

- Reduce startup work: defer boot-only services and route-independent polling.
- Improve skeleton/loading transitions and avoid layout shift when data lands.
- Add performance regression smoke coverage for slow-network profiles.
- Verify PWA install, update and offline-navigation flows end to end.
- Add a small performance status panel for developers (route chunk sizes, cache
  hits, API node health) behind a query flag.

## Track 2 — Governance and community

### W25 — Governance and community intelligence

**Status: complete (2026-11-18).** See
`docs/workstreams/W25-governance-intelligence.md`.

- Witness analytics: approval-stake concentration, top-21/top-50 share, HHI and
  Gini, feed freshness, version drift, missed-block leaders, a local trend
  column and on-demand voter segments by HP and account age.
- Proposal analytics: committed daily funding, 30/90-day projections, estimated
  paid-to-date, monthly outlook, top creators, receivers and inferred topics;
  voter overlap against the return proposal on proposal detail.
- Delegation explorer: outbound and inbound delegations, effective HP, share of
  owned/effective stake and a recent delegation change timeline.
- Community insight pages: subscribers, active authors, posting cadence, pending
  payouts, top recent authors, reward concentration and moderation signals.
- Account authority risk: key reuse, shared authority, single-key control,
  proxy and governance-vote expiry signals, owner-key age and readable diffs
  for queued permission changes.

## Track 3 — Content creation

### W26 — Drafts and creator workflow

- Local drafts with autosave, restore and explicit discard.
- Rich markdown editor improvements: tables, image insertion, preview parity,
  keyboard shortcuts and draft length guidance.
- Cross-posting and community selection with clear beneficiary/authority
  preview.
- Publish checklist: tags, beneficiaries, reward settings, community and
  expected posting key.
- Export/import drafts as JSON for backup.

## Track 4 — UI polish and visual consistency

This is a continuous layer applied during every workstream, with a dedicated
audit pass below. It is not just cosmetic: spacing, alignment and density affect
scanability and perceived reliability.

### W27 — UI polish and visual consistency audit

**Status: complete (2026-11-18), pulled forward ahead of W22–W26.** See
`docs/workstreams/W27-ui-polish.md` for the measurements and before/after
evidence.

- **Header lockup:** fix the `src/layouts/MainLayout.vue` hive icon and title
  gap, optical alignment, icon sizing and responsive hiding. Audit the search,
  queue, notifications, account and settings action group spacing.
- **Post sidebar:** rebuild the spacing rhythm in `src/pages/post.vue` around the
  author card, post-details card and tip/metadata actions. Align card headers,
  labels and values; reduce sparse/dead space; make action buttons and dividers
  visually consistent; verify sticky and mobile behaviour.
- **Card and list rhythm:** audit padding, 4/8px spacing, icon-text gaps, button
  heights, focus rings, separators and empty-state balance across account,
  wallet, witness, market and post cards.
- **Navigation and drawers:** align sidebar sections, section headers, icon
  columns and footer content; check mobile drawer density.
- **Typography:** consistent eyebrow/title/body/meta scale and truncation
  behaviour; avoid one-character label wraps.
- **Visual regression evidence:** before/after screenshots at 1440px and 390px;
  axe zero; no overflow; no layout shift during load.

## Track 5 — Search and discovery

### W28 — Unified search and discovery

- One search surface for accounts, posts, tags, communities, blocks,
  transactions, proposals and witnesses.
- Typed suggestions and facets, with direct-route parsing preserved.
- Saved searches and shareable search URLs.
- Tag and community analytics: trending authors, reward distribution, posting
  cadence and related tags.
- Recommendation rails based on followed tags/communities, without hiding the
  chronological option.
- Keyboard-first result navigation and recent-search management.

## Sequencing

| Phase | Workstreams | Outcome |
| --- | --- | --- |
| Delivered early | W27, W22 | UI polish complete; measured speed, dashboard and hard-reload fix complete |
| 1 | W23 | Network and data resilience — complete |
| 2 | W24 | Stable startup, updates and offline behaviour — complete |
| 3 | W25 | Deep governance and community intelligence — complete |
| 4 | W26 | Creator workflow on top of the reliable platform |
| 5 | W28 | Search and discovery, last by request |

Tracks may overlap only when they share a dependency. W27, W22, W23, W24 and
W25 were pulled forward and landed first; the next workstream is W26.
Performance and reliability land before feature work that would otherwise make
the bundle or network layer harder to reason about. UI polish remains a
continuous layer, with W27 as the formal audit and cleanup pass.

## Definition of done

Every workstream must include:

- A `docs/workstreams/W*-*.md` record with scope, components, authorities,
  verification and notes.
- `bun run lint`, `bun run test`, `bun run build` and `bun run test:e2e` green.
- Axe checks at 1440px and 390px for affected routes.
- A browser smoke of the key flows, including stale/error states.
- Deploy with `./scripts/deploy.sh` and a live production smoke.
- Unit/E2E test counts, build/deploy status and backup path reported.
- Commit and push to `origin/master`, with a clean working tree.

## Standards

- Vue 3 + Quasar 2 + Vite.
- Design tokens and `.home-card` / `.home-panel` patterns.
- One page-level `h1`; section headings are `h2`.
- Sanitized UGC and `noopener noreferrer` on external links.
- Posting/active queue authorities preserved exactly.
- Expandable raw JSON on explorer pages.
- Shared UI primitives under `src/components/ui/`.
- Central API client and cached read layer for chain data.
- Visibility-aware polling; no background polling without intent.
- Prefer semantic tables, real buttons and keyboard-operable surfaces.

## Suggested new-session prompt

> Read `docs/ROADMAP.md` first. The verified W16–W21 baseline is `7b82f97`;
> W27 UI polish, W22 performance, W23 resilience, W24 runtime polish and W25
> governance intelligence were delivered on top of it. W16–W25 are complete,
> with 47 unit-test files / 333 tests and 40 Playwright E2E tests passing.
> Production is deployed from the W25 build.
>
> Start **Track 3 — W26: Drafts and creator workflow**. Do not start W28 yet;
> W28 search stays last.
>
> Add local drafts with autosave/restore, richer markdown editing, cross-posting
> and community selection, a publish checklist and JSON draft export/import on
> top of the measured, resilient platform.
>
> Follow the standards in this roadmap: design tokens, one page-level `h1`,
> posting/active authority correctness, sanitized UGC and `noopener noreferrer`.
>
> Run `bun run lint`, `bun run test`, `bun run build` and `bun run test:e2e`, run
> axe at 1440px and 390px, smoke the key flows, deploy with
> `./scripts/deploy.sh`, and live-smoke production. Update `docs/workstreams/`
> and this roadmap, report unit/E2E counts, build/deploy status and backup path,
> then commit and push the verified work with a clean working tree.
>
> Do not redo finished workstreams except for integration fixes.
