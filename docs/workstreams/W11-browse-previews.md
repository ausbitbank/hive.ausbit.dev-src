# W11 — Browse listings and post previews

Date: 2026-11-17
Status: complete

## Goals

- Make `/browse`, tag pages, community listings and profile sections
  (`posts/blog/feed/replies/comments`) feel like a professional content site.
- Replace the old masonry/centred preview cards and developer-style API toolbar.
- Keep table access and post actions for power users without making them the
  default.

## What was wrong

- Masonry columns produced uneven, hard-to-scan cards with centred text.
- Card titles/summaries were rendered in dense text columns with no clear
  hierarchy.
- `/browse` had no visible page heading; profile/community sections had no
  section heading.
- The toolbar exposed raw API fields (`method`, `observer`, `start_author`, …).
- “Load more” replaced the current page instead of appending.
- Post cards had no consistent author/time/community/tag/payout structure.
- Table view was functional but visually raw.

## Listing chrome

`src/pages/browse.vue`:

- Visible page heading and subtitle for global, account, community and tag
  contexts.
- Global sort navigation as link chips: Trending, New, Hot, Promoted, Top
  payout, Top comments and Muted.
- Active sort state and tag context with a clear-tag action.
- Sort links preserve the selected layout (`?style=cards|list|table`).
- One `h1` on every page: visible on global pages, account name on profiles,
  sr-only on community pages.
- Profile listing pages use a compact account header (avatar, name and section
  nav only), so the posts start close to the top of the viewport. The full
  profile header is unchanged on the profile page.

## Browse container

`src/components/browseContainer.vue` was rebuilt:

- Clean toolbar: result count, hidden-by-filter count, refresh, filters and
  Cards/List/Table layout control.
- Cards view uses a responsive CSS grid (no masonry).
- List view uses a fixed thumbnail column and horizontal content.
- Table view remains available for power users.
- Filters popover replaces the old raw API controls: hide voted/reblogs/pinned,
  muted/moderated content and reward range.
- Muted/moderated posts are hidden by default; the toolbar explains how many
  posts were hidden by filters.
- “Load more posts” now appends to the existing list, deduplicates and tracks
  whether another page exists.
- Full loading skeletons, empty states with reset/load-more/refresh actions,
  error states and an end-of-results marker.
- Layout choice is kept in the URL (`?style=...`) and old style values are
  aliased (`preview`/`media` → cards, `full` → list).

## Post preview card

`src/components/postPreview.vue` was rebuilt:

- Cover image with 16:9 crop, hover zoom, community overlay and a graceful
  placeholder when a post has no image.
- Author row with avatar, `@name`, reputation, relative time and community.
- Pinned and comment badges; replies also show who they reply to.
- Two-line title, three-line summary, tag chips and a clear Read/View action.
- Footer stats for votes, comments, payout and reblogs.
- Feed entries show a “Reblogged by @user” strip.
- List layout uses a fixed 178×150 thumbnail and horizontal body.
- Cards are keyboard-friendly, use unique heading ids and keep one `h3` per
  preview.

## Table view

`src/components/browseTable.vue` was polished:

- Compact table header with column selector and CSV export.
- Useful default columns: Author, Title, Created, Comments, Pending Payout.
- Clickable post titles and expandable rows (row contents render on demand).
- Safe handling of missing `json_metadata`, `stats` and payout values.

## Helpers and tests

`src/services/posts.js` adds pure helpers for:

- metadata parsing, display titles, comment detection, tags, community titles,
  payout values/labels, votes, comment counts, rebloggers and reputation
  formatting (bridge display values and condenser raw values).

Covered by `tests/unit/posts.spec.js`.

## Verification

- `bun run lint` clean.
- `bun run test` — 16 files / 121 tests passing.
- `bun run build` succeeds.
- Playwright at 1440px and 390px across `/browse`, `/trending/hive`,
  community, posts, feed, replies and table views: no overflow, one `h1`, no
  console errors.
- Verified layout switching, URL state, sort links, filters/reset, load-more
  appending (20 → 40), empty tag state and table row expansion.
- Axe WCAG A/AA: zero violations on all tested browse/profile/list/table pages
  at desktop and mobile.

## Files

- `src/pages/browse.vue` — page/section headings, sort navigation and context.
- `src/components/browseContainer.vue` — toolbar, layouts, filters and paging.
- `src/components/postPreview.vue` — new card/list preview component.
- `src/components/browseTable.vue` — polished table view.
- `src/components/accountHeader.vue` — compact mode for profile listings.
- `src/services/posts.js` — post preview helpers.
- `tests/unit/posts.spec.js` — helper tests.
