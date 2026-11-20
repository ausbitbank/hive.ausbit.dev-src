# Performance dashboard

Generated 2026-11-20T04:09:18.747Z from commit `723327f` (W36).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose and
search pages. It is intentionally repeatable locally and in CI rather than tied
to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 120 ms | 1884 ms | 0.009 | 352.700 KB | 145.200 KB | 48.200 KB | 715.400 KB | 134 |
| Browse | 44 ms | 2224 ms | 0.001 | 352.700 KB | 119.900 KB | 44.700 KB | 854 KB | 145 |
| Block 1 | 48 ms | 1248 ms | 0.001 | 352.700 KB | 112.600 KB | 41.400 KB | 676 KB | 103 |
| Post | 52 ms | 1912 ms | 0 | 352.700 KB | 267.600 KB | 45.200 KB | 835.800 KB | 131 |
| Wallet | 36 ms | 1832 ms | 0.029 | 352.700 KB | 146.100 KB | 46 KB | 740 KB | 146 |
| Internal market | 40 ms | 396 ms | 0.023 | 352.700 KB | 108.700 KB | 41.700 KB | 673.400 KB | 96 |
| Compose | 52 ms | 352 ms | 0.008 | 352.700 KB | 111.700 KB | 42.100 KB | 675.800 KB | 94 |
| Search | 40 ms | 328 ms | 0.001 | 352.700 KB | 105 KB | 41.700 KB | 668.700 KB | 95 |

Initial bundle snapshot: **504.900 KB gzip**
/ **348.700 KB Brotli** (entry shell and
modulepreloads).

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 355 | 150 | 55 | 720 | 8000 | 0.5 |
| Browse | 355 | 145 | 55 | 900 | 8000 | 0.5 |
| Block 1 | 355 | — | 55 | — | 8000 | 0.5 |
| Post | 355 | 280 | 55 | 860 | 8000 | 0.5 |
| Wallet | 355 | 165 | 55 | 760 | 8000 | 0.5 |
| Internal market | 355 | 125 | 55 | 710 | 8000 | 0.5 |
| Compose | 355 | 120 | 55 | 700 | 8000 | 0.5 |
| Search | 355 | 150 | 55 | 720 | 8000 | 0.5 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `serializer-bZO_BWwO.js` | 958.500 KB | 265.100 KB | 140.300 KB |
| `browser-kh1oa0w8.js` | 384.800 KB | 146 KB | 122.600 KB |
| `index-CB1yNcmT.css` | 229.200 KB | 39.600 KB | 31.400 KB |
| `index-isNHaw_p.js` | 193.400 KB | 64.600 KB | 56.500 KB |
| `lib-96BoxN_p.js` | 192.600 KB | 57 KB | 49.400 KB |
| `Index-9ZejjZ26.js` | 114.400 KB | 31.800 KB | 27.500 KB |
| `wallet-CUydsZLE.js` | 81.200 KB | 21 KB | 18.300 KB |
| `MainLayout-BhER3YDh.js` | 76.400 KB | 23.600 KB | 20.600 KB |
| `runtime-core.esm-bundler-7dsYGXba.js` | 69.500 KB | 26.800 KB | 24.400 KB |
| `account-C5xI0brv.js` | 60.500 KB | 17.100 KB | 15.100 KB |
| `witnesses-BKSjXugC.js` | 53.400 KB | 15.800 KB | 14 KB |
| `nodes-CgUQxkHI.js` | 42.200 KB | 11.900 KB | 10.700 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W36 | 723327f | 2026-11-20 04:09 | Home LCP 1884ms / total 715.4KB<br>Browse LCP 2224ms / total 854KB<br>Block 1 LCP 1248ms / total 676KB<br>Post LCP 1912ms / total 835.8KB<br>Wallet LCP 1832ms / total 740KB<br>Internal market LCP 396ms / total 673.4KB<br>Compose LCP 352ms / total 675.8KB<br>Search LCP 328ms / total 668.7KB |
| W36 | 723327f | 2026-11-20 04:08 | Home LCP 1916ms / total 715.4KB<br>Browse LCP 2388ms / total 854KB<br>Block 1 LCP 1244ms / total 676KB<br>Post LCP 1864ms / total 835.8KB<br>Wallet LCP 1672ms / total 740KB<br>Internal market LCP 368ms / total 673.4KB<br>Compose LCP 352ms / total 675.8KB<br>Search LCP 340ms / total 668.7KB |
| W28-final | 1dc5a60 | 2026-11-18 09:52 | Home LCP 1836ms / total 646.5KB<br>Browse LCP 2484ms / total 655.6KB<br>Block 1 LCP 1192ms / total 650KB<br>Post LCP 2308ms / total 787.1KB<br>Wallet LCP 1544ms / total 685.6KB<br>Internal market LCP 380ms / total 648.6KB<br>Compose LCP 368ms / total 648.3KB<br>Search LCP 344ms / total 643.1KB |
| W26-final | 683b03a | 2026-11-18 08:41 | Home LCP 1980ms / total 642.5KB<br>Browse LCP 4264ms / total 651.7KB<br>Block 1 LCP 1472ms / total 632.9KB<br>Post LCP 2772ms / total 782.3KB<br>Wallet LCP 2124ms / total 680KB<br>Internal market LCP 400ms / total 631.5KB<br>Compose LCP 388ms / total 631.2KB |
| W25-final | 58b5ed2 | 2026-11-18 06:50 | Home LCP 1820ms / total 642.2KB<br>Browse LCP 3328ms / total 674KB<br>Block 1 LCP 1172ms / total 632.7KB<br>Post LCP 1988ms / total 782.1KB<br>Wallet LCP 1512ms / total 679.7KB<br>Internal market LCP 392ms / total 631.3KB |
| W25-final | 40fef79 | 2026-11-18 06:44 | Home LCP 1776ms / total 642.8KB<br>Browse LCP 3152ms / total 703.3KB<br>Block 1 LCP 1268ms / total 633.2KB<br>Post LCP 2064ms / total 782.6KB<br>Wallet LCP 1572ms / total 680.2KB<br>Internal market LCP 404ms / total 631.8KB |
| local | 40fef79 | 2026-11-18 06:36 | Home LCP 1748ms / total 642.8KB<br>Browse LCP 2324ms / total 703.3KB<br>Block 1 LCP 1208ms / total 633.2KB<br>Post LCP 2092ms / total 782.6KB<br>Wallet LCP 1584ms / total 680.2KB<br>Internal market LCP 428ms / total 631.8KB |
| W24-final | b75f7b7 | 2026-11-18 05:12 | Home LCP 1764ms / total 642.4KB<br>Browse LCP 3004ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2016ms / total 782.3KB<br>Wallet LCP 1424ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
