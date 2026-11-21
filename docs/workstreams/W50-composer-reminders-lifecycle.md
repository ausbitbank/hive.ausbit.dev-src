# W50 — Composer draft lifecycle and reminders

Date: 2026-11-21
Status: implemented and verified

## Scope

Fifth composer phase:

- archive/restore drafts;
- local publish reminders;
- local storage usage;
- clear-all drafts;
- cross-tab draft/snippet/template synchronization.

The optional visual editor remains later work.

## Draft lifecycle

Draft export version is now 3. The model adds:

- `scheduledAt` for a local publish reminder;
- `archivedAt` for archive state.

The drafts panel has Active/Archived views, an archive/restore action per draft,
and keeps pinned drafts first. New drafts and duplicated drafts return to the
Active view. `Clear all` removes drafts, their history and pinned ids after
confirmation; snippets and templates are kept.

The panel shows an approximate local storage size based on the `compose*`
localStorage keys, plus the current draft count.

## Publish reminders

The Post details panel has a local reminder date/time field. Nothing is
scheduled or broadcast automatically. When a reminder is due:

- a banner appears at the top of the composer;
- **Open** selects the draft;
- **Dismiss** clears the reminder for every due draft;
- a due reminder is also visible from the draft list’s alarm icon.

## Cross-tab sync

A `storage` listener updates drafts, snippets, templates, pinned ids and open
history when another tab changes them. If the active draft changed in another
tab and this tab has unsaved edits, the edits are kept and a notice explains
the conflict. If this tab has no unsaved edits, the newer saved draft is loaded.

## Verification

- `bun run lint` — clean.
- `bun run test` — 87 files, 823 tests passing.
- `bun run build` — succeeded.
- Fast E2E against Obscura — 15 compose/action flows passing, 2 Chromium-only
  file-input tests skipped.
- Chromium compose actions — 17/17 passing, including archive/restore, reminder
  dismissal, clear-all and the existing upload, embed, snippet, template,
  history and metadata flows.
- Chromium a11y and polish — 19/19 passing.
- Performance budgets — pass after a small compose total-JS increase.
- Visual smoke at 1440px: reminder banner, Active/Archived toggle and local
  storage line fit without overflow.
- Deployed to production with `./scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T125955Z.tar.gz`.
- Live smoke on `https://hive.ausbit.dev`: a due reminder appears, the local
  storage line renders, the Archived view opens, and the browser reported no
  page errors.

## Follow-ups

- Optional visual WYSIWYG editor.
- Optional cloud/shared drafts, which need server-side storage.
