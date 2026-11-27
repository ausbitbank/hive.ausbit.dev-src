# W98 — Queue authority and retry safety

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A signing-authority audit found that the action queue trusted each item's own
`posting`/`active` label and could retry or mis-address non-idempotent actions.
This workstream makes the queue fail closed and keeps active-key actions on an
explicit review path.

## Fixes

1. **Authority and owner verification.** A new pure `queueAuthority` module maps
   the operations the app queues to the chain's required role (posting, active,
   `custom_json` required auths, `account_update2` metadata fields). Queue
   insertion and every broadcast now reject a mismatched declaration, an unknown
   operation or an item owned by another account. The item stays visible with a
   failed explanation instead of prompting for the wrong key.
2. **Signed-in signer.** `sendAction()` signs as the authenticated account and
   refuses an item whose owner is different, instead of trusting `action[0]`.
3. **Stable status updates.** After the wallet returns, the queue looks up the
   original action instance instead of writing to a captured array index, so
   removing or clearing other rows during the await cannot mark the wrong item
   sent or failed.
4. **Active retries are explicit.** `resetFailedQueueStatuses()` (used by Send
   all) only resets posting failures. A failed active action stays failed until
   the user retries that item; this avoids re-signing a transfer whose first
   broadcast may have been accepted with a lost response.
5. **Active actions never auto-send.** Auto-send skips `active` items for every
   signer (not just SmartLock). The queue notification says how many actions
   need individual review, and the manual send button remains available.
6. **Self-reblog ownership.** `expandQueueOperation()` accepts the queue owner
   and refuses a `_reblog` marker whose comment author differs, so the appended
   follow operation cannot reblog as another account.
7. **Delete ownership.** `deleteCommentQueueItem()` throws unless the target
   author matches the signed-in username; it no longer derives the queue owner
   from an arbitrary post object.
8. **Companion author binding.** Vault companion comments already forced
   `parent_author`; they now force `author` to the queued account too.

Not changed: the user still approves each active action in the wallet. No key
custody, auto-broadcast of active actions or server signing was added.

## Components

| Area | Files |
| --- | --- |
| Authority map | `src/services/queueAuthority.js` |
| Queue store | `src/stores/hive/mutations.js` |
| Queue UI and broadcast | `src/components/queue.vue` |
| SmartLock expansion | `src/components/smartlock/api.js` |
| Self-reblog and companions | `src/services/queue.js`, `src/services/publish.js` |
| Delete and subscriptions | `src/services/comments.js`, `src/pages/subscriptions.vue` |
| Tests | `tests/unit/queue-authority.spec.js`, `tests/unit/queue.spec.js`, `tests/unit/store-mutations.spec.js`, `tests/unit/comments.spec.js`, `tests/unit/vault-publish.spec.js` |

## Authority and privacy

- Strictly fewer signing paths; no new authority.
- Active operations remain active-key wallet approvals and are never
  auto-broadcast.
- No new storage key, server call or key custody.

## Verification

- `bun run lint` — clean.
- `bun run test` — **232 files / 2,255 tests** passing.
- `bun run build` — succeeded.
- Targeted queue/store/comment/Vault suites pass.

## Remaining

- An interrupted active broadcast still requires the user to check the chain or
  wallet before explicitly retrying. A future improvement is a chain-history
  check that can prove the transaction was not included.
- `nextActionableIndex()` remains a pure status walker; the UI supplies the
  active-operation skip list.
- The queue still uses array order rather than stable IDs; the status lookup now
  uses the action object, but a future refactor should persist an explicit id.
