# W22 bundle analysis

Date: 2026-11-18
Baseline: W27 (`a1da1e1`) plus the W22 changes in this workstream

## Headline

The initial shell is still dominated by `@hiveio/hive-js` and the Quasar
framework, but route-level preview and interaction code is now substantially
smaller.

| Route | Route JS before | Route JS after | Change | Total transfer before | Total transfer after | Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Home | 280.6 KB | 104.3 KB | −62.8% | 871.7 KB | 632.0 KB | −27.5% |
| Browse | 294.3 KB | 111.4 KB | −62.1% | 825.6 KB | 668.6 KB | −19.0% |
| Block 1 | 137.0 KB | 98.2 KB | −28.3% | 667.1 KB | 625.4 KB | −6.2% |
| Post | 306.0 KB | 245.0 KB | −19.9% | 858.7 KB | 774.1 KB | −9.9% |
| Wallet | 167.8 KB | 132.7 KB | −20.9% | 770.4 KB | 671.9 KB | −12.8% |
| Internal market | 136.1 KB | 95.6 KB | −29.8% | 667.5 KB | 624.1 KB | −6.5% |

The initial shell moved from **315.2 KB to 314.2 KB Brotli** (the entry chunk
is unchanged in composition); the win is that route work no longer pulls the
markdown renderer, the JSON viewer, Axios or dialog-only components on first
paint. Home FCP is ~0.12s (boot splash) and LCP ~0.45s locally instead of
~1.84s, mainly because the blocking node probe was removed from boot.

## Largest initial chunk

The entry `index-*.js` is 1.34 MB raw / 236.5 KB Brotli. Source-map attribution:

| Source group | Approx. source bytes |
| --- | ---: |
| `bn.js` | 693 KB |
| `readable-stream` | 330 KB |
| `quasar` | 279 KB |
| `@hiveio/hive-js` | 241 KB |
| `bluebird` | 179 KB |
| `bytebuffer` | 153 KB |
| `vue-router` | 120 KB |
| `elliptic` | 109 KB |

This is the `hive-js` signing/transport stack plus Quasar. It is eagerly
imported because `$hive` and the SmartLock/queue surfaces are available on
every page. Fully removing it from first paint requires migrating the remaining
read paths to the central API client and loading the signing stack only for
writes; that is a larger data-layer change than W22.

## Render-helper split

`browser-*.js` (373.8 KB raw / 119.3 KB Brotli) is `@ecency/render-helper` and
its markdown/HTML dependencies:

| Source group | Approx. source bytes |
| --- | ---: |
| `@xmldom/xmldom` | 270 KB |
| `autolinker` | 202 KB |
| `@ecency/render-helper` | 139 KB |
| `entities` | 131 KB |
| `remarkable` | 125 KB |
| `htmlparser2` | 49 KB |

Home/browse/account cards only need an image and a plain-text summary. W22 adds
`src/utils/postPreview.js` for those surfaces. `render-helper` now loads only
where a full body is rendered (the post page and the community header).

## Changes in this pass

- Removed the blocking Hive node probe from the `hivejs` boot: the configured
  node is installed synchronously and a healthy fallback is probed on idle.
- Metadata-only prerender: route HTML keeps crawlable `<title>`, description,
  canonical, Open Graph, Twitter and JSON-LD, but no body snapshot. This removes
  the hard-reload flash of stale chain data.
- Replaced preview uses of `@ecency/render-helper` with the local preview
  helpers (home rows, browse cards, recent/community carousels).
- Made the community header async, so normal browse pages do not load the
  renderer.
- Removed Axios: the four remaining calls use `fetch`. Axios is no longer a
  direct dependency or an eager boot file.
- Made `jsonViewer`, `CommentForm`, `shareButtons`, `votesDialog`, queue,
  notifications and settings async/dialog-only where the surface is not needed
  on first paint.
- Deferred the TradingView embed until the user requests the chart.
- Self-hosted only the Latin and Latin Extended Roboto subsets; removed the
  Cyrillic/Greek/symbol subset downloads.
- Added intent-based route prefetch on link hover/focus.
- Removed the unused TradingView preconnect from the HTML shell.

## Remaining opportunities

1. **hive-js in the initial chunk.** Continue the W20 migration for the
   remaining `$hive.api` reads, then load hive-js/SmartLock only for signing.
   This is the single largest remaining initial-JS opportunity.
2. **Quasar component graph.** The framework share of the entry chunk is still
   significant. Route-level Quasar component imports are already tree-shaken,
   but a component-usage audit may remove more.
3. **Material Icons.** The icon font is ~128 KB. An SVG icon subset would remove
   it, at the cost of a larger icon migration.
4. **CLS on wallet and post.** Wallet remains ~0.23 CLS and post ~0.18 CLS from
   asynchronous data landing. The dashboard now measures it; W24 owns the
   skeleton/loading-transition work.
5. **HTTP/2 request count.** The app still makes ~100 requests on first load
   because Quasar/Rolldown emits many small shared chunks. HTTP/2 handles this
   well in production, but chunk consolidation may help weak networks.

## How this was measured

`bun run build` then `bun run perf` (see `docs/performance/README.md`). Source
attribution used a one-off `PERF_SOURCE_MAP=1 bun run build` and the generated
`.map` files; source maps are not part of the normal production build.
