# W47 — Composer embeds, split preview and editor tools

Date: 2026-11-21
Status: implemented and verified

## Scope

Second composer phase from the roadmap:

- media embeds for video, audio and social links;
- split, top-down and auto-updating previews;
- editor settings and HTML source mode;
- an expanded Markdown toolbar;
- list continuation, indentation and more keyboard shortcuts.

Visual editing, snippets/templates and true scheduling remain later phases.

## Embed detection

`src/services/embeds.js` recognises:

- YouTube, Vimeo, 3Speak, Odysee, Rumble, BitChute and DTube URLs, inserted as
  plain links that the existing renderer turns into click-to-load embeds;
- Spotify, SoundCloud and Twitch URLs, inserted as iframes;
- X/Twitter status URLs, inserted as a labelled link;
- image URLs, inserted as Markdown images.

The shared allow-list moved to `src/utils/embedHosts.js` and is now used by both
`render.vue` and `safeHtml.js`. It adds Spotify, SoundCloud, Twitch,
`youtube-nocookie.com` and `platform.twitter.com` to the previous hosts.

## Renderer

`render.vue` accepts an `embeds` prop. When false (the composer's preview
setting), it removes iframes, replaces supported video thumbnails with a plain
“Watch video” link and turns other iframes into an “Open embedded media” link.
Post pages keep embeds enabled by default.

## Editor toolbar

`MarkdownToolbar.vue` now provides:

- bold, italic, underline and strikethrough;
- heading dropdown for H1–H3;
- quote, bullet, numbered and task lists;
- link, image upload, image URL and centred blocks;
- media-embed dialog with provider detection and a YouTube thumbnail preview;
- table dialog with rows and columns;
- inline code, code block and divider.

## Markdown engine

`src/utils/markdownEditor.js` adds:

- underline, strikethrough, H1/H2/H3 and task-list actions;
- embed/raw insertion, indent and outdent;
- `continueMarkdownList` for Enter inside bullet, numbered and task lists;
- shortcuts for underline (Ctrl/⌘ U), strikethrough (Ctrl/⌘ Shift X) and
  headings (Ctrl/⌘ Alt 1/2/3).

## Composer behaviour

- Write, Split and Preview modes. Split is a two-column desktop layout and
  stacks on mobile.
- Preview renders on a 320 ms debounce when auto-update is on.
- Top-down preview puts the preview above the editor in Split.
- Preview embeds can be turned off independently.
- Editor settings dialog persists source mode, auto-update, preview embeds,
  top-down preview, centered images and fullscreen.
- HTML source mode hides the Markdown toolbar and renders the sanitised result.
- Fullscreen hides the publishing sidebar; Escape exits.
- Copy the whole body as Markdown; a Markdown cheat sheet is built in.
- Pasting or dropping a supported media URL inserts the embed instead of raw
  text. Image URLs become Markdown images.
- Tab and Shift+Tab indent and outdent selected lines.

## Verification

- `bun run lint` — clean.
- `bun run test` — 85 files, 806 tests passing.
- `bun run build` — succeeded.
- Full Chromium E2E — 82/82 passing, including the media-embed dialog, split
  preview, preview-embeds toggle, table dialog, HTML source mode and axe checks.
- Fast E2E against Obscura — 10 compose/action flows passing; the Chromium-only
  file-input upload test is skipped there.
- Performance budgets — pass after a small compose route/total increase for the
  new toolbar and preview controls.
- Visual smoke at 1440px: split preview shows a YouTube click-to-play thumbnail,
  heading and list rendering; the settings dialog fits without overflow.
- Deployed to production with `./scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T092750Z.tar.gz`.
- Live smoke on `https://hive.ausbit.dev`: Split preview renders the YouTube
  thumbnail, heading and list; the media dialog and editor settings open; no
  page errors were reported.

## Follow-ups

- Snippets, templates and draft search/version recovery.
- Post-publish success panel.
- Optional visual editor and scheduled-draft reminders.
