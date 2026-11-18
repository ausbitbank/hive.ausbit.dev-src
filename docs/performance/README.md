# Performance dashboard

Generated 2026-11-18T01:41:04.652Z from commit `a1da1e1` (W22-splash).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the routes named in W22. It is intentionally
repeatable locally and in CI rather than tied to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 124 ms | 452 ms | 0.009 | 318.300 KB | 104.300 KB | 40.100 KB | 632 KB | 104 |
| Browse | 52 ms | 2560 ms | 0.028 | 318.300 KB | 111.400 KB | 40.800 KB | 668.600 KB | 118 |
| Block 1 | 52 ms | 1208 ms | 0 | 318.300 KB | 98.200 KB | 39.600 KB | 625.400 KB | 80 |
| Post | 56 ms | 1964 ms | 0.047 | 318.300 KB | 245 KB | 40.500 KB | 774.100 KB | 102 |
| Wallet | 48 ms | 1560 ms | 0.256 | 318.300 KB | 132.700 KB | 42.100 KB | 671.900 KB | 114 |
| Internal market | 56 ms | 416 ms | 0.124 | 318.300 KB | 95.600 KB | 39.900 KB | 624.100 KB | 74 |

Initial bundle snapshot: **473.100 KB gzip**
/ **314.200 KB Brotli** (entry shell and
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
| `index-DbKdSXZn.js` | 1344 KB | 382.300 KB | 236.500 KB |
| `browser-CfWlnz_E.js` | 373.800 KB | 141.800 KB | 119.400 KB |
| `index-Bc1pxGX8.css` | 227.700 KB | 39.300 KB | 31.100 KB |
| `runtime-core.esm-bundler-Bxt1xSqX.js` | 69.400 KB | 26.800 KB | 24.300 KB |
| `wallet-DfnJOTmy.js` | 68.800 KB | 17.800 KB | 15.500 KB |
| `MainLayout-B1SbtZ2F.js` | 56.600 KB | 17.200 KB | 15.200 KB |
| `account-Wav_dw17.js` | 43.700 KB | 11.200 KB | 9.800 KB |
| `witnesses-CxLem6B6.js` | 31.100 KB | 9.700 KB | 8.700 KB |
| `jsonViewer-BUNv2e1E.js` | 30.300 KB | 10.100 KB | 9.200 KB |
| `smartlock-Cnz3PjPx.js` | 30 KB | 10.900 KB | 9.800 KB |
| `QSelect-CIdrfOFp.js` | 28.900 KB | 10 KB | 9.200 KB |
| `post-iYCjrfaR.js` | 28.700 KB | 8.800 KB | 7.800 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W22-splash | a1da1e1 | 2026-11-18 01:41 | Home LCP 452ms / total 632KB<br>Browse LCP 2560ms / total 668.6KB<br>Block 1 LCP 1208ms / total 625.4KB<br>Post LCP 1964ms / total 774.1KB<br>Wallet LCP 1560ms / total 671.9KB<br>Internal market LCP 416ms / total 624.1KB |
| W22-final | a1da1e1 | 2026-11-18 01:26 | Home LCP 432ms / total 631.5KB<br>Browse LCP 2328ms / total 639.5KB<br>Block 1 LCP 1184ms / total 624.9KB<br>Post LCP 1864ms / total 773.7KB<br>Wallet LCP 1520ms / total 671.5KB<br>Internal market LCP 376ms / total 623.7KB |
| W22-after | a1da1e1 | 2026-11-18 01:23 | Home LCP 436ms / total 631.5KB<br>Browse LCP 2252ms / total 639.5KB<br>Block 1 LCP 1152ms / total 624.9KB<br>Post LCP 1732ms / total 773.7KB<br>Wallet LCP 1568ms / total 671.5KB<br>Internal market LCP 364ms / total 623.7KB |
| W22-after | a1da1e1 | 2026-11-18 01:21 | Home LCP 464ms / total 652.5KB<br>Browse LCP 1964ms / total 660.4KB<br>Block 1 LCP 1368ms / total 645.9KB<br>Post LCP 1832ms / total 794.5KB<br>Wallet LCP 1672ms / total 692.5KB<br>Internal market LCP 400ms / total 644.6KB |
| W22-after-draft | a1da1e1 | 2026-11-18 01:19 | Home LCP 468ms / total 714KB<br>Browse LCP 2172ms / total 661.5KB<br>Block 1 LCP 1160ms / total 646.9KB<br>Post LCP 1884ms / total 815.6KB<br>Wallet LCP 1828ms / total 754KB<br>Internal market LCP 384ms / total 645.7KB |
| W22-before | a1da1e1 | 2026-11-18 01:16 | Home LCP 1844ms / total 871.7KB<br>Browse LCP 3712ms / total 825.6KB<br>Block 1 LCP 1836ms / total 667.1KB<br>Post LCP 3300ms / total 858.7KB<br>Wallet LCP 3644ms / total 770.4KB<br>Internal market LCP 1632ms / total 667.5KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
