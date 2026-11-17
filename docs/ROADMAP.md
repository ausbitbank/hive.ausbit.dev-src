# hive.ausbit.dev roadmap and session handoff

Last updated: 2026-11-18

This file is the persistent handoff for future agent sessions. Read it first.
It records what is done, what remains, and the design standards already in use.

## Current state

Current verified baseline: **`cccde83` on `master`**, pushed to `origin/master`.
Production `hive.ausbit.dev` is deployed from this build. W16 (wallet), W17
(witnesses, health, nodes) and W18 (markets, HBD tools, internal market) are
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
- README revamp: replace the current short README with an accurate project
  overview, feature/route tour, screenshots, stack and architecture summary,
  local setup, dev/lint/test/build commands, deploy/rollback workflow, API and
  data-source notes, key-authority/security guidance, and links to `ROADMAP.md`
  and the workstream docs.

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
> `cccde83` on `master`, pushed to `origin/master`; W16 (wallet), W17
> (witnesses, health, nodes) and W18 (markets, HBD tools, internal market) are
> complete, with 24 test files / 199 tests passing, a green build, and
> production deployed from the same commit.
>
> Continue with **Priority 4 — queue, login, notifications**. Review the current
> surfaces before changing them: `src/components/queue.vue`,
> `src/components/smartlock/`, `src/components/notifications.vue`,
> `src/components/userLogin.vue` and `src/stores/hive/`.
>
> Deliver:
>
> 1. Queue controls: send all, retry failures, clear completed, per-item status
>    and clearer posting/active key requirements.
> 2. SmartLock: lock button, session timeout and clearer key-type explanation.
> 3. Notifications: load more, filtering, reliable mark-all-read and a live badge.
> 4. Clearer login/onboarding copy around posting versus active keys.
> 5. A new `docs/workstreams/W19-queue-login.md` workstream record.
>
> Follow the existing standards: use the design tokens and card patterns, keep
> one page-level `h1`, preserve correct posting/active queue authorities, sanitize
> UGC, and use `noopener noreferrer` on external links.
>
> After implementation, run `bun run lint`, `bun run test` and `bun run build`,
> run axe at 1440px and 390px, smoke the key flows, deploy with
> `./scripts/deploy.sh`, and live-smoke production. Update `docs/workstreams/`
> and `ROADMAP.md`, report the test count, build/deploy status and backup path,
> then commit and push the verified work and confirm the working tree is clean.
>
> Do not redo W16–W18 except for integration fixes. The README revamp is tracked
> in Priority 6 and is not part of this session.
