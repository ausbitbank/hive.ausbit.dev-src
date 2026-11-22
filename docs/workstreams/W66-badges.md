# W66 — Badge shelf

Date: 2026-11-23
Status: implemented locally

## Scope

A cached, fail-open badge client for PeakD and HiveBuzz, a curated credential
allowlist, and an author-selected badge shelf and detail dialog. Verification
is always issuer-based; nothing is self-claimed or editable.

## Sources

- **PeakD** — badge accounts are `badge-######` Hive accounts. A profile shelf
  already knows the up to six selected badge accounts from the theme, so each
  one is confirmed with the chain-native
  `bridge.get_relationship_between_accounts(badge, account)`; `follows: true`
  means the badge still applies. No third-party API or Worker proxy is used on
  profile views.
- **PeakD Studio picker** — to suggest badges the author has earned, the Studio
  paginates the public `condenser_api.get_followers` list and keeps
  `badge-######` accounts. This scan is cached for an hour and runs only while
  the author is editing a skin.
- Metadata for confirmed badge accounts is resolved with the existing cached
  `condenser_api.get_accounts` layer. Badges without a profile name or image
  are omitted.
- **HiveBuzz** — `https://hivebuzz.me/api/badges/<name>`; only `state: "on"`
  is earned. Descriptions are converted to plain text. The level image is
  `https://hivebuzz.me/api/level/<name>`.

Both sources are cached for one hour, deduplicated in flight, aborted on
navigation and fail open to an empty shelf. No badge request is made on post
pages or feeds.

## Security

- The profile path only asks the chain a yes/no follow question for the six
  badge accounts already encoded in the validated theme; arbitrary account ids
  and non-`badge-######` names are rejected.
- Badge images require HTTPS on a known image host; a broken or unknown image
  omits the badge.
- Badge descriptions are sanitized to plain text and rendered with `{{ }}`,
  never `v-html`.
- `src/data/badges/credentials.js` is the only source of “Verified”: NFT
  Showroom, Hive Learners, Lensy and Hive Verifieds. Every other badge shows its
  issuer without a check.

## Components

- `src/services/badges.js` — normalisation, direct membership confirmation,
  full follower pagination for Studio suggestions, HiveBuzz catalog/level and
  selection resolution.
- `src/data/badges/credentials.js` — curated credential allowlist.
- `src/components/theme/BadgeShelf.vue` — chips, issuer labels, keyboard
  detail dialog and `noopener noreferrer` issuer links.
- `src/components/theme/ProfileShelf.vue` — lazy badge resolution on the
  account page only.
- `src/pages/skinStudio.vue` — earned badge picker, level switch and preview.

## Verification

- `bun run lint` — clean for the badge files.
- `bun run test` — 140 files, 1,201 tests passing; the badge tests cover direct
  membership, full follow pagination, cache, HiveBuzz `state: "on"` filtering
  and sanitisation.
- `bun run build` and `bun run perf:check` — green.
- Chromium E2E with mocked chain reads — shelf, circle, dialog, sanitized
  description, issuer link, omitted unknown badge, Studio selection and no
  badge requests on a post page.
- The metadata Worker no longer carries a badge proxy route, so the badge shelf
  has no separate deployment step.
