# Performance dashboard

Generated 2026-11-18T09:52:32.232Z from commit `1dc5a60` (W28-final).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose and
search pages. It is intentionally repeatable locally and in CI rather than tied
to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 248 ms | 1836 ms | 0.028 | 340.600 KB | 95.200 KB | 41.400 KB | 646.500 KB | 106 |
| Browse | 56 ms | 2484 ms | 0.028 | 340.600 KB | 103.500 KB | 42.200 KB | 655.600 KB | 118 |
| Block 1 | 52 ms | 1192 ms | 0.001 | 340.600 KB | 99.900 KB | 40.200 KB | 650 KB | 86 |
| Post | 48 ms | 2308 ms | 0 | 340.600 KB | 235 KB | 41.200 KB | 787.100 KB | 105 |
| Wallet | 52 ms | 1544 ms | 0.037 | 340.600 KB | 123.300 KB | 42.900 KB | 685.600 KB | 120 |
| Internal market | 52 ms | 380 ms | 0.023 | 340.600 KB | 97.200 KB | 40.500 KB | 648.600 KB | 80 |
| Compose | 56 ms | 368 ms | 0.008 | 340.600 KB | 97.500 KB | 40.800 KB | 648.300 KB | 76 |
| Search | 52 ms | 344 ms | 0.001 | 340.600 KB | 92.700 KB | 40.400 KB | 643.100 KB | 79 |

Initial bundle snapshot: **492.200 KB gzip**
/ **336.400 KB Brotli** (entry shell and
modulepreloads).

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 345 | 130 | 55 | 720 | 8000 | 0.5 |
| Browse | 345 | 145 | 55 | 730 | 8000 | 0.5 |
| Block 1 | 345 | — | 55 | — | 8000 | 0.5 |
| Post | 345 | 280 | 55 | 860 | 8000 | 0.5 |
| Wallet | 345 | 165 | 55 | 760 | 8000 | 0.5 |
| Internal market | 345 | 125 | 55 | 710 | 8000 | 0.5 |
| Compose | 345 | 120 | 55 | 700 | 8000 | 0.5 |
| Search | 345 | 150 | 55 | 720 | 8000 | 0.5 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `serializer-D9dnJ8Xr.js` | 958.500 KB | 265.100 KB | 140.300 KB |
| `browser-DlFjIv5v.js` | 373.800 KB | 141.800 KB | 119.300 KB |
| `index-nwRC24mT.js` | 365 KB | 115.600 KB | 99.800 KB |
| `index-wC8311rt.css` | 227.800 KB | 39.300 KB | 31.100 KB |
| `wallet-bZ5wtE_v.js` | 70 KB | 18 KB | 15.800 KB |
| `runtime-core.esm-bundler-Bxt1xSqX.js` | 69.400 KB | 26.800 KB | 24.300 KB |
| `MainLayout-UJhT9H5J.js` | 66.300 KB | 19.900 KB | 17.400 KB |
| `account-BpHMlVA7.js` | 55 KB | 14.900 KB | 13.100 KB |
| `witnesses-DIvWg7y0.js` | 51 KB | 15.100 KB | 13.400 KB |
| `compose-BQw0m4tB.js` | 42.900 KB | 13.400 KB | 12.100 KB |
| `search-BtYi-5hR.js` | 32.400 KB | 10 KB | 9 KB |
| `browse-FrIOtWjy.js` | 31.700 KB | 9.900 KB | 8.900 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W28-final | 1dc5a60 | 2026-11-18 09:52 | Home LCP 1836ms / total 646.5KB<br>Browse LCP 2484ms / total 655.6KB<br>Block 1 LCP 1192ms / total 650KB<br>Post LCP 2308ms / total 787.1KB<br>Wallet LCP 1544ms / total 685.6KB<br>Internal market LCP 380ms / total 648.6KB<br>Compose LCP 368ms / total 648.3KB<br>Search LCP 344ms / total 643.1KB |
| W26-final | 683b03a | 2026-11-18 08:41 | Home LCP 1980ms / total 642.5KB<br>Browse LCP 4264ms / total 651.7KB<br>Block 1 LCP 1472ms / total 632.9KB<br>Post LCP 2772ms / total 782.3KB<br>Wallet LCP 2124ms / total 680KB<br>Internal market LCP 400ms / total 631.5KB<br>Compose LCP 388ms / total 631.2KB |
| W25-final | 58b5ed2 | 2026-11-18 06:50 | Home LCP 1820ms / total 642.2KB<br>Browse LCP 3328ms / total 674KB<br>Block 1 LCP 1172ms / total 632.7KB<br>Post LCP 1988ms / total 782.1KB<br>Wallet LCP 1512ms / total 679.7KB<br>Internal market LCP 392ms / total 631.3KB |
| W25-final | 40fef79 | 2026-11-18 06:44 | Home LCP 1776ms / total 642.8KB<br>Browse LCP 3152ms / total 703.3KB<br>Block 1 LCP 1268ms / total 633.2KB<br>Post LCP 2064ms / total 782.6KB<br>Wallet LCP 1572ms / total 680.2KB<br>Internal market LCP 404ms / total 631.8KB |
| local | 40fef79 | 2026-11-18 06:36 | Home LCP 1748ms / total 642.8KB<br>Browse LCP 2324ms / total 703.3KB<br>Block 1 LCP 1208ms / total 633.2KB<br>Post LCP 2092ms / total 782.6KB<br>Wallet LCP 1584ms / total 680.2KB<br>Internal market LCP 428ms / total 631.8KB |
| W24-final | b75f7b7 | 2026-11-18 05:12 | Home LCP 1764ms / total 642.4KB<br>Browse LCP 3004ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2016ms / total 782.3KB<br>Wallet LCP 1424ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 05:00 | Home LCP 464ms / total 642.4KB<br>Browse LCP 2844ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2032ms / total 782.3KB<br>Wallet LCP 2168ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 04:53 | Home LCP 520ms / total 642.3KB<br>Browse LCP 2208ms / total 647.4KB<br>Block 1 LCP 1292ms / total 632.8KB<br>Post LCP 1980ms / total 782.2KB<br>Wallet LCP 1552ms / total 679.5KB<br>Internal market LCP 376ms / total 631.4KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
