# Performance dashboard

Generated 2026-11-18T02:18:22.937Z from commit `a3fd565` (W23-resilience).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the routes named in W22. It is intentionally
repeatable locally and in CI rather than tied to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 124 ms | 432 ms | 0.008 | 322.500 KB | 107.700 KB | 41 KB | 640.600 KB | 111 |
| Browse | 56 ms | 2172 ms | 0.028 | 322.500 KB | 112.800 KB | 41 KB | 674.400 KB | 124 |
| Block 1 | 56 ms | 1160 ms | 0 | 322.500 KB | 99.600 KB | 39.700 KB | 631.100 KB | 85 |
| Post | 56 ms | 1852 ms | 0.182 | 322.500 KB | 246.300 KB | 40.700 KB | 779.700 KB | 106 |
| Wallet | 48 ms | 1524 ms | 0.231 | 322.500 KB | 134.300 KB | 42.300 KB | 677.800 KB | 119 |
| Internal market | 48 ms | 372 ms | 0.124 | 322.500 KB | 96.900 KB | 40.100 KB | 629.800 KB | 79 |

Initial bundle snapshot: **477.800 KB gzip**
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
| `index-CLZ7uMsz.js` | 1328.100 KB | 377.300 KB | 232.200 KB |
| `browser-CiFQzF8D.js` | 373.800 KB | 141.800 KB | 119.500 KB |
| `index-Dt5rLM5a.css` | 227.800 KB | 39.400 KB | 31.100 KB |
| `runtime-core.esm-bundler-Bxt1xSqX.js` | 69.400 KB | 26.800 KB | 24.300 KB |
| `wallet-nTz4bXJ-.js` | 69.200 KB | 17.900 KB | 15.600 KB |
| `MainLayout-DyW9I4JR.js` | 59.400 KB | 18.100 KB | 15.900 KB |
| `account-BwqZWI_1.js` | 43.900 KB | 11.300 KB | 9.900 KB |
| `witnesses-7-_-G4gL.js` | 31.300 KB | 9.800 KB | 8.800 KB |
| `jsonViewer-D3Sl36xL.js` | 30.300 KB | 10.100 KB | 9.200 KB |
| `smartlock-BFeC_k6i.js` | 30 KB | 10.900 KB | 9.800 KB |
| `post-cxa3dSLZ.js` | 29 KB | 8.900 KB | 7.900 KB |
| `QSelect-COJNSJrx.js` | 28.900 KB | 10 KB | 9.200 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| W23-resilience | a3fd565 | 2026-11-18 02:18 | Home LCP 432ms / total 640.6KB<br>Browse LCP 2172ms / total 674.4KB<br>Block 1 LCP 1160ms / total 631.1KB<br>Post LCP 1852ms / total 779.7KB<br>Wallet LCP 1524ms / total 677.8KB<br>Internal market LCP 372ms / total 629.8KB |
| W22-final | ea1a8a5 | 2026-11-18 01:48 | Home LCP 460ms / total 632KB<br>Browse LCP 2380ms / total 668.6KB<br>Block 1 LCP 1160ms / total 625.4KB<br>Post LCP 1920ms / total 774.1KB<br>Wallet LCP 1528ms / total 671.9KB<br>Internal market LCP 388ms / total 624.1KB |
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
