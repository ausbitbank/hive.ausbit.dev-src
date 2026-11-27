# W93 — Subscription cancellation safety

Date: 2026-11-28
Status: implemented and verified locally

## Problem

Cancelling from `/subscriptions?account=ausbitclank` returned:

```text
Error: Cannot create a recurrent transfer with 0 amount
```

The account had no open recurring transfer (`find_recurrent_transfers`
returned an empty list). The page still treated the plan as active because the
last payment's access window had not ended, so it offered a Cancel button. The
chain correctly refused the zero-amount operation: a zero amount can only
cancel an existing transfer, never create one.

A second edge existed for accounts with multiple recurring transfers to the
same receiver: HF28 matches by `(from, to, pair_id)`, but the cancel builder
always sent `extensions: []`.

## Fix

- `readerPlans` now records `hasOpenTransfer` and `pairId` from
  `find_recurrent_transfers`.
- The Cancel button only appears when the plan has an open recurring transfer.
  A plan that still has access but no open transfer now says “No active
  recurring transfer to cancel” and shows the access end date.
- `queueCancel` refuses to queue when there is no open transfer, even if called
  programmatically.
- `buildCancelOperation` accepts `pairId` and emits
  `extensions: [{ type: 1, value: { pair_id } }]` when it is non-zero.
- The confirmation dialog no longer shows the stale “must be verified” caveat;
  it names the open plan and pair when present.
- No Vault crypto, grant, bulletin, key or relay code changed.

## Components

| Area | Files |
| --- | --- |
| Cancel operation | `src/services/vaultPayments.js` |
| Reader plan/cancel UI | `src/pages/subscriptions.vue` |
| Tests | `tests/unit/vault-payments.spec.js`, `tests/unit/vault-subscribe.spec.js`, `e2e/vault.spec.js` |

## Verification

- Targeted Vault tests: 36 passed.
- Full unit suite excluding one unrelated untracked WIP `cart-page.spec.js`:
  **221 files, 2,118 tests** passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/vault.spec.js --config=playwright.config.js` —
  **9/9 passed**, including:
  - an open transfer shows Cancel and queues the dialog;
  - a plan with access but no open transfer hides Cancel and explains why.

## Remaining

- HF28 multi-pair cancellation is now constructed correctly but still needs a
  future testnet confirmation before promising every wallet/browser path.
- Cancellation remains an explicit wallet-approved active-key operation; the
  page never broadcasts.
