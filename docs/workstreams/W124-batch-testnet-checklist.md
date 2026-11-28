# W124 — Batch creation ordering coverage and testnet checklist

Date: 2026-11-28
Status: covered locally; live testnet smoke blocked

## Scope

W118 added HP delegation inside the atomic account-creation transaction and RC
as a separate posting transaction after confirmation, but the page had no test
for that ordering or for its failure states. This slice re-checks both
transactions, adds component-level coverage, and writes the operator testnet
checklist. No product behaviour changed.

## Re-check result

- **Ordering is correct.** For each claim the active transaction is
  `create_claimed_account` (or `account_create`) followed immediately by that
  account's `delegate_vesting_shares`. The whole batch is one Keychain request
  with `active` authority.
- **RC stays separate.** `signRcDelegation` sends only `custom_json` `rc`
  operations with `posting` authority, and only for names in `batchedNames`
  whose claim state is `created`. A blocked or not-yet-created name is excluded.
- **Failure states are contained.** An unavailable HP conversion aborts before
  signing with “Nothing was broadcast”; a rejected creation signature leaves
  `batchedNames` empty and does not start polling or offer RC; a rejected RC
  signature leaves the accounts created and `rcSigned` false.
- No code defect was found in the ordering. The gap was coverage and operator
  evidence.

## Components

| Area | Files |
| --- | --- |
| Coverage | `tests/unit/batch-create.spec.js` |
| Existing page (unchanged) | `src/pages/batchCreate.vue` |
| Operator checklist | `docs/account-creation-testnet-smoke.md` |
| Prior record | `docs/workstreams/W118-batch-delegation.md` |

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite green (see `docs/ROADMAP.md`).
- New batch coverage — 6/6: active ordering, HP conversion abort, rejected
  creation, RC-after-creation with a blocked name excluded, no RC without a
  created account, rejected RC remains retryable.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in this isolated worktree.

## Blocker

The live testnet walkthrough has not run. This environment has no funded Hive
testnet account with Keychain access and no browser wallet session, so a real
signature cannot be produced. The operator checklist records the exact steps and
pass criteria; the next operator with testnet access must run it and attach the
build SHA, testnet node, transaction ids and explorer observations. Until then
the batch path is unit-covered, not live-smoked.

## Remaining

- Execute `docs/account-creation-testnet-smoke.md` on testnet and record the
  evidence in W118/W124.
- The batch page still requires Hive Keychain; SmartLock/HiveAuth users use the
  individual claim links.
