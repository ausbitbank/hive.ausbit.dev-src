# Performance dashboard

Generated 2026-11-18T06:44:10.293Z from commit `40fef79` (W25-final).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the routes named in W22. It is intentionally
repeatable locally and in CI rather than tied to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 84 ms | 1776 ms | 0.028 | 323.400 KB | 108.700 KB | 41.400 KB | 642.800 KB | 108 |
| Browse | 56 ms | 3152 ms | 0.028 | 323.400 KB | 116.700 KB | 42.100 KB | 703.300 KB | 121 |
| Block 1 | 44 ms | 1268 ms | 0 | 323.400 KB | 100.300 KB | 40.100 KB | 633.200 KB | 85 |
| Post | 52 ms | 2064 ms | 0 | 323.400 KB | 247.800 KB | 41.100 KB | 782.600 KB | 107 |
| Wallet | 48 ms | 1572 ms | 0.030 | 323.400 KB | 135.200 KB | 42.800 KB | 680.200 KB | 120 |
| Internal market | 40 ms | 404 ms | 0.023 | 323.400 KB | 97.700 KB | 40.500 KB | 631.800 KB | 79 |

Initial bundle snapshot: **478.200 KB gzip**
/ **318.700 KB Brotli** (entry shell and
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

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `index-CL2xLuPX.js` | 1329.100 KB | 377.700 KB | 232.300 KB |
| `browser-D857bLhn.js` | 373.800 KB | 141.800 KB | 119.300 KB |
| `index-wC8311rt.css` | 227.800 KB | 39.300 KB | 31.100 KB |
| `wallet-DrRzUxeG.js` | 69.800 KB | 18 KB | 15.700 KB |
| `runtime-core.esm-bundler-Bxt1xSqX.js` | 69.400 KB | 26.800 KB | 24.300 KB |
| `MainLayout-DWpaktVl.js` | 63 KB | 19.100 KB | 16.800 KB |
| `account-Ceu1CrdU.js` | 54.800 KB | 14.900 KB | 13.100 KB |
| `witnesses-CHwIEG0x.js` | 50.900 KB | 15.100 KB | 13.400 KB |
| `browse-BHqQqT5G.js` | 30.800 KB | 9.600 KB | 8.500 KB |
| `jsonViewer-CeqkI_c5.js` | 30.300 KB | 10.100 KB | 9.200 KB |
| `smartlock-Cg0PANbk.js` | 30 KB | 10.900 KB | 9.800 KB |
| `post-D8ycIAFb.js` | 29.300 KB | 9 KB | 7.900 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W25-final | 40fef79 | 2026-11-18 06:44 | Home LCP 1776ms / total 642.8KB<br>Browse LCP 3152ms / total 703.3KB<br>Block 1 LCP 1268ms / total 633.2KB<br>Post LCP 2064ms / total 782.6KB<br>Wallet LCP 1572ms / total 680.2KB<br>Internal market LCP 404ms / total 631.8KB |
| local | 40fef79 | 2026-11-18 06:36 | Home LCP 1748ms / total 642.8KB<br>Browse LCP 2324ms / total 703.3KB<br>Block 1 LCP 1208ms / total 633.2KB<br>Post LCP 2092ms / total 782.6KB<br>Wallet LCP 1584ms / total 680.2KB<br>Internal market LCP 428ms / total 631.8KB |
| W24-final | b75f7b7 | 2026-11-18 05:12 | Home LCP 1764ms / total 642.4KB<br>Browse LCP 3004ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2016ms / total 782.3KB<br>Wallet LCP 1424ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 05:00 | Home LCP 464ms / total 642.4KB<br>Browse LCP 2844ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2032ms / total 782.3KB<br>Wallet LCP 2168ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 04:53 | Home LCP 520ms / total 642.3KB<br>Browse LCP 2208ms / total 647.4KB<br>Block 1 LCP 1292ms / total 632.8KB<br>Post LCP 1980ms / total 782.2KB<br>Wallet LCP 1552ms / total 679.5KB<br>Internal market LCP 376ms / total 631.4KB |
| W24-final | 031dd36 | 2026-11-18 04:38 | Home LCP 456ms / total 642.4KB<br>Browse LCP 3116ms / total 647.5KB<br>Block 1 LCP 1304ms / total 632.9KB<br>Post LCP 2212ms / total 782.3KB<br>Wallet LCP 1716ms / total 679.6KB<br>Internal market LCP 384ms / total 631.5KB |
| W24-final | 031dd36 | 2026-11-18 04:34 | Home LCP 464ms / total 641.8KB<br>Browse LCP 2936ms / total 646.9KB<br>Block 1 LCP 1564ms / total 632.3KB<br>Post LCP 2244ms / total 781.7KB<br>Wallet LCP 1744ms / total 679KB<br>Internal market LCP 380ms / total 630.9KB |
| W24-dims2 | 4aaa08e | 2026-11-18 04:33 | Home LCP 500ms / total 641.8KB<br>Browse LCP 1808ms / total 646.9KB<br>Block 1 LCP 1212ms / total 632.3KB<br>Post LCP 2324ms / total 781.7KB<br>Wallet LCP 1976ms / total 679KB<br>Internal market LCP 404ms / total 630.9KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
