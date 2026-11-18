# W24 — Runtime polish and startup

Date: 2026-11-18
Status: complete
Baseline: W23 (`65a82de`)

## Scope

W24 reduces work that is not needed for first paint, finishes the known CLS
follow-ups from W22/W23, adds slow-network regression smoke coverage, verifies
PWA install/update/offline navigation end to end, and adds a query-gated
developer performance panel.

It does not redo W22 or W23, does not change signing authorities, and does not
start W25–W28. Search remains last.

## Startup work

- **SmartLock watchdog** (`src/boot/smartlock.js`): the 60-second lock check,
  pointer/key/touch activity listeners and visibility handler now start only
  for a signed-in SmartLock session and only from an idle callback. Logged-out
  and Keychain sessions pay nothing at startup; switching login type starts or
  stops the watchdog through the store.
- **Notification polling** (`src/components/notifications.vue`): the initial
  unread-count request and route-independent 60-second poll are deferred to an
  idle callback. Opening the notification inbox still refreshes immediately, so
  the visible inbox never waits for the idle timer.
- **Queue chunk**: the W23 idle preload for signed-in users is preserved, so an
  offline queue remains available without putting the queue on the startup path.
- The existing idle Hive-node probe, route prefetch and deferred dialogs remain
  unchanged.

## Layout stability

The W22 dashboard left wallet and post above the 0.1 CLS target. W24 fixes the
transition rather than hiding the content:

| Route | CLS before | CLS after | What changed |
| --- | ---: | ---: | --- |
| Wallet | 0.230 | **0.037** | Account header is synchronous with the route; the loading shell mirrors the portfolio header, asset grid and activity card. |
| Post | 0.061–0.18 | **0** | The loading state is a two-column article/sidebar skeleton; the first four post images are preloaded with decoded URL keys, intrinsic `width`/`height` attributes and a 70vh body placeholder before body paint. |
| Internal market | 0.124 | **0.023** | The order-book/trade grid reserves its loaded height while data lands. |

The post route was the remaining outlier because bodies contain user-supplied
images of arbitrary aspect ratio. Reserving each image's real dimensions before
the body enters the DOM removes that shift; the standard dashboard reports
**0**, and the slow-4G smoke also stays below **0.1**. Layout shift is not
suppressed with `transform` tricks; the actual skeleton and content geometry now
agree.

## Slow-network regression smoke

`e2e/perf.spec.js` adds a repeatable slow-4G profile using CDP network
emulation (6 Mbit/s down, 3 Mbit/s up, 100 ms latency) and a cold context with
service workers blocked. It measures LCP and CLS with buffered
`PerformanceObserver` instances for home, wallet and post, then asserts:

- LCP is present and below 8000 ms;
- CLS is below 0.1;
- horizontal overflow is zero.

Final full-suite values: home `CLS 0.029 / LCP 2848 ms`, wallet
`CLS 0.030 / LCP 3568 ms`, post `CLS 0.0001 / LCP 3396 ms`. All three enforce
the 0.1 target. The standard dashboard measures post at **0**, so the image
dimension reservation now holds on both the fast and slow profiles.

The second test checks the developer panel is absent by default, appears at
`?perf=1`, contains cache/API/chunk data, is axe-clean and closes cleanly.

## Developer performance panel

`src/components/ui/PerfPanel.vue` is loaded asynchronously only when requested
with `?perf=1` (or `?debug=perf`). It shows:

- current route;
- loaded JavaScript chunk count and encoded size, CSS size and the initial-JS
  budget;
- read-cache hit rate, hits/misses and stale hits from W23 telemetry;
- API request success rate, p50/p95 latency, retries, failovers, timeouts and
  aborts;
- per-node active/cooling/failure state and last latency;
- the largest loaded chunks.

It updates every two seconds while open, uses the existing tokens and
`.home-card` / `.home-panel` patterns, has an accessible close button and adds
no page-level `h1`. Closing it removes the query flag. The chunk is not part of
the normal startup path.

## PWA install, update and offline navigation

`e2e/pwa.spec.js` now verifies:

- manifest install prerequisites: name, `start_url`, `scope`, standalone
  display, 192/512 icons and icon responses;
- shell, feed, service worker and offline page availability;
- offline navigation through the service worker after one controlled reload
  (header and page render from the cached shell);
- the explicit update flow: a changed worker waits, no automatic reload occurs
  before confirmation, “Reload now” reloads once and leaves no waiting worker.

`scripts/serve-dist.mjs` now serves `sw.js` with `Cache-Control: no-store` so
local update checks behave like production rather than reusing a stale worker
script.

## Verification

- `bun run lint` — clean.
- `bun run test` — **38 files / 280 tests passing**.
- `bun run build` — succeeded.
- `bun run test:e2e` — **32 Playwright tests passing** (4.8 minutes), including
  all axe checks at 1440px and 390px for 11 routes, slow-network smoke, PWA
  install/update/offline navigation and the existing resilience suite.
- `bun run perf:check` — passed.
- Browser smoke:
  - slow-4G startup and data landing on home/wallet/post;
  - CLS below 0.1 on the slow profile;
  - developer panel query gate, data refresh and axe;
  - PWA offline navigation;
  - update prompt and safe reload;
  - existing dead-node, stale-snapshot and offline-signing flows still pass.

## Performance impact

`bun run perf` on the W24 build (label `W24-runtime`):

| Route | LCP | CLS | Initial JS | Route JS | Total transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 1764 ms | **0.008** | 323.3 KB | 108.4 KB | 642.4 KB |
| Browse | 3004 ms | **0.028** | 323.3 KB | 113.5 KB | 693.0 KB |
| Block 1 | 1188 ms | **0** | 323.3 KB | 100.2 KB | 632.8 KB |
| Post | 2016 ms | **0** | 323.3 KB | 247.6 KB | 782.3 KB |
| Wallet | 1424 ms | **0.037** | 323.3 KB | 134.7 KB | 679.5 KB |
| Internal market | 376 ms | **0.023** | 323.3 KB | 97.5 KB | 631.5 KB |

Initial Brotli JS stays at **318.7 KB**; the encoded initial-JS figure is
**323.3 KB** of the 345 KB budget. Route JS moved by **+0.4–1.0 KB** versus
W23. Total transfer moved **+2.0–3.4 KB** on most routes; browse adds **18.6 KB**
when visible preview thumbnails load because W24 makes that measurement
repeatable (480px Cloudinary variants), and still lands at **693 KB** under its
730 KB budget. All route, CSS, LCP and CLS budgets pass; browse LCP varies
between runs but stays inside the 8 s CI headroom.

## Notes

- W22 metadata-only prerender, boot splash, Rocket Loader opt-out, intent
  prefetch and performance budgets are preserved.
- W23 telemetry, failover, cache invalidation, snapshots and update flow are
  unchanged except for the offline/update E2E coverage.
- Post image preloading waits at most 10 s for the first four images; failures
  still render the body with normal browser image loading. Successful images
  get intrinsic `width`/`height` attributes before insertion, so the reserved
  box is correct even when the rendered body uses `srcset`. Roboto uses
  `font-display: optional` plus a Latin preload so late font swaps do not move
  post text.
- The concurrent settings-panel changes that appeared in the working tree were
  kept intact and committed separately as
  `feat(settings): refresh the settings panel layout and controls` rather than
  folded into the W24 implementation.

## Deploy and production smoke

- Deploy: `./scripts/deploy.sh` completed successfully.
- Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261118T045824Z.tar.gz`
  (`18431f8a513e785bc3638f9cfd72c81fab41c7708b5de98eba01022a26a45364`).
- Activated index hash:
  `3ab63260588312170bbc79fa0ab1e6c36970badf173536b91456de47cc0c7433`.
- Prerender wrote metadata-only shells for the eleven key routes.
- Live smoke through Cloudflare (service worker blocked):
  - static HTML has one `#q-app`, the boot splash, the metadata-only marker,
    `data-cfasync="false"` and zero prerendered body markers;
  - home, wallet and post render at 1440px and 390px with one `h1`, zero
    horizontal overflow and zero axe WCAG A/AA violations;
  - post CLS measured **0.0001** in production after intrinsic image dimensions;
  - the developer panel opens at `?perf=1`, shows cache/API data and is axe-clean;
  - zero application console errors. CoinGecko returned a temporary CORS/network
    failure during the run; the existing price fallback handled it, so only that
    third-party noise was filtered from the console assertion.

## Next

W25 — governance and community intelligence is next. W26 and W28 remain
queued; W28 search stays last.
