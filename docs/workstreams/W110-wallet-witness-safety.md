# W110 — Wallet, market and witness safety

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A wallet/market audit and a witness/queue follow-up found a dead posting
authority mapping, fund-redirecting Hive-Engine JSON, a memo-encryption promise
that was not kept, dependency-breaking auto-send, several dialog amount crashes
and rounding/ID bugs, plus stale witness data and a wrong-account witness form.
This slice fixes the high and medium issues and records the remaining operator
follow-ups.

## Claim, queue and dependencies

1. **`claim_reward_balance` is posting authority.** Hive requires posting for
   this operation, but the queue map listed it as active, so every claim item was
   marked FAILED before it could be signed. The wallet and dashboard claim
   buttons work again.
2. **Auto-send stops at a pending active item.** It no longer skips account
   creation to send a later posting RC delegation. `canSendAll` uses the same
   rule, so a queue with only active items does not leave “Send all” stuck in a
   loading state.
3. **Owner-only operations fail closed.** `change_recovery_account` and
   `decline_voting_rights` were listed as active; the queue cannot express owner
   authority, so they now map to unknown and are rejected.

## Hive-Engine and memo safety

5. **Hive-Engine JSON is serialised, not concatenated.**
   `hiveEngineOperation()` builds the `ssc-mainnet-hive` payload with
   `JSON.stringify`. A memo containing `"` can no longer inject a second `to`,
   `quantity` or `symbol` and redirect a transfer. Transfer, stake, unstake,
   trade and cancel all use it.
6. **Encrypt Memo no longer lies for Keychain/HiveAuth.** Only SmartLock turns a
   leading `#` into a real encrypted memo. The checkbox is disabled (with an
   explicit “this memo will be public” note) for Keychain/HiveAuth and for
   Hive-Engine or recurrent transfers, where no encryption step exists.

## Amounts, IDs and dialogs

7. **One strict amount parser.** `parseAssetAmount()` rejects empty, NaN,
   negative, zero, `1,5`/`1,000`, exponent and over-balance values, and rounds
   down to the asset precision. Transfer, recurrent transfer, savings, staking,
   unstaking and conversion dialogs disable Send instead of queueing
   `NaN HIVE` or silently turning `1,5` into `1.000`.
8. **Recurring zero amount cannot delete a plan.** A recurrent transfer now
   requires a positive amount; zero is the chain's cancellation form.
9. **Savings dialog cannot throw.** An empty/invalid amount no longer calls
   `.toFixed()` on a string.
10. **Delegation 0 cannot revoke by default.** The delegation dialog requires a
    positive VESTS amount, and its method refuses zero.
11. **Cancel Powerdown actually cancels.** It now resets the amount to zero
    before sending `withdraw_vesting`, instead of re-sending the old rate.
12. **Request and order ids are unique.** Savings withdrawals, conversions, the
    interest claim pair and limit orders use `nextRequestId()` (timestamp +
    counter) instead of random 1–10000 or a fixed id. Two same-second limit
    orders no longer collide, and order amounts round down so a max sell cannot
    exceed the balance.
13. **Conversion copy matches the operation.** The HIVE tab describes
    HIVE → HBD (`collateralized_convert`); the HBD tab describes HBD → HIVE.
14. **The wallet-actions widget shows HBD per HIVE for buys too.** Buy orders no
    longer display the inverse price next to sells.

## Wallet and witness state

15. **Wallet reads are identity-bound.** Open orders, pending savings,
    conversions and Hive-Engine balances ignore a response after an account
    switch, so one account's request ids cannot appear under another.
16. **Witness voter sampling is filtered.** `list_witness_votes` paginates into
    the next witness; rows are filtered by `witness` and pagination stops at the
    boundary, so voter bands and totals no longer include unrelated accounts.
17. **Witness settings are identity-bound.** `/witness` uses a request token and
    checks the username after every await; a login switch cannot put account A's
    witness key/URL into B's form, and logging out clears the form. Queueing a
    witness update therefore cannot use stale data.
18. **`/witnesses` reacts to login changes.** Optimistic votes/proxy are cleared,
    the new account and proxy are loaded, and a logged-out visitor no longer
    sees a proxy or its voting weight.
19. **HBD interest accepts two decimals.** `0.29`, `0.07` and `1.15` are valid;
    binary floating point no longer rejects a witness's current rate.
20. **Authority editing fails visibly.** Account-authority edits require Hive
    Keychain and report `notInstalled`, `notActive`, cancellation or the wallet
    message instead of a silent `console.warn`.
21. **Witness status is honest.** The live signing card uses the on-chain key,
    not the draft; a backup witness is “Not scheduled” rather than “Missed slot”;
    the version group colour uses the same major/minor rule as `versionDrift`;
    and `/witnesses` has one page-level `h1`.
22. **Queued authority previews are real changes only.** Metadata-only
    `account_update2` items and sent/failed items no longer appear as pending
    permission changes.

## Components

| Area | Files |
| --- | --- |
| Queue/authority | `src/services/queueAuthority.js`, `src/components/queue.vue`, `src/components/accountAuthorities.vue`, `src/services/authority.js` |
| Hive-Engine/memo | `src/services/hiveEnginePayload.js`, `src/components/transferDialog.vue`, `stakingDialog.vue`, `unstakingDialog.vue`, `src/pages/token.vue` |
| Amounts/ids | `src/services/signingInputs.js`, `savingsDialog.vue`, `convertDialog.vue`, `delegationDialog.vue`, `src/services/market.js` |
| Wallet | `src/pages/wallet.vue`, `src/components/wallet/HiveEngineTokens.vue`, `src/services/walletActions.js` |
| Witness | `src/services/witnessVoters.js`, `src/pages/witness.vue`, `src/pages/witnesses.vue`, `src/services/witnesses.js`, `src/components/witness/WitnessAnalytics.vue`, `WitnessVoterSegments.vue` |
| Tests | `tests/unit/queue-authority.spec.js`, `queue-autosend.spec.js`, `hiveEnginePayload.spec.js`, `transfer-dialog-encryption.spec.js`, `amountInput.spec.js`, `requestId.spec.js`, `market.spec.js`, `walletActions.spec.js`, `witness-voters-fetch.spec.js`, `witnesses.spec.js`, `authority.spec.js` |

## Authority and privacy

- `claim_reward_balance` is now correctly posting; auto-send still never sends
  active actions.
- Hive-Engine writes remain active-authority queue items with explicit review;
  the JSON fix prevents a memo from changing the destination.
- Memo encryption is only offered where it is actually implemented, so a memo
  is never falsely labelled private.
- No new storage, origin or key custody. Request ids are generated locally.

## Verification

- `bun run lint` — clean.
- `bun run test` — **248 files / 2,347 tests** passing.
- `bun run build` — succeeded.
- Targeted Chromium: `e2e/governance.spec.js` 6/6; `actions`, `wallet-csv` and
  `markets-sats` 37 passing with two live-data flakes that passed on their exact
  isolated reruns.
- Full Chromium suite: **213 passed**; four checks hit a missing `dist` while a
  concurrent session rebuilt the shared worktree and all four passed on isolated
  rerun.
- `bun run perf:check` passed in an isolated worktree (the shared worktree's
  uncommitted Vault changes push the same routes slightly over budget).
- Axe clean for `/witnesses`, `/proposals` and `/@ausbitbank` at 1440×900 and
  390×844.

## Remaining

- Active-broadcast retry still has no automatic on-chain reconciliation
  (`transaction_status_api.find_transaction` or history) for a lost response, so
  the queue keeps failed active items manual. A confirmation/warning was drafted
  but removed to stay inside the Home JS budget.
- The delegation slider still uses `vesting_shares - delegated_vesting_shares`;
  it does not subtract an active powerdown or cap by voting mana.
- Hive-Engine order forms still have no client-side balance cap or submit guard;
  the chain rejects unfunded/duplicate orders.
- The HBD interest claim still queues the deposit and cancel as two separate
  active items; both are confirmed but not atomic.
- Authority add/remove still uses Keychain's dedicated requests rather than the
  signing queue, so SmartLock/HiveAuth users cannot edit account authorities.
- The witness voter sample is capped at 5,000 and the first page of each
  endpoint; very large witnesses are sampled, not enumerated.
