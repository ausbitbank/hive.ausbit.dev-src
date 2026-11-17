# hive.ausbit.dev roadmap and session handoff

Last updated: 2026-11-17

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
- Account overview and wallet portfolio summary (phase 1).
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

## Priority 1 — rebuild the wallet page properly

**User feedback:** the current wallet work only added a portfolio summary at the
top; the rest of the page is still the old layout, and the summary duplicates
information below it. This needs a full rebuild, not another summary card.

Current file: `src/pages/wallet.vue` (~1,335 lines). It still contains:

- Old Hive / Hive Engine tabs.
- A long balance list and transaction history.
- Many inline dialogs and actions.
- The new portfolio summary above the old page.

### Goal

A single coherent wallet experience, not a new card layered on top of the old
page. Remove duplicated balance data once the new layout covers it.

### Proposed information architecture

1. **Wallet header**
   - Compact identity/portfolio header.
   - Total HIVE/HBD value, 24h change if available, HP and HBD APR.
   - Logged-in-only primary actions.

2. **Overview**
   - Asset cards: liquid HIVE, staked HP, liquid HBD, HIVE savings, HBD savings.
   - Each card: balance, USD value, APR/status and contextual actions.
   - Pending/attention strip: power-down, withdrawals, conversions, open orders,
     pending rewards, HBD interest.
   - Recent 5 activity items.

3. **Activity**
   - Full transaction history with date grouping.
   - Filters by operation type, direction and search.
   - Friendly operation summaries, expandable JSON and tx/block links.
   - Infinite or paginated loading, with a compact mobile layout.

4. **Pending**
   - Power-down progress and cancel.
   - Savings withdrawals and cancellations.
   - Conversions and collateralized conversions.
   - Internal-market open orders and cancellation.
   - Pending rewards and HBD interest claim.
   - Delegations in/out.

5. **Tokens**
   - Hive Engine balances, transfers, staking and unstaking.
   - Remove the old Hive/Hive-Engine tab split in favour of the sections above.

### Components to extract

Split the monolith into focused components, for example:

- `WalletPortfolioHeader.vue`
- `WalletAssetCard.vue`
- `WalletPendingPanel.vue`
- `WalletActivity.vue`
- `WalletOperationRow.vue`
- `HiveEngineTokens.vue`

Reuse existing dialogs (`transferDialog`, `stakingDialog`,
`unstakingDialog`, `savingsDialog`, `delegationDialog`, `convertDialog`,
`claimRewards`, etc.) rather than rewriting transaction flows unnecessarily.

### Preserve functionality

- Transfer HIVE/HBD
- Power up/down and cancel power-down
- Savings deposit/withdraw and cancellation
- Delegations in/out
- HBD/HIVE conversions and collateralized conversions
- Internal market orders and cancellation
- Claim rewards and HBD interest
- Hive Engine transfer/stake/unstake
- Memo decryption
- Tax export link
- Posting vs active key clarity for every action

### Acceptance criteria

- No duplicated summary/balance information.
- The page looks like one modern product, not two generations layered together.
- Desktop and 390px layouts have no overflow.
- All existing wallet actions still work.
- Queue items use the correct authority (`posting` vs `active`).
- `bun run lint`, `bun run test`, `bun run build`.
- Axe WCAG A/AA clean.
- Live smoke test before deploy.

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

> Read `docs/ROADMAP.md` first. Continue with Priority 1: a full wallet page
> rebuild, not another summary card. Replace the old wallet layout, extract
> focused wallet components, remove duplicated balance information and preserve
> all existing wallet actions. Run lint/test/build, axe, desktop and 390px smoke
> tests, then deploy and live-smoke.
