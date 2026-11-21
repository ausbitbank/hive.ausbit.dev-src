# W59 — Composer upload hardening

Date: 2026-11-22
Status: implemented and verified

## Scope

Closing the upload-quality items in issue #82:

- cancel a running batch, including while the signature prompt is open;
- retry one failed/cancelled file or every failed/cancelled file;
- per-file signing, upload and progress state in the dialog;
- a richer recent-upload row with size, relative time and a copy-URL action.

## Upload service

`src/services/imageHost.js`

- `uploadImage` now uses `XMLHttpRequest` in production so it can report real
  upload progress and abort through an `AbortSignal`. The fetch path stays for
  tests and non-browser callers; it reports 0 then 100 because fetch does not
  expose upload progress.
- Aborted uploads throw an error with `code: 'aborted'`; `isUploadAborted`
  keeps the caller's checks readable.
- `createUploadQueue` builds per-file state (`queued`, `signing`, `uploading`,
  `done`, `error`, `cancelled`) and keeps the `File` object in component memory
  only. Cover uploads are limited to one file.
- `uploadQueueSummary` backs the dialog summary and the decision to close or
  keep the dialog open for retry.
- `formatUploadBytes` and `formatUploadAge` render the recent-upload metadata.

## Composer UI

`src/pages/compose.vue`

- Every selected file gets a row with filename, size, status and a progress bar.
  Signing is indeterminate; uploading shows the measured percentage.
- **Cancel upload** sets a run flag and aborts the in-flight XHR. Queued rows are
  marked cancelled immediately; the active row is marked cancelled when the
  running step settles. Closing the dialog is disabled while a run is active.
- **Retry** appears on failed and cancelled rows and retries just that file.
  **Retry failed** retries every failed/cancelled row in the current dialog.
- Successful files are inserted even when a sibling fails, so a partial batch is
  not lost. The dialog stays open with the failed rows and a retry prompt.
- A user-cancelled signature stops the batch rather than prompting for the next
  file.
- Queue mutations use the reactive proxies created by assigning the queue to the
  component state. Without that, status and progress updates were applied to raw
  objects and the dialog did not re-render reliably.
- Recent uploads are now rows with a thumbnail, filename, size, relative time
  and separate Insert / Use as cover and Copy URL buttons. The existing tile
  class is retained so the previous insert test and cover picker behaviour stay
  intact.

## Verification

- `bun run lint` — clean.
- `bun run test` — 95 files, 877 tests passing, including new unit coverage for
  upload progress, abort, XHR error mapping, queue summaries and labels.
- `bun run build` — succeeded.
- Chromium E2E — 113/113 passing. New coverage:
  - cancel during signing, then retry inserts the image;
  - recent rows show size and time and copy the URL (clipboard assertion);
  - the upload dialog is axe clean and overflow-free at 1440px and 390px.
- `bun run perf:check` — all route budgets pass; `/compose` measured 715KB total.
- Deployed to production with `./scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T152135Z.tar.gz`.
- Live smoke on `https://hive.ausbit.dev`: the public index and entry-asset
  hashes match the local build; the composer and upload dialog render, the
  recent row shows the thumbnail, filename, 2.0 KB, 5 min ago and Copy URL, the
  copied URL matches the clipboard, and the browser reported no page errors.

## Follow-ups

- Cover quality warnings and the expanded publish checklist (next composer
  workstream).
- Community picker metadata and topic drag controls.
- The remaining editor, drafts, metadata-tooling and manual SmartLock items in
  issue #82.
