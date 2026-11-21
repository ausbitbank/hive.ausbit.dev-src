# W45 — Issue #84 3Speak feed play badge

Date: 2026-11-21
Status: implemented and deployed

## Scope

Issue **#84** reported that 3Speak video cards in the feed
(`/created/3speak`, `@threespeak` → Blog) had no play badge. The post page did
show the play control and played the video in-site, so only the feed card was
missing.

## Root cause

The W35 work added the play badge to suspended `markdown-video-link`
thumbnails inside rendered post bodies. Feed cards (`postPreview.vue`) only
rendered the cover image; they had no video detection and no overlay at all.

## Changes

`src/utils/postPreview.js`:

- Added `postIsThreeSpeakVideo(post)`. It recognises the real metadata shapes
  without flagging a prose post that merely uses the `#3speak` tag:
  - `app: "3speak/embed"` (and any `3speak/*` app);
  - the `threespeak.video` marker;
  - `video.platform === "3speak"` or a 3Speak `video.url` / `video.embed`;
  - a 3Speak link in `metadata.links` or the body.
- Metadata may be an object (bridge) or a JSON string (condenser).

`src/components/postPreview.vue`:

- Both card and list layouts render a centred `.post-card__play` overlay with
  `play_arrow` on 3Speak video posts (`aria-hidden`, `pointer-events: none`).
- The card's accessible label becomes **Open video: …** instead of **Open
  post: …**, and the footer action reads **Watch** instead of **Read**.
- The badge is 52px (44px on phones) with a translucent dark disc and a scale
  on card hover.

Tests (`tests/unit/post-preview.spec.js`):

- detection for app, marker, `video` object, links, string metadata and
  body-only embeds;
- prose posts tagged `#3speak` stay unflagged;
- a mounted card shows the badge and `Watch`, while a regular card does not.

## Verification

- `bun run lint` — clean.
- `bun run test` — 82 files, 777 tests passed.
- `bun run build` — succeeded.
- Local Playwright on `/created/3speak`: 17 of 20 cards carry the badge and
  `Watch`; the three without are not videos (prose/photo posts that happen to
  use the tag, e.g. `@manexperiment`'s music article and two Ecency photo
  posts). Screenshot reviewed at 1400px: the badge is centred and clear on
  every video thumbnail.
