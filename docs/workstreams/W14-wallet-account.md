# W14 — Wallet and account overview

Date: 2026-11-17
Status: complete (phase 1 of the broader site-wide pass)

## Account page

`src/pages/account.vue` was rebuilt around a clear dashboard:

- Overview card with effective HP, reputation, account age, voting power,
  downvote power and a compact RC indicator.
- Quick links to wallet, blog, posts, comments, followers and following.
- Power-down notice and external Hive.blog/PeakD/Ecency links.
- Activity card with auto-refresh, operation filter, pagination and the rebuilt
  operation list.
- Sidebar: recent posts, account details, withdraw routes, JSON metadata,
  posting metadata, authorities, witness properties and witness votes.
- Responsive two-column layout that stacks on mobile.
- Missing accounts now show a proper not-found state; reputation comes from
  `bridge.get_profile` because the condenser account response can return `0`.

### Activity list

`src/components/accountOperations.vue` now uses the shared `BlockOperation`
renderer:

- Friendly operation summaries instead of a JSON dump per operation.
- Per-operation expandable JSON.
- Compact metadata row with block and transaction links.
- Page height reduced from ~22,000px to ~8,000px for 50 operations.

## Wallet page

`src/pages/wallet.vue` gained a portfolio summary above the existing tabs:

- Total HIVE/HBD portfolio value.
- Liquid HIVE, staked HP, liquid HBD, savings, pending rewards and yield.
- Existing power-down and pending HBD interest are surfaced.
- Refresh and “Manage balances” actions.
- Responsive two-column summary grid on mobile.
- Existing HIVE/Hive-Engine tabs, transaction history, filters and action
  dialogs remain intact.

`src/components/rc.vue` gained a compact mode used by the account overview.

## Verification

- `bun run lint` clean.
- `bun run test` — 17 files / 129 tests passing.
- `bun run build` succeeds.
- Account, wallet and missing-account views at 1440px and 390px: no overflow,
  one `h1`, no console errors.
- Axe WCAG A/AA: zero violations.
