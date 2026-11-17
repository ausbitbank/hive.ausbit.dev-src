# hive.ausbit.dev roadmap and session handoff

Last updated: 2026-11-18

This file is the persistent handoff for future agent sessions. Read it first.
It records what is done, what remains, and the design standards already in use.

## Current state

Current verified baseline: **`7b82f97` on `master`**, pushed to `origin/master`.
Production `hive.ausbit.dev` is deployed from this build. W16 (wallet), W17
(witnesses, health, nodes), W18 (markets, HBD tools, internal market), W19
(queue, notifications, SmartLock, login), W20 (data layer, shared UI, legacy
page consistency) and W21 (E2E, offline shell, SEO, navigation polish) are
complete.

Recent completed workstreams:

- Block detail view (`/b/:blockNum`) with transaction grouping, friendly
  operations, virtual ops and raw block JSON.
- Transaction detail view (`/tx/:txId`) with summaries, signatures, raw JSON,
  prev/next navigation and block anchors.
- Post pages and comment threads: content-first layout, lazy/paginated comments,
  native markdown comment composer, replies to any comment.
- Browse/profile listings: cards/list/table views, filters, sort navigation,
  profile compact headers.
- Front page dashboard: live block card, market list, top witnesses, trending
  posts, recent author posts.
- Account overview (W14).
- Wallet page full rebuild: portfolio header, asset cards, pending strip and
  panel, date-grouped filtered activity, extracted Hive-Engine tokens, removed
  duplicated balances (W16).
- Command palette and navigation: Ctrl/Cmd+K, direct route parsing, recents,
  header/mobile/drawer triggers.
- Witnesses, witness editing, network health and API nodes: searchable/sortable
  witness directory with proxies, voting and vote-weight calculator, health
  warnings, rebuilt witness settings, network metrics dashboard and node
  latency history/failover (W17).
- W17 follow-up: labelled saved public signing keys with one-click switching on
  `/witness`, and corrected relative-time rendering so price-feed ages read
  “40 minutes ago” rather than “in 40 minutes”.
- Markets: responsive TradingView chart with pair/interval URL state, HBD peg
  and savings APR cards, conversion calculator, rebuilt internal market with
  order book, trades, open orders, balances and fees, and deeper home-market
  links (W18).
- Queue, notifications and SmartLock: persisted per-item statuses with send all,
  retry failures and clear completed; paginated/filterable notification inbox
  with live unread badge and queued mark-all-read; SmartLock lock controls,
  inactivity timeout and clearer posting/active key guidance (W19).
- Data layer and consistency: central JSON-RPC read client with timeouts,
  retries, failover and cancellation; TTL/stale-while-revalidate caches for
  accounts, global props, witnesses and posts; visibility-aware polling;
  shared page/stat/empty/skeleton/table/filter components; rebuilt HBD,
  stabilizer and tax pages (W20).
- Quick wins and hardening: Playwright E2E and axe checks in CI, offline
  shell/manifest/feed, prerendered key routes, keyboard shortcuts,
  back-to-top, searchable 404, copy/share menus and a full README revamp (W21).

Relevant docs:

- `docs/workstreams/W7-proposals.md` and `W7-proposals-log.md`
- `docs/workstreams/W8-block-view.md`
- `docs/workstreams/W9-post-reading.md`
- `docs/workstreams/W10-transactions.md`
- `docs/workstreams/W11-browse-previews.md`
- `docs/workstreams/W12-comment-composer.md`
- `docs/workstreams/W13-home-dashboard.md`
- `docs/workstreams/W14-wallet-account.md`
- `docs/workstreams/W15-command-palette.md`
- `docs/workstreams/W16-wallet-rebuild.md`
- `docs/workstreams/W17-witnesses-health.md`
- `docs/workstreams/W18-markets.md`
- `docs/workstreams/W19-queue-login.md`
- `docs/workstreams/W20-data-layer.md`
- `docs/workstreams/W21-hardening.md`

## Priority 1 — wallet page rebuild (complete)

Completed 2026-11-18. See `docs/workstreams/W16-wallet-rebuild.md`.

`src/pages/wallet.vue` was rebuilt from ~1,571 lines to ~700 lines and split
into focused components under `src/components/wallet/`:

- Portfolio header: total holdings, weighted 24h change, HP/HBD APR and
  logged-in primary actions.
- Overview: liquid HIVE, staked HP, liquid HBD, HIVE savings and HBD savings
  cards, each with USD value, status, contextual actions and authority labels.
- Pending strip and panel: power-down progress/cancel, savings withdrawals,
  conversions, open orders, rewards, HBD interest and delegations.
- Recent activity plus full activity with date grouping, type/direction/search
  filters, raw JSON, tx/block links and on-demand pagination (50 at a time).
- Hive-Engine tokens with balances, details, transfer/stake/unstake, market
  links and token history.

The old Hive/Hive-Engine tabs and duplicated balance list were removed. All
wallet actions, memo decryption, claiming and the tax export link are preserved.

Checks: lint clean, 19 test files / 142 tests passing, build succeeded, zero axe
violations at 1440px and 390px, deploy and live smoke completed.

## Priority 2 — witnesses and network health (complete)

Completed 2026-11-18. See `docs/workstreams/W17-witnesses-health.md`.

- `/witnesses` rebuilt: search by name/URL/version, sorting with direction,
  my-votes view, voting proxy set/clear, vote/unvote, vote-weight and top-20
  impact calculator, expandable raw details, and warnings for signing disabled,
  stale price feeds, missed scheduled blocks and version mismatch.
- `/witness` rebuilt: status cards, validated identity/chain/advanced subsidy
  settings, labelled saved public signing keys with one-click switching,
  percentage-to-basis-point HBD interest, JSON and `cli_wallet` preview, reset,
  registration and confirmed signing disable.
- `/health` rebuilt: overall status banner, witness participation, treasury-
  excluded HBD debt ratio, median price and feed range, vesting resource pool,
  hardfork and chain versions, chain state, scheduled witness health and API
  latency summary.
- `/nodes` rebuilt: head, lag, version and health per node, local 24-sample
  latency history with sparklines, 30-second re-checks, manual selection,
  auto-select fastest, automatic failover and version comparison.
- All witness mutations queue with active authority; the queue refreshes the
  affected account after a witness broadcast.

Checks: lint clean, 23 test files / 188 tests passing, build succeeded, zero
axe violations at 1440px and 390px on all four routes, browser smoke completed,
deploy and live smoke completed.

## Priority 3 — markets (complete)

Completed 2026-11-18. See `docs/workstreams/W18-markets.md`.

- `/markets` is now a market chart and HBD tools page: responsive TradingView
  chart, pair/interval selection with URL state, HIVE/HBD snapshot, HBD peg
  premium/discount, HBD savings APR and a HIVE ↔ HBD conversion calculator.
- `/market` is the rebuilt internal market: ticker strip, order book with
  cumulative depth and click-to-prefill, recent trades, open orders, balances,
  zero-fee disclosure and a validated buy/sell form.
- Order creation and cancellation queue with active authority; the existing
  queue refreshes the account after a broadcast.
- Home market card rows link HIVE to the chart and HBD to the peg/converter
  section; BTC/ETH remain external CoinGecko links with `noopener noreferrer`.
- Hash navigation now scrolls to anchored sections with a header offset.

Checks: lint clean, 24 test files / 199 tests passing, build succeeded, zero axe
violations at 1440px and 390px on both routes, deploy and live smoke completed.

## Priority 4 — queue, login, notifications (complete)

Completed 2026-11-18. See `docs/workstreams/W19-queue-login.md`.

- Queue rebuilt with persisted per-item states (queued, sending, sent, failed),
  send all, retry failures, clear sent, clear queue, pause/resume auto-send,
  operation/key summaries and raw details.
- Restored queues stay paused; interrupted broadcasts return as retryable
  failures; any broadcast failure pauses auto-send.
- SmartLock account status, lock/unlock controls, 5/15/30/60-minute inactivity
  timeout and a visibility-aware auto-lock boot task.
- Login popup now explains posting versus active keys and Keychain, and the
  import form labels required versus optional keys.
- Notifications inbox: page-size loading, load more with `last_id`, type filters,
  unread-only mode, 60-second visible-tab badge refresh, and queued
  mark-all-read that updates local unread state after a successful broadcast.
- Keychain and SmartLock signing paths preserve the queue item’s posting/active
  authority; SmartLock active actions always require a password confirmation.

Checks: lint clean, 27 test files / 226 tests passing, build succeeded, zero axe
violations at 1440px and 390px with the login, settings, SmartLock, queue and
notification surfaces open, deploy and live smoke completed.

## Priority 5 — data layer and consistency (complete)

Completed 2026-11-18. See `docs/workstreams/W20-data-layer.md`.

- Central JSON-RPC read client with timeout, retry, node failover, cancellation
  and `HiveApiError` metadata. Node selection now keeps hive-js and the central
  client on the same endpoint.
- Bounded TTL cache with stale-while-revalidate, in-flight de-duplication and
  prefix invalidation. Cached reads cover global props, accounts, witnesses,
  posts, follow counts, median/ticker and open orders.
- Store actions, witness/health surfaces, home/browse posts, block head reads,
  HBD and stabilizer now use the cached read layer; mutation paths force fresh
  account reads.
- `VueTimers` and a shared polling helper pause while the tab is hidden and
  refresh once when it returns; account auto-refresh and notifications follow
  the same visibility rule.
- Shared `PageHeader`, `StatCard`, `EmptyState`, `Skeleton`, `DataTable` and
  `FilterBar` components under `src/components/ui/`.
- `/hbd`, `/hbdstabilizer` and `/tax` moved onto the shared card/typography
  system with consistent loading, empty, error and stale/error-with-data states.

Checks: lint clean, 31 test files / 245 tests passing, build succeeded, zero axe
violations at 1440px and 390px on the migrated pages, deploy and live smoke
completed.

## Priority 6 — quick wins and hardening (complete)

Completed 2026-11-18. See `docs/workstreams/W21-hardening.md`.

- Playwright E2E covers login simulation, comment queueing, proposal voting,
  wallet transfers, browse filters, queue controls, navigation shortcuts, 404
  search, back-to-top, share menus and the offline shell.
- Axe WCAG A/AA checks run in CI for eight key routes at 1440px and 390px.
- PWA manifest, production-only service worker, offline page, online/offline
  notices and offline-safe queue failures.
- Build-generated RSS feed plus optional Chromium prerender of key routes,
  sitemap/robots updates and existing post/account JSON-LD.
- Keyboard shortcuts: `Ctrl K` / `/` search, `?` help, `g` navigation sequences.
- Back-to-top, searchable 404, copy/share actions on blocks, transactions,
  accounts and proposals.
- README rewritten with screenshots, feature/route tour, stack, architecture,
  data layer, commands, E2E/deploy workflow, data sources and key safety.

Checks: lint clean, 31 test files / 245 unit tests passing, 20 Playwright tests
passing, build and feed/prerender succeeded, zero axe violations at 1440px and
390px, deploy and live smoke completed.

## Future candidates

- Migrate the remaining small legacy pages (`connections`, `communities`,
  `trail`, `tip`, `create`, `token`) onto the shared UI primitives.
- Performance budgets, route-level bundle splitting and images lazy-loading.
- Authenticated E2E against a disposable test account with mocked signing.
- Offline data snapshots for selected explorer views.
- PWA install prompt and update-available flow.
- More structured data for proposals, blocks and transactions.
- Search relevance, grouped results and saved searches.

## Standards already used

- Vue 3 + Quasar 2 + Vite.
- Page classes and design tokens in `src/css/app.scss`.
- Full card headers use `.home-card` / `.home-panel` patterns.
- One page-level `h1`; section headings are `h2`.
- UGC is sanitized; external links use `noopener noreferrer`.
- Expandable JSON is important on explorer pages.
- Test count and build status should be reported after each workstream.
- Deploy with `./scripts/deploy.sh`, then live-smoke.
- Rollback uses the backup path printed by the deploy script.
- Commit and push verified work to `origin/master`; confirm the working tree is
  clean and report the commit hash and deploy backup path.

## Suggested new-session prompt

> Read `docs/ROADMAP.md` first. The current verified baseline is commit
> `7b82f97` on `master`, pushed to `origin/master`; W16–W21 are complete, with
> 31 unit test files / 245 tests passing, 20 Playwright E2E tests passing, a
> green build, and production deployed from the same commit.
>
> All named priorities are complete. Review the current state and **Future
> candidates** section, then choose and execute the next follow-up workstream.
> The recommended first pass is:
>
> 1. Migrate the remaining small legacy pages (`connections`, `communities`,
>    `trail`, `tip`, `create`, `token`) onto the shared UI primitives and
>    consistent loading/empty/error states.
> 2. Add performance budgets, route-level bundle splitting and image lazy-loading.
> 3. Add structured data for proposals, blocks and transactions.
> 4. Extend the authenticated E2E suite against a disposable test account with
>    mocked signing.
> 5. Add an offline data snapshot and PWA update-available flow.
> 6. Record the work in a new `docs/workstreams/W22-*.md` file.
>
> Follow the existing standards: use the design tokens and card patterns, keep
> one page-level `h1`, preserve correct posting/active queue authorities, sanitize
> UGC, and use `noopener noreferrer` on external links.
>
> After implementation, run `bun run lint`, `bun run test`, `bun run build` and
> `bun run test:e2e`, run axe at 1440px and 390px, smoke the key flows, deploy
> with `./scripts/deploy.sh`, and live-smoke production. Update
> `docs/workstreams/` and `ROADMAP.md`, report the unit/E2E counts, build/deploy
> status and backup path, then commit and push the verified work and confirm the
> working tree is clean.
>
> Do not redo W16–W21 except for integration fixes.
