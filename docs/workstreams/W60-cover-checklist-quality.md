# W60 — Cover quality and checklist warnings

Date: 2026-11-22
Status: implemented and verified

## Scope

Closing the cover and checklist items in issue #82:

- warn regular-post authors when a post has no image/cover;
- warn when the cover is below 640×320 or is portrait;
- probe body and cover images for broken links;
- warn when a tag names a different `hive-*` community than the destination;
- let each account hide advisory warnings with **Don't warn again**, and restore
  them from the checklist.

Missing-cover warnings apply only to regular posts. Short-post and comment
composers do not use the publish checklist, and comment edits in the composer
report “Comments have no cover image” instead of warning.

## Image probing

`src/services/imageHealth.js`

- `probeImage` loads a URL with `Image()` and reads `naturalWidth`/`naturalHeight`
  without canvas or CORS configuration. It returns `ok`, `broken`, `invalid`,
  `timeout` or `unknown`.
- `probeImages` deduplicates URLs and probes at most four at a time so a
  many-image post does not burst the image host.
- `analyzeImageHealth` separates broken links from cover quality issues.
- Cover thresholds are 640×320. A portrait image (`height > width`) is flagged
  even when it is large enough.
- `coverIssueDetail` produces one sentence with the actual dimensions and the
  recommended landscape size.

Probing is advisory. It never blocks publishing, never uploads anything and is
not persisted.

## Checklist

`src/services/publish.js`

- `publishChecklist` accepts optional `imageHealth` probe output.
- Regular posts with no body image and no cover get an “Images and cover”
  warning with the `cover-missing` dismiss key.
- Broken image URLs add an “Image links” warning; cover dimension problems add
  a “Cover image quality” warning.
- A selected community plus another `hive-123456`-style tag adds a “Community
  tag” warning that names both communities.
- Comment edits get an informational “Comments have no cover image” row and no
  image-quality or community-tag warnings.
- Image warnings contain `dismissKey`; errors and non-image warnings do not.

## Composer

`src/pages/compose.vue`

- Watches the cover and body image URLs with a 500 ms debounce and probes them
  with a run counter so stale results cannot overwrite a newer draft.
- Dismissible warnings show **Don't warn again**. Hidden warnings are stored per
  account (guests separately) under `composeDismissedWarnings:<account>`, capped
  at 40 keys.
- A “N hidden warnings · Restore warnings” row appears whenever dismissals are
  active, so hiding is always reversible. The preference survives reloads.
- Checklist filtering only hides `warn` items with a `dismissKey`; blocking
  errors are never hidden and `checklistErrors` still controls publishing.

`src/services/checklistPrefs.js` owns the per-account dismissal storage and
validation.

## Verification

- `bun run lint` — clean.
- `bun run test` — 97 files, 889 tests passing, including image probing,
  cover-quality summaries, dismissal storage and checklist warnings.
- `bun run build` — succeeded.
- Chromium E2E — 117/117 passing. New coverage:
  - missing-cover warning hides, persists across reload and restores;
  - broken image and 100×300 portrait cover warnings appear;
  - a different community tag produces the mismatch warning;
  - shorts and comment composers show no cover warnings.
- Axe clean on `/compose` at 1440px and 390px; the mobile compose polish check
  passes.
- `bun run perf:check` — all budgets pass; `/compose` measured 716.7 KB total.
- Deployed to production with `./scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T161109Z.tar.gz`.
- Live smoke on `https://hive.ausbit.dev`: the index and entry-asset hashes match
  the local build; the missing-cover warning, dismiss action, hidden-warning
  restore, broken-image probe and tag-mismatch warning render; shorts and the
  comment composer show no cover warning; no page errors.

## Follow-ups

- Community picker avatars, subscriber counts, search and rules links.
- Topic drag reordering and richer suggestions.
- Remaining editor, drafts, metadata-tooling and manual SmartLock items.
