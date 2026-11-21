# W48 — Composer snippets, templates and draft controls

Date: 2026-11-21
Status: implemented and verified

## Scope

Third composer phase from the roadmap:

- local reusable snippets with create, edit, delete and insert;
- post templates, including a starter library and save-current-as-template;
- draft search, sorting, pinning and duplication;
- a post-publish success panel.

Draft version history and import/export for snippets/templates remain
follow-ups.

## Snippets

`src/services/snippets.js` owns the model and per-account storage:

- name and body are required; storage is capped at 40 snippets;
- create, update, delete and insert at the caret;
- per-account keys (`composeSnippets:<account>`), with a guest bucket;
- JSON export/parsing helpers are included for a later import UI.

The editor toolbar gains an **Insert snippet** button. The dialog lists saved
snippets, supports editing and deletion, and inserts the chosen text at the
current selection with sensible blank-line padding.

## Templates

`src/services/templates.js` stores reusable post content:

- title, body, community, tags, description, cover image, beneficiaries,
  rewards, AI disclosure, countdown, portfolio, collection and display author;
- edit identity, draft id, owner and cross-post attribution are not stored;
- applying a template preserves the current draft id, owner and edit target;
- 30 saved templates per account, plus five starters: development update,
  photo story, tutorial, weekly roundup and project update.

The drafts panel and editor settings open the templates dialog. Users can save
the current draft, apply a saved or starter template, and delete saved
templates. Applying over non-empty content asks for confirmation.

## Draft controls

- Search filters drafts by title and body.
- Sort by recently updated or title.
- Pin drafts; pinned ids are stored per account and pinned rows sort first.
- Duplicate a draft with a new id, “(copy)” suffix and no edit identity.
- Pinned ids are removed when their draft is discarded or published.

## Post-publish panel

After queueing, a dialog confirms the action is waiting for a signature, shows
the eventual post URL, allows copying it, and points out that the link works
after broadcast. The existing notification and queue flow are unchanged.

## Verification

- `bun run lint` — clean.
- `bun run test` — 87 files, 818 tests passing.
- `bun run build` — succeeded.
- Fast E2E against Obscura — 13 compose/action flows passing; the
  Chromium-only file-input upload test is skipped there.
- Full Chromium E2E — 85/85 passing, including the snippets, templates, draft
  search/pin/duplicate and post-publish panel flows plus axe checks.
- Performance budgets — pass after a small compose route increase for the new
  dialogs and draft controls.
- Visual smoke at 1440px: the snippets dialog fits without overflow and the
  toolbar snippet button is reachable.

## Follow-ups

- Draft version history/recovery.
- Snippet and template import/export UI.
- Optional visual editor and scheduled-draft reminders.
