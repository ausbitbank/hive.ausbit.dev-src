# W104 — Media, upload and account-claim hardening

Date: 2026-11-28
Status: implemented and verified locally

## Scope

Audits of composer media/upload handling and account-creation flows found a
HiveAuth upload failure, privacy leaks in the image proxy, stale caret/handle
behaviour, incomplete authority matching, and unsafe Hivedex payment-link
handling.

## Media and uploads

- **HiveAuth image uploads use the checksum endpoint.** `ImageUploadButton` now
  signs `sha256(challenge + sha256(file))` through the compact checksum payload
  and uploads with `checksum: true` when the login type is HiveAuth. Whole-file
  JSON signing through the HAS relay (the previous path) fails for normal
  photos.
- **Unknown card-image hosts are proxied.** `resizeImageUrl()` now routes unknown
  hosts through the selected image proxy, matching the module contract and
  `shortFormImageUrl()`, so a feed card does not leak the reader's IP.
- **Query-string proxy bypass closed.** A decoded body image with a query string
  is only loaded directly for known Hive image hosts or the deliberate GitHub
  raw fallback; other origins stay behind the proxy.
- **Base58 decode cap.** `/p/<hash>` values longer than 2,048 characters are
  rejected instead of driving a quadratic decode.
- **Code fences are not images.** `extractBodyImages()` masks fenced and inline
  code before matching Markdown/HTML images, so a code sample cannot become a
  cover or `json_metadata.image`.
- **Upload insertion follows the current caret.** Comment and short-form
  composers use the live textarea selection when the upload resolves, instead of
  a stale pre-upload offset.
- **Upload dialog cannot be dismissed mid-run.** The composer dialog is
  persistent while uploads are in flight.
- **Alt-text checklist catches `![image]`.** A literal “image” alt is treated as
  missing, not accepted as real alt text.
- **Single-line paste guard.** A clipboard string with spaces is no longer parsed
  as an embed URL and cannot swallow the rest of the paste.

## Account creation and claims

- **Exact authority matching.** A central `authoritiesMatchKeys()` /
  `authoritiesMatchPayload()` requires threshold 1, no account authorities, one
  key with weight 1 and the exact memo key. It is used by the claim page, batch
  page, Hivedex signup and the new-owner “check created” action.
- **Victim-side verification.** `joinKeys.checkCreated()` no longer reports
  success when the username exists with different keys; it shows a persistent
  mismatch warning.
- **Hivedex resume verifies saved keys.** Orders store their public keys, and a
  resumed order compares them with the chain. “Created — keys not verified” is
  shown when verification is impossible, and the order is only deleted after a
  confirmed match.
- **Safe payment links.** Hivedex invoice links must be `https:` URLs; unsafe
  links are rejected on creation and dropped from saved orders.
- **Double-invoice guard.** The creating flag is set before the availability
  await, so a double click cannot create two invoices.
- **Stale claim checks are ignored.** `claimAccount` uses a request token and
  shows an error when the check fails; switching claim links cannot let an old
  response overwrite the new payload.
- **Create form is bound to the typed name.** Availability checks are validated,
  token-guarded and reset when the username changes; key generation requires an
  available name and clears the saved-key confirmation; creation refuses keys
  generated for a different username.

## Components

| Area | Files |
| --- | --- |
| Uploads | `src/components/ImageUploadButton.vue` |
| Images/media | `src/services/imageProxy.js`, `src/utils/media.js` |
| Composer/comment insertion | `src/pages/compose.vue`, `src/components/CommentForm.vue`, `src/pages/ShortFormPost.vue`, `src/components/shortForm/ShortFormTimeline.vue`, `src/services/publish.js` |
| Claims | `src/services/accountClaim.js`, `src/pages/joinKeys.vue`, `src/pages/claimAccount.vue`, `src/pages/batchCreate.vue` |
| Account creation/Hivedex | `src/pages/create.vue`, `src/pages/hivedexSignup.vue`, `src/services/hivedex.js` |
| Tests | `tests/unit/image-proxy.spec.js`, `tests/unit/media.spec.js`, `tests/unit/post-preview.spec.js`, `tests/unit/publish.spec.js`, `tests/unit/accountClaim.spec.js`, `tests/unit/hivedex.spec.js` |

## Authority and privacy

- No new authority. Claim matching is stricter before presenting success.
- HiveAuth no longer signs whole image files through the relay.
- Unknown image hosts no longer see readers directly in card images.
- Hivedex links are restricted to https.

## Verification

- `bun run lint` — clean.
- `bun run test` — **238 files / 2,307 tests** passing.
- `bun run build` — succeeded.
- Targeted media/image/claim/Hivedex suites pass.

## Remaining

- Multi-image uploads can still derive alt text from filenames; a per-image alt
  editor is future UI work.
- The proxy still relies on the selected image host to fetch unknown origins.
- Hivedex resume cannot verify keys from orders saved before this change; those
  show “keys not verified” rather than failing.
