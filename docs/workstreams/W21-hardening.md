# W21 — Quick wins and hardening

Date: 2026-11-18
Status: complete

## Scope

Priority 6: end-to-end and accessibility coverage, CI hardening, the offline
shell, SEO feed/prerender, keyboard shortcuts, back-to-top, a searchable 404,
copy/share actions, and a full README revamp.

## E2E and CI

Added Playwright and axe-core with a production-style test harness:

- `playwright.config.js` runs against `dist/spa` served by
  `scripts/serve-dist.mjs` with history fallback.
- `bun run test:e2e` runs the suite; `bun run test:e2e:build` builds first.
- Unit tests remain Vitest (`bun run test`).

`e2e/` covers:

- login key-guide copy and simulated session restore;
- comment composer queuing a posting `comment`;
- proposal support/unvote queuing an active `update_proposal_votes`;
- wallet transfer dialog queuing an active `transfer`;
- queue sent/failed states and clear-completed controls;
- browse filters and card/list/table layout state;
- 404 direct search resolving a block;
- keyboard shortcuts (`?`, `g` sequences);
- back-to-top behaviour;
- copy/share menu contents;
- PWA manifest, RSS feed, service worker and offline assets;
- axe WCAG A/AA checks on `/`, `/browse`, `/blocks`, `/witnesses`,
  `/proposals`, `/hbd`, `/market` and `/markets` at 1440px and 390px.

The GitHub Actions workflow now installs Chromium and runs the E2E/axe suite
after the production build, uploading failure artifacts.

## PWA, offline and feed

- `public/manifest.webmanifest` with app icons, theme colours and standalone
  display.
- `public/sw.js`: network-first navigation with a cached `index.html` shell,
  stale-while-revalidate for same-origin assets, and an offline fallback.
- `public/offline.html` for a cold offline navigation.
- `src/boot/pwa.js` registers the service worker only in production and shows
  online/offline status notifications.
- Queue broadcasts check `navigator.onLine` and mark the action failed with a
  clear retry message when offline.
- `scripts/generate-feed.mjs` writes `dist/spa/feed.xml` from the project
  author’s Hive blog after each build; failures fall back to a valid feed.
- `index.html` advertises the manifest, RSS alternate and theme colour.

## SEO

- `scripts/prerender.mjs` renders key routes with Chromium after the build and
  writes crawlable HTML snapshots into `dist/spa/<route>/index.html`.
- Local prerender URLs are rewritten to relative paths before writing.
- The deploy script runs prerendering after the build when a browser is
  available; failure is non-fatal and leaves the normal SPA fallback.
- `public/sitemap.xml` covers the main static routes and `public/robots.txt`
  points to it.
- Existing post/account JSON-LD structured data remains in place.

## Navigation and page UX

- **Keyboard shortcuts**: `Ctrl K`/`/` open search, `?` opens the shortcut list,
  and `g` then `h/b/w/m/p/n/s` navigates to Home, Blocks, Witnesses, Markets,
  Proposals, API nodes and Health.
- **Back-to-top** floating action appears after scrolling a long page and
  respects reduced-motion preferences.
- **404 page** rebuilt with direct search (`@account`, `#tag`, block number,
  transaction id, proposal id or supported Hive URL), example queries and quick
  links. It keeps one page-level `h1`.
- **Copy/share** menus on blocks, transactions, accounts and proposals: copy
  link, copy Markdown and native share when supported.
- Share and shortcut surfaces were checked with axe while open.

## README

The README now documents the project overview, screenshots, route/feature tour,
keyboard shortcuts, stack, architecture, data layer, local setup, commands,
unit/E2E testing, deployment/rollback, data sources, key authorities/security,
documentation links and license.

## Verification

- `bun run lint` — clean.
- `bun run test` — **31 files / 245 tests passing**.
- `bun run build` — succeeded, including `feed.xml`.
- `bun run test:e2e` — **20 Playwright tests passing** (3.8 minutes), including
  axe checks at 1440px and 390px.
- Prerender generated snapshots for `/`, `/blocks`, `/browse`, `/witnesses`,
  `/proposals`, `/hbd`, `/market`, `/markets`, `/health`, `/nodes` and `/tax`.
- Deployed with `./scripts/deploy.sh` (lint, build, feed, prerender, backup,
  upload, activate). Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261117T171446Z.tar.gz`
  (`d99025bb38de2faca6d75e70b900a84406f78d562afd96ffc9707dff47266d31`).
- Live smoke on `https://hive.ausbit.dev`:
  - manifest, feed, service worker and offline page return 200;
  - feed contains items;
  - homepage, browse, HBD, internal market and block 1 render one `h1` with zero
    horizontal overflow;
  - prerendered `/blocks` and `/hbd` responses contain static headings;
  - 404 search resolves `/block/1`;
  - shortcuts dialog opens, share menu opens, back-to-top appears;
  - service worker registers at the site scope;
  - zero axe violations after the surfaces settle, no console errors.

## Notes

- The service worker is production-only (`import.meta.env.PROD`) and uses a
  versioned shell cache. Navigation stays network-first so a deploy is picked up
  on the next online visit.
- Prerendering is intentionally optional. It improves crawler output when
  Chromium is available but does not break the SPA fallback if it is not.
- Playwright tests wait for Vue to mount before interacting because prerendered
  HTML is visible before event handlers attach.
- The queue still stores operations, not private keys, and keeps the active-key
  confirmation rules from W19.
