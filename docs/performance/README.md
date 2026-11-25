# Performance dashboard

Generated 2026-11-24T02:26:39.675Z from commit `2b07101` (local).

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
| Home | 140 ms | 140 ms | 0.002 | 128.500 KB | 165.800 KB | 52.100 KB | 411.900 KB | 174 |
| Browse | 56 ms | 3248 ms | 0 | 128.500 KB | 136 KB | 49.300 KB | 379.300 KB | 155 |
| Block 1 | 44 ms | 44 ms | 0 | 128.500 KB | 121.800 KB | 45.300 KB | 361.100 KB | 111 |
| Post | 52 ms | 2124 ms | 0 | 128.500 KB | 295 KB | 51.200 KB | 541 KB | 148 |
| Wallet | 56 ms | 1740 ms | 0.029 | 128.500 KB | 157.900 KB | 50 KB | 409.900 KB | 153 |
| Internal market | 48 ms | 324 ms | 0.023 | 128.500 KB | 114.400 KB | 45.700 KB | 354.900 KB | 103 |
| Compose | 64 ms | 64 ms | 0.007 | 128.500 KB | 160.100 KB | 48.800 KB | 402.800 KB | 110 |
| Search | 64 ms | 300 ms | 0.001 | 128.500 KB | 118.300 KB | 45.800 KB | 358 KB | 113 |

## LCP element

The gap between FCP and LCP is almost always the first chain read or the first
post image, not the JS shell. This table names the element that actually won.

| Route | LCP | Element |
| --- | ---: | --- |
| Home | 140 ms | `P` |
| Browse | 3248 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://files.peakd.c` |
| Block 1 | 44 ms | `P` |
| Post | 2124 ms | `IMG https://i.ecency.com/p/23KQwnti57stuXpnvnU2ByoTTe7rtyo8v5uYk1kPymfyjguJmftL7537KDU3LSmGFFxDipLuZBrmJzt1NMLvKJPXjjbbV` |
| Wallet | 1740 ms | `DIV col-12 text-center full-width account-header` |
| Internal market | 324 ms | `P market-intro` |
| Compose | 64 ms | `P` |
| Search | 300 ms | `P page-intro` |

Initial bundle snapshot: **174.100 KB gzip**
/ **150.100 KB Brotli** (entry shell and
modulepreloads).

The home shell also carries the pre-warmed snapshot: **8.9 KB Brotli** (35.2 KB JSON). It is HTML transfer, not JS.

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

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 160 | 181 | 55 | 560 | 2500 | 0.1 |
| Browse | 160 | 151 | 55 | 560 | 3500 | 0.1 |
| Block 1 | 160 | 127 | 55 | 520 | 2500 | 0.1 |
| Post | 160 | 310 | 55 | 700 | 3500 | 0.1 |
| Wallet | 160 | 165 | 55 | 560 | 3500 | 0.1 |
| Internal market | 160 | 120 | 55 | 500 | 2000 | 0.1 |
| Compose | 160 | 170 | 55 | 540 | 2000 | 0.1 |
| Search | 160 | 130 | 55 | 500 | 2000 | 0.1 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `browser-BhLO-hLA.js` | 361.700 KB | 139 KB | 116.900 KB |
| `index-0E6BhVPq.css` | 250.900 KB | 43.100 KB | 34.300 KB |
| `index-XV6Trtpz.js` | 216.500 KB | 70.800 KB | 61.400 KB |
| `Index-BPO3IcIo.js` | 149.300 KB | 40.400 KB | 34.300 KB |
| `compose-8Oyne5h5.js` | 143.700 KB | 37.500 KB | 32.600 KB |
| `dist-Lbnn-ipf.js` | 94.400 KB | 33.400 KB | 29.200 KB |
| `wallet-CTiLW24_.js` | 87 KB | 23 KB | 20 KB |
| `MainLayout-L4k0cYbi.js` | 80.600 KB | 24 KB | 20.900 KB |
| `runtime-core.esm-bundler-CqJwwLne.js` | 69.600 KB | 26.900 KB | 24.400 KB |
| `account-F9YulLWv.js` | 60.800 KB | 17.200 KB | 15.200 KB |
| `witnesses-DHzk3sXY.js` | 53.500 KB | 15.800 KB | 14 KB |
| `skinStudio-Di_ibzUZ.js` | 43.100 KB | 12.300 KB | 10.800 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| local | 2b07101 | 2026-11-24 02:26 | Home LCP 140ms / total 411.9KB<br>Browse LCP 3248ms / total 379.3KB<br>Block 1 LCP 44ms / total 361.1KB<br>Post LCP 2124ms / total 541KB<br>Wallet LCP 1740ms / total 409.9KB<br>Internal market LCP 324ms / total 354.9KB<br>Compose LCP 64ms / total 402.8KB<br>Search LCP 300ms / total 358KB |
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
