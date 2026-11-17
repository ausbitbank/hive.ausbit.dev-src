# W9 — Post reading and comment threads

Date: 2026-11-17
Status: complete

## Goals

- Fix the oversized avatar images inserted next to every `@mention`.
- Make the post page content-first instead of starting with a full profile banner.
- Make long comment threads usable and fast, especially on mobile.

## Mention avatar bug

`@ecency/render-helper` decorates each mention with:

```html
<a class="er-author er-author-link">
  <img class="er-author-link-image" src="https://i.ecency.com/u/USER/avatar/small">
  @user
</a>
```

Nothing sized those images, so every mention rendered a 256px avatar. PeakD
renders plain mention links. `src/components/render.vue` now removes
`img.er-author-link-image` during DOMPurify's `uponSanitizeElement` hook, and
`src/css/app.scss` keeps a `display: none` fallback. The mention text and link
remain.

## Post page

`src/pages/post.vue` was rebuilt around a content-first layout:

- Removed the full `account-header` banner and its account tabs from post pages.
- New post hero: community/category, date, edited state, left-aligned title,
  author avatar/name/reputation, reading time, word count, comment and reblog
  counts.
- Actions: vote (inline control), reply, share dialog, reblog.
- Article body uses the existing sanitised renderer with improved long-form
  typography (link colours, figures, captions, heading scroll offsets).
- Tags now appear as chips under the post.
- Right sidebar: mini author card with about text and profile link, post details
  (community, category, app, votes, payout, beneficiaries, payout flags), tip
  button, full metadata popup and external links.
- Mobile stacks the article, comments, then the sidebar.
- Community titles are resolved from `bridge.get_community` and cached in the
  store, so posts in `hive-*` communities show a real name instead of the id.
- Fixed a Pinia state/getter name collision (`communityInfo`) that prevented the
  community cache from updating. This also fixes community page headers.

## Comment threads

`src/components/comments.vue` and `src/components/comment.vue` were rebuilt:

- Comments are **collapsed by default**, matching PeakD's “Load comments”
  behaviour. The initial page does not fetch or render the discussion.
- Loading uses `bridge.get_discussion` once, then flattens the reply tree with a
  pure helper in `src/services/comments.js`.
- Rendering is paginated: 30 comments at a time with “Load more comments”.
  The 528-comment sample used to produce a **1.45 million px** document; it now
  starts at ~13k px and only renders the first page.
- Sort options: Best (net rshares), Newest, Oldest, Most replies.
- Hidden/flagged comments and their subtrees are skipped by default, with a
  filter menu to show them.
- Each comment now has an author header at the top (avatar, `@author`,
  reputation, relative time, reply count) instead of showing the author only in
  the footer.
- Nested replies are flattened with capped indentation and a subtle rail, so
  deep threads stay readable on mobile.
- Comment actions reuse a compact mode of `postFooter` (reply, payout, vote,
  more) with the author row omitted.
- `#comments` deep links auto-load the discussion.

## Verification

- `bun run lint` clean.
- `bun run test` — 14 files / 111 tests passing (new comment helper coverage).
- `bun run build` succeeds.
- Playwright at 1440px and 390px on a 528-comment proposal and a normal post:
  no horizontal overflow, one `h1`, no console errors/warnings.
- Mention images: 0 (`img.er-author-link-image`).
- Comments start collapsed; first page renders 30 comments; Load more reaches
  60; sorting resets the page.
- Axe WCAG A/AA: zero violations with comments loaded at desktop and 390px.
- Vote dialog, share dialog, full metadata popup and comment composer open
  without console errors.

## Files

- `src/components/render.vue` — mention image removal.
- `src/css/app.scss` — mention fallback and long-form typography.
- `src/pages/post.vue` — content-first post page and sidebar.
- `src/components/comments.vue` — lazy loading, pagination, sorting, filters.
- `src/components/comment.vue` — single comment card with author header.
- `src/components/postFooter.vue` — compact comment footer mode.
- `src/components/shareButtons.vue` — fixed click binding and opener safety.
- `src/services/comments.js` — flatten/sort/count/reputation helpers.
- `src/stores/hive/getters.js` — renamed colliding community getter.
- `tests/unit/comments.spec.js` — helper tests.
