# W119 — Duplicate an edited post as a new draft

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W113 made the publish checklist warn that beneficiary and reward edits are not
resent for an existing post, but left the user with no way to apply those settings
without retyping the body. This slice adds an explicit duplicate-as-new action.

## Behaviour

1. **Edit view offers “Duplicate as new”.** The action saves the current dirty
   edit first (and aborts if that save fails), then creates a fresh draft with a
   new id, no `editing` marker, no archive timestamp and the current account as
   owner.
2. **Content is preserved.** Title, body, tags, community, cover, images,
   beneficiaries, rewards, product/Vault flags and reminder fields carry over.
3. **Payout controls become effective.** The duplicate is a new post, so the
   normal publish path sends `comment_options`; the original edit is unchanged
   and remains queued as an edit if the user goes back to it.
4. **No silent overwrite.** The original draft stays in storage under its id; the
   duplicate is a separate record in the normal draft list.

## Components

| Area | Files |
| --- | --- |
| Composer | `src/pages/compose.vue` |
| Drafts | `src/services/drafts.js` |
| Tests | `tests/unit/drafts.spec.js` |

## Authority and privacy

- Posting-key only, through the normal queue; nothing is auto-broadcast.
- No new storage key or network read; the duplicate is a local draft.

## Verification

- `bun run lint` — clean.
- `bun run test` — **249 files / 2,374 tests** passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- The duplicate is not linked back to the original edit; a future “forked from”
  note could make provenance clearer.
- Duplicating an edit still keeps the original permlink only as history in the
  source draft, not as a visible reference.
