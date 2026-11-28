# Performance dashboard

Generated 2026-11-28T17:18:11.432Z from commit `eda8d8a` (local).

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
| Home | 172 ms | 1248 ms | 0.002 | 139.400 KB | 199.300 KB | 54 KB | 459.800 KB | 197 |
| Browse | 48 ms | 2416 ms | 0 | 139.400 KB | 166.800 KB | 51.100 KB | 424.400 KB | 180 |
| Block 1 | 48 ms | 1228 ms | 0 | 139.400 KB | 146.300 KB | 46.500 KB | 399.400 KB | 129 |
| Post | 56 ms | 2576 ms | 0 | 139.400 KB | 342.900 KB | 52.700 KB | 603.700 KB | 176 |
| Wallet | 52 ms | 1616 ms | 0.029 | 139.400 KB | 186.100 KB | 51.300 KB | 452.700 KB | 175 |
| Internal market | 52 ms | 308 ms | 0.023 | 139.400 KB | 139.600 KB | 46.900 KB | 394.600 KB | 124 |
| Compose | 48 ms | 380 ms | 0.007 | 139.400 KB | 208.800 KB | 50.500 KB | 465.900 KB | 135 |
| Search | 40 ms | 308 ms | 0.016 | 139.400 KB | 144.700 KB | 47.100 KB | 398.300 KB | 131 |

## LCP element

The gap between FCP and LCP is almost always the first chain read or the first
post image, not the JS shell. This table names the element that actually won.

| Route | LCP | Element |
| --- | ---: | --- |
| Home | 1248 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://files.peakd.c` |
| Browse | 2416 ms | `IMG q-img__image q-img__image--with-transition q-img__image--loaded https://images.hive.blog/480x0/https://files.peakd.c` |
| Block 1 | 1228 ms | `SPAN block-metric__value block-metric__mono` |
| Post | 2576 ms | `IMG https://images.hive.blog/p/23KQwnti57stuXpnvnU2ByoTTe7rtyo8v5uYk1kPymfyjguJmftL7537KDU3LSmGFFxDipLuZBrmJzt1NMLvKJPXj` |
| Wallet | 1616 ms | `DIV col-12 text-center full-width account-header` |
| Internal market | 308 ms | `P market-intro` |
| Compose | 380 ms | `P compose-hint` |
| Search | 308 ms | `P page-intro` |

Initial bundle snapshot: **186.900 KB gzip**
/ **160.800 KB Brotli** (entry shell and
modulepreloads).

The home shell also carries the pre-warmed snapshot: **9.6 KB Brotli** (37.7 KB JSON). It is HTML transfer, not JS.

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

The 2026-11-28 refresh reconciles the budgets with the feature work shipped
after the last update in `55d67e2` (queue reconciliation, authority editing,
account delegation, downvote views, short-form feed filters and the Vault
polish). Measured route JS is 199.3 KB Home, 166.8 KB Browse, 342.9 KB Post,
186.1 KB Wallet, and total JS is 279–482.3 KB across the tracked routes. Budgets
were raised by 2–7 KB with roughly 2–4 KB headroom. Initial JS (160 KB), CSS
(55 KB), LCP and CLS budgets are unchanged.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 160 | 202 | 55 | 580 | 2500 | 0.1 |
| Browse | 160 | 170 | 55 | 580 | 4200 | 0.1 |
| Block 1 | 160 | 148 | 55 | 540 | 2500 | 0.1 |
| Post | 160 | 347 | 55 | 720 | 3500 | 0.1 |
| Wallet | 160 | 189 | 55 | 580 | 3500 | 0.1 |
| Internal market | 160 | 141 | 55 | 520 | 2000 | 0.1 |
| Compose | 160 | 212 | 55 | 560 | 2000 | 0.1 |
| Search | 160 | 146 | 55 | 520 | 2000 | 0.1 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `browser-BhLO-hLA.js` | 361.700 KB | 139 KB | 116.900 KB |
| `index-DVxOwLA1.css` | 251.400 KB | 43.200 KB | 34.500 KB |
| `index-CnEk1bCB.js` | 240.900 KB | 78.300 KB | 67.200 KB |
| `compose-csT_65_3.js` | 176.900 KB | 46.700 KB | 39.800 KB |
| `Index-hkGlbfL4.js` | 160.200 KB | 43.400 KB | 36.700 KB |
| `MainLayout-BJnxbq7D.js` | 102.500 KB | 29.800 KB | 25.600 KB |
| `dist-8CHx40St.js` | 95.200 KB | 33.700 KB | 29.500 KB |
| `downvotes-DUHplvzy.js` | 90.900 KB | 25.100 KB | 22.300 KB |
| `wallet-BIiksO50.js` | 88.300 KB | 23.400 KB | 20.400 KB |
| `account-CNHHz5DG.js` | 76 KB | 21.200 KB | 18.500 KB |
| `blogSettings-LydjgL6f.js` | 55.500 KB | 14.300 KB | 12.500 KB |
| `skinStudio-e3cH2r64.js` | 55.200 KB | 15.200 KB | 13.500 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| local | eda8d8a | 2026-11-28 17:18 | Home LCP 1248ms / total 459.8KB<br>Browse LCP 2416ms / total 424.4KB<br>Block 1 LCP 1228ms / total 399.4KB<br>Post LCP 2576ms / total 603.7KB<br>Wallet LCP 1616ms / total 452.7KB<br>Internal market LCP 308ms / total 394.6KB<br>Compose LCP 380ms / total 465.9KB<br>Search LCP 308ms / total 398.3KB |
| local | 326ad27 | 2026-11-26 02:19 | Home LCP 1128ms / total 434.4KB<br>Browse LCP 2980ms / total 399.8KB<br>Block 1 LCP 1228ms / total 371.8KB<br>Post LCP 2916ms / total 563KB<br>Wallet LCP 1812ms / total 421.3KB<br>Internal market LCP 324ms / total 365.6KB<br>Compose LCP 380ms / total 414.3KB<br>Search LCP 316ms / total 376.1KB |
| snapshot-first | 3c0ec1c | 2026-11-22 08:08 | Home LCP 1188ms / total 384.4KB<br>Browse LCP 2300ms / total 386.3KB<br>Block 1 LCP 1480ms / total 339.8KB<br>Post LCP 2168ms / total 508KB<br>Wallet LCP 2084ms / total 388.1KB<br>Internal market LCP 312ms / total 333.7KB<br>Compose LCP 360ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| snapshot-first | 3c0ec1c | 2026-11-22 08:07 | Home LCP 1140ms / total 384.4KB<br>Browse LCP 2288ms / total 386.3KB<br>Block 1 LCP 1616ms / total 339.8KB<br>Post LCP 2712ms / total 508KB<br>Wallet LCP 2028ms / total 388.1KB<br>Internal market LCP 304ms / total 333.7KB<br>Compose LCP 344ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| slow-api-300ms | 3c0ec1c | 2026-11-22 07:52 | Home LCP 1720ms / total 385.1KB<br>Browse LCP 3700ms / total 400.9KB<br>Block 1 LCP 1540ms / total 340.5KB<br>Post LCP 2660ms / total 509.6KB<br>Wallet LCP 2300ms / total 389.6KB<br>Internal market LCP 332ms / total 334.5KB<br>Compose LCP 368ms / total 376.9KB<br>Search LCP 308ms / total 337.6KB |
| perf-pass-cache | e880ed6 | 2026-11-21 23:47 | Home LCP 2984ms / total 387.4KB<br>Browse LCP 2724ms / total 459.2KB<br>Block 1 LCP 1556ms / total 343.8KB<br>Post LCP 2356ms / total 507.6KB<br>Wallet LCP 2384ms / total 388.1KB<br>Internal market LCP 328ms / total 333.8KB<br>Compose LCP 360ms / total 376.2KB<br>Search LCP 288ms / total 336.8KB |
| perf-pass-linkify | fb152e9 | 2026-11-21 23:44 | Home LCP 3196ms / total 387.4KB<br>Browse LCP 2720ms / total 459.2KB<br>Block 1 LCP 1564ms / total 343.8KB<br>Post LCP 2284ms / total 507.6KB<br>Wallet LCP 2140ms / total 388.1KB<br>Internal market LCP 316ms / total 333.8KB<br>Compose LCP 408ms / total 376.2KB<br>Search LCP 284ms / total 336.8KB |
| perf-pass-covers | b8779ac | 2026-11-21 23:36 | Home LCP 2828ms / total 387.5KB<br>Browse LCP 2628ms / total 596.4KB<br>Block 1 LCP 1552ms / total 343.8KB<br>Post LCP 2156ms / total 514.1KB<br>Wallet LCP 2128ms / total 388.2KB<br>Internal market LCP 304ms / total 333.8KB<br>Compose LCP 328ms / total 376.2KB<br>Search LCP 280ms / total 336.9KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
