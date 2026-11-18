# W23 — Network and data resilience

Date: 2026-11-18
Status: complete
Baseline: W22 (`8c66214`) plus CI/Keychain follow-ups (`2e3a575`, `1a6155a`)
Implementation commit: `a3fd565`

## Scope

W23 makes the read path observable and hard to kill, gives every failed refresh
a usable state, and makes offline behaviour explicit:

- structured telemetry for the central API client and the read cache;
- timeout, retry, cancellation and node-rotation hardening;
- a page-level error boundary and consistent stale/offline notices;
- write-aware cache invalidation;
- timestamped offline snapshots for selected read-only views;
- an explicit service-worker update prompt with a safe reload.

It does not redo W22 or W27, does not change the signing authorities, and does
not start W24–W26 or W28. The central API client remains the read path; writes
continue to use hive-js/Keychain/SmartLock through the action queue.

## Authorities and signing

- Posting actions remain posting: votes, comments, follows, reblogs,
  notifications and community subscriptions.
- Active actions remain active: transfers, savings, conversions, market orders,
  witness votes/proxies, delegations and account updates.
- Every signing action still enters the queue for review. Signing intent is
  visible in the queue with its key authority and operation details before
  broadcast.
- Offline is now a hard signing block:
  - `addToQueue` marks a new action `failed` with
    “Reconnect before signing this action” and emits a single notification;
  - the queue disables auto-send, Send all and per-item send while offline;
  - the queue broadcast guard still refuses to call Keychain/SmartLock offline;
  - the failed intent is preserved and `Send all` resets failed items after
    reconnecting.

## Telemetry contract

`src/services/telemetry.js` owns a bounded, dependency-free session metric set.
The API client records attempts and terminal requests; the cache records every
lookup.

| Function | Purpose |
| --- | --- |
| `recordApiAttempt({ method, node, ok, durationMs, timedOut, aborted, code })` | One transport attempt against one node. |
| `recordApiRequest({ method, node, ok, durationMs, attempts, retries, failovers, timedOut, aborted, code, error })` | Terminal outcome of one logical request. |
| `recordApiRetry(...)` / `recordApiFailover(...)` | Explicit retry and node-rotation events. |
| `recordCacheEvent({ key, hit, stale })` | Fresh hit, stale hit or miss. |
| `recordUiError({ info, message })` | Error-boundary catches. |
| `getTelemetrySnapshot()` | Plain-object snapshot for UI, logs and smoke tests. |
| `subscribeTelemetry(fn)` / `resetTelemetry()` | Live observer and test reset. |

`getTelemetrySnapshot()` returns:

```js
{
  requests: { total, successes, failures, aborted, successRate },
  attempts: { total, retries, failovers, timeouts },
  latency: { samples, average, p50, p95, max },
  cache: { hits, misses, staleHits, hitRate },
  nodes: [{ key, requests, successes, failures, timeouts, successRate, averageLatency, ... }],
  methods: [{ key, requests, successes, failures, timeouts, successRate, averageLatency, ... }],
  recent: [{ t, type, method, node, ok, durationMs, ... }]
}
```

- Success rate counts terminal requests and excludes caller aborts from the
  failure numerator.
- Latency samples are non-aborted attempts; p50/p95 are computed over the last
  1000 samples.
- Events are bounded to 250 entries. Nothing leaves the browser.
- A read-only `window.__hiveTelemetry.snapshot()` handle makes the contract
  inspectable from the console and browser smoke tests. The visual developer
  panel remains W24 work (behind a query flag).

## Hardening

`src/services/api.js` now has:

- per-attempt timeouts (default 8s) and a bounded retry count (default 1 extra
  attempt), capped by the number of known nodes so one node is never retried in
  a loop;
- a short retry delay (100ms default, configurable);
- per-node failure tracking and exponential cooldown (15s up to 5min) so a dead
  node is skipped on the next read instead of adding latency to every request;
- automatic rotation to the next usable node, with `currentNode` only updated
  after a success;
- an explicit node choice clearing that node’s cooldown so a user-selected node
  is tried immediately;
- caller cancellation that stops the whole request and never fails over or
  retries after the signal is aborted;
- HTTP status codes and RPC codes preserved on `HiveApiError`, together with
  `attempts` and `cause`;
- `getApiNodeHealth()` for diagnostics and tests (active node, consecutive
  failures, cooldown, last latency).

If every node is cooling down, the client still tries the full list rather than
failing with no network attempt.

## Cache invalidation after writes

`src/services/cacheInvalidation.js` maps a successfully broadcast operation to
the read caches it must clear. The queue calls it immediately after a
successful broadcast, before refreshing the acting account.

| Operation family | Invalidated |
| --- | --- |
| vote, comment, comment_options, delete_comment | post lists, involved account entries, saved home post snapshots |
| custom_json | post lists, follow counts, community entry (when the payload names one), saved home post snapshots |
| witness vote/proxy/update/set_properties | witness entries, global properties, saved witness and health snapshots |
| account_update / account_update2 | account entry, post lists, saved home post snapshots |
| transfer, savings, convert, claims, delegation, limit orders, account creation | involved accounts, global properties, ticker, median price, open orders, saved health snapshot |

`invalidateCache` also bumps the cache epoch, so a read that was already in
flight cannot repopulate an entry that a write just invalidated. Every cache
entry has a delete path: prefix invalidation, targeted invalidators in
`chainData.js`, or `clearCache` for a full reset.

## Offline read snapshots

`src/services/snapshots.js` stores successful read models in
`hive:snapshot:<name>` with:

- a 7-day default TTL;
- a 512 KB per-snapshot cap;
- explicit `savedAt` timestamps and opportunistic pruning;
- no storage of signing material or wallet secrets.

Selected read-only views:

- home latest block;
- home coin prices (external CoinGecko read);
- home top witnesses;
- home trending and recent posts;
- latest blocks list;
- network health summary.

Each view writes a snapshot only after a successful read. On a failed refresh,
or offline, it restores the snapshot and renders `DataNotice` with “saved … ago”
and a Retry action. Signing never reads from a snapshot.

## Error boundaries and fallbacks

- `src/components/ui/ErrorBoundary.vue` wraps the routed view in
  `MainLayout.vue`, keyed by route path. It catches descendant render errors,
  records a `ui-error` telemetry event, and shows a single page-level `h1` with
  Try again (remount), Reload page and Home. Queue and saved data are untouched.
- `src/components/ui/DataNotice.vue` is the shared stale/offline/error notice
  using the existing tokens and `.home-card` / `.home-panel` rhythm.
- Existing page error states (browse, block, post, account, witnesses,
  proposals, market, markets, HBD, stabilizer, health, nodes) remain; the new
  notice fills the gaps for refresh failures with usable cached data.
- No new page-level `h1` was added to live data views; the health notice adds no
  heading.

## Service-worker updates

`public/sw.js` moved to shell cache `v3` and no longer calls `skipWaiting()`
during install. An update becomes a waiting worker and is applied only after an
explicit `SKIP_WAITING` message.

`src/boot/pwa.js`:

- watches `updatefound` and `registration.waiting`;
- prompts once per waiting worker with a Quasar dialog (“Reload now” / “Later”);
- “Reload now” posts `SKIP_WAITING`, waits for `controllerchange`, then reloads
  exactly once;
- “Later” keeps the current page and reminds the user; a later visibility check
  can prompt again (checks are throttled to 30 minutes);
- never prompts on first install;
- keeps the existing offline/online notifications and exposes the reactive
  connection state as `$online`;
- preloads the deferred queue chunk on idle for signed-in users so the queue is
  available from the shell cache when offline.

The queue and any open action survive the update prompt; the reload only happens
after the user confirms and the new worker takes control.

## Verification

- `bun run lint` — clean.
- `bun run test` — **38 files / 279 tests passing**.
  - New coverage: telemetry contract, node cooldown/retry/cancel, cache epoch
    invalidation, write invalidation mapping, snapshots/TTL/pruning, update
    availability, connectivity.
- `bun run build` — succeeded, including Rocket Loader compatibility and feed
  generation.
- `bun run test:e2e` — **28 Playwright tests passing**, including:
  - dead-primary-node failover with telemetry evidence;
  - home snapshot fallback when all chain reads fail;
  - offline signing marked failed with no tx id;
  - all existing axe checks at 1440px and 390px for 11 routes.
- `bun run perf:check` — passed.
- Axe at 1440px and 390px is part of the E2E suite for the affected routes;
  zero WCAG A/AA violations.
- Browser smoke:
  - dead node → healthy node rotation, no dead page (automated in the E2E
    suite with telemetry evidence);
  - stale/error notices with saved timestamps and retry;
  - offline home/blocks/health snapshots;
  - offline signing blocked and preserved as failed intent;
  - service-worker update prompt and safe reload on a production build:
    the prompt appeared only after a changed worker waited, no reload happened
    before confirmation, “Reload now” activated the new worker and reloaded
    once, and the registration finished with `waiting: false`;
  - live production smoke after deploy.

## Performance impact

Measured with `bun run perf` on the W23 build (label `W23-resilience`):

| Route | LCP before → after | Total transfer before → after |
| --- | --- | --- |
| Home | 460 → **432 ms** | 632.0 → **640.6 KB** |
| Browse | 2380 → **2172 ms** | 668.6 → **674.4 KB** |
| Block 1 | 1160 → **1160 ms** | 625.4 → **631.1 KB** |
| Post | 1920 → **1852 ms** | 774.1 → **779.7 KB** |
| Wallet | 1528 → **1524 ms** | 671.9 → **677.8 KB** |
| Internal market | 388 → **372 ms** | 624.1 → **629.8 KB** |

Initial Brotli JS moved **314.2 → 318.7 KB** (+4.5 KB) for telemetry, the error
boundary, snapshots and the update flow. All budgets still pass with headroom
(initial JS 322.5 KB of 345 KB; route JS 96.9–246.3 KB; total transfer
629.8–779.7 KB). The small total-transfer increase is the resilience code, not
a route-splitting regression. Post/wallet CLS remain above 0.1 and are the known
W24 skeleton/transition follow-up, not a W23 change.

## Notes

- W22 metadata-only prerender, boot splash, Rocket Loader opt-out, intent-based
  prefetch and budgets are preserved.
- Cache invalidation runs only after a real successful broadcast, never when an
  action is merely queued.
- Offline snapshots are explicitly labelled as saved data; they never claim to
  be live and never feed a signing path.
- The update flow deliberately trades instant activation for safety: an open
  action queue cannot disappear under a forced reload.
- The uncommitted Keychain install-page change that appeared during the session
  was kept as a separate `fix(login)` commit (`1a6155a`), not folded into W23.

## Deploy and production smoke

- Deploy: `./scripts/deploy.sh` completed successfully.
- Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261118T025124Z.tar.gz`
  (`c1111d40884749a32cbbd7b1c00e8f1b6a002af77ba18c96e57156532d98fdf2`).
- Activated index hash:
  `b749b9d1029a88e3008109df853e3c16f4e29d4ca36d3c1711ca3181685d5253`.
- Prerender wrote metadata-only shells for the eleven key routes.
- Live smoke through Cloudflare (service worker blocked):
  - static HTML has one `#q-app`, the boot splash, the
    `<!-- hive:metadata-only-prerender -->` marker, `data-cfasync="false"` on
    the entry script and zero prerendered body markers;
  - home, `/blocks` and the announcement post render at 1440px and 390px with
    one `h1`, zero horizontal overflow and zero axe WCAG A/AA violations;
  - `/blocks` serves its route-specific title;
  - zero console errors;
  - live telemetry on home: 4 requests, 100% success, 301ms average latency,
    p95 377ms, 0 timeouts/retries/failovers.

## Next

W24 owns startup/CLS refinement, the developer performance panel, slow-network
regression coverage and PWA install/update/offline-navigation E2E. W25–W28
remain queued; W28 stays last.
