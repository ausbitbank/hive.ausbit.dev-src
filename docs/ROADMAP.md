# hive.ausbit.dev roadmap and session handoff

Last updated: 2026-11-18

This file is the persistent handoff for future agent sessions. Read it first.
It records what is done, what remains, and the design standards already in use.

## Current state

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

## Priority 2 — witnesses and network health

- Modern `/witnesses` directory: search, sort, my votes, proxy, vote/unvote,
  vote-weight calculator, health warnings (missed blocks, stale price feed,
  signing disabled, version mismatch).
- Modern `/witness` edit experience.
- `/health` network dashboard: witness participation, HBD debt ratio, resource
  pool, median price, hardfork status, chain version and API/latency summary.
- `/nodes` proper status view: latency history, head lag, version, failover and
  auto-select fastest healthy node.

## Priority 3 — markets

- Make the TradingView chart responsive; it is currently fixed at 1000×1000.
- Improve pair selection and chart page layout.
- Internal market: order book, recent trades, open orders, balances and fees.
- HBD peg/premium, savings APR and a HIVE/HBD conversion calculator.
- Link the home market card deeper into the market experience.

## Priority 4 — queue, login, notifications

- Queue: send all, retry failures, clear completed, per-item status and clearer
  key requirements.
- SmartLock: lock button, session timeout and clearer key-type explanation.
- Notifications: load more, filtering, mark-all-read reliability and live badge.
- Improve login/onboarding copy around posting vs active keys.

## Priority 5 — data layer and consistency

- Central API client: timeout, retries, node failover, cancellation.
- TTL cache / stale-while-revalidate for global props, accounts, posts and
  witnesses.
- Pause polling when the tab is hidden.
- Shared `PageHeader`, `StatCard`, `EmptyState`, `Skeleton`, `DataTable` and
  `FilterBar` components.
- Move remaining legacy pages onto the current card/typography system.
- Consistent loading, empty, error and stale-data states.

## Priority 6 — quick wins and hardening

- Playwright E2E for login simulation, comment posting, proposal voting, wallet
  actions, browse filters and queue broadcasting.
- Axe checks in CI for key routes.
- PWA/offline shell and queue persistence.
- SEO: prerender key routes, post/account structured data, RSS feeds.
- Keyboard shortcuts and focus traps in dialogs.
- “Back to top” for long pages.
- Better 404 with search suggestions.
- Copy/share actions for blocks, transactions, accounts and proposals.

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

## Suggested new-session prompt

> Read `docs/ROADMAP.md` first. Continue with Priority 2: witnesses and network
> health. Build the modern `/witnesses` directory with search, sort, my votes,
> proxy, vote/unvote, vote-weight calculator and health warnings; rebuild
> `/witness` editing; then improve `/health` and `/nodes` using the existing
> design tokens and card patterns. Run lint/test/build, axe, desktop and 390px
> smoke tests, then deploy and live-smoke.
