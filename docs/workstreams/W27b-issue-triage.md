# W27b — GitHub issue triage (issues #30–#42)

Date: 2026-11-18
Status: complete — fixes merged, deployed and live-verified

## Scope

A maintenance pass over the thirteen open issues filed by the automated audit on
2026-11-18. The work split into three groups:

- **Runtime** — follower titles and counts, avatar fallbacks, account tab
  scrolling, service-worker fetch failures, operation counts and wallet
  deep-linking.
- **Crawler metadata** — duplicate prerendered tags, dynamic route metadata,
  canonical block URLs and the RSS feed.
- **Origin policy** — security headers, trailing slashes, real 404 statuses and
  the web manifest content type.

The canonical virtual-host file is now
[`deploy/nginx/hive.ausbit.dev.conf`](../../deploy/nginx/hive.ausbit.dev.conf).
It owns the URL policy, headers, 404 handling and the SSI metadata shell.

## Runtime fixes

### #37 Account tabs at 390px

The account tab strip now enables Quasar's outside arrows on mobile. The arrows
use a 30px target and no longer overlap labels. At 390px the strip is still
swipeable and keyboard-scrollable; the arrow on the right (or left, when
scrolled) makes the overflow obvious. Measured at 390×844: scroll width 878px,
viewport 276px, both arrows rendered.

### #38 Followers/following titles

`connections.vue` now calls `setPageMeta` on mount and on path changes.
`/@ausbitbank/followers` reports `@ausbitbank's followers — hive.ausbit.dev`
with the matching canonical; following uses the same pattern.

### #39 Service-worker TypeError

`public/sw.js` always resolves a `Response`:

- navigation failures fall back to cached `index.html`/`offline.html`, then a
  generated 503 offline page;
- same-origin asset failures return the cached copy or an explicit 504 empty
  response instead of rejecting with `undefined`;
- navigations are only written to the shell cache when `response.ok`;
- the cache version moved to `hive-ausbit-shell-v4`.

Verified by registering the worker, navigating to `/b/111758000`, and going
offline: no `Failed to convert value to 'Response'` error, and offline
navigation still renders the blocks page.

### #40 Follower avatars and counts

The failing requests were legacy `profile.cover_image` backgrounds
(`tinypic.com`, `postimg.org`, `steemitimages.com`, …), not the Hive avatar
endpoint. Follower/following cards no longer request profile cover art
(`:show-cover="false"`), which removes ~20 failed requests per 100 followers and
shortens the settle time. Both `userCard` and `accountHeader` now fall back to
`/statics/member.png` on an avatar error. The body count uses the same
`tidyNumber` helper as the badge: “followed by 19,352 accounts”.

### #41 Home vs block-page operation counts

`HomeBlockCard` called `blockOperationCount(block, virtualOps)`, so “Operations”
included virtual ops while the block page excluded them. The home card now calls
`blockOperationCount(block)`; “Virtual ops” remains a separate metric. Live
example: block 111,762,051 showed 10 transactions / 11 operations / 1 virtual op
on both surfaces.

### #42 Wallet Activity URL

Wallet section links are router links to `#overview`, `#activity`, `#pending`
and `#tokens`. `wallet.vue` watches `$route.hash` and re-applies the hash scroll
after account data renders, so refresh and Back keep the selected section.
Verified: click Activity → `/@ausbitbank/wallet#activity`; reload stays on the
hash and restores the activity scroll position.

## Crawler metadata

### #31 Duplicate prerendered tags

The build minifies optional attribute quotes (`<meta name=description …>`), but
`prerender-meta.mjs` only matched quoted attributes. Every injected tag was
therefore appended after the homepage tags. The helper now:

- matches quoted and unquoted attribute values;
- replaces the first matching tag and removes any duplicates;
- keeps exactly one `<title>`, canonical, description, OG and Twitter tag;
- removes old JSON-LD blocks before adding the route-specific one.

Live counts for `/`, `/blocks` and `/@hiveio`: one canonical, one description and
one `og:title`.

### #32 Dynamic route metadata

`prerender.mjs` now writes an SSI shell (`__meta.html`) in addition to the
static prerendered pages. nginx validates the URL segment with a regex and sets
`page_title`, `page_description`, `page_path` and `page_type`; the SSI template
renders them into the original application shell. No body is snapshotted.

Examples verified against production:

| URL | Title |
| --- | --- |
| `/@hiveio` | `@hiveio — Hive account` |
| `/@ausbitbank/followers` | `@ausbitbank's followers — hive.ausbit.dev` |
| `/@ausbitbank/wallet` | `@ausbitbank's wallet — hive.ausbit.dev` |
| `/@ausbitbank/<permlink>` | `@ausbitbank: <permlink> — Hive post` |
| `/b/111758685` | `Hive block 111758685` |
| `/tx/<id>` | `Hive transaction <id>` |
| `/trending/hive` | `Trending Hive posts in #hive` |

Canonicals are the final no-slash URL for the route. The previous hard-coded
static route list also gained `/trending`, `/created`, `/hot`, `/create`,
`/witness`, `/hbdstabilizer` and the sort routes.

### #33 404 / URL consistency

- Unknown paths now return HTTP 404 while still serving the SPA shell; the named
  `@spa404` location forces the status and gives the page a `/404` canonical.
- The Error404 page uses a `<main>` landmark.
- Search block results use the canonical `/b/:id`; `/block/:id` permanently
  redirects to `/b/:id`.
- Command palette account shortcuts (Wallet / Posts / Blog / Followers) are
  hidden until `fetchAccount` confirms the account exists. A nonexistent account
  now shows only the profile result.
- Missing static files (`/version.json`, `/sitemap.txt`, missing assets) return
  404 instead of the homepage shell.

### #34 Trailing slashes

The origin enforces a no-trailing-slash policy, preserving the query string:
`/blocks/?x=1` → 301 `/blocks?x=1`. The sitemap already lists no-slash URLs;
all 15 entries were rechecked and return 200 without a redirect.

### #35 Manifest content type

`location = /manifest.webmanifest` sets
`default_type application/manifest+json`. Production now returns
`content-type: application/manifest+json`.

### #36 RSS feed

The build now requests `bridge.get_account_posts` with `sort: posts` and filters
again to `post.author === 'ausbitbank'`. The channel description says the feed is
project updates from that account. Titles that are empty or contain no letters
or digits (for example `.`) fall back to the permlink. Live feed: 20 items, all
`@ausbitbank`, no punctuation-only titles.

## Origin policy

### #30 Security headers

The nginx origin now sends:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` with `frame-ancestors 'none'` (plus the app’s image,
  frame, worker and API allowances, including Cloudflare Web Analytics)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` without camera/microphone/geolocation/payment
- `Cross-Origin-Opener-Policy: same-origin`

Playwright on `/`, `/@ausbitbank/followers`, `/@ausbitbank/wallet`, `/b/…` and
`/blocks` reported no CSP violations or page errors.

## Verification

- `bun run lint` — 0 errors, 0 warnings.
- `bun run test` — 39 files, 287 tests passed.
- `bun run test:e2e` — 32 Playwright tests passed.
- `bun run perf:check` — all budgets passed; LCP 1.6–2.3s, initial transfer
  631–782KB.
- `./scripts/deploy.sh` — build, feed, prerender, backup and staged rsync
  completed.
- Live checks: headers, manifest type, sitemap targets, duplicate meta counts,
  dynamic metadata, 404 status, service worker, tab arrows, follower count and
  wallet hash.
- nginx config backed up on the host before installation
  (`/etc/nginx/sites-available/hive.ausbit.dev.bak-20261118T053751Z` and a
  later pre-CSP backup) and validated with `nginx -t` before reload.

## Follow-ups

- SSI titles are route-derived, not chain-derived: a post gets
  `@author: permlink — Hive post` rather than its on-chain title. That is enough
  for crawlers to distinguish the URL; actual post titles still need SSR or an
  edge worker reading the chain.
- The service worker still logs the browser's own network error when the site
  is offline. It no longer throws or returns `undefined`.
- Cloudflare Web Analytics is explicitly allowed by CSP. If the beacon is
  removed, narrow `script-src` and `connect-src` again.
