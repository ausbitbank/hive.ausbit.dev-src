# Performance dashboard

Generated 2026-11-18T08:41:11.160Z from commit `683b03a` (W26-final).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose page.
It is intentionally repeatable locally and in CI rather than tied to a hosted
Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 112 ms | 1980 ms | 0.008 | 323 KB | 108.800 KB | 41.400 KB | 642.500 KB | 113 |
| Browse | 80 ms | 4264 ms | 0.028 | 323 KB | 117.200 KB | 42.100 KB | 651.700 KB | 118 |
| Block 1 | 76 ms | 1472 ms | 0.001 | 323 KB | 100.500 KB | 40.100 KB | 632.900 KB | 85 |
| Post | 72 ms | 2772 ms | 0 | 323 KB | 248 KB | 41.100 KB | 782.300 KB | 107 |
| Wallet | 100 ms | 2124 ms | 0.037 | 323 KB | 135.400 KB | 42.800 KB | 680 KB | 119 |
| Internal market | 52 ms | 400 ms | 0.023 | 323 KB | 97.800 KB | 40.500 KB | 631.500 KB | 79 |
| Compose | 56 ms | 388 ms | 0.008 | 323 KB | 98.100 KB | 40.800 KB | 631.200 KB | 75 |

Initial bundle snapshot: **478.300 KB gzip**
/ **319 KB Brotli** (entry shell and
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

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `index-CepECznm.js` | 1329.600 KB | 377.800 KB | 232.600 KB |
| `browser-C7Uvo9S9.js` | 373.800 KB | 141.800 KB | 119.400 KB |
| `index-wC8311rt.css` | 227.800 KB | 39.300 KB | 31.100 KB |
| `wallet-CFhSyUly.js` | 69.800 KB | 18 KB | 15.700 KB |
| `runtime-core.esm-bundler-Bxt1xSqX.js` | 69.400 KB | 26.800 KB | 24.300 KB |
| `MainLayout-BjOc_GbR.js` | 64 KB | 19.400 KB | 16.900 KB |
| `account-7ZT4Qtaw.js` | 54.900 KB | 14.900 KB | 13.100 KB |
| `witnesses-BJ_wj7xf.js` | 50.900 KB | 15.100 KB | 13.400 KB |
| `compose-qetklBUu.js` | 42.900 KB | 13.400 KB | 12 KB |
| `browse-DVCDz4zW.js` | 31.800 KB | 10 KB | 8.900 KB |
| `jsonViewer-rt7FOKGi.js` | 30.300 KB | 10.100 KB | 9.200 KB |
| `smartlock-BSApTFNR.js` | 30 KB | 10.900 KB | 9.800 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W26-final | 683b03a | 2026-11-18 08:41 | Home LCP 1980ms / total 642.5KB<br>Browse LCP 4264ms / total 651.7KB<br>Block 1 LCP 1472ms / total 632.9KB<br>Post LCP 2772ms / total 782.3KB<br>Wallet LCP 2124ms / total 680KB<br>Internal market LCP 400ms / total 631.5KB<br>Compose LCP 388ms / total 631.2KB |
| W25-final | 58b5ed2 | 2026-11-18 06:50 | Home LCP 1820ms / total 642.2KB<br>Browse LCP 3328ms / total 674KB<br>Block 1 LCP 1172ms / total 632.7KB<br>Post LCP 1988ms / total 782.1KB<br>Wallet LCP 1512ms / total 679.7KB<br>Internal market LCP 392ms / total 631.3KB |
| W25-final | 40fef79 | 2026-11-18 06:44 | Home LCP 1776ms / total 642.8KB<br>Browse LCP 3152ms / total 703.3KB<br>Block 1 LCP 1268ms / total 633.2KB<br>Post LCP 2064ms / total 782.6KB<br>Wallet LCP 1572ms / total 680.2KB<br>Internal market LCP 404ms / total 631.8KB |
| local | 40fef79 | 2026-11-18 06:36 | Home LCP 1748ms / total 642.8KB<br>Browse LCP 2324ms / total 703.3KB<br>Block 1 LCP 1208ms / total 633.2KB<br>Post LCP 2092ms / total 782.6KB<br>Wallet LCP 1584ms / total 680.2KB<br>Internal market LCP 428ms / total 631.8KB |
| W24-final | b75f7b7 | 2026-11-18 05:12 | Home LCP 1764ms / total 642.4KB<br>Browse LCP 3004ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2016ms / total 782.3KB<br>Wallet LCP 1424ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 05:00 | Home LCP 464ms / total 642.4KB<br>Browse LCP 2844ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2032ms / total 782.3KB<br>Wallet LCP 2168ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 04:53 | Home LCP 520ms / total 642.3KB<br>Browse LCP 2208ms / total 647.4KB<br>Block 1 LCP 1292ms / total 632.8KB<br>Post LCP 1980ms / total 782.2KB<br>Wallet LCP 1552ms / total 679.5KB<br>Internal market LCP 376ms / total 631.4KB |
| W24-final | 031dd36 | 2026-11-18 04:38 | Home LCP 456ms / total 642.4KB<br>Browse LCP 3116ms / total 647.5KB<br>Block 1 LCP 1304ms / total 632.9KB<br>Post LCP 2212ms / total 782.3KB<br>Wallet LCP 1716ms / total 679.6KB<br>Internal market LCP 384ms / total 631.5KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
