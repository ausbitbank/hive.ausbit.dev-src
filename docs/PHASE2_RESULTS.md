# Phase 2 results

Completed on branch `improve/phase-2` and merged to `master`.

## Security

- SmartLock no longer persists unlocked posting keys. Keys live in memory only;
  a reload requires the password again.
- Legacy plaintext `ausbitdev_peaklock_cache_v2_*` / `lscache-*` entries are
  purged automatically on first load.
- New SmartLock imports require an 8+ character password; new ciphertext uses
  100,000 SJCL KDF iterations.
- `sscjs` (and its vulnerable nested axios) removed; replaced with a small
  fetch JSON-RPC client with throttling, timeout and fallback hosts.
- Production dependency audit reduced from **25 findings (12 high)** to
  **2 high** — both `ws@3` inside `@hiveio/hive-js`, which is Node-only and
  unused by the browser build. A dhive migration remains the long-term fix.
- Community descriptions/rules and rendered posts are sanitized with DOMPurify.
- Untrusted profile/token URLs are scheme-checked; `target=_blank` links carry
  `rel=noopener noreferrer`.
- `docs/SECURITY.md` documents CSP/HSTS/nosniff/referrer header guidance; the
  headers still need to be applied at nginx/Cloudflare.

## UX / accessibility

- Mobile search added (the header search was desktop-only).
- Account/community tab strips no longer clip at 390px; mobile arrows and
  scrollable content are used.
- All primary pages have exactly one `h1`; mobile horizontal overflow is zero.
- Axe WCAG A/AA: **zero violations** on home, account and wallet.
- Icon-only controls have accessible names, images have alt text, progress bars
  are labelled, tab/badge contrast fixed, skip link and focus styles added.
- Internal Explore/Tools navigation, footer and quick links make every tool
  discoverable.
- Empty/error/loading states added for browse, prices, wallet Hive-Engine,
  proposals and nodes. Search accepts posts, accounts, tags, tx ids, blocks and
  Hive front-end URLs.
- Long post/comment content wraps instead of widening mobile pages. A recursive
  comment self-import that could blank post pages was removed.

## SEO / sharing

- Per-page titles, descriptions, canonical URLs, Open Graph and Twitter tags.
- Article and Profile JSON-LD for posts/accounts.
- `sitemap.xml` for core routes and a sitemap directive in `robots.txt`.
- Social crawlers without JS still see the default index.html card; SSR or edge
  meta injection is a documented follow-up.

## Functionality

- New `/blocks` page with 10-block live refresh, pause/resume and error/retry.
- In-app proposal vote/unvote through the existing broadcast queue.
- Queue persistence with a 24h TTL and owner guard; restored queues start
  **paused** until the user presses play.
- Startup API-node health selection (parallel probes, configured node wins) and
  faster failure detection.
- Account creation fee read from chain properties instead of hard-coded 3 HIVE.
- RC costs are explicitly labelled protocol approximations; the dead RC API was
  not reintroduced.

## Performance

- `moment` and `sanitize-html` removed; `dayjs` compatibility wrapper and
  DOMPurify-based text helpers used instead.
- Quasar animation CSS trimmed to the animation classes actually used.
- Preconnect/dns-prefetch hints for chain, image, price and Hive-Engine origins.
- Total JS: **3415 KB → 3185 KB**; total CSS: **255 KB → 248 KB**.

## Tests / CI

- Vitest + jsdom, **98 tests in 12 files** covering services, store mutations,
  timers, safe URL/HTML, Hive-Engine, node selection, queue persistence, meta,
  text/time helpers and SmartLock cache cleanup.
- GitHub Actions runs install → lint → test → build on push/PR.
- `bun run lint`, `bun run test` and `bun run build` pass.

## Deployment

- Deploy with `./scripts/deploy.sh` (backup-first, staged rsync).
- Roll back with `./scripts/rollback.sh <backup>`; the pre-phase-2 site backup
  remains on `hurgenburgen:~/hive-backups/`.

## Remaining follow-ups

1. Apply CSP/HSTS/X-Content-Type-Options/Referrer-Policy at nginx or Cloudflare;
   disable Rocket Loader or account for it in the CSP.
2. Migrate `@hiveio/hive-js` to `@hiveio/dhive`/wax and clear the remaining
   Node-only `ws` audit entries.
3. Add SSR/prerender or edge meta injection for social crawlers.
4. Optional light theme (the current UI is intentionally dark because several
   surfaces use explicit dark backgrounds).
5. Add Playwright route smoke tests to CI and Pinia store action tests.

## Production deployment

- Deployed to https://hive.ausbit.dev on 2026-11-17 from `master` commit
  `da9a91b`.
- Pre-phase-2 backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261117T085841Z.tar.gz`.
- Original pre-revamp backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261117T074127Z.tar.gz`.
- Live verification: all primary routes HTTP 200, no mobile overflow, one `h1`
  per page, OG/Twitter tags present, zero axe violations on home/account/wallet
  and no console errors.
