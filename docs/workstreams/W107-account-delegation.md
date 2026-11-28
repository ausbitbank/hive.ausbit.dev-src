# W107 — Opt-in post-creation RC and HP delegation

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A new Hive account starts with no Resource Credits and no Hive Power, so its
first post, vote or transfer fails until someone helps. W82 left opt-in
`delegate_rc` / `delegate_vesting_shares` as follow-up work. This slice adds the
choice to the two sponsor flows (`/create` and `/create/claim`) without merging
new operations into the creation transaction or weakening the review boundary.

## Behaviour

1. **Optional panel on both sponsor flows.** `DelegationOptions` lets the sponsor
   enable Resource Credits (default 5 billion) and/or Hive Power (default 5 HP)
   before creating the account. Both are off by default.
2. **Correct on-chain shapes.**
   - Resource Credits use the Hive `rc` custom_json
     `["delegate_rc", { from, delegatees: [account], max_rc, extensions: [] }]`
     with posting authority, matching hive-tx's `delegateRC` helper. There is no
     native `delegate_rc` operation.
   - Hive Power uses `delegate_vesting_shares` with the HP converted to VESTS at
     the current `total_vesting_fund_hive` / `total_vesting_shares` ratio, with
     active authority.
3. **Queued after creation, never bundled.** The creation operation is queued
   first, then each delegation as its own item. The queue broadcasts in order and
   active actions still require explicit approval. A failed creation leaves a
   failed delegation that is visible and removable, never a partially-applied
   bundle.
4. **Fail closed on bad input.** Invalid/self account names, negative or
   absurdly large amounts (1 trillion RC / 10 million HP caps), or an HP request
   without global properties stop the flow before anything is queued. Nothing is
   silently clamped or guessed.
5. **Queue labels and summaries.** The drawer shows “Delegate RC” and a
   “Delegate N RC to @account” summary instead of a generic app action.

## Authority and privacy

- Resource Credits: **posting** authority through the `rc` custom_json.
- Hive Power: **active** authority through `delegate_vesting_shares`.
- No key is requested until the user reviews and approves each queue item.
  Active delegation is never auto-sent.
- No server, relay or third party is involved; the operations are built in the
  browser from public chain properties.
- The new account receives only RC/HP, not any authority over the sponsor.

## Components

| Area | Files |
| --- | --- |
| Helper | `src/services/accountDelegation.js` |
| Queue | `src/services/queue.js`, `src/services/queueAuthority.js` |
| UI | `src/components/onboarding/DelegationOptions.vue` |
| Sponsor pages | `src/pages/create.vue`, `src/pages/claimAccount.vue` |
| Tests | `tests/unit/accountDelegation.spec.js`, `tests/unit/delegation-options.spec.js`, `tests/unit/queue-authority.spec.js` |

## Verification

- `bun run lint` — clean.
- `bun run test` — **244 files / 2,344 tests** passing.
- `bun run build` — succeeded.
- `bunx playwright test e2e/a11y.spec.js -g "axe clean: /create"` — `/create`
  and `/create/claim` axe-clean at 1440×900 and 390×844 (both routes were added
  to the permanent a11y route list).
- Full Chromium suite — **209 checks**, all passing after one unrelated
  dashboard-template mount timeout passed on the exact isolated rerun.

## Remaining

- `/create/batch` does not yet offer delegation; each batched claim would need
  its own RC/HP choice or a shared default.
- The RC amount is entered in billions of RC (0.5 steps). A future UI could read
  the sponsor's RC manabar and suggest a fraction of it.
- The HP conversion is a point-in-time VESTS value; the wallet/drawer shows the
  VESTS string, not a fresh HP estimate.
- No live Hivedex or account-creation smoke was run in this slice. The queue
  operations are unit-tested but a real testnet claim with delegations is still
  the release smoke.
