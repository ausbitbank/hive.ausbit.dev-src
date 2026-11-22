# W66 — Badge shelf

Date: 2026-11-23
Status: implemented locally

## Scope

A cached, fail-open badge client for PeakD and HiveBuzz, a curated credential
allowlist, and an author-selected badge shelf and detail dialog. Verification
is always issuer-based; nothing is self-claimed or editable.

## Sources

- **PeakD** — badge accounts are `badge-######` Hive accounts. Membership is
  read through the same-origin Worker proxy
  `GET /api/badges/peakd?account=<name>`; the public
  `condenser_api.get_followers` list is the fallback. Metadata is resolved with
  the existing cached `condenser_api.get_accounts` layer. Badges without a
  profile name or image are omitted.
- **HiveBuzz** — `https://hivebuzz.me/api/badges/<name>`; only `state: "on"`
  is earned. Descriptions are converted to plain text. The level image is
  `https://hivebuzz.me/api/level/<name>`.

Both sources are cached for one hour, deduplicated in flight, aborted on
navigation and fail open to an empty shelf. No badge request is made on post
pages or feeds.

## Security

- The Worker validates the account name (`^[a-z][a-z0-9.-]{2,15}$`), applies a
  timeout and edge cache, and never becomes an open proxy.
- Badge images require HTTPS on a known image host; a broken or unknown image
  omits the badge.
- Badge descriptions are sanitized to plain text and rendered with `{{ }}`,
  never `v-html`.
- `src/data/badges/credentials.js` is the only source of “Verified”: NFT
  Showroom, Hive Learners, Lensy and Hive Verifieds. Every other badge shows its
  issuer without a check.

## Components

- `src/services/badges.js` — normalisation, cache, PeakD proxy/fallback,
  HiveBuzz catalog/level, selection resolution and Studio suggestions.
- `src/data/badges/credentials.js` — curated credential allowlist.
- `src/components/theme/BadgeShelf.vue` — chips, issuer labels, keyboard
  detail dialog and `noopener noreferrer` issuer links.
- `src/components/theme/ProfileShelf.vue` — lazy badge resolution on the
  account page only.
- `src/pages/skinStudio.vue` — earned badge picker, level switch and preview.
- `deploy/cloudflare/metadata-worker.mjs` — `/api/badges/peakd` route.

## Verification

- `bun run lint` — clean for the badge files.
- `bun run test` — 127 files, 1,100 tests passing, including 9 new badge tests.
- Chromium E2E with mocked PeakD/HiveBuzz APIs — shelf, circle, dialog,
  sanitized description, issuer link, omitted unknown badge, and no badge
  requests on a post page.
- The Worker route still needs `wrangler deploy` before production uses the
  proxy; the Hive followers fallback keeps the shelf working without it.
