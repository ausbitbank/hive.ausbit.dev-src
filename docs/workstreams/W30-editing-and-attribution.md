# W30 — Editing, deletion and cross-post attribution

Date: 2026-11-19
Status: complete

## Problem

- There was no way to edit or delete your own posts or comments. The queue could
  broadcast a `delete_comment` operation in principle, but nothing ever built
  one.
- The composer's **Attribution → Cross-post from Hive** panel wrote
  `json_metadata.cross_post = { author, permlink }` and silently copied the
  original title and body into empty drafts. Nothing in the app read that
  metadata, so the attribution was invisible, and the prefill made
  cross-posting indistinguishable from accidentally reposting yourself.

## Editing

Comments and top-level posts share the same on-chain operation: an edit is a
`comment` op with the same `author` and `permlink`. Hive requires the original
`parent_author` and `parent_permlink`, and ignores `comment_options` on edits —
those are set once by a separate operation at creation.

### Comments

`CommentForm.vue` gained `mode="edit"` with `initialBody`, `author`, `permlink`
and `jsonMetadata` props. In edit mode it:

- loads the existing body and disables submit until the text actually changes;
- keeps the original permlink and parent rather than generating a new one;
- merges the original `json_metadata` instead of replacing it;
- queues the operation without `comment_options`.

`postFooter.vue` shows **Edit** and **Delete** in the overflow menu when the
signed-in user wrote the post or comment. Delete asks for confirmation and
queues `delete_comment`.

### Posts

`post.vue` shows **Edit post** / **Delete post** in the Actions card for the
author. Edit links to `/compose?edit=@author/permlink`, where
`loadPostForEdit()` fetches the post and builds a draft carrying:

- the real title, body, community, tags and beneficiaries;
- the existing reward settings;
- an `editing` marker (`author`, `permlink`, `parentPermlink`,
  `previousMetadata`).

`drafts.js` normalises and persists that marker so a reload keeps edit mode. It
is dropped if the draft owner is not the post author, or the permlink is
invalid — a draft can never edit somebody else's post.

Publishing an edit reuses the original permlink and parent, merges metadata over
the original and omits `comment_options`.

## Queue correctness

- Edits carry a queue-only `_edit` marker so the action list shows
  “Edit reply on @…” / “Edit …” instead of “Publish …”.
- Both signers strip the marker before broadcast: `queue.vue` for Keychain and
  `smartlock/api.js` for SmartLock, since the chain rejects unknown fields.
- `delete_comment` has a label (“Delete post”) and summary (“Delete @author/permlink”).
- `delete_comment` was already in `cacheInvalidation`'s post operations, so
  edits and deletions clear the post caches.

## Cross-post attribution

Metadata now uses the interoperable convention written by other cross-post
tools, while keeping the legacy shape readable:

```json
{ "cross_post": true, "original_author": "bob", "original_permlink": "original-post" }
```

- `buildPostMetadata()` writes those three keys.
- `readCrossPostMetadata()` accepts the new flags *and* the old
  `cross_post: { author, permlink }` object.
- `post.vue` renders a “Cross-post of @author/permlink” pill linking to the
  original.
- The composer panel was renamed **Cross-post source**, explains that it records
  attribution only (no media, rewards or payout settings are copied), and the
  prefill is now an explicit **Copy original text** action with a confirmation
  when it would replace existing text.
- The publish checklist warns when you attribute a post to yourself.

## Verification

- `bun run lint` — clean.
- Targeted unit tests — 47 passing across `publish`, `comments`, `drafts`, `queue`.
- `bun run build` — succeeds.
- The full suite has two failures in `vote-control.spec.js` from unrelated,
  pre-existing uncommitted work in `vote.vue`; they fail on a clean tree too.

## Files

- `src/services/publish.js` — edit-aware `buildPostOperation` /
  `postQueueItem`, `readCrossPostMetadata`, edit checklist rows, new metadata.
- `src/services/comments.js` — `mode: 'edit'` comment items and
  `deleteCommentQueueItem`.
- `src/services/drafts.js` — `normalizeEditing` and draft persistence.
- `src/services/queue.js` — labels and summaries for edits and deletes.
- `src/components/CommentForm.vue` — edit mode.
- `src/components/postFooter.vue` — edit/delete menu.
- `src/components/queue.vue`, `src/components/smartlock/api.js` — strip markers.
- `src/pages/post.vue` — edit/delete actions and cross-post credit.
- `src/pages/compose.vue` — post edit route, opt-in cross-post prefill.
- `tests/unit/{publish,comments,drafts,queue}.spec.js`.

## Notes and limits

- Deleting is blocked while a post or comment still has replies, matching the
  chain rule; the UI explains why.
- Edits do not resend `comment_options`. Changing beneficiaries or payout
  settings after publishing needs a separate `comment_options` update, which
  this change does not add.
- Changing the community/tag on an edit only changes metadata; the on-chain
  category is fixed at creation, and the checklist says so.
