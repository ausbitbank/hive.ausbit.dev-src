# Performance dashboard

Generated 2026-11-21T17:58:22.095Z from commit `00ba6db` (local).

This dashboard measures the built SPA served by `scripts/serve-dist.mjs` with
Brotli/gzip compression and a cold browser cache. It records Core Web Vitals
and encoded transfer sizes for the main explorer routes plus the compose and
search pages. It is intentionally repeatable locally and in CI rather than tied
to a hosted Lighthouse account.

## Latest run

| Route | FCP | LCP | CLS | Initial JS | Route JS | CSS | Total transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 156 ms | 3360 ms | 0.004 | 355.500 KB | 153.100 KB | 48.400 KB | 726.300 KB | 166 |
| Browse | 84 ms | 3336 ms | 0.001 | 355.500 KB | 122.100 KB | 44.800 KB | 867.600 KB | 142 |
| Block 1 | 80 ms | 1864 ms | 0.001 | 355.500 KB | 117.300 KB | 41.400 KB | 683.500 KB | 106 |
| Post | 72 ms | 2736 ms | 0 | 355.500 KB | 276.600 KB | 45.700 KB | 848.100 KB | 136 |
| Wallet | 76 ms | 2516 ms | 0.029 | 355.500 KB | 150.900 KB | 46 KB | 731.100 KB | 146 |
| Internal market | 72 ms | 704 ms | 0.023 | 355.500 KB | 109.600 KB | 41.700 KB | 677.100 KB | 97 |
| Compose | 60 ms | 696 ms | 0.009 | 355.500 KB | 150.600 KB | 44.300 KB | 719.700 KB | 101 |
| Search | 80 ms | 640 ms | 0.002 | 355.500 KB | 107.300 KB | 41.800 KB | 673.900 KB | 104 |

Initial bundle snapshot: **508 KB gzip**
/ **351.400 KB Brotli** (entry shell and
modulepreloads).

## Budgets

`docs/performance/budgets.json` is enforced by `bun run perf:check` in CI.

| Route | Initial JS KB | Route JS KB | CSS KB | Total KB | LCP ms | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 356 | 154 | 55 | 730 | 8000 | 0.5 |
| Browse | 356 | 145 | 55 | 900 | 8000 | 0.5 |
| Block 1 | 356 | — | 55 | — | 8000 | 0.5 |
| Post | 356 | 280 | 55 | 860 | 8000 | 0.5 |
| Wallet | 356 | 165 | 55 | 760 | 8000 | 0.5 |
| Internal market | 356 | 125 | 55 | 710 | 8000 | 0.5 |
| Compose | 356 | 152 | 55 | 720 | 8000 | 0.5 |
| Search | 356 | 150 | 55 | 720 | 8000 | 0.5 |

## Largest chunks

| Asset | Raw | gzip | Brotli |
| --- | ---: | ---: | ---: |
| `serializer-bZO_BWwO.js` | 958.500 KB | 265.100 KB | 140.300 KB |
| `browser-BQpIxzu-.js` | 384.800 KB | 146 KB | 122.800 KB |
| `index-CB1yNcmT.css` | 229.200 KB | 39.600 KB | 31.400 KB |
| `index-Bt2QXJCr.js` | 202.600 KB | 67.600 KB | 59.100 KB |
| `lib-96BoxN_p.js` | 192.600 KB | 57 KB | 49.400 KB |
| `compose-BaqNm0NP.js` | 144.700 KB | 38.200 KB | 33.100 KB |
| `Index-BLg3i3h2.js` | 124.900 KB | 34 KB | 29.200 KB |
| `wallet-9FCQ0woI.js` | 86.100 KB | 22.700 KB | 19.800 KB |
| `MainLayout-B6vmgzMT.js` | 72.800 KB | 22.200 KB | 19.400 KB |
| `runtime-core.esm-bundler-CntdQHv-.js` | 69.700 KB | 26.900 KB | 24.400 KB |
| `account-D9uGAvEN.js` | 60.500 KB | 17.100 KB | 15.100 KB |
| `witnesses-Dt4YQEDN.js` | 53.400 KB | 15.800 KB | 14.100 KB |

See [bundle analysis](bundle-analysis.md) for the dependency notes and the W22
changes.

## History

| Run | Commit | Generated | Routes |
| --- | --- | --- | --- |
| local | 00ba6db | 2026-11-21 17:58 | Home LCP 3360ms / total 726.3KB<br>Browse LCP 3336ms / total 867.6KB<br>Block 1 LCP 1864ms / total 683.5KB<br>Post LCP 2736ms / total 848.1KB<br>Wallet LCP 2516ms / total 731.1KB<br>Internal market LCP 704ms / total 677.1KB<br>Compose LCP 696ms / total 719.7KB<br>Search LCP 640ms / total 673.9KB |
| local | 00ba6db | 2026-11-21 17:30 | Home LCP 3200ms / total 726.2KB<br>Browse LCP 2948ms / total 1112.3KB<br>Block 1 LCP 1748ms / total 683.5KB<br>Post LCP 2636ms / total 848.1KB<br>Wallet LCP 2508ms / total 731.1KB<br>Internal market LCP 596ms / total 677KB<br>Compose LCP 680ms / total 719.7KB<br>Search LCP 544ms / total 673.8KB |
| local | de3acb4 | 2026-11-21 07:49 | Home LCP 2864ms / total 722.7KB<br>Browse LCP 2720ms / total 690.3KB<br>Block 1 LCP 1548ms / total 678.8KB<br>Post LCP 2192ms / total 842.5KB<br>Wallet LCP 2140ms / total 724.1KB<br>Internal market LCP 360ms / total 676.2KB<br>Compose LCP 376ms / total 693.5KB<br>Search LCP 356ms / total 671.8KB |
| W36 | 723327f | 2026-11-20 04:09 | Home LCP 1884ms / total 715.4KB<br>Browse LCP 2224ms / total 854KB<br>Block 1 LCP 1248ms / total 676KB<br>Post LCP 1912ms / total 835.8KB<br>Wallet LCP 1832ms / total 740KB<br>Internal market LCP 396ms / total 673.4KB<br>Compose LCP 352ms / total 675.8KB<br>Search LCP 328ms / total 668.7KB |
| W36 | 723327f | 2026-11-20 04:08 | Home LCP 1916ms / total 715.4KB<br>Browse LCP 2388ms / total 854KB<br>Block 1 LCP 1244ms / total 676KB<br>Post LCP 1864ms / total 835.8KB<br>Wallet LCP 1672ms / total 740KB<br>Internal market LCP 368ms / total 673.4KB<br>Compose LCP 352ms / total 675.8KB<br>Search LCP 340ms / total 668.7KB |
| W28-final | 1dc5a60 | 2026-11-18 09:52 | Home LCP 1836ms / total 646.5KB<br>Browse LCP 2484ms / total 655.6KB<br>Block 1 LCP 1192ms / total 650KB<br>Post LCP 2308ms / total 787.1KB<br>Wallet LCP 1544ms / total 685.6KB<br>Internal market LCP 380ms / total 648.6KB<br>Compose LCP 368ms / total 648.3KB<br>Search LCP 344ms / total 643.1KB |
| W26-final | 683b03a | 2026-11-18 08:41 | Home LCP 1980ms / total 642.5KB<br>Browse LCP 4264ms / total 651.7KB<br>Block 1 LCP 1472ms / total 632.9KB<br>Post LCP 2772ms / total 782.3KB<br>Wallet LCP 2124ms / total 680KB<br>Internal market LCP 400ms / total 631.5KB<br>Compose LCP 388ms / total 631.2KB |
| W25-final | 58b5ed2 | 2026-11-18 06:50 | Home LCP 1820ms / total 642.2KB<br>Browse LCP 3328ms / total 674KB<br>Block 1 LCP 1172ms / total 632.7KB<br>Post LCP 1988ms / total 782.1KB<br>Wallet LCP 1512ms / total 679.7KB<br>Internal market LCP 392ms / total 631.3KB |

## Commands

```sh
bun run build       # produce dist/spa
bun run perf        # write latest.json, history.jsonl and this dashboard
bun run perf:check  # run the same measurement and fail on budget regressions
```
