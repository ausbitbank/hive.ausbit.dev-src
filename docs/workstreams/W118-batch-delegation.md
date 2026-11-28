# W118 — Batch account creation delegation

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W107 added opt-in RC/HP delegation to `/create` and `/create/claim`; the advanced
`/create/batch` flow still created bare accounts. This slice adds a shared
delegation choice to the batch page while respecting the active/posting split of
a single Hive transaction.

## Behaviour

1. **HP delegation is part of the creation transaction.** When enabled, each
   account's `delegate_vesting_shares` operation follows its
   `create_claimed_account` / `account_create` operation, using HP converted at
   the current chain ratio. The whole batch is still one atomic active-key
   transaction.
2. **RC delegation is a separate posting transaction after confirmation.** RC
   uses the `rc` custom_json and posting authority, so it cannot share a
   transaction signed with the active key. The page polls until the new accounts
   exist, then offers “Sign RC delegation”; the posting-key transaction covers
   only the accounts created by this batch.
3. **Failure is contained.** Invalid HP conversion or a bad delegation setting
   aborts before the creation transaction. A failed/declined RC signing leaves
   the accounts created and the RC action available to retry.
4. **Defaults stay opt-in.** Both delegations are off by default; the shared
   amount controls are the same component used by the single-account flows.

## Components

| Area | Files |
| --- | --- |
| Batch page | `src/pages/batchCreate.vue` |
| Delegation builder | `src/services/accountDelegation.js` |
| Shared UI | `src/components/onboarding/DelegationOptions.vue` |

## Authority and privacy

- Creation and HP delegation are active-key operations in one reviewed Keychain
  transaction.
- RC delegation is posting authority and is signed only after the accounts are
  confirmed to exist.
- No key is stored or sent to a Banksia server.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Follow-up

W124 re-checked the two-transaction ordering, added `tests/unit/batch-create.spec.js`
and wrote the operator testnet checklist at
[`docs/account-creation-testnet-smoke.md`](../account-creation-testnet-smoke.md). The
live testnet smoke is still blocked on a funded testnet account with Keychain.

## Remaining

- The batch page still requires Hive Keychain for the creation transaction;
  SmartLock/HiveAuth users use individual claim links.
- A testnet smoke of a create + HP + RC batch is still the release check for
  this advanced path.
- RC signing is a second wallet approval by design; the page does not auto-send
  it.
