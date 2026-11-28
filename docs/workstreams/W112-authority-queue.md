# W112 — Account-authority edits through the signing queue

Date: 2026-11-28
Status: implemented and verified locally

## Scope

The account permission editor used Hive Keychain's dedicated
`requestAddAccountAuthority` / `requestRemoveAccountAuthority` calls directly.
That bypassed the signing queue, so SmartLock and HiveAuth users saw a silent
no-op, and every Keychain edit skipped the queue's review/audit surface.

## Fixes

1. **Authority changes are queued `account_update` operations.** `addAuth` and
   `removeAuth` now build an active-authority `account_update` with
   `accountAuthorityUpdate()` and add it to the normal queue.
2. **The diff is narrow and preserving.** Only the selected permission's
   `account_auths` array changes. Existing keys, the threshold, the memo key and
   the legacy `json_metadata` are carried through unchanged, and
   `account_auths` stays sorted.
3. **Owner edits fail closed.** The queue cannot express owner authority, so an
   owner change is rejected with a clear message instead of queueing an
   operation that cannot be signed.
4. **Self-grants and invalid weights are rejected.** Weight must be a whole
   number 1–65535; an account cannot grant authority to itself.
5. **Every signer can use it.** Keychain, SmartLock and HiveAuth all sign the
   same queued active item with their normal approval flow. Nothing is
   auto-broadcast.

## Components

| Area | Files |
| --- | --- |
| Builder | `src/services/authority.js` |
| Editor | `src/components/accountAuthorities.vue` |
| Tests | `tests/unit/authority.spec.js` |

## Authority and privacy

- Account-authority changes use **active** authority; owner changes are refused.
- The existing memo key and legacy metadata are preserved so an authority edit
  does not silently wipe a profile.
- The operation is reviewed in the queue like any other active action.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite passing (authority suite **16/16**).
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- Key-level authority edits (adding/removing a public key, changing the
  threshold) are still view-only; the same builder can be extended to them.
- Owner changes need a dedicated owner-key flow, which is outside the queue's
  active/posting model.
