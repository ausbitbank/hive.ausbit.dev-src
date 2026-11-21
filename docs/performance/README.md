# Performance dashboard

Generated 2026-11-21T07:49:06.680Z from commit `de3acb4` (local).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose and
search pages. It is intentionally repeatable locally and in CI rather than tied
to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 96 ms | 2864 ms | 0.004 | 354.800 KB | 150.200 KB | 48.400 KB | 722.700 KB | 163 |
| Browse | 40 ms | 2720 ms | 0.001 | 354.800 KB | 121.400 KB | 44.800 KB | 690.300 KB | 142 |
| Block 1 | 56 ms | 1548 ms | 0.001 | 354.800 KB | 113.400 KB | 41.400 KB | 678.800 KB | 104 |
| Post | 44 ms | 2192 ms | 0 | 354.800 KB | 272.100 KB | 45.300 KB | 842.500 KB | 134 |
| Wallet | 48 ms | 2140 ms | 0.029 | 354.800 KB | 144.800 KB | 45.800 KB | 724.100 KB | 143 |
| Internal market | 52 ms | 360 ms | 0.023 | 354.800 KB | 109.500 KB | 41.700 KB | 676.200 KB | 97 |
| Compose | 44 ms | 376 ms | 0.008 | 354.800 KB | 126.800 KB | 42.700 KB | 693.500 KB | 98 |
| Search | 44 ms | 356 ms | 0.002 | 354.800 KB | 105.900 KB | 41.800 KB | 671.800 KB | 103 |

Initial bundle snapshot: **507.200 KB gzip**
/ **350.600 KB Brotli** (entry shell and
modulepreloads).

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 355 | 150 | 55 | 730 | 8000 | 0.5 |
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
| `browser-Co1DAhBC.js` | 384.800 KB | 146 KB | 122.700 KB |
| `index-CB1yNcmT.css` | 229.200 KB | 39.600 KB | 31.400 KB |
| `index-CKkdknaz.js` | 200.500 KB | 66.900 KB | 58.400 KB |
| `lib-96BoxN_p.js` | 192.600 KB | 57 KB | 49.400 KB |
| `Index-l5XaX_47.js` | 128.300 KB | 35.300 KB | 30.300 KB |
| `wallet-C3OJDUz3.js` | 81.200 KB | 20.900 KB | 18.300 KB |
| `MainLayout-CJGgpExU.js` | 72.800 KB | 22.200 KB | 19.400 KB |
| `runtime-core.esm-bundler-7dsYGXba.js` | 69.500 KB | 26.800 KB | 24.400 KB |
| `compose-BQ-ShOAg.js` | 64.400 KB | 19.500 KB | 17.400 KB |
| `account-D2EDFMOU.js` | 60.500 KB | 17.100 KB | 15.100 KB |
| `witnesses-DhOcmdhe.js` | 53.400 KB | 15.800 KB | 14 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| local | de3acb4 | 2026-11-21 07:49 | Home LCP 2864ms / total 722.7KB<br>Browse LCP 2720ms / total 690.3KB<br>Block 1 LCP 1548ms / total 678.8KB<br>Post LCP 2192ms / total 842.5KB<br>Wallet LCP 2140ms / total 724.1KB<br>Internal market LCP 360ms / total 676.2KB<br>Compose LCP 376ms / total 693.5KB<br>Search LCP 356ms / total 671.8KB |
| W36 | 723327f | 2026-11-20 04:09 | Home LCP 1884ms / total 715.4KB<br>Browse LCP 2224ms / total 854KB<br>Block 1 LCP 1248ms / total 676KB<br>Post LCP 1912ms / total 835.8KB<br>Wallet LCP 1832ms / total 740KB<br>Internal market LCP 396ms / total 673.4KB<br>Compose LCP 352ms / total 675.8KB<br>Search LCP 328ms / total 668.7KB |
| W36 | 723327f | 2026-11-20 04:08 | Home LCP 1916ms / total 715.4KB<br>Browse LCP 2388ms / total 854KB<br>Block 1 LCP 1244ms / total 676KB<br>Post LCP 1864ms / total 835.8KB<br>Wallet LCP 1672ms / total 740KB<br>Internal market LCP 368ms / total 673.4KB<br>Compose LCP 352ms / total 675.8KB<br>Search LCP 340ms / total 668.7KB |
| W28-final | 1dc5a60 | 2026-11-18 09:52 | Home LCP 1836ms / total 646.5KB<br>Browse LCP 2484ms / total 655.6KB<br>Block 1 LCP 1192ms / total 650KB<br>Post LCP 2308ms / total 787.1KB<br>Wallet LCP 1544ms / total 685.6KB<br>Internal market LCP 380ms / total 648.6KB<br>Compose LCP 368ms / total 648.3KB<br>Search LCP 344ms / total 643.1KB |
| W26-final | 683b03a | 2026-11-18 08:41 | Home LCP 1980ms / total 642.5KB<br>Browse LCP 4264ms / total 651.7KB<br>Block 1 LCP 1472ms / total 632.9KB<br>Post LCP 2772ms / total 782.3KB<br>Wallet LCP 2124ms / total 680KB<br>Internal market LCP 400ms / total 631.5KB<br>Compose LCP 388ms / total 631.2KB |
| W25-final | 58b5ed2 | 2026-11-18 06:50 | Home LCP 1820ms / total 642.2KB<br>Browse LCP 3328ms / total 674KB<br>Block 1 LCP 1172ms / total 632.7KB<br>Post LCP 1988ms / total 782.1KB<br>Wallet LCP 1512ms / total 679.7KB<br>Internal market LCP 392ms / total 631.3KB |
| W25-final | 40fef79 | 2026-11-18 06:44 | Home LCP 1776ms / total 642.8KB<br>Browse LCP 3152ms / total 703.3KB<br>Block 1 LCP 1268ms / total 633.2KB<br>Post LCP 2064ms / total 782.6KB<br>Wallet LCP 1572ms / total 680.2KB<br>Internal market LCP 404ms / total 631.8KB |
| local | 40fef79 | 2026-11-18 06:36 | Home LCP 1748ms / total 642.8KB<br>Browse LCP 2324ms / total 703.3KB<br>Block 1 LCP 1208ms / total 633.2KB<br>Post LCP 2092ms / total 782.6KB<br>Wallet LCP 1584ms / total 680.2KB<br>Internal market LCP 428ms / total 631.8KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
