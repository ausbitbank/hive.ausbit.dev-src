# W70 — Composer editor polish

Date: 2026-11-23
Status: deployed and live-smoked
Issue: <https://github.com/ausbitbank/hive.ausbit.dev-src/issues/82>

## Scope

Three remaining #82 editor gaps, with no signing, authority or draft-schema
changes:

1. **Heading outline** — a toolbar button opens a jump list of the post's
   Markdown headings.
2. **Emoji picker** — a curated picker inserts an emoji at the saved caret.
3. **Drag topic ordering** — the existing Topic order dialog rows are draggable,
   with the up/down buttons kept as the keyboard-accessible path.

## Heading outline

- `markdownHeadings()` parses ATX headings (`#` to `######`), allows up to three
  leading spaces, and skips fenced code blocks so pasted code cannot pollute the
  list.
- Each entry carries its level, text, line and source offset.
- The toolbar button is disabled when there are no headings. Choosing a heading
  focuses the body textarea, moves the caret to the heading and scrolls it into
  view.
- The dialog is keyboard-operable and uses real buttons with level labels.

## Emoji picker

- Six curated groups (smileys, gestures, Hive/work, signals, life, objects) with
  accessible labels; no new dependency.
- The picker captures the caret before opening, switches out of Preview mode,
  and inserts at the captured selection.
- The emoji table is a lazy chunk loaded when the picker first opens, so the
  compose route does not pay for it.
- Labels avoid collisions with Material icon names, so the icon subset only
  gains the one new `toc` glyph.

## Drag topic ordering

- Topic order rows are `draggable` with a grip affordance, drag highlight and
  drop-target styling.
- Dropping calls the same reorder logic as the arrows; the first-five primary
  boundary follows automatically.
- The up/down buttons and their labels remain, so keyboard and screen-reader
  users are not dependent on drag gestures.
- Verified in Chromium: dragging `#alpha` from first to last produced
  `#beta, #gamma, #alpha`.

## Deliberately not included

- **Autosave toggle**: autosave (with flush on tab hide and unload) is the
  composer's data-loss safety net. A toggle needs a navigation guard and an
  unsaved-changes flow first; shipping the switch alone would make losing work
  easy. The #82 item stays open as an optional follow-up.
- Gallery/grid insertion, undo/redo, draft rename/trash and cross-post polish
  remain in #82.

## Files

- `src/utils/markdownEditor.js` — `markdownHeadings()`.
- `src/utils/emoji.js` — curated emoji groups (lazy chunk).
- `src/pages/compose.vue` — toolbar buttons, outline and emoji dialogs, drag
  handlers, styles.
- `tests/unit/markdown-editor.spec.js` — heading extraction and code-fence
  handling.
- `e2e/actions.spec.js` — emoji insertion and outline jump.
- `public/statics/material-icons-subset.woff2`, `src/data/material-icons.json` —
  regenerated subset with `toc`.

## Verification

- `bun run lint` — clean; theme-token scan clean.
- `bun run test` — 140 files, 1,209 tests passed (including the icon subset
  check).
- `bun run build` — succeeded.
- `bun run test:e2e -- e2e/actions.spec.js -g "compose inserts an emoji and jumps to headings"` — 1 passed.
- `bunx playwright test e2e/a11y.spec.js -g "/compose"` — axe clean at 1440px and
  390px.
- `bun run perf:check` — all budgets passed; compose 401.6 KB total.
- Manual Chromium smoke: topic drag reorder and the lazy emoji dialog.

## Deployment

- Deployed 2026-11-23 from commit `cf797c4` with `./scripts/deploy.sh`.
- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261123T102942Z.tar.gz`.
- Rollback: `./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261123T102942Z.tar.gz`.
- Production `index.html` SHA-256 `f91e3acb…9bc86` matches the local build.

Live browser smoke (Chromium, 1440px, `/compose`):

- A seeded draft loaded and the emoji picker inserted 🚀 at the caret.
- The heading outline listed `H1 Intro` and `H2 Details`; choosing Details moved
  the caret to offset 20.
- Dragging `#alpha` from first to last produced `#beta, #gamma, #alpha`.
- No page errors.

## Notes

- No draft schema or queue changes; drafts remain v3.
- The outline reads the live body, so it updates as headings are typed.
- Emoji insertion uses the same caret helper path as the other toolbar actions,
  so undo/redo behaviour is unchanged.
