# Performance dashboard

Generated 2026-11-26T02:19:06.723Z from commit `326ad27` (local).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose and
search pages. It is intentionally repeatable locally and in CI rather than tied
to a hosted Lighthouse account.

No simulated network latency. Set `PERF_API_LATENCY_MS` / `PERF_IMAGE_LATENCY_MS` to model
slow public nodes and media hosts, and `PERF_SETTLE_MS` to extend the
measurement window.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 136 ms | 1128 ms | 0.005 | 132.600 KB | 183.600 KB | 52.600 KB | 434.400 KB | 192 |
| Browse | 52 ms | 2980 ms | 0 | 132.600 KB | 152.100 KB | 49.500 KB | 399.800 KB | 171 |
| Block 1 | 40 ms | 1228 ms | 0 | 132.600 KB | 128.200 KB | 45.400 KB | 371.800 KB | 120 |
| Post | 48 ms | 2916 ms | 0 | 132.600 KB | 312.300 KB | 51.700 KB | 563 KB | 164 |
| Wallet | 56 ms | 1812 ms | 0.036 | 132.600 KB | 165 KB | 50.100 KB | 421.300 KB | 163 |
| Internal market | 52 ms | 324 ms | 0.023 | 132.600 KB | 120.800 KB | 45.700 KB | 365.600 KB | 112 |
| Compose | 40 ms | 380 ms | 0.007 | 132.600 KB | 167.300 KB | 48.800 KB | 414.300 KB | 119 |
| Search | 60 ms | 316 ms | 0 | 132.600 KB | 132 KB | 45.900 KB | 376.100 KB | 125 |

## LCP element

The gap between FCP and LCP is almost always the first chain read or the first
post image, not the JS shell. This table names the element that actually won.

| Route | LCP | Element |
| --- | ---: | --- |
| Home | 1128 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://images.hive.b` |
| Browse | 2980 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://files.peakd.c` |
| Block 1 | 1228 ms | `SPAN block-metric__value block-metric__mono` |
| Post | 2916 ms | `IMG https://images.hive.blog/p/23KQwnti57stuXpnvnU2ByoTTe7rtyo8v5uYk1kPymfyjguJmftL7537KDU3LSmGFFxDipLuZBrmJzt1NMLvKJPXj` |
| Wallet | 1812 ms | `DIV col-12 text-center full-width account-header` |
| Internal market | 324 ms | `P market-intro` |
| Compose | 380 ms | `P compose-hint` |
| Search | 316 ms | `P page-intro` |

Initial bundle snapshot: **178.400 KB gzip**
/ **153.900 KB Brotli** (entry shell and
modulepreloads).

The home shell also carries the pre-warmed snapshot: **11 KB Brotli** (40.5 KB JSON). It is HTML transfer, not JS.

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

The 2026-11-24 W73 Phase 1 moderation slice added the shared content-policy
decision to Home, Browse, Post and Search. The values above are the measured
post-change budgets after the moderation store was kept out of the guest routes
and the blocked notice was made async. LCP and CLS budgets are unchanged;
initial JS remains 160 KB.

The 2026-11-25 W76 transparency pass added per-voter content exclusion when
`active_votes` is present and a partial-list-index reason. It moved the shared
content policy by about 1 KB on Home, Browse, Post and Search; those route JS
budgets (and Home's total JS) were raised by 1–4 KB. Initial JS and LCP/CLS
budgets are unchanged.

The 2026-11-25 W77 default-on phishing floor adds a small dynamically imported
safety-floor chunk that starts its cached list read at boot, before the first
feed render. It adds roughly 2–5 KB to the route transfer for every route
because the floor protects guests on any content surface; the route JS and Home
total budgets were raised accordingly. Initial JS, CSS, LCP and CLS budgets are
unchanged.

The 2026-11-25 W79 image-proxy preference is imported by the shared render,
short-form media and post-preview paths, so it adds roughly 1–2 KB to every
route's JS. Route JS (and the affected total-JS) budgets were raised by 2–4 KB
with 1 KB headroom. Initial JS, CSS, LCP and CLS budgets are unchanged.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 160 | 185 | 55 | 560 | 2500 | 0.1 |
| Browse | 160 | 155 | 55 | 560 | 3500 | 0.1 |
| Block 1 | 160 | 130 | 55 | 520 | 2500 | 0.1 |
| Post | 160 | 314 | 55 | 700 | 3500 | 0.1 |
| Wallet | 160 | 167 | 55 | 560 | 3500 | 0.1 |
| Internal market | 160 | 122 | 55 | 500 | 2000 | 0.1 |
| Compose | 160 | 170 | 55 | 540 | 2000 | 0.1 |
| Search | 160 | 133 | 55 | 500 | 2000 | 0.1 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `browser-BhLO-hLA.js` | 361.700 KB | 139 KB | 116.900 KB |
| `index-0E6BhVPq.css` | 250.900 KB | 43.100 KB | 34.300 KB |
| `index-Dn3fQA7B.js` | 221.500 KB | 72.600 KB | 62.800 KB |
| `Index-zhMJ1Zfq.js` | 156.500 KB | 42.400 KB | 35.900 KB |
| `compose-kBYF116A.js` | 148.200 KB | 38.400 KB | 33.300 KB |
| `dist-Lbnn-ipf.js` | 94.400 KB | 33.400 KB | 29.200 KB |
| `wallet-BoXjL1iH.js` | 87.200 KB | 22.900 KB | 20 KB |
| `MainLayout-zeT8gtIA.js` | 85.100 KB | 25 KB | 21.800 KB |
| `account-DcskA2Wx.js` | 62.100 KB | 17.700 KB | 15.600 KB |
| `witnesses-BTw1-rIK.js` | 53.700 KB | 15.900 KB | 14.100 KB |
| `runtime-core.esm-bundler-B7XIQ4CZ.js` | 48.900 KB | 19.800 KB | 18 KB |
| `skinStudio-BOXQOHfu.js` | 43.200 KB | 12.300 KB | 10.800 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| local | 326ad27 | 2026-11-26 02:19 | Home LCP 1128ms / total 434.4KB<br>Browse LCP 2980ms / total 399.8KB<br>Block 1 LCP 1228ms / total 371.8KB<br>Post LCP 2916ms / total 563KB<br>Wallet LCP 1812ms / total 421.3KB<br>Internal market LCP 324ms / total 365.6KB<br>Compose LCP 380ms / total 414.3KB<br>Search LCP 316ms / total 376.1KB |
| snapshot-first | 3c0ec1c | 2026-11-22 08:08 | Home LCP 1188ms / total 384.4KB<br>Browse LCP 2300ms / total 386.3KB<br>Block 1 LCP 1480ms / total 339.8KB<br>Post LCP 2168ms / total 508KB<br>Wallet LCP 2084ms / total 388.1KB<br>Internal market LCP 312ms / total 333.7KB<br>Compose LCP 360ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| snapshot-first | 3c0ec1c | 2026-11-22 08:07 | Home LCP 1140ms / total 384.4KB<br>Browse LCP 2288ms / total 386.3KB<br>Block 1 LCP 1616ms / total 339.8KB<br>Post LCP 2712ms / total 508KB<br>Wallet LCP 2028ms / total 388.1KB<br>Internal market LCP 304ms / total 333.7KB<br>Compose LCP 344ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| slow-api-300ms | 3c0ec1c | 2026-11-22 07:52 | Home LCP 1720ms / total 385.1KB<br>Browse LCP 3700ms / total 400.9KB<br>Block 1 LCP 1540ms / total 340.5KB<br>Post LCP 2660ms / total 509.6KB<br>Wallet LCP 2300ms / total 389.6KB<br>Internal market LCP 332ms / total 334.5KB<br>Compose LCP 368ms / total 376.9KB<br>Search LCP 308ms / total 337.6KB |
| perf-pass-cache | e880ed6 | 2026-11-21 23:47 | Home LCP 2984ms / total 387.4KB<br>Browse LCP 2724ms / total 459.2KB<br>Block 1 LCP 1556ms / total 343.8KB<br>Post LCP 2356ms / total 507.6KB<br>Wallet LCP 2384ms / total 388.1KB<br>Internal market LCP 328ms / total 333.8KB<br>Compose LCP 360ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| perf-pass-linkify | fb152e9 | 2026-11-21 23:44 | Home LCP 3196ms / total 387.4KB<br>Browse LCP 2720ms / total 459.2KB<br>Block 1 LCP 1564ms / total 343.8KB<br>Post LCP 2284ms / total 507.6KB<br>Wallet LCP 2140ms / total 388.1KB<br>Internal market LCP 316ms / total 333.8KB<br>Compose LCP 408ms / total 376.2KB<br>Search LCP 284ms / total 336.8KB |
| perf-pass-covers | b8779ac | 2026-11-21 23:36 | Home LCP 2828ms / total 387.5KB<br>Browse LCP 2628ms / total 596.4KB<br>Block 1 LCP 1552ms / total 343.8KB<br>Post LCP 2156ms / total 514.1KB<br>Wallet LCP 2128ms / total 388.2KB<br>Internal market LCP 304ms / total 333.8KB<br>Compose LCP 328ms / total 376.2KB<br>Search LCP 280ms / total 336.9KB |
| perf-pass-avatars-svgo | 5b37597 | 2026-11-21 23:31 | Home LCP 3308ms / total 387.5KB<br>Browse LCP 2684ms / total 596.4KB<br>Block 1 LCP 1580ms / total 343.8KB<br>Post LCP 2856ms / total 514.1KB<br>Wallet LCP 2172ms / total 386.9KB<br>Internal market LCP 296ms / total 333.8KB<br>Compose LCP 336ms / total 376.2KB<br>Search LCP 288ms / total 336.9KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```

`perf:check` blocks on bundle-size, CSS and app-transfer budgets. LCP and CLS are
reported as advisory notes because they still depend on live public nodes,
remote images and CI CPU; a slow API node must not look like a bundle
regression.
