# W22 — Performance measurement, dashboard and hard-reload startup

Date: 2026-11-18
Status: complete
Baseline: W27 (`a1da1e1`)

## Scope

W22 establishes a repeatable performance baseline for home, browse, block, post,
wallet and the internal market; publishes a dashboard and CI budgets; analyses
the bundle; and removes the hard-reload flash caused by full-body crawler
snapshots. It also takes the first route-level splitting/deferral pass.

## Measurement

`scripts/perf-baseline.mjs` serves the production build with
`scripts/serve-dist.mjs`, which now negotiates Brotli/gzip. Each route runs in a
fresh browser context with the service worker blocked and a cold cache. The
script records:

- TTFB, FCP, LCP, CLS, DOMContentLoaded and load;
- encoded bytes for initial JS, route JS, total JS, CSS, fonts, images and total
  transfer;
- request counts and third-party request counts;
- the initial asset set from the built `index.html` and the largest chunks.

Modes:

```sh
bun run perf        # write latest.json, history.jsonl and the dashboard
bun run perf:check  # run the same measurement and enforce budgets
```

The dashboard is [`docs/performance/README.md`](../performance/README.md), the
machine-readable report is `docs/performance/latest.json`, trend history is
`docs/performance/history.jsonl`, budgets are
`docs/performance/budgets.json`, and the dependency notes are in
[`docs/performance/bundle-analysis.md`](../performance/bundle-analysis.md).

## Before and after

Same machine, same static server, cold cache, 1440×1000.

| Route | FCP before → after | LCP before → after | Route JS before → after | Total transfer before → after |
| --- | --- | --- | --- | --- |
| Home | 1844 → **124 ms** | 1844 → **452 ms** | 280.6 → **104.3 KB** | 871.7 → **632.0 KB** |
| Browse | 1724 → **52 ms** | 3712 → **2560 ms** | 294.3 → **111.4 KB** | 825.6 → **668.6 KB** |
| Block 1 | 1560 → **52 ms** | 1836 → **1208 ms** | 137.0 → **98.2 KB** | 667.1 → **625.4 KB** |
| Post | 1648 → **56 ms** | 3300 → **1964 ms** | 306.0 → **245.0 KB** | 858.7 → **774.1 KB** |
| Wallet | 1864 → **48 ms** | 3644 → **1560 ms** | 167.8 → **132.7 KB** | 770.4 → **671.9 KB** |
| Internal market | 1632 → **56 ms** | 1632 → **416 ms** | 136.1 → **95.6 KB** | 667.5 → **624.1 KB** |

After FCP is the static boot splash; LCP is the meaningful first content paint
of the app. Home LCP improved by **75.5%** and total transfer by **27.5%**.
Browse route JS fell by **62.1%**, wallet LCP by **57.2%** and block/post LCP
by **34–41%**. Initial shell JS is essentially unchanged at 318.3 KB (the
hive-js + Quasar entry chunk); the route work is what moved.

Home font transfer dropped from 228.2 KB to **167.7 KB** by self-hosting only
the Latin and Latin Extended Roboto subsets. Request counts fell on every
route (home 112 → 104, browse 124 → 118, wallet 119 → 114).

## Hard-reload startup fix

The old prerender captured `page.content()` after 3.5s, including the full body,
runtime-injected modulepreloads and live chain values. On a hard reload the
crawler snapshot appeared first and was then replaced when Vue mounted.

W22 chooses **metadata-only prerender**:

- the original built shell is retained unchanged (entry script, CSS, head);
- route-specific title, description, canonical, Open Graph, Twitter and JSON-LD
  are merged into the shell;
- no rendered body is written, so there is nothing stale to flash;
- a static boot splash paints immediately and is hidden by
  `#q-app:not(:empty)` as soon as Vue mounts;
- the duplicate `#q-app` id in `App.vue` was removed (`#app-root`), leaving one
  valid mount element;
- a `<!-- hive:metadata-only-prerender -->` marker makes the mode explicit;
- the service-worker shell cache was bumped to `v2` to retire old snapshots.

`scripts/lib/prerender-meta.mjs` holds the metadata merge and is unit-tested.
`bun run prerender` now writes metadata-only files for `/`, `/blocks`, `/browse`,
`/witnesses`, `/proposals`, `/hbd`, `/market`, `/markets`, `/health`, `/nodes`
and `/tax`.

Cloudflare Rocket Loader is active on production and rewrites module scripts.
`scripts/cf-compat.mjs` adds `data-cfasync="false"` to the entry script so
Rocket Loader does not defer the SPA unnecessarily.

### Verification

With all JS requests delayed for 1.2s:

- before JS: `#q-app` is empty, no `.q-header`, body background is the dark
  shell and the static title is present;
- after JS: header and `h1` appear normally;
- the static HTML contains zero `q-header`/`q-page` body markers.

## Bundle analysis and changes

Full detail: [`docs/performance/bundle-analysis.md`](../performance/bundle-analysis.md).

The largest remaining chunk is the entry (`index-*.js`), which contains the
hive-js stack (`bn.js`, `readable-stream`, `bluebird`, `bytebuffer`, `elliptic`)
and Quasar. The second-largest is the render-helper bundle. W22 split the
render-helper out of preview routes and deferred non-critical work:

- removed the blocking node probe from the `hivejs` boot; the configured node is
  used immediately and a faster fallback is probed on idle;
- replaced render-helper in home/browse/account previews with
  `src/utils/postPreview.js`; render-helper now loads only where a full body is
  rendered;
- made the community header async;
- made `jsonViewer`, `CommentForm`, `shareButtons`, `votesDialog`, queue,
  notifications and settings async/dialog-only;
- removed Axios (four calls now use `fetch`) and deleted its boot file and
  dependency;
- deferred the TradingView embed behind an explicit “Load chart” action;
- self-hosted only the Latin and Latin Extended Roboto subsets;
- removed the unused TradingView preconnect;
- added intent-based prefetch on internal link hover/focus.

Remaining opportunities are documented in the bundle analysis. The largest is
finishing the W20 read-path migration so hive-js/SmartLock can load only for
signing. CLS on wallet/post is still above the 0.1 target; W24 owns skeleton and
loading-transition work.

## Budgets and CI

`docs/performance/budgets.json` caps initial JS, route JS, total JS, CSS, total
transfer, LCP and CLS. `.github/workflows/ci.yml` now runs `bun run perf:check`
after the E2E/axe suite. The measured final run passes:

- initial JS **318.3 KB** (budget 345 KB)
- CSS **39.6–42.1 KB** (budget 55 KB)
- route JS **95.6–245.0 KB** (per-route budgets 125–280 KB)
- total transfer **624.1–774.1 KB** (per-route budgets 710–860 KB)
- LCP **416–2560 ms** (budget 8000 ms; CI headroom)
- CLS **0–0.256** (budget 0.5; W24 will tighten toward 0.1)

## Verification

- `bun run lint` — clean.
- `bun run test` — **33 files / 257 tests passing**.
- `bun run build` — succeeded, including feed and Rocket Loader compatibility.
- `bun run test:e2e` — **25 Playwright tests passing** (4.1 minutes), including
  axe at 1440px and 390px.
- `bun run perf:check` — passed.
- Browser smoke: hard reload with delayed JS, home/browse/block/post/wallet/
  market, lazy TradingView placeholder, preview images and prefetch hover.
- Deploy — `./scripts/deploy.sh` completed successfully.
  - Backup:
    `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261118T014540Z.tar.gz`
    (`5d325d0ba862f360d9d526b3342778f42ca13f2c94ef76a89d82fad2e355f69c`).
  - Activated index hash:
    `d8c603d027d7d89b6f84c280d9a14de6ad110f4d0dd4b70ae4e047abcf143c66`.
  - Prerender wrote metadata-only shells for the eleven key routes.
- Live smoke through Cloudflare (Rocket Loader active, service worker blocked,
  1.6 Mbit/s / 150 ms emulation):
  - static HTML has one `#q-app`, the boot splash, `data-cfasync="false"` on
    the entry script and **zero** prerendered body markers;
  - before JS the splash is visible and no header/body content is present; after
    mount the splash is hidden and the home `h1` is present;
  - `/blocks` and `/market` serve route-specific titles with metadata-only
    shells;
  - axe is clean on home and post after the standard settle;
  - zero console errors; lazy TradingView placeholder and hover prefetch work.

## Next

W23 — network and data resilience is next: API telemetry, timeout/retry/
cancellation hardening, failover visibility, cache invalidation and offline
read snapshots. W24 then owns startup/CLS refinement and the developer
performance panel.
