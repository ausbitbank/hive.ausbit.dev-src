# W8 — Block detail view rebuild

Date: 2026-11-17
Status: complete

## Goals

- Keep the expandable JSON experience.
- Make `/b/:blockNum` feel like a real block explorer instead of a raw
  operation dump.
- Stay readable at 390px and 1440px with no horizontal overflow.

## What changed

- `src/pages/block.vue` rewritten around a block summary, navigation and tabs.
  - Previous / next / refresh / latest controls plus footer paging.
  - Hero with witness, absolute and relative timestamps, irreversible/head
    badges, copy block ID and HiveHub link.
  - Metrics for transactions, operations, virtual ops and block size, plus
    block ID, previous block, Merkle root and signing key.
  - Tabs: Transactions, Virtual operations, Raw JSON.
  - Loading skeletons, not-found/error state, retry and page metadata.
- `src/components/BlockTransaction.vue` added.
  - Groups operations by transaction, shows the tx id, operation count,
    copy-id and collapse/expand. Every transaction starts expanded so the
    existing scanning behaviour is preserved.
- `src/components/BlockOperation.vue` added.
  - Friendly summaries for votes, posts, transfers, power up/down, custom
    JSON, rewards, orders, conversions, savings, delegations, witness and
    proposal operations.
  - Virtual operations now have summaries too: `effective_comment_vote`,
    `comment_payout_update`, `comment_benefactor_reward`, `return_vesting_delegation`,
    `producer_reward`, `fill_order`, `limit_order_cancelled`, `fill_convert_request`,
    `fill_vesting_withdraw`, `fill_transfer_from_savings`,
    `fill_collateralized_convert_request`, `liquidity_reward` and `dhf_funding`.
  - Each operation keeps its own raw-JSON toggle (`json-viewer`, `deep=1`).
  - The full signed block remains available in the Raw JSON tab with copy.
- `src/components/block.vue` is still used only as the simple latest-block
  widget on the home and health pages; its full view is no longer routed.
- Contrast fixes in `src/css/app.scss`: brighter visited links and dark ink on
  light Quasar badges (green, cyan, teal, orange, amber, light-blue, red, blue).
- `src/components/BlockTransaction.vue` uses a brighter transaction-id link
  colour to pass WCAG AA on the slightly lighter transaction header.

## Verification

- `bun run lint` clean.
- `bun run test` — 13 files / 105 tests passing.
- `bun run build` succeeds.
- Playwright at 1440px and 390px on blocks `111735000` and `111739593`:
  no overflow, one `h1`, no console errors on valid blocks.
- Interaction checks: per-op JSON toggle, transaction collapse, virtual tab,
  raw JSON tab, previous/next and latest navigation.
- Axe WCAG A/AA: zero violations on both sample blocks.
- Missing/invalid blocks render a clean error state with their own title.

## Notes

- `getOpsInBlockAsync(n, true)` is used for virtual operations.
- Raw JSON is still the same `json-viewer` tree, defaulted to `deep=1`.
- Transaction ids link to the existing `/tx/:txId` route.
