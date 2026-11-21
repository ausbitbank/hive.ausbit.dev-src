# W22 bundle analysis

Date: 2026-11-18
Baseline: W27 (`a1da1e1`) plus the W22 changes in this workstream

> **Post-migration note (2026-11-22, #88):** `@hiveio/hive-js` has been
> replaced. The preloaded JS set is now 31 files, 407 KB raw / 148 KB gzip /
> 131 KB Brotli; total JS is 3,473 KB raw / 1,135 KB gzip / 915 KB Brotli
> (down from 3,866 KB / 1,249 KB / 979 KB). The 794 KB raw / 219 KB gzip /
> 107 KB Brotli SmartLock chunk is now loaded on demand (account menu/login,
> queue, compose image signing, wallet keepsats) instead of during boot.
> `perf:check` passes; Home transfer is ~505 KB and Compose ~498 KB versus
> ~622 KB and ~615 KB before.

## Headline

The initial shell is still dominated by `@hiveio/hive-js` and the Quasar
framework, but route-level preview and interaction code is now substantially
smaller.

| Route | Route JS before | Route JS after | Change | Total transfer before | Total transfer after | Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 280.6 KB | 104.3 KB | −62.8% | 871.7 KB | 632.0 KB | −27.5% |
| Browse | 294.3 KB | 111.4 KB | −62.1% | 825.6 KB | 668.6 KB | −19.0% |
| Block 1 | 137.0 KB | 98.2 KB | −28.3% | 667.1 KB | 625.4 KB | −6.2% |
| Post | 306.0 KB | 245.0 KB | −19.9% | 858.7 KB | 774.1 KB | −9.9% |
| Wallet | 167.8 KB | 132.7 KB | −20.9% | 770.4 KB | 671.9 KB | −12.8% |
| Internal market | 136.1 KB | 95.6 KB | −29.8% | 667.5 KB | 624.1 KB | −6.5% |

The initial shell moved from **315.2 KB to 314.2 KB Brotli** (the entry chunk
is unchanged in composition); the win is that route work no longer pulls the
markdown renderer, the JSON viewer, Axios or dialog-only components on first
paint. Home FCP is ~0.12s (boot splash) and LCP ~0.45s locally instead of
~1.84s, mainly because the blocking node probe was removed from boot.

## Largest initial chunk

The entry `index-*.js` is 1.34 MB raw / 236.5 KB Brotli. Source-map attribution:

| Source group | Approx. source bytes |
| --- | ---: |
| `bn.js` | 693 KB |
| `readable-stream` | 330 KB |
| `quasar` | 279 KB |
| `@hiveio/hive-js` | 241 KB |
| `bluebird` | 179 KB |
| `bytebuffer` | 153 KB |
| `vue-router` | 120 KB |
| `elliptic` | 109 KB |

This is the `hive-js` signing/transport stack plus Quasar. It is eagerly
imported because `$hive` and the SmartLock/queue surfaces are available on
every page. Fully removing it from first paint requires migrating the remaining
read paths to the central API client and loading the signing stack only for
writes; that is a larger data-layer change than W22.

## Render-helper split

`browser-*.js` (373.8 KB raw / 119.3 KB Brotli) is `@ecency/render-helper` and
its markdown/HTML dependencies:

| Source group | Approx. source bytes |
| --- | ---: |
| `@xmldom/xmldom` | 270 KB |
| `autolinker` | 202 KB |
| `@ecency/render-helper` | 139 KB |
| `entities` | 131 KB |
| `remarkable` | 125 KB |
| `htmlparser2` | 49 KB |

Home/browse/account cards only need an image and a plain-text summary. W22 adds
`src/utils/postPreview.js` for those surfaces. `render-helper` now loads only
where a full body is rendered (the post page and the community header).

## Changes in this pass

- Removed the blocking Hive node probe from the `hivejs` boot: the configured
  node is installed synchronously and a healthy fallback is probed on idle.
- Metadata-only prerender: route HTML keeps crawlable `<title>`, description,
  canonical, Open Graph, Twitter and JSON-LD, but no body snapshot. This removes
  the hard-reload flash of stale chain data.
- Replaced preview uses of `@ecency/render-helper` with the local preview
  helpers (home rows, browse cards, recent/community carousels).
- Made the community header async, so normal browse pages do not load the
  renderer.
- Removed Axios: the four remaining calls use `fetch`. Axios is no longer a
  direct dependency or an eager boot file.
- Made `jsonViewer`, `CommentForm`, `shareButtons`, `votesDialog`, queue,
  notifications and settings async/dialog-only where the surface is not needed
  on first paint.
- Deferred the TradingView embed until the user requests the chart.
- Self-hosted only the Latin and Latin Extended Roboto subsets; removed the
  Cyrillic/Greek/symbol subset downloads.
- Added intent-based route prefetch on link hover/focus.
- Removed the unused TradingView preconnect from the HTML shell.

## W23 delta

W23 adds API telemetry, failover health state, the error boundary, offline
snapshots and the explicit service-worker update flow. The measured cost is
small and stays inside every budget:

- initial Brotli JS **314.2 → 318.7 KB** (+4.5 KB);
- route JS **+1.3–3.4 KB** (home +3.4 KB, browse/block/post/wallet/market
  +1.3–1.6 KB);
- total transfer **+4.4–8.6 KB**, with the same request-count band;
- LCP is unchanged within run-to-run noise and `bun run perf:check` passes.

Post and wallet CLS remain above the 0.1 target; that is the known W24
skeleton/loading-transition work, not a W23 regression.

## W24 delta

W24 keeps the initial Brotli shell at **318.7 KB** and spends a small amount of
route code on runtime polish:

- wallet route JS **134.3 → 134.7 KB** (synchronous account header removes the
  late header shift);
- post route JS **246.3 → 247.6 KB** (image preload plus decoded intrinsic
  dimensions before body paint);
- market route JS **96.9 → 97.5 KB** (stable loading placeholder);
- total transfer **+2.0–3.4 KB** on most routes; browse is **693.0 KB** when
  visible preview thumbnails load (480px Cloudinary variants), still under its
  730 KB budget. All budgets pass.

The measured CLS is now below the 0.1 target on every dashboard route:
home 0.008, browse 0.028, block 0, post 0, wallet 0.037 and market 0.023.
The slow-4G smoke also keeps post at effectively zero by reserving each image's
intrinsic dimensions before the body enters the DOM.

## Optimisation pass (2026-11-22)

A repo, dependency and bundle pass after the hive-tx migration removed the
remaining legacy weight without changing app behaviour.

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| SmartLock chunk (raw) | 794 KB | 33.8 KB | −95.7% |
| SmartLock chunk (Brotli) | 107.0 KB | 11.3 KB | −89.4% |
| Initial JS (raw) | 407 KB | 348.5 KB | −14.4% |
| Initial JS (Brotli) | 131 KB | 112.8 KB | −13.9% |
| Total JS (raw) | 3,473 KB | 2,721 KB | −21.6% |
| Total JS (Brotli) | 915 KB | 819 KB | −10.5% |
| `dist/spa` | 5.5 MB | 4.2 MB | −24% |
| `public/` | 774 KB | 274 KB | −65% |
| Tracked repo | 14.0 MB | 7.6 MB | −46% |

### Bundle

- **crypto-browserify removed from SmartLock.** `sjcl` probes Node's
  `require('crypto').randomBytes` inside a try/catch. The Node polyfill plugin
  resolved that probe and bundled `bn.js`, `elliptic`, `readable-stream` and
  friends (about 700 KB raw). A tiny `src/shims/crypto.js` override leaves
  `randomBytes` undefined, so sjcl stays on `window.crypto.getRandomValues`.
- **Buffer moved out of the shell.** Only the lazy `hive-tx` path needs a
  global `Buffer`. `src/services/hiveTx.js` now imports the polyfill just
  before `import('hive-tx')`; SmartLock uses `TextEncoder`/`TextDecoder` and
  `Uint8Array`.
- **DOMPurify split from text helpers.** `src/utils/safeHtml.js` keeps the
  text-only helpers used by home/account/browse. DOMPurify moved to
  `src/utils/safeRichHtml.js`, which is only loaded by community headers.
- **Dead code removed.** `components/block.vue` (replaced by `pages/block.vue`),
  its `animInt.vue` helper, and five unreferenced components
  (`coingecko`, `recentPostsCarousel`, `savingsWithdrawalsInProgress`,
  `convertRequests`, `ui/FilterBar`).
- **Dependencies removed.** `gsap` (only used by the dead `animInt`) and
  `@hiveio/hivescript` (only its 16 KB `bad-actors.json` was used; now vendored
  at `src/data/badActors.json`).

### Assets and repo size

- `palnet.svg` 362 KB → `palnet.webp` 2.2 KB; `leofinance.svg` 32 KB → 3.1 KB;
  `member.png` 77 KB → 4.0 KB; `lightning.png` 17 KB → 4.0 KB.
- Removed nine unreferenced PWA icon sizes and the legacy root
  `app-icon.png`/`app-splashscreen.png`.
- 50 documentation screenshots converted from PNG to WebP (9.1 MB → 3.2 MB)
  with their Markdown references updated.

### Follow-up: icon font, budgets and the renderer probe

- **Material Icons subset.** The full font is 128.6 KB and only 367 of its 2,234
  ligatures are referenced. `bun run icons:subset` regenerates a 20.5 KB subset
  (**−84%**), and `tests/unit/icon-font.spec.js` fails if a new icon is added
  without regenerating it. The font is self-hosted from
  `public/statics/material-icons-subset.woff2`.
- **`@quasar/extras` removed.** The 36 MB package was only supplying the full
  icon font and nine Animate.css transitions. The font is subset above and the
  transitions are vendored in `src/css/animations.css`, dropping the dependency
  entirely. The upstream font and its license are kept in `scripts/assets/` for
  the generator.
- **Budgets tightened.** `docs/performance/budgets.json` now guards the gains:
  initial JS 356 → 160 KB, per-route JS/transfer budgets cut to roughly 10–15%
  above the current measurements, LCP 8,000 → 5,000 ms and CLS 0.5 → 0.1.
- **Home transfer 486.2 → 383.8 KB** after the font subset, with initial JS
  unchanged at **126.3 KB** encoded.
- **Renderer DOM parser stays.** Replacing `@xmldom/xmldom` with the browser's
  native `DOMParser`/`XMLSerializer` was prototyped. On a 54-case corpus it
  changed malformed-HTML recovery, CDATA, `<template>`/`<noscript>` and table
  serialization. render-helper's security boundary explicitly assumes xmldom's
  parsing/serialization, so the 270 KB parser stays.

### Follow-up: dev loop and shell polish

- **Node polyfill plugin removed.** `vite-plugin-node-polyfills` was only
  resolving `buffer`, `crypto` and render-helper's `querystring` import. Three
  explicit aliases (`buffer/`, `src/shims/crypto.js`,
  `src/shims/querystring.js`) replace it, removing about 9 MB of build-time
  dependencies. A unit test checks the querystring shim against Node's.
- **Vitest runs ~5× faster.** `pool: 'vmThreads'` reuses one jsdom environment
  per worker and `tests/setup.js` exposes Node WebCrypto to the signing tests.
  The suite dropped from ~30 s to ~6 s. Happy DOM was evaluated and rejected:
  DOMPurify's security tests returned unsanitised HTML under it.
- **Smaller shell.** Quasar 2.35.6 (patch), the unused `LoadingBar` plugin
  removed, and Vite's `modulePreload` polyfill disabled for the modern target.
  The icon font is now preloaded alongside Roboto.
- **Post LCP hint.** The first body image on a post page is marked
  `fetchpriority="high" loading="eager"`; every other image stays lazy.
- **Smaller avatars.** Avatars now use the image service's 64px `small`
  variant (8.6 KB) instead of the default 128px image (30.6 KB); only the
  88px account header keeps `medium`. A witness page with 50 avatars drops
  about 1.1 MB of image transfer.
- **SVGs optimised.** The remaining service icons were run through SVGO
  (`--multipass`), saving another ~8.8 KB of static assets.
- **Initial JS 352.0 → 348.5 KB raw / 113.8 → 112.8 KB Brotli.** The post
  renderer remains the largest lazy chunk; removing its `autolinker` dependency
  would save ~15 KB Brotli but changes fuzzy-domain linkification, so it was
  left alone.

`bun run perf:check` passes. The heaviest remaining lazy chunk is still the post
renderer (`@ecency/render-helper`, 126 KB Brotli).

## Remaining opportunities

1. **hive-js in the initial chunk.** Done in #88: signing/keys/memos use a
   lazy-loaded `hive-tx`, reads use `src/services/api.js`, and the hive-js
   serializer chunks are no longer in the preload set.
2. **Quasar component graph.** The framework share of the entry chunk is still
   significant. Route-level Quasar component imports are already tree-shaken,
   but a component-usage audit may remove more.
3. **Material Icons.** Done: the font is now a 20.5 KB subset with a guard test
   (`bun run icons:subset`).
4. **CLS on wallet and post.** Wallet remains ~0.23 CLS and post ~0.18 CLS from
   asynchronous data landing. The dashboard now measures it; W24 owns the
   skeleton/loading-transition work.
5. **HTTP/2 request count.** The app still makes ~100 requests on first load
   because Quasar/Rolldown emits many small shared chunks. HTTP/2 handles this
   well in production, but chunk consolidation may help weak networks.
6. **Post renderer DOM parser.** `@xmldom/xmldom` is 270 KB of the lazy post
   chunk. A native-DOM swap was prototyped and rejected (see above); reducing
   it further needs render-helper's own differential fuzz plus a browser-native
   serializer that preserves its nonce boundary.

## How this was measured

`bun run build` then `bun run perf` (see `docs/performance/README.md`). Source
attribution used a one-off `PERF_SOURCE_MAP=1 bun run build` and the generated
`.map` files; source maps are not part of the normal production build.
