# W113 — Composer draft ownership and publish integrity

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A composer/draft audit found cross-account draft exposure, storage-history
exceptions that broke autosave, several “switch draft” paths that discarded
unsaved content, a Keychain reply that dropped `comment_options`, and publish
checks that disagreed with the operation builder.

## Draft ownership and autosave

1. **Only the viewer's drafts are selected.** `visibleDraftsFor()` and
   `pickInitialDraft()` choose the route draft or newest draft from the
   owner-filtered list. A URL pointing at another account's draft id no longer
   opens it, and the dashboard widget already filters by owner.
2. **A login switch resets the editor.** When the signed-in account changes and
   the active draft belonged to the previous account, the composer selects the
   new account's draft or a blank one instead of leaving the old body on screen.
3. **Ownership cannot be overwritten.** `saveDraft()` refuses to save a draft
   whose stored owner differs from the signed-in account.
4. **History storage cannot break autosave.** `readDraftHistory()` and the
   history write/remove path catch blocked or quota-exceeded storage, matching
   the module's “history is a convenience” contract.
5. **Switching drafts keeps unsaved work.** New draft, select draft and import
   only switch after the current dirty draft saves successfully; a failed save
   keeps the editor open.
6. **Cross-tab deletion keeps unsaved edits.** If another tab deletes the active
   draft while this tab has unsaved changes, the editor stays put and explains
   why instead of replacing it with an empty/new draft.

## Publishing

7. **Keychain replies keep comment options.** The raw `requestBroadcast` path
   now uses `expandQueueOperation()`, so a reply with beneficiaries sends the
   `comment` and `comment_options` operations together. This matches SmartLock
   and HiveAuth.
8. **Collection-only drafts cannot pass the checklist.** The tags check uses
   `resolveCategory()`; `c-c-c` alone no longer reports “Ready” while
   `buildPostOperation()` would throw.
9. **The review destination is the real category.** The summary uses
   `resolveCategory()` instead of the first tag.
10. **Edits warn about payout settings.** Any edit (top-level or comment) shows
    a warning that beneficiary and reward changes are not resent, matching the
    queue's `commentOptions: false` behaviour.

## Components

| Area | Files |
| --- | --- |
| Composer | `src/pages/compose.vue` |
| Drafts | `src/services/drafts.js` |
| Publish | `src/services/publish.js` |
| Queue | `src/components/queue.vue` |
| Tests | `tests/unit/drafts.spec.js`, `tests/unit/publish.spec.js`, `tests/unit/queue.spec.js` |

## Authority and privacy

- Drafts stay local and are filtered by owner; another account's draft is never
  loaded or overwritten.
- No authority change. Comment options are now actually sent for Keychain
  replies, matching the other signers.
- Payout edits are labelled as ineffective on chain instead of pretending to
  apply.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- Payout controls remain editable on an existing post; they are now labelled as
  not resent. A “duplicate as new post” path would let a user apply new payout
  settings.
- Cross-account selection is still based on the `owner` field; drafts written by
  older builds without an owner are visible to every account by design.
