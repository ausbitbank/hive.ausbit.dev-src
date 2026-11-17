# Phase 2 improvement program

Branch: `improve/phase-2` (based on `master` at the 2026-11-17 revamp).

This file is the durable source of truth for the phase-2 work. If the session is
compacted, resume by reading this file, `git status`, `git log --oneline -10`,
and the workstream logs in `docs/workstreams/`.

## Goal

Improve the live site in this order: **security → UX/accessibility → SEO →
functionality → performance/aesthetics**, without regressing the revamp.

## Rules

- Work on `improve/phase-2`; do not deploy until the final verification passes.
- One workstream at a time unless file ownership is disjoint.
- Agents must not `git commit`, `git push`, or deploy. The coordinator commits.
- Agents must not edit `package.json`/`bun.lock` unless their workstream owns it.
- Agents write a short worklog to `docs/workstreams/<id>-<name>.md`.
- Run `bun run lint` and `bun run build` after each integration batch.
- If a batch breaks the build, fix or revert that batch before continuing.
- Keep the public API of shared services stable; add helpers rather than
  rewriting call sites that another workstream owns.

## Workstreams

| ID | Name | Status | Owner | Files |
|----|------|--------|-------|-------|
| W1 | Security hardening | done | security agent | smartlock, communityHeader, safe URL helper, target=_blank, security docs |
| W2 | Mobile/UX/accessibility | pending | ux agent | MainLayout, header/search, accountHeader, carousels, browse toolbar, a11y |
| W3 | SEO/meta/sitemap | pending | seo agent | index.html, router, pages, meta utility, public/sitemap.xml |
| W4 | Functionality | pending | feature agent | blocks page, proposal votes, queue persistence, node selection, RC/account fee |
| W5 | Performance/aesthetics | pending | perf agent | sanitize-html→DOMPurify, moment→dayjs, animations, theme/polish |
| W6 | Tests/CI | done | test agent | vitest, unit tests, CI workflow, package scripts |

## Integration order

1. W1 + W6 (disjoint: W1 code, W6 tests/new files; package.json handled by
   coordinator after W1).
2. W2 + W4 (disjoint file sets; verify no overlap).
3. W3 (depends on W2/W4 page structure).
4. W5 (last; broad mechanical sweeps).
5. Final verification, merge to `master`, push, deploy.

## W1 — Security hardening

- [x] SmartLock: remove plaintext/key cache from `lscache`; unlock only in memory.
- [x] SmartLock: require password after reload; raise new-import password minimum;
      increase SJCL KDF iterations for new encryptions.
- [x] Replace `sscjs` with a small fetch-based Hive-Engine client (only `find`
      is used: wallet + token, 11 call sites). Coordinator removes the dep.
- [x] Sanitize community `description` / `flag_text` with DOMPurify.
- [x] Add `src/utils/safeUrl.js`; validate untrusted profile/token URLs in
      `accountHeader`, `communityHeader`, `userCard`, `token`.
- [x] Add `rel="noopener noreferrer"` to all `target="_blank"` anchors.
- [x] Add `docs/SECURITY.md` with nginx/Cloudflare CSP/HSTS/nosniff/referrer
      recommendations (no server credentials available from the repo).
- [x] Worklog `docs/workstreams/W1-security.md`.

Acceptance: no `lscache`/`sscjs` imports in `src`; no unsanitized `v-html`;
`bun run lint` and `bun run build` pass.

## W2 — Mobile/UX/accessibility

- [ ] Mobile search: visible trigger in the header; full-width dialog; reuse
      searchbox; remove `debounce="3000"`; support `@user/post`, full Hive URLs,
      tags, tx ids and block numbers.
- [ ] Responsive account tabs (no clipped tabs at 390px).
- [ ] Fluid carousel widths (fix 5px home overflow on 390px).
- [ ] Mobile browse toolbar: collapsible advanced filters.
- [ ] Internal Tools navigation in the drawer (blocks, nodes, health, proposals,
      witnesses, HBD, market, tax, create account, browse).
- [ ] Accessibility: fix viewport zoom, icon-only accessible names, image alts,
      progressbar labels, h1 on primary pages, skip link, focus styles,
      reduced-motion CSS.
- [ ] User-facing error/empty/loading states on primary pages (at least browse,
      HBD, wallet Hive-Engine, proposals, nodes).
- [ ] Settings/login copy: beneficiary explanation, remember-me behavior,
      theme labels.
- [ ] Worklog `docs/workstreams/W2-ux.md`.

Acceptance: mobile screenshots at 390px show no horizontal overflow/clipped
tabs; axe critical issues reduced to zero on home/account/wallet.

## W3 — SEO/meta/sitemap

- [ ] `src/utils/pageMeta.js` updating title, description, canonical, OG and
      Twitter tags; default tags in `index.html`.
- [ ] Apply per-page meta: home, account, post, block, tx, wallet, browse,
      proposals, witnesses, nodes, HBD, market.
- [ ] Post/account meta uses subject/summary/avatar/cover and article type.
- [ ] Add `public/sitemap.xml` for core static routes; update robots.txt.
- [ ] Add JSON-LD for posts (Article) and accounts (ProfilePage) where useful.
- [ ] Worklog `docs/workstreams/W3-seo.md`.

Acceptance: every primary page has non-empty title/description and OG/Twitter
tags; post/account canonical URLs resolve.

## W4 — Functionality

- [ ] `/blocks` live latest-blocks page with refresh; add to router and drawer.
- [ ] In-app proposal voting/unvoting via the existing queue (Keychain/SmartLock),
      replacing external HiveSigner vote links.
- [ ] Persist the broadcast queue with an expiry; restore with a notice.
- [ ] Startup API-node selection with health check and fallback; keep manual
      node switching.
- [ ] Live RC costs (or clearly remove the stale hard-coded claim if the chain
      API cannot provide them reliably).
- [ ] Account creation fee from chain properties instead of hard-coded 3 HIVE.
- [ ] Worklog `docs/workstreams/W4-features.md`.

Acceptance: `/blocks` updates, proposal vote enters the queue, queue survives
reload, no dead external vote paths for proposals.

## W5 — Performance/aesthetics

- [ ] Replace `sanitize-html` with a DOMPurify-based text/sanitize helper;
      remove the dependency and its ~197 KB chunk.
- [ ] Replace `moment` with a dayjs compatibility wrapper; remove moment.
- [ ] Restrict Quasar `animations` to the classes actually used.
- [ ] Add preconnect/dns-prefetch hints for chain/API/image origins.
- [ ] Proper theme handling: dark/light toggle separate from animated background;
      persist and apply.
- [ ] Visual polish: consistent headings, carousel overlays, card/button
      consistency, mobile table/grid behaviour, skeleton/empty states.
- [ ] Worklog `docs/workstreams/W5-perf.md`.

Acceptance: build JS/CSS totals decrease; dark/light toggle works; no visual
regressions on desktop/mobile smoke pages.

## W6 — Tests/CI

- [x] Vitest + jsdom config and scripts (`test`, `test:watch`, `test:coverage`).
- [x] Unit tests for safe URL, sanitize helpers, page meta, prices fallback,
      Hive-Engine fetch client, and hive store actions.
- [x] Playwright smoke config + route test (optional in CI; documented locally).
- [x] GitHub Actions: install, lint, test, build on push/PR.
- [x] Worklog `docs/workstreams/W6-tests.md`.

Acceptance: `bun run test` passes locally; CI workflow is present and valid.

## Verification checklist

- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test`
- [ ] local dev server smoke
- [ ] live deploy via `./scripts/deploy.sh`
- [ ] live smoke: home/account/wallet/blocks/nodes/browse/post/proposals/hbd/404
- [ ] rollback backup path recorded

## Deployment

Use `./scripts/deploy.sh`. The pre-phase-2 live build is backed up on
`hurgenburgen:~/hive-backups/`. Roll back with `./scripts/rollback.sh <backup>`.

## Decision log

- 2026-11-17: Phase 2 starts from `master` revamp; no dhive migration in this
  program (large, separate risk). Security, mobile UX and a11y take priority
  over new features.
