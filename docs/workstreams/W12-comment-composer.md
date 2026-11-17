# W12 — Comment composer and inline replies

Date: 2026-11-17
Status: complete

## Problem

- The article “Write a comment” / Reply dialog mounted EasyMDE inside a Quasar
  popup/dialog. It crashed with `TypeError: Cannot set properties of undefined
  (setting 'modeOption')`, leaving a broken empty editor.
- The old form was mostly advanced fields (JSON metadata, HBD settings) with no
  reliable toolbar, preview or reply context.
- Comment Reply buttons used the same broken popup editor.

## New composer

`src/components/CommentForm.vue`:

- Native textarea, no EasyMDE dependency.
- Formatting toolbar: bold, italic, heading, quote, bullet/numbered list, link,
  image and inline code, with accessible labels and titles.
- Markdown preview toggle using the normal sanitised renderer.
- Character count, Markdown hint, Ctrl/Cmd+Enter submit.
- Clear reply context: “Commenting on @poster” or “Replying to @commenter”.
- Cancel and Comment/Reply actions, disabled while empty or submitting.
- Posting-as indicator and negative/positive queue notifications.
- Responsive dialog layout down to 390px.

Posting builds a proper `comment` operation via the new
`commentQueueItem()` helper in `src/services/comments.js`, including
`comment_options` and the user’s beneficiary settings. The queue’s existing
Keychain/SmartLock paths split out `comment_options` at broadcast time.

## Where it is used

- **Article hero Reply** — replies to the post itself.
- **Comments header “Write a comment”** — top-level comment dialog.
- **Every comment’s Reply action** — the compact footer now shows a clear
  `Reply` button, opening the form with that comment’s exact
  `parent_author` / `parent_permlink`.
- **Post dialog footer** — also uses the new composer.

After a comment is queued the list refreshes automatically after the broadcast
window, without resetting how many comments were already loaded. A manual
refresh button is also available in the comments header.

## Cleanup

- Removed `src/components/commentBox.vue`.
- Removed `src/components/MarkdownEditor.vue`.
- Removed the unused `easymde` dependency.
- Added notification contrast rules for bright Quasar status toasts.
- Queue broadcasts now clone operations before Keychain/SmartLock mutation, so a
  queued comment keeps its `comment_options` if the broadcast needs retrying.

## Verification

- `bun run lint` clean.
- `bun run test` — 16 files / 123 tests passing.
- `bun run build` succeeds.
- Logged-in browser simulation verified:
  - Article and comment composers open with no EasyMDE and no console errors.
  - Bold formatting and preview work.
  - Top-level queue item targets the post author/post permlink.
  - Comment Reply queue item targets the comment author/comment permlink.
  - Cancel closes the dialog.
  - Mobile dialog fits at 390px.
- Axe WCAG A/AA: zero violations with the dialog open and notifications shown.

## Files

- `src/components/CommentForm.vue` — new composer.
- `src/components/comments.vue` — top-level composer, refresh and reply flow.
- `src/components/comment.vue` — forwards reply/posted events.
- `src/components/postFooter.vue` — reply dialog and clear Reply action.
- `src/pages/post.vue` — article Reply dialog and comment refresh token.
- `src/services/comments.js` — `commentQueueItem` helper.
- `tests/unit/comments.spec.js` — queue item coverage.
- `src/css/app.scss` — notification contrast.
