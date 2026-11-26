# W80 — Post quick look and feed position restoration

Status: implemented in this workstream. Related issue: #110.

## Problem

Browse feeds (`/created`, `/trending`, `/hot`, community and account feeds) render
small preview cards. Those cards show a vote total but cannot vote or inspect
the vote list. Opening the full post to do either also loses the reader's place:
the router always scrolled to the top, the page was remounted on every route
change, and only the first page of an infinite feed survived the remount.

## Scope

- Add a **Quick look** eye control to every `postPreview` card, immediately
  before the vote indicator.
- Add a single quick-look overlay hosted by `MainLayout`:
  - content-only reading sheet (no author sidebar, similar posts or comment
    tree);
  - vote control, vote breakdown, comment count link and "Open full post";
  - right-side non-modal sheet on desktop, full-screen sheet on mobile;
  - instant paint from the card seed, hydrated with a full post read;
  - optimistic vote state shared back to the source card.
- Make the open peek part of the URL as `?peek=@author/permlink` on the current
  route. The path does not change, so the feed is not remounted. Back closes the
  peek.
- Restore feed position when the reader does leave:
  - `scrollBehavior` now uses `savedPosition` and returns `false` for query-only
    changes;
  - loaded feed pages are kept in a session-only per-feed cache so a remount has
    the full document height, not just the first snapshot page.

## Components and services

- `src/components/postPreview.vue`: eye control, optimistic vote indicator.
- `src/components/PostPeek.vue`: overlay, hydration, route/history sync, vote
  breakdown and actions.
- `src/services/postPeek.js`: singleton overlay state, route-key parsing and the
  short-lived optimistic vote map.
- `src/services/feedState.js`: bounded, TTL, session-only feed continuity cache.
- `src/services/chainData.js` / `src/services/api.js`: cached
  `condenser_api.get_content` read for the full body and full vote rows.
- `src/components/browseContainer.vue`: restore/save the in-memory feed.
- `src/router/index.js`: saved-position and same-path scroll behaviour.
- `src/layouts/MainLayout.vue`: mounts the single overlay host.

## Authority and privacy

Voting reuses the existing `vote.vue` control and posting-key queue. No authority
path changed and no action is auto-signed.

The `peek` query contains only the public author/permlink pair. Optimistic votes
stay in memory for ten minutes and are keyed by author/permlink; they are not
persisted or uploaded. The feed cache is session memory only and is capped at
twelve feeds.

## Verification

- `bun run lint` — clean (including the theme-token scan).
- `bun run test` — 1,518 tests across 176 files.
- `bun run build` — SPA build succeeded.
- `bunx playwright test --project=chromium` — 178 tests passed, including:
  open/close without scrolling, Back closes the peek, full-post Back restores
  scroll, `?peek=` deep link, vote updates the source card, vote breakdown, and
  the 390px full-screen sheet.
- `bun run test:e2e -- e2e/peek.spec.js` — 5 functional peek tests passed in
  the fast Obscura suite.
- Axe WCAG A/AA checks passed on the open peek at 1440px and 390px.

## Known limits

- The feed cache is in-memory and expires after five minutes. A hard reload still
  restores only the snapshot's first page.
- A queued vote is optimistic for up to ten minutes; if the transaction never
  confirms, a later refresh corrects the card from chain data.
- The peek intentionally omits comments, similar posts and the author/sidebar
  cards. Those remain a deliberate "Open full post" trip.
- Opening a post from inside the peek leaves the peek history entry behind, so
  Back from the full post returns to the peek rather than the bare feed.
