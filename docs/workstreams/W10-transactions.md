# W10 — Transaction detail pages

Date: 2026-11-17
Status: complete

## Goals

- Replace the raw JSON-only `/tx/:txId` page with a proper explorer view.
- Keep full raw transaction JSON available and expandable.
- Reuse the friendly operation summaries built for the block page.

## Data sources

- `transaction_status_api.find_transaction` provides the block number, inclusion
  status (`within_reversible_block` / `within_irreversible_block`) and RC cost.
- `condenser_api.get_block` is used to load the block, find the exact signed
  transaction and expose its transaction number, witness, timestamp and
  previous/next transaction.
- If the status lookup or block lookup fails, the page falls back to
  `condenser_api.get_transaction` through the configured API node, then to
  `getTransactionAsync`.
- The raw tab renders the original transaction object: reference block,
  expiration, operations, extensions, signatures, transaction id, block number
  and transaction number.

## Page

`src/pages/tx.vue` now has:

- Top navigation: all blocks, previous transaction, refresh, next transaction
  and containing block.
- Hero: status badge, short transaction id, containing block, producing
  witness, block timestamp and relative age.
- Copyable full transaction id.
- Metrics: block, transaction #, operations, signatures, expiration, RC cost,
  reference block and status detail.
- Tabs: **Operations** and **Raw JSON**.
- Operation list using `BlockOperation`: friendly summary, links and the
  existing per-operation expandable JSON.
- Signatures card with individually copyable signatures.
- Raw JSON tab with the same `json-viewer` tree and a Copy JSON action.
- Footer previous/next transaction navigation, falling back to the block link.
- Loading skeleton, not-found state, retry and page metadata.

Block pages now give every transaction card an `id` equal to its transaction
id, and `src/pages/block.vue` scrolls to the hash after loading. This makes
`/tx/...` → “View block” land directly on the transaction.

## Helpers and tests

`src/services/transactions.js` contains pure helpers:

- `shortTxId` — short hash for titles/navigation.
- `describeTransactionStatus` — label, badge colour and detail.
- `transactionNumber` — 1-based transaction number.
- `formatRcCost` — grouped RC cost.
- `findTransactionNeighbours` — index, previous and next transaction ids.

Covered by `tests/unit/transactions.spec.js`.

## Verification

- `bun run lint` clean.
- `bun run test` — 15 files / 116 tests passing.
- `bun run build` succeeds.
- Playwright on a single-operation and a multi-operation transaction at 1440px
  and 390px: no overflow, one `h1`, no console errors.
- Verified operation JSON toggle, raw JSON tab, previous/next navigation and
  the transaction → block anchor landing on the right transaction.
- Missing transaction shows a clean not-found state with retry.
- Axe WCAG A/AA: zero violations on single, multi and missing transaction
  pages, desktop and mobile.

## Files

- `src/pages/tx.vue` — rebuilt transaction page.
- `src/services/transactions.js` — transaction helpers.
- `tests/unit/transactions.spec.js` — helper tests.
- `src/components/BlockTransaction.vue` — transaction id anchor and scroll margin.
- `src/pages/block.vue` — scroll to a transaction hash after loading.
