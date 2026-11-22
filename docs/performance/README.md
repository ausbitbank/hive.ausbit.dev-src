# Performance dashboard

Generated 2026-11-22T08:08:45.527Z from commit `3c0ec1c` (snapshot-first).

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
| Home | 128 ms | 1188 ms | 0.006 | 125 KB | 146.700 KB | 48.600 KB | 384.400 KB | 169 |
| Browse | 44 ms | 2300 ms | 0 | 125 KB | 122.700 KB | 45.800 KB | 386.300 KB | 146 |
| Block 1 | 48 ms | 1480 ms | 0 | 125 KB | 109.100 KB | 41.600 KB | 339.800 KB | 104 |
| Post | 40 ms | 2168 ms | 0 | 125 KB | 272.100 KB | 45.900 KB | 508 KB | 135 |
| Wallet | 56 ms | 2084 ms | 0.029 | 125 KB | 144.800 KB | 46.200 KB | 388.100 KB | 146 |
| Internal market | 56 ms | 312 ms | 0.023 | 125 KB | 101.800 KB | 41.900 KB | 333.700 KB | 96 |
| Compose | 56 ms | 360 ms | 0.007 | 125 KB | 142.500 KB | 44.500 KB | 376.200 KB | 99 |
| Search | 52 ms | 288 ms | 0.001 | 125 KB | 105.700 KB | 42 KB | 336.800 KB | 106 |

## LCP element

The gap between FCP and LCP is almost always the first chain read or the first
post image, not the JS shell. This table names the element that actually won.

| Route | LCP | Element |
| --- | ---: | --- |
| Home | 1188 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://files.peakd.c` |
| Browse | 2300 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://files.peakd.c` |
| Block 1 | 1480 ms | `SPAN block-metric__value block-metric__mono` |
| Post | 2168 ms | `IMG https://i.ecency.com/p/23KQwnti57stuXpnvnU2ByoTTe7rtyo8v5uYk1kPymfyjguJmftL7537KDU3LSmGFFxDipLuZBrmJzt1NMLvKJPXjjbbV` |
| Wallet | 2084 ms | `DIV col-12 text-center full-width account-header` |
| Internal market | 312 ms | `P market-intro` |
| Compose | 360 ms | `P compose-hint` |
| Search | 288 ms | `P page-intro` |

Initial bundle snapshot: **166.700 KB gzip**
/ **144 KB Brotli** (entry shell and
modulepreloads).

The home shell also carries the pre-warmed snapshot: **9.9 KB Brotli** (35.8 KB JSON). It is HTML transfer, not JS.

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 160 | 165 | 55 | 560 | 2500 | 0.1 |
| Browse | 160 | 140 | 55 | 560 | 3500 | 0.1 |
| Block 1 | 160 | 125 | 55 | 520 | 2500 | 0.1 |
| Post | 160 | 300 | 55 | 700 | 3500 | 0.1 |
| Wallet | 160 | 165 | 55 | 560 | 3500 | 0.1 |
| Internal market | 160 | 115 | 55 | 500 | 2000 | 0.1 |
| Compose | 160 | 160 | 55 | 540 | 2000 | 0.1 |
| Search | 160 | 120 | 55 | 500 | 2000 | 0.1 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `browser-BhLO-hLA.js` | 361.700 KB | 139 KB | 116.900 KB |
| `index-Dj87Xpar.css` | 229.200 KB | 39.500 KB | 31.300 KB |
| `index-YTdgJM03.js` | 204 KB | 67.800 KB | 59 KB |
| `compose-tHWQCpqQ.js` | 145.300 KB | 38.300 KB | 33.300 KB |
| `Index-a3HsZAD-.js` | 128.400 KB | 35 KB | 30 KB |
| `dist-Lbnn-ipf.js` | 94.400 KB | 33.400 KB | 29.200 KB |
| `wallet-DJYc0sqn.js` | 86.100 KB | 22.700 KB | 19.800 KB |
| `MainLayout-BFTAkW0X.js` | 79.900 KB | 23.900 KB | 20.900 KB |
| `runtime-core.esm-bundler-CqJwwLne.js` | 69.600 KB | 26.900 KB | 24.400 KB |
| `account-b_WWM98X.js` | 60.400 KB | 17.100 KB | 15.100 KB |
| `witnesses-CU6SEulg.js` | 53.500 KB | 15.800 KB | 14 KB |
| `nodes-B3phvhg_.js` | 42.800 KB | 12.200 KB | 10.900 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| snapshot-first | 3c0ec1c | 2026-11-22 08:08 | Home LCP 1188ms / total 384.4KB<br>Browse LCP 2300ms / total 386.3KB<br>Block 1 LCP 1480ms / total 339.8KB<br>Post LCP 2168ms / total 508KB<br>Wallet LCP 2084ms / total 388.1KB<br>Internal market LCP 312ms / total 333.7KB<br>Compose LCP 360ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| snapshot-first | 3c0ec1c | 2026-11-22 08:07 | Home LCP 1140ms / total 384.4KB<br>Browse LCP 2288ms / total 386.3KB<br>Block 1 LCP 1616ms / total 339.8KB<br>Post LCP 2712ms / total 508KB<br>Wallet LCP 2028ms / total 388.1KB<br>Internal market LCP 304ms / total 333.7KB<br>Compose LCP 344ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| slow-api-300ms | 3c0ec1c | 2026-11-22 07:52 | Home LCP 1720ms / total 385.1KB<br>Browse LCP 3700ms / total 400.9KB<br>Block 1 LCP 1540ms / total 340.5KB<br>Post LCP 2660ms / total 509.6KB<br>Wallet LCP 2300ms / total 389.6KB<br>Internal market LCP 332ms / total 334.5KB<br>Compose LCP 368ms / total 376.9KB<br>Search LCP 308ms / total 337.6KB |
| perf-pass-cache | e880ed6 | 2026-11-21 23:47 | Home LCP 2984ms / total 387.4KB<br>Browse LCP 2724ms / total 459.2KB<br>Block 1 LCP 1556ms / total 343.8KB<br>Post LCP 2356ms / total 507.6KB<br>Wallet LCP 2384ms / total 388.1KB<br>Internal market LCP 328ms / total 333.8KB<br>Compose LCP 360ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| perf-pass-linkify | fb152e9 | 2026-11-21 23:44 | Home LCP 3196ms / total 387.4KB<br>Browse LCP 2720ms / total 459.2KB<br>Block 1 LCP 1564ms / total 343.8KB<br>Post LCP 2284ms / total 507.6KB<br>Wallet LCP 2140ms / total 388.1KB<br>Internal market LCP 316ms / total 333.8KB<br>Compose LCP 408ms / total 376.2KB<br>Search LCP 284ms / total 336.8KB |
| perf-pass-covers | b8779ac | 2026-11-21 23:36 | Home LCP 2828ms / total 387.5KB<br>Browse LCP 2628ms / total 596.4KB<br>Block 1 LCP 1552ms / total 343.8KB<br>Post LCP 2156ms / total 514.1KB<br>Wallet LCP 2128ms / total 388.2KB<br>Internal market LCP 304ms / total 333.8KB<br>Compose LCP 328ms / total 376.2KB<br>Search LCP 280ms / total 336.9KB |
| perf-pass-avatars-svgo | 5b37597 | 2026-11-21 23:31 | Home LCP 3308ms / total 387.5KB<br>Browse LCP 2684ms / total 596.4KB<br>Block 1 LCP 1580ms / total 343.8KB<br>Post LCP 2856ms / total 514.1KB<br>Wallet LCP 2172ms / total 386.9KB<br>Internal market LCP 296ms / total 333.8KB<br>Compose LCP 336ms / total 376.2KB<br>Search LCP 288ms / total 336.9KB |
| perf-pass-avatars | 5b37597 | 2026-11-21 23:28 | Home LCP 3824ms / total 387.5KB<br>Browse LCP 2708ms / total 596.5KB<br>Block 1 LCP 1568ms / total 343.9KB<br>Post LCP 2172ms / total 514.3KB<br>Wallet LCP 2100ms / total 388.3KB<br>Internal market LCP 320ms / total 333.9KB<br>Compose LCP 344ms / total 376.3KB<br>Search LCP 276ms / total 336.9KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
