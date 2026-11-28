# Batch account creation — operator testnet smoke

This is the release checklist for `/create/batch` on Hive testnet. It is an
operator run, not an automated test: each step needs a real Keychain approval.
Unit coverage for operation order, authority split and failure states lives in
`tests/unit/batch-create.spec.js`.

Do not advertise the advanced batch path as live-tested until this checklist has
been run and its evidence recorded in
[`docs/workstreams/W118-batch-delegation.md`](workstreams/W118-batch-delegation.md).

## Preconditions

- A testnet Hive account with active and posting keys in Keychain, plus enough
  testnet RC to create one account and enough testnet HIVE/account tokens for
  two creates.
- Keychain pointed at a testnet node (Keychain settings → node).
- `docs/account-creation-plan.md` claim-link format unchanged; two valid claim
  links generated for unused testnet names.
- For the rejection case, a claim link whose username is already registered
  with different keys.
- Record: build SHA, browser and Keychain version, testnet node, date, operator.

## Run

1. Open `/create/batch` while signed in as the sponsor on testnet.
2. Paste the two unused claim links and press **Review claims**. Both rows must
   show `Ready`, not `Already created` or `Name taken`.
3. Enable **Hive Power delegation** (for example 5 HP) and leave **RC
   delegation** enabled (for example 5 billion RC). Confirm the review copy says
   HP is inside the creation transaction and RC is a second posting action.
4. Press **Sign batch**. Approve one Keychain request with **active**
   authority. The request must contain, per account, `create_claimed_account`
   immediately followed by `delegate_vesting_shares` in the same transaction.
5. Wait for the page poller to mark both accounts as created. Confirm on the
   testnet explorer:
   - both accounts exist with the claim-link owner/active/posting/memo keys;
   - the creator is the sponsor;
   - each account received the requested HP delegation in the same block as
     its creation;
   - no RC delegation happened yet.
6. Press **Sign RC delegation**. Approve the second Keychain request with
   **posting** authority. It must contain only `rc` `custom_json` operations,
   one per created account, and no `delegate_vesting_shares`.
7. Confirm both accounts received the RC delegation and can broadcast a small
   posting action or have a non-zero RC allowance.
8. Re-run **Review claims** with the two now-created links plus one
   already-registered/different-key link. The created rows must be
   `Already created`; the conflicting row must be `Name taken with different
   keys`. Pressing either sign button must not include a blocked name.
9. Cancel a third Keychain request (or reject it) and confirm the page keeps the
   created accounts, does not mark RC signed, and leaves the RC action available
   to retry.

## Pass criteria

- One active transaction creates both accounts and their HP delegations
  atomically.
- RC is a separate posting transaction after confirmation, never mixed into the
  active transaction.
- A rejected/duplicate name is excluded from both signing payloads.
- A declined second signature leaves the accounts and HP intact and RC
  retryable.
- No owner key is ever requested, stored or sent to a Banksia server.

## Failure handling

- If the active transaction is rejected, nothing was created; fix the claims and
  retry. The page must not start polling or offer RC.
- If the transaction is accepted but the poller times out, check the explorer
  before retrying. Re-running the same claim links must show
  `Already created` rather than duplicating a create.
- If RC signing is rejected, the accounts remain usable only after another
  sponsor action; retry the RC signing from the same page.
- If HP conversion is unavailable, the page must abort before the wallet opens
  with “Nothing was broadcast”.

## Current blocker (2026-11-28)

This run has **not** been performed in the current environment: there is no
funded Hive testnet account with Keychain available to the agent, and no live
browser wallet session. The ordering and failure states are covered by unit
tests only. The next operator with testnet access must run this checklist and
record the build/testnet evidence before the batch path is called live-tested.
