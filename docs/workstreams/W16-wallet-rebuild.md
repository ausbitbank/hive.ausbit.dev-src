# W16 — Wallet page rebuild

Date: 2026-11-18
Status: complete

## Scope

Full rebuild of `/@:username/wallet` (Priority 1). The previous page had a
portfolio summary layered above the original Hive / Hive-Engine tab layout, so
balances appeared twice and the page still read as two generations of UI.

The rebuilt page is a single wallet product with one information architecture:

1. Portfolio header — total holdings, 24h weighted change, HP APR, HBD APR,
   logged-in primary actions and section navigation.
2. Overview — five asset cards (liquid HIVE, staked HP, liquid HBD, HIVE
   savings, HBD savings) plus a pending/attention strip.
3. Recent activity — latest five operations.
4. Activity — full history, grouped by date, filtered by type, direction and
   search, with raw JSON and tx/block links, loaded 50 at a time on demand.
5. Pending — power-down progress and cancel, savings withdrawals and cancel,
   conversions, open orders and cancel, pending rewards and claim, HBD interest
   and claim, delegation summary.
6. Tokens — Hive-Engine balances, token details, transfer/stake/unstake, market
   links and the 250-item token history.

## Components

| File | Responsibility |
| --- | --- |
| `src/pages/wallet.vue` | Orchestration, account/prices/history/pending data, dialogs |
| `src/components/wallet/WalletPortfolioHeader.vue` | Total value, 24h change, APR chips, primary actions, jump links |
| `src/components/wallet/WalletAssetCard.vue` | One asset card with balance, USD value, status and authority-labelled actions |
| `src/components/wallet/WalletPendingStrip.vue` | Overview attention strip with links into the pending section |
| `src/components/wallet/WalletPendingPanel.vue` | Detailed pending items, cancellation/claim actions and delegations |
| `src/components/wallet/WalletActivity.vue` | Date grouping, filters, pagination and activity state |
| `src/components/wallet/WalletOperationRow.vue` | Friendly wallet operation row, memo decryption and expandable JSON |
| `src/components/wallet/HiveEngineTokens.vue` | Self-contained Hive-Engine balances, actions and history |
| `src/services/wallet.js` | Portfolio maths, transaction classification/filtering, operation descriptions |

The old Hive / Hive-Engine tabs and the duplicated balance list were removed.
`wallet.vue` dropped from ~1,571 lines to ~700 lines.

## Preserved actions

- Transfer HIVE/HBD (active key).
- Power up and power down / cancel power-down (active key).
- Savings deposit/withdraw and withdrawal cancellation (active key).
- Delegations in/out, modify and cancel (active key).
- HIVE ↔ HBD conversions and collateralized conversions (active key).
- Internal-market order display and cancellation (active key).
- Claim post/curation rewards (posting key).
- Claim HBD savings interest (active key).
- Hive-Engine transfer/stake/unstake (active key).
- Memo decryption for transfer and savings memos.
- Tax export link.
- Authority is visible on every asset action and stated on the pending panel.

## Verification

- `bun run lint` — clean.
- `bun run test` — 19 files / 142 tests passing (7 new wallet helper tests).
- `bun run build` — succeeded.
- Headless Chromium at 1440×1200 and 390×844:
  - one `h1`, six section `h2`s, five asset cards;
  - horizontal overflow `0` on both widths;
  - 50 initial activity rows, load-more increases to 100;
  - type + direction filters and search narrow the list correctly;
  - activity JSON expands;
  - asset, header and token action menus open at both widths without overflow.
- Axe WCAG A/AA: zero violations on desktop and 390px, and zero with an asset
  action menu open (after fixing list semantics and orange badge contrast).
- Action dialogs exercised: HIVE transfer, HBD transfer, power up, power down,
  delegate, savings deposit, convert, Hive-Engine transfer; no page/console
  errors outside known third-party CORS/price noise.
- Deployed with `./scripts/deploy.sh` and live-smoked.

## Notes

- Activity starts at 50 operations and uses an explicit “Load older activity”
  button. This keeps the rebuilt page responsive while preserving full history.
- Portfolio total covers liquid, staked and saved balances. Pending rewards are
  shown separately in the attention strip and pending panel, so the total
  matches the five asset cards exactly.
- Auto-refresh still refreshes the account and prices every 60 seconds.
