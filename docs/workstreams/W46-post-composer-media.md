# W46 — Post composer media, rewards and metadata

Date: 2026-11-21
Status: implemented and verified

## Scope

First implementation slice from the composer roadmap (issue #82):

- image upload from the toolbar, drag-and-drop and clipboard paste;
- cover-image selection and `json_metadata.image` ordering;
- an allow/decline rewards choice;
- community subscription suggestions;
- interoperable post metadata: description, mentioned users, AI disclosure,
  countdown, portfolio, collection and display author;
- rendering the new metadata on post pages and feed cards.

Media embeds, a split live preview, snippets/templates, a visual editor and true
scheduling remain follow-ups.

## New services

`src/services/imageHost.js`

- Validates JPEG, PNG, GIF, WebP, AVIF, BMP and SVG files; rejects HEIC/HEIF
  with a clear conversion message. Limit is 8 MB because the signed upload
  challenge is sent to Keychain as a Buffer JSON string.
- Builds the signed payload as `ImageSigningChallenge` + file bytes.
- Signs through Keychain or SmartLock; no posting key is stored or logged.
- Uploads the multipart file to `images.hive.blog/<account>/<signature>` and
  maps host errors to readable messages.
- Keeps a per-account local recent-upload list (24 entries) for reuse.

`src/utils/media.js`

- Extracts markdown and HTML images in document order, deduplicated.
- Derives a short plain-text description from the body.
- Extracts mentioned accounts while ignoring code blocks, URLs and email
  addresses.
- Builds safe markdown image links.

## Draft model

Draft export version is now 2. The model adds:

- `description`, `coverImage`, `aiTools`, `countdown`, `portfolio`,
  `collection` and `authorDisplay`;
- `rewards.decline`, derived from a zero payout cap for older drafts;
- up to 10 tags. The editor marks the first five as primary discovery tags.

`normalizeDraft` migrates old drafts without loss, drops unsafe cover URLs and
invalid countdown values, and normalises AI tool keys to the interoperable set:
`media_generation`, `translation`, `post_draft`, `writing_edit`, `research`,
`other`.

## Post construction

`buildPostMetadata` now writes:

| Key | Value |
| --- | --- |
| `image` | chosen cover first, then unique body images |
| `users` | accounts mentioned in the body |
| `description` | explicit description, or a body-derived excerpt |
| `ai_tools` | only the AI tool flags that are true |
| `countdown` | ISO timestamp |
| `portfolio` | `true` when enabled |
| `collection` | `true` when enabled, plus the `c-c-c` tag |
| `author` | display-name override |

`comment_options.max_accepted_payout` becomes `0.000 HBD` when rewards are
declined. Edits strip only the metadata keys this composer owns, then rebuild
them; unknown keys written by other frontends are preserved. An existing image
array is kept when the edit has no images of its own.

The publish checklist adds image/alt-text, preview-description, countdown,
AI-disclosure, display-author, portfolio and collection rows.

## Composer UI

- Toolbar upload action plus drag/drop and paste handlers.
- Upload dialog with alt text, progress, errors, recent uploads and an optional
  “centre uploaded images” preference persisted per browser.
- Cover picker from body images and recent uploads, with reset to the first body
  image.
- Post details panel: description with auto-fill, display author, AI disclosure,
  countdown date/time, portfolio and collection toggles.
- Rewards panel: “Allow rewards” on by default; declining writes a zero payout
  cap. Payout split, cap, votes and curation moved under advanced settings.
- Community picker now loads `bridge.list_all_subscriptions` on mount and lists
  subscribed communities first.
- Review dialog before queueing summarises the final post and still requires the
  normal posting-key signature.

## Display

- Post page: AI disclosure badge with tooltip, live countdown, portfolio and
  collection badges, display-author byline, and `metadata.description` for page
  and social previews.
- Feed cards: small AI, portfolio, collection and countdown badges. Cards
  already preferred `metadata.image` and `metadata.description`.

## Security and authority

- Publishing and uploads use the posting key only. Active-key operations are
  unchanged.
- SmartLock keeps unlocked keys in memory; the upload flow reuses the existing
  unlock dialog and session timeout.
- Embedded/user content remains sanitised by the existing renderer.

## Verification

- `bun run lint` — clean.
- `bun run test` — 84 files, 798 tests passing.
- `bun run build` — succeeded.
- Fast E2E against Obscura — compose flows pass; the file-input upload test is
  skipped there because Obscura has no `DataTransfer`.
- Full Chromium E2E — 80/80 passing, including axe at 1440px and 390px, the
  Keychain upload flow with a stubbed extension and mocked image host, review
  dialog, rewards decline, metadata, cards and post display.
- Performance budgets — pass after raising the compose route/total budgets and
  the post/home ceilings by the measured feature cost.
- Upload signing payload verified with a unit test against the exact
  `sha256("ImageSigningChallenge" + file)` digest.
- Deployed to production with `./scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T084254Z.tar.gz`.
- Live smoke on `https://hive.ausbit.dev`: composer loads, Post details and
  Allow rewards are visible, the upload dialog opens for a logged-in session,
  the AI badge renders on the latest dev post, and the browser reported no page
  errors.
- SmartLock upload uses the existing signer and unlock flow; a live SmartLock
  upload should still be included in a follow-up smoke.

## Follow-ups

- Media embed dialog and embed preview.
- Split/top-down live preview and the expanded toolbar.
- Snippets, templates and draft search/version recovery.
- Post-publish success panel.
- Visual editor and scheduled-draft reminders, if desired later.
