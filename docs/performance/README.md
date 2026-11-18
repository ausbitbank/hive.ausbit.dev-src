# Performance dashboard

Generated 2026-11-18T05:12:24.649Z from commit `b75f7b7` (W24-final).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the routes named in W22. It is intentionally
repeatable locally and in CI rather than tied to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 76 ms | 1764 ms | 0.008 | 323.300 KB | 108.400 KB | 41.400 KB | 642.400 KB | 113 |
| Browse | 44 ms | 3004 ms | 0.028 | 323.300 KB | 113.500 KB | 41.400 KB | 693 KB | 123 |
| Block 1 | 44 ms | 1188 ms | 0 | 323.300 KB | 100.200 KB | 40.100 KB | 632.800 KB | 85 |
| Post | 56 ms | 2016 ms | 0 | 323.300 KB | 247.600 KB | 41.100 KB | 782.300 KB | 107 |
| Wallet | 48 ms | 1424 ms | 0.037 | 323.300 KB | 134.700 KB | 42.700 KB | 679.500 KB | 119 |
| Internal market | 52 ms | 376 ms | 0.023 | 323.300 KB | 97.500 KB | 40.500 KB | 631.500 KB | 79 |

Initial bundle snapshot: **478 KB gzip**
/ **318.700 KB Brotli** (entry shell and
modulepreloads).

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 345 | 130 | 55 | 720 | 8000 | 0.5 |
| Browse | 345 | 145 | 55 | 730 | 8000 | 0.5 |
| Block 1 | 345 | 130 | 55 | 710 | 8000 | 0.5 |
| Post | 345 | 280 | 55 | 860 | 8000 | 0.5 |
| Wallet | 345 | 165 | 55 | 760 | 8000 | 0.5 |
| Internal market | 345 | 125 | 55 | 710 | 8000 | 0.5 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `index-Dpr2_b_E.js` | 1328.700 KB | 377.600 KB | 232.300 KB |
| `browser-DoX5Drma.js` | 373.800 KB | 141.800 KB | 119.300 KB |
| `index-wC8311rt.css` | 227.800 KB | 39.300 KB | 31.100 KB |
| `runtime-core.esm-bundler-Bxt1xSqX.js` | 69.400 KB | 26.800 KB | 24.300 KB |
| `wallet-C8vock0E.js` | 69.100 KB | 17.800 KB | 15.600 KB |
| `MainLayout-Ca9GAYNu.js` | 62.400 KB | 19 KB | 16.600 KB |
| `account-3r-1I7_v.js` | 43.900 KB | 11.300 KB | 9.900 KB |
| `witnesses--GWW35cI.js` | 31.300 KB | 9.800 KB | 8.800 KB |
| `jsonViewer-CcMgVmNZ.js` | 30.300 KB | 10.100 KB | 9.200 KB |
| `smartlock-BYZ0r9pK.js` | 30 KB | 10.900 KB | 9.800 KB |
| `post-DDl2Y2yT.js` | 29.300 KB | 9 KB | 7.900 KB |
| `QSelect-ZQrzmNf7.js` | 28.900 KB | 10 KB | 9.200 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W24-final | b75f7b7 | 2026-11-18 05:12 | Home LCP 1764ms / total 642.4KB<br>Browse LCP 3004ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2016ms / total 782.3KB<br>Wallet LCP 1424ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 05:00 | Home LCP 464ms / total 642.4KB<br>Browse LCP 2844ms / total 693KB<br>Block 1 LCP 1188ms / total 632.8KB<br>Post LCP 2032ms / total 782.3KB<br>Wallet LCP 2168ms / total 679.5KB<br>Internal market LCP 376ms / total 631.5KB |
| W24-final | ac3b35f | 2026-11-18 04:53 | Home LCP 520ms / total 642.3KB<br>Browse LCP 2208ms / total 647.4KB<br>Block 1 LCP 1292ms / total 632.8KB<br>Post LCP 1980ms / total 782.2KB<br>Wallet LCP 1552ms / total 679.5KB<br>Internal market LCP 376ms / total 631.4KB |
| W24-final | 031dd36 | 2026-11-18 04:38 | Home LCP 456ms / total 642.4KB<br>Browse LCP 3116ms / total 647.5KB<br>Block 1 LCP 1304ms / total 632.9KB<br>Post LCP 2212ms / total 782.3KB<br>Wallet LCP 1716ms / total 679.6KB<br>Internal market LCP 384ms / total 631.5KB |
| W24-final | 031dd36 | 2026-11-18 04:34 | Home LCP 464ms / total 641.8KB<br>Browse LCP 2936ms / total 646.9KB<br>Block 1 LCP 1564ms / total 632.3KB<br>Post LCP 2244ms / total 781.7KB<br>Wallet LCP 1744ms / total 679KB<br>Internal market LCP 380ms / total 630.9KB |
| W24-dims2 | 4aaa08e | 2026-11-18 04:33 | Home LCP 500ms / total 641.8KB<br>Browse LCP 1808ms / total 646.9KB<br>Block 1 LCP 1212ms / total 632.3KB<br>Post LCP 2324ms / total 781.7KB<br>Wallet LCP 1976ms / total 679KB<br>Internal market LCP 404ms / total 630.9KB |
| W24-dims1 | 4aaa08e | 2026-11-18 04:32 | Home LCP 492ms / total 641.8KB<br>Browse LCP 3460ms / total 646.9KB<br>Block 1 LCP 1364ms / total 632.3KB<br>Post LCP 2596ms / total 781.7KB<br>Wallet LCP 2440ms / total 679KB<br>Internal market LCP 388ms / total 630.9KB |
| W24-post-debug2 | 4aaa08e | 2026-11-18 04:30 | Home LCP 488ms / total 642.4KB<br>Browse LCP 3392ms / total 672.8KB<br>Block 1 LCP 1212ms / total 632.9KB<br>Post LCP 1964ms / total 782KB<br>Wallet LCP 1812ms / total 679.7KB<br>Internal market LCP 368ms / total 631.5KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
