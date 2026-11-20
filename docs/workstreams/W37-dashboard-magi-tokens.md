# W37 — Dashboard Magi tokens

Date: 2026-11-20
Status: implemented

## Scope

Issue **#76** asked for standard Magi tokens and their value in the dashboard
portfolio wallet widget.

## Changes

- `WidgetWallet` now loads the account's `magi_token` balances alongside the
  Magi HIVE/HBD balances.
- Added a **Magi tokens** row showing the token count and combined value.
- Token values are derived from Magi DEX pools through the public indexer
  (`https://indexer.magi.milohpr.com/v1/graphql`):
  - HBD-quoted pools give a direct HBD price.
  - HIVE-quoted pools are converted through the HBD/HIVE pool.
  - Tokens with no pool are shown as unpriced rather than valued at zero.
- Token value is included in the widget portfolio total.
- The widget footer reports unpriced tokens and whether token prices came from
  DEX pools.
- Updated the dashboard editor hint for the Magi toggle.

## Verification

- `bun run lint` — clean.
- `bun run test -- tests/unit/magi.spec.js tests/unit/layer2-nodes.spec.js` —
  20 tests passed.
- `bun run build` — succeeded.
- Local Chromium check with `@tibfox`:
  - wallet widget shows **Magi tokens · 3 tokens · $229.24**
  - footer reports **2 Magi tokens unpriced**
  - the widget total includes the priced Magi token value
