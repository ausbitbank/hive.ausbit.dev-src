# W121 — Failed active broadcast reconciliation

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W120 warned that a failed active broadcast may already have landed, but Retry
still built and signed a brand-new transaction. This slice checks the chain
first: a failed active item that is already present is marked sent instead of
being re-broadcast, and an inconclusive lookup fails closed.

## Behaviour

- Starting any broadcast records `attemptedAt` in the queue item metadata.
  Legacy and interrupted items fall back to `addedAt`.
- Before a failed **active** item can request a signature again, Banksia:
  1. asks `transaction_status_api.find_transaction` when the item has a tx id;
  2. reads the newest 200 rows of `condenser_api.get_account_history` and
     matches `transfer`/`recurrent_transfer` field by field (`from`, `to`,
     `amount`, `memo`, plus `recurrence` for recurring transfers) inside a
     bounded window around the attempt.
- A match marks the item sent, stores the discovered tx id, invalidates the
  same read caches as a normal send and never opens the wallet.
- A clean miss (`find_transaction` answered without the tx, or history covers
  the attempt with no match) allows the normal manual retry.
- An inconclusive lookup does not re-broadcast. That includes a failed history
  call, a history page that does not reach back to the attempt, and an empty
  history inside a two-minute indexing grace.
- Operations without a safe history identity (market orders, savings, custom
  JSON, account updates, and so on) keep the W120 warning and manual retry;
  they are not given a false “already sent” verdict.
- Auto-send is unchanged: active items remain manual, and reconciliation only
  runs from the explicit per-item Retry action.

## Components

| Area | Files |
| --- | --- |
| Reconcile decision and history match | `src/services/queueReconcile.js` |
| Attempt metadata | `src/services/queue.js`, `src/stores/hive/mutations.js` |
| Retry flow and inline state | `src/components/queue.vue` |
| Coverage | `tests/unit/queue-reconcile.spec.js`, `tests/unit/store-mutations.spec.js` |

## Authority and privacy

- No new signing surface and no key custody. A found item is marked sent
  without another wallet request.
- Only the signed-in account's public history is read.
- Clock drift is widened by five minutes; the match window is capped at the
  24-hour queue lifetime. An uncertain verdict never silently sends.
- Active authority stays manual; reconciliation cannot auto-send posting or
  active actions.

## Verification

- `bun run lint` — clean.
- `bun run test` — green with **2,402 tests across 249 files**.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in this isolated worktree.
- Targeted Chromium: the new reconcile E2E passes; axe on the open queue
  panel at 1440×900 and 390×844 reports no violations.

## Remaining

- Market orders, savings operations and other active actions still rely on the
  W120 warning because they have no narrow history identity. Adding a safe
  identity for them would need a per-operation match plan.
- Reconciliation uses the configured API node; a node that does not expose
  `transaction_status_api` still falls back to account history.
