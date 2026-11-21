# hive.ausbit.dev roadmap

Last updated: 2026-11-18

This is the active roadmap. It contains only open work. Delivered features and
their verification records live in `docs/workstreams/` and are not repeated
here.

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
| Initial route JavaScript | Keep the initial bundle below the CI budget |
| Route chunks | Each route-owned chunk stays within its budget |
| LCP / INP / CLS | LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1 at p75 |
| API reliability | p95 read latency ≤ 1.5s; failed-request rate < 1% |
| Cache efficiency | > 70% of repeat reads served without a network call |
| Resilience | Dead-node failover, offline shell and queue survive smoke tests |
| Accessibility | Zero axe WCAG A/AA violations on key routes at 1440px and 390px |
| Quality gate | Lint + unit + E2E + build + live smoke green for every workstream |

## Open work

W34 (the 2026-11-19 issue sweep) and W35 (its five reopen follow-ups) are
complete. See `docs/workstreams/W34-issue-sweep.md` and
`docs/workstreams/W35-issue-followups.md`.

W36 (Lightning receive and pay, v4vapp Phase 1–2) is complete and deployed:
lint, unit tests, build, performance budgets, the targeted Lightning E2E and a
live browser smoke are green. The full fast suite has four pre-existing
live-data failures unrelated to this workstream. See
`docs/workstreams/W36-lightning-bridge.md`. It ships with a documented CORS
fallback until v4v.app allowlists the production origin. Keepsats, POS and post
zaps remain open follow-ups.

W37 (dashboard Magi tokens, issue #76) and W38 (the last three open issues —
#50, #77 and #78) are complete. W38 adds community headers, forced dashboard
refreshes, an in-editor rows/masonry preview, auto-optimize and named layouts.
See `docs/workstreams/W37-dashboard-magi-tokens.md` and
`docs/workstreams/W38-dashboard-followups.md`.

W46 is the first composer slice from issue #82: image upload with Keychain and
SmartLock signing, drag/drop and paste, cover-image selection, an allow/decline
rewards choice, community subscription suggestions, and interoperable metadata
for descriptions, mentions, AI disclosure, countdowns, portfolio, collections
and display authors. It also renders that metadata on post pages and feed cards.
It is complete and deployed; the live smoke covered the composer, upload dialog,
post badges and the absence of page errors. See
`docs/workstreams/W46-post-composer-media.md`. Media embeds, a split live
preview, snippets, templates and the visual editor remain follow-ups.

W47 is the second composer phase: media embeds for video, audio and social
links; Write/Split/Preview modes with debounced live preview, top-down and
preview-embeds settings; HTML source mode; an expanded toolbar with headings,
task lists, table and media dialogs; list continuation, indentation and more
keyboard shortcuts. See `docs/workstreams/W47-composer-embeds-preview.md`.
Snippets, templates, draft recovery, the post-publish panel and an optional
visual editor remain.

W48 is the third composer phase: local snippets, post templates with a starter
library, draft search/sort/pinning/duplication, and a post-publish success
panel. See `docs/workstreams/W48-composer-snippets-templates.md`. Draft version
history, snippet/template import/export, and the optional visual editor remain.

Remaining follow-ups with no open GitHub issue: Keepsats/POS/post zaps from the
Lightning workstream, the optional #63 server-side existence check at the edge,
and the remaining composer roadmap phases. There is no other open issue backlog
at the time of writing.

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

> Read `docs/ROADMAP.md` first. It lists only open work; completed features and
> their verification records are in `docs/workstreams/`.
>
> Pick the next workstream from the agreed scope, give it the next W-number, and
> write its `docs/workstreams/W*-*.md` record alongside the code.
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
