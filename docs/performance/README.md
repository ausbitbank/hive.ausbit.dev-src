# Performance dashboard

Generated 2026-11-21T23:31:34.923Z from commit `5b37597` (perf-pass-avatars-svgo).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose and
search pages. It is intentionally repeatable locally and in CI rather than tied
to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 128 ms | 3308 ms | 0.003 | 125 KB | 145.700 KB | 48.600 KB | 387.500 KB | 168 |
| Browse | 52 ms | 2684 ms | 0 | 125 KB | 120.400 KB | 45 KB | 596.400 KB | 148 |
| Block 1 | 52 ms | 1580 ms | 0 | 125 KB | 109.100 KB | 41.600 KB | 343.800 KB | 104 |
| Post | 48 ms | 2856 ms | 0.006 | 125 KB | 278.200 KB | 45.900 KB | 514.100 KB | 134 |
| Wallet | 48 ms | 2172 ms | 0.029 | 125 KB | 143.500 KB | 46.200 KB | 386.900 KB | 145 |
| Internal market | 40 ms | 296 ms | 0 | 125 KB | 101.800 KB | 41.900 KB | 333.800 KB | 99 |
| Compose | 40 ms | 336 ms | 0.007 | 125 KB | 142.600 KB | 44.500 KB | 376.200 KB | 99 |
| Search | 52 ms | 288 ms | 0.001 | 125 KB | 105.700 KB | 42 KB | 336.900 KB | 106 |

Initial bundle snapshot: **166.700 KB gzip**
/ **144.100 KB Brotli** (entry shell and
modulepreloads).

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 160 | 165 | 55 | 560 | 5000 | 0.1 |
| Browse | 160 | 140 | 55 | 560 | 5000 | 0.1 |
| Block 1 | 160 | 125 | 55 | 520 | 5000 | 0.1 |
| Post | 160 | 300 | 55 | 700 | 5000 | 0.1 |
| Wallet | 160 | 165 | 55 | 560 | 5000 | 0.1 |
| Internal market | 160 | 115 | 55 | 500 | 5000 | 0.1 |
| Compose | 160 | 160 | 55 | 540 | 5000 | 0.1 |
| Search | 160 | 120 | 55 | 500 | 5000 | 0.1 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `browser-BKsXjRRK.js` | 383.600 KB | 145.700 KB | 122.300 KB |
| `index-Dj87Xpar.css` | 229.200 KB | 39.500 KB | 31.300 KB |
| `index-L3PS75OQ.js` | 203.900 KB | 67.900 KB | 59.100 KB |
| `compose-dfKZmiiI.js` | 145.300 KB | 38.300 KB | 33.300 KB |
| `Index-hkmsYDiz.js` | 124.800 KB | 34 KB | 29.100 KB |
| `dist-Lbnn-ipf.js` | 94.400 KB | 33.400 KB | 29.200 KB |
| `wallet-9oyjPTnz.js` | 86.100 KB | 22.700 KB | 19.800 KB |
| `MainLayout-DgocMNZ_.js` | 79.900 KB | 23.900 KB | 20.900 KB |
| `runtime-core.esm-bundler-CqJwwLne.js` | 69.600 KB | 26.900 KB | 24.400 KB |
| `account-CaOsJjw2.js` | 60.400 KB | 17.100 KB | 15.100 KB |
| `witnesses-DwHxF4NY.js` | 53.500 KB | 15.800 KB | 14 KB |
| `nodes-DUVvKsRT.js` | 42.800 KB | 12.200 KB | 10.900 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| perf-pass-avatars-svgo | 5b37597 | 2026-11-21 23:31 | Home LCP 3308ms / total 387.5KB<br>Browse LCP 2684ms / total 596.4KB<br>Block 1 LCP 1580ms / total 343.8KB<br>Post LCP 2856ms / total 514.1KB<br>Wallet LCP 2172ms / total 386.9KB<br>Internal market LCP 296ms / total 333.8KB<br>Compose LCP 336ms / total 376.2KB<br>Search LCP 288ms / total 336.9KB |
| perf-pass-avatars | 5b37597 | 2026-11-21 23:28 | Home LCP 3824ms / total 387.5KB<br>Browse LCP 2708ms / total 596.5KB<br>Block 1 LCP 1568ms / total 343.9KB<br>Post LCP 2172ms / total 514.3KB<br>Wallet LCP 2100ms / total 388.3KB<br>Internal market LCP 320ms / total 333.9KB<br>Compose LCP 344ms / total 376.3KB<br>Search LCP 276ms / total 336.9KB |
| perf-pass-followup2 | 104701c | 2026-11-21 23:18 | Home LCP 3048ms / total 383.3KB<br>Browse LCP 2692ms / total 596.2KB<br>Block 1 LCP 1592ms / total 339.7KB<br>Post LCP 2332ms / total 514KB<br>Wallet LCP 1996ms / total 388.1KB<br>Internal market LCP 304ms / total 333.7KB<br>Compose LCP 336ms / total 376KB<br>Search LCP 284ms / total 336.7KB |
| perf-pass-followups | 2b51eee | 2026-11-21 22:22 | Home LCP 2896ms / total 383.9KB<br>Browse LCP 2772ms / total 354.9KB<br>Block 1 LCP 1484ms / total 340.2KB<br>Post LCP 2492ms / total 515.5KB<br>Wallet LCP 2160ms / total 388.6KB<br>Internal market LCP 504ms / total 334.3KB<br>Compose LCP 608ms / total 376.6KB<br>Search LCP 412ms / total 337.3KB |
| perf-pass-icons | 2b51eee | 2026-11-21 22:17 | Home LCP 2700ms / total 383.8KB<br>Browse LCP 2572ms / total 383.6KB<br>Block 1 LCP 1476ms / total 340.2KB<br>Post LCP 2184ms / total 515.4KB<br>Wallet LCP 2092ms / total 388.5KB<br>Internal market LCP 480ms / total 334.2KB<br>Compose LCP 620ms / total 376.6KB<br>Search LCP 436ms / total 337.2KB |
| perf-pass-final | 2b51eee | 2026-11-21 21:40 | Home LCP 2664ms / total 486.2KB<br>Browse LCP 2884ms / total 457.3KB<br>Block 1 LCP 1472ms / total 443KB<br>Post LCP 2140ms / total 618.3KB<br>Wallet LCP 2192ms / total 491.4KB<br>Internal market LCP 296ms / total 436.6KB<br>Compose LCP 340ms / total 479.3KB<br>Search LCP 276ms / total 439.6KB |
| perf-pass-2026-11-22 | 2b51eee | 2026-11-21 21:37 | Home LCP 2848ms / total 494.2KB<br>Browse LCP 2596ms / total 465.3KB<br>Block 1 LCP 1500ms / total 451KB<br>Post LCP 2212ms / total 626.3KB<br>Wallet LCP 2180ms / total 499.4KB<br>Internal market LCP 308ms / total 444.6KB<br>Compose LCP 336ms / total 487.3KB<br>Search LCP 288ms / total 447.6KB |
| local | 00ba6db | 2026-11-21 17:58 | Home LCP 3360ms / total 726.3KB<br>Browse LCP 3336ms / total 867.6KB<br>Block 1 LCP 1864ms / total 683.5KB<br>Post LCP 2736ms / total 848.1KB<br>Wallet LCP 2516ms / total 731.1KB<br>Internal market LCP 704ms / total 677.1KB<br>Compose LCP 696ms / total 719.7KB<br>Search LCP 640ms / total 673.9KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
