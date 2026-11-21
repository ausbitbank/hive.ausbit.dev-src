# W49 — Composer draft history and snippet/template backup

Date: 2026-11-21
Status: implemented and verified

## Scope

Fourth composer phase from the roadmap:

- draft version history with restore;
- snippet import/export;
- template import/export.

The optional visual editor and scheduling reminders remain later work.

## Draft history

`src/services/drafts.js` adds:

- `DRAFT_HISTORY_KEY` with a compact per-draft snapshot map;
- two retained versions per draft and a 20-snapshot global cap;
- a 10-minute autosave throttle, with explicit **Save version now** forcing a
  snapshot;
- snapshots of the previous saved title, body, description, cover, tags,
  community, rewards, beneficiaries, AI disclosure, countdown, presentation
  flags and display author;
- `restoreDraftSnapshot` preserves the draft id, owner and edit identity.

The editor header now opens **Draft history**. The dialog lists saved versions
with timestamps, allows restoring one after confirmation, supports saving the
current version immediately, and can clear history for the current draft.
History is removed when a draft is discarded or published.

## Snippet backup

The snippets dialog gains **Export snippets** and **Import snippets**:

- exports a versioned `hive-snippets` JSON envelope;
- imports our envelope, a bare array or a single snippet object;
- merges by id without overwriting newer local copies;
- reports added, updated and skipped snippets.

## Template backup

The templates dialog gains **Export templates** and **Import templates** with
the same merge rules and a versioned `hive-templates` envelope. Starter
templates are not exported; they are always available in the app.

## UI

- History button in the editor header.
- History dialog with restore, save-now and clear actions.
- Import/export controls inside the snippets and templates dialogs.
- Hidden file inputs are labelled for assistive technology.

## Verification

- `bun run lint` — clean.
- `bun run test` — 87 files, 822 tests passing.
- `bun run build` — succeeded.
- Fast E2E against Obscura — compose flows pass, including draft-history
  restore and the snippet/template dialogs.
- Chromium E2E — compose, a11y and polish suites pass; the full-suite result is
  recorded after the run.
- Performance budgets — pass.

## Follow-ups

- Optional visual editor.
- Scheduled-draft reminders.
- Optional cross-tab draft synchronization.
