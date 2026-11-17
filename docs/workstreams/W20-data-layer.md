# W20 — Data layer, shared UI and legacy page consistency

Date: 2026-11-18
Status: complete

## Scope

Priority 5: a central chain read client, cached/stale-while-revalidate data,
visibility-aware polling, shared UI primitives and migration of the remaining
HBD, stabilizer and tax surfaces onto the current card/typography system.

The review found read calls spread across hive-js, ad-hoc caches in individual
components, polling that continued in hidden tabs, and legacy pages still using
`text-h*` typography and fixed layouts.

## Central API client

`src/services/api.js` provides a JSON-RPC transport for chain reads:

- Configurable nodes, default timeout **8 seconds** and one retry/failover
  attempt by default.
- Requests try the active node, then the next known node; a successful node
  becomes the active node.
- Failures carry method, node, code and attempt count in `HiveApiError`.
- Cancellation is supported through an external `AbortSignal`; timeouts abort
  the underlying fetch.
- `setHiveNode()` now synchronises the hive-js node and the central client, so
  settings and node auto-selection keep reads and writes on the same endpoint.
- Helpers cover accounts, global properties, witnesses, follow counts, median
  price, ticker, open orders and generic bridge calls.

Writes still go through hive-js/Keychain/SmartLock because they require the
signing stack.

## TTL cache and stale-while-revalidate

`src/services/cache.js` adds a bounded TTL cache and `loadCached()`:

- Fresh entries return without a request.
- Stale entries return immediately and revalidate in the background.
- Concurrent callers for the same key share one in-flight request.
- Prefix invalidation supports accounts, witnesses, posts, open orders and
  global properties.
- Force reads bypass the cache for actions that need fresh balances.

`src/services/chainData.js` defines the read models and TTLs:

| Data | TTL |
| --- | --- |
| Global properties | 15s |
| Accounts | 15s |
| Witness list / single witness | 60s |
| Ranked/account posts | 30s |
| Follow counts | 60s |
| Median price / ticker | 15s |
| Open orders | 5s |

Integrations:

- Store actions for account(s), global properties, follow counts and community
  info now use the cached read layer.
- Account, queue, wallet, market and login refreshes force fresh account reads
  after actions.
- Witness directory, witness page, health page and home witness card use cached
  witness/global reads.
- Home trending, home recent posts and browse listings use cached ranked/account
  post reads; browse refresh forces a fresh read.
- Block and home-block head reads use the central client for global properties.
- `/hbd` and `/hbdstabilizer` use cached accounts, median price, ticker and open
  orders.

## Polling visibility

- `src/mixins/timers.js` now pauses every running timer while the document is
  hidden and resumes/refreshes them when the tab becomes visible. This covers
  markets, market, wallet, nodes, health-adjacent timers, HBD monitor,
  stabilizer, internal market and the old block widget.
- `src/services/polling.js` provides the same visibility-aware behaviour for
  direct interval users. `/blocks` and the home block card now use it.
- Account auto-refresh reschedules without fetching while hidden.
- Notifications already polled only while visible; SmartLock’s auto-lock timer
  intentionally keeps running in the background for security.

## Shared UI components

Added under `src/components/ui/`:

| Component | Responsibility |
| --- | --- |
| `PageHeader.vue` | Page eyebrow, one page-level `h1`, intro, live dot and action slot |
| `StatCard.vue` | Label, value, unit, status badge, progress bar, hint and links |
| `EmptyState.vue` | Icon, title, message and optional action |
| `Skeleton.vue` | Accessible loading skeleton rows |
| `DataTable.vue` | Accessible semantic table with alignments, loading/empty states and cell slots |
| `FilterBar.vue` | Responsive filter/action toolbar |

## Migrated legacy pages

### `/hbd`

Rebuilt as a stablecoin monitor using `PageHeader`, `StatCard`, `EmptyState` and
`Skeleton`:

- Debt ratio with treasury-excluded supply, status and hard-limit progress.
- Median price, savings APR, internal HIVE/HBD implication, HBD supply and print
  rate.
- Redemption/haircut conditions with the threshold formula and facts.
- HBD savings projections and wallet link.
- Get HBD routes, internal market, external venues and the stabilizer link.
- Stale/error warning retains the last values and offers a retry.

### `/hbdstabilizer`

Rebuilt with `PageHeader`, `StatCard`, `DataTable`, `Skeleton` and
`EmptyState`:

- DAO value, stabilizer HBD, open-order count and median price.
- Account balances table for hive.fund, hbdstabilizer and hbd.funder with
  HIVE/HBD/HP and USD estimate.
- Open market orders table with side, sell, receive, price and expiry.
- Recent stabilizer operations in a scroll area with explicit empty/loading
  states and reload.

### `/tax`

Rebuilt with `PageHeader`, `FilterBar`, `StatCard`, `DataTable`, `EmptyState`
and `Skeleton`:

- Account field, Analyse, Load 1,000 and Load 10,000 controls.
- Transactions, days covered, net HIVE, net HBD and net VESTS summaries.
- Accessible daily totals table with signed-value colouring.
- CSV export, raw transactions and rendered operations.
- Explicit empty, loading and error states; batch loading runs sequentially and
  preserves the filtered-history retry behaviour.

All three pages use one page-level `h1`, the design tokens, shared card
patterns, and `noopener noreferrer` on external links.

## Verification

- `bun run lint` — clean.
- `bun run test` — **31 files / 245 tests passing** (19 new tests for the API
  client, cache, chain-data cache, visibility polling and timer pause/resume).
- `bun run build` — succeeded.
- Headless Chromium at 1440px and 390px:
  - `/hbd`, `/hbdstabilizer`, `/tax?user=ausbitbank` and `/` each have one
    `h1` and zero horizontal overflow;
  - HBD shows six stat cards, debt ratio, haircut facts, savings APR and get-HBD
    routes;
  - stabilizer shows four stat cards, account balances, open-order empty state
    and 100 recent operations in a contained scroll area;
  - tax shows five stat cards, the daily table and raw/rendered history;
  - home and browse reads still populate through the cached post layer;
  - console is clean.
- Axe WCAG A/AA: zero violations at 1440px and 390px on `/hbd`,
  `/hbdstabilizer`, `/tax` and `/`.
- Deployed with `./scripts/deploy.sh`. Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261117T160228Z.tar.gz`
  (`6b630a449033bf11ef6888d2fdedbf7ebf9f8646321e2cb2287ed830b1b6f78b`).
- Live smoke on `https://hive.ausbit.dev` for `/hbd`, `/hbdstabilizer`,
  `/tax?user=ausbitbank` and `/`: HTTP 200, one `h1`, zero overflow, zero axe
  violations and no console errors.

## Notes

- The central client is used for chain reads. Signing/broadcast paths remain on
  hive-js and the existing Keychain/SmartLock queue implementation.
- Account cache entries are short-lived, but mutations force a fresh read after
  a broadcast so wallet and market balances do not appear stale.
- Stale-while-revalidate keeps navigation fast while refreshing background data.
  If a refresh fails, the existing data remains visible with an explicit warning
  where the page supports it.
- The timers mixin refreshes once when a hidden tab becomes visible, which also
  gives returning users a current view without waiting for the next interval.
- The shared components are deliberately small and composition-based so later
  pages can adopt them without changing their data logic.
