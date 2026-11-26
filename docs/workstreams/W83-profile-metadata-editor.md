# W83 — Profile metadata editor and image uploads

Date: 2026-11-26
Status: complete — implemented and verified locally

## Scope

Make account metadata editable for every account, including brand-new accounts
whose `json_metadata` and `posting_json_metadata` are empty strings on chain,
and make the profile image and cover image editable without hand-writing URLs.

- Empty metadata is treated as `{}` instead of `JSON.parse('')`, so the editor
  no longer throws when opening `@banksia-io` or any freshly created account.
- The posting metadata card is visible and editable for the signed-in account
  even when the field is empty.
- A dedicated Profile images panel previews, validates, uploads, replaces and
  removes `profile.profile_image` and `profile.cover_image`.
- Uploads reuse `ImageUploadButton` and therefore the same
  `images.hive.blog` challenge, signature and upload path as post images.
- Malformed JSON shows an inline error and cannot be queued; the JSON preview
  is only rendered when the draft parses.
- Draft state exposes Discard/Submit only when the canonical JSON actually
  changed, and a 16 KB guard blocks oversized metadata before queueing.
- Legacy `json_metadata` stays editable but is clearly labelled as an active-key
  action; profile images live in posting metadata.

## Affected routes and components

- `/@account` — `src/pages/account.vue` shows both metadata cards safely,
  hides them for other accounts when empty, and resets editor toggles when the
  route account changes.
- `src/components/propsEditor.vue` — safe parser, image panel, dirty tracking,
  validation and submit/discard flow.
- `src/components/ImageUploadButton.vue` — optional success message/caption so
  profile uploads do not report "Inserted into your post".
- `src/services/accountMetadata.js` — pure parse/format, profile-field and
  operation-building helpers.

## Authority and privacy impact

- Posting metadata uses `account_update2` with the posting key and an empty
  legacy `json_metadata` field, matching the W63 theme-write rule.
- Legacy metadata uses `account_update` with the active key and sends the
  account's posting authority and memo key back unchanged.
- Image uploads sign the standard `ImageSigningChallenge` with the posting key.
  No key material is stored; the existing Keychain, SmartLock and HiveAuth
  bridges are unchanged.
- Metadata is public by design. The editor adds no local storage for drafts.

## Verification

- `bun run lint` — clean, including the theme token scanner.
- `bun run test` — 184 files, 1,572 tests passing, including new
  `account-metadata` and `props-editor` suites.
- `bun run build` — succeeded.

Not run in this workstream: the Chromium E2E suite and a live upload smoke.

## Remaining work

- Live smoke the upload → save → sign → profile refresh flow with a real
  account once deployed.
- Structured editors for display name, about, location and website if the chips
  prove too coarse for profile authoring.
