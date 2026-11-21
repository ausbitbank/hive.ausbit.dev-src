# W44 — Issue #85 raw image URLs in Threads

Date: 2026-11-21
Status: implemented and deployed

## Scope

Issue **#85** reported that `https://hive.ausbit.dev/shorts/threads` showed raw
image URLs as plain text in some thread bodies instead of rendering the image.

## Root cause

InLeo (`leothreads/0.3`) often pastes the upload URL into the post body as
plain text, for example:

```
Saturday 21 November 2026
Good morning Hivers!
https://img.leopedia.io/DQm…/IMG_3963.jpeg
```

The body carries no markdown image syntax, no `<img>` tag and sometimes an
empty `json_metadata.image`, so `shortMedia()` found nothing to render. The
card preview (`shortPreview()`) only stripped markdown images and left the URL
in the text. Other clients had the same shape (`cdn.steemitimages.com`,
`img.leopedia.io`, …).

## Changes

`src/services/shortForm.js`:

- Added `BARE_MEDIA_URL`, matching http(s) URLs that end in an image or video
  extension (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.bmp`, `.svg`,
  `.mp4`, `.webm`, `.ogv`, `.mov`) with an optional query string.
- `shortMedia()` now scans the body for bare media URLs after metadata,
  markdown and `<img>` sources. Deduplication and the four-item cap still apply,
  and videos keep their play badge.
- `shortPreview()` removes bare media URLs before collapsing whitespace, so the
  card no longer leaks the URL once the image renders below it.

`tests/unit/short-form.spec.js`:

- Bare image URLs and `<center>`-wrapped URLs are collected as media, including
  videos and query strings.
- A bare URL that duplicates a metadata/markdown image is de-duplicated.
- Previews drop bare media URLs.

## Verification

- `bun run lint` — clean.
- `bun run test` — 82 files, 772 tests passed.
- `bun run build` — succeeded.
- Local Playwright against the built SPA on `/shorts/threads`:
  - before: 6 of the first 40 cards showed `https://…` text with `imgs=0`;
  - after: none show a raw URL and the affected cards render 1–4 images;
  - a leopedia bare-URL thread renders both photos through the Hive image
    proxy (`naturalWidth` 900/640), with the body preview clean.
- The detail page (`/shorts/threads/@author/permlink`) already renders the
  extracted media below the body; the body URL remains as Markdown text there.
  The reported feed surface is fixed.

## Deploy

`./scripts/deploy.sh` — deployed to `hurgenburgen:/var/www/hive.ausbit.dev`.
