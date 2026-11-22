# W62 — Public community browser

Date: 2026-11-22
Status: implemented, deployed and verified

## Scope

The account-scoped `/@:username/communities` view only covers communities an
account already follows. Newcomers had no way to see what Hive communities
exist before signing in or subscribing. W62 adds a public directory:

- `/communities` is the canonical page, with the short `/c` alias redirected to
  it in both the client router and nginx.
- Anyone can search all communities by title and description, browse curated
  category searches, compare subscribers and active authors, sort by trending,
  subscribers, active authors or newest, and hide NSFW communities.
- The directory pages through `bridge.list_communities` with infinite scroll
  and shows clear loading, empty, error and end-of-list states.
- The search term and sort are carried in the URL, so a directory view can be
  shared or bookmarked.

## Data layer

`src/services/communityDirectory.js`

- `buildDirectoryCard` normalises a bridge record into the existing
  `CommunityCard` shape: cleaned title/description, subscribers, active authors,
  pending rewards, community type (Topic/Journal/Council), NSFW flag and
  canonical `/c/<name>/trending` link.
- `buildDirectoryCards` de-duplicates names and keeps server order.
- `sortDirectoryCards` implements local sorting for subscribers, active authors
  and creation time; rank leaves the server order untouched.
- `summarizeDirectory` totals loaded communities, subscribers, active authors,
  pending rewards and NSFW rows.
- `COMMUNITY_CATEGORIES` is a curated set of title/description searches, because
  Hivemind has no fixed category taxonomy. `COMMUNITY_SORTS` holds the four
  directory sorts.
- `isHiveCommunityName` recognises an exact `hive-123456` lookup.

`src/services/chainData.js`

- `fetchCommunityDirectoryPage({ sort, query, last, limit })` wraps
  `bridge.list_communities`. Only the three Hivemind sorts (`rank`, `new`,
  `subs`) reach the node; pages are cached for five minutes and force-refresh
  supported.
- Exact `hive-123456` searches use the existing cached `fetchCommunity` read
  instead of the title/about query, so pasting a community name always works.

`src/services/community.js`

- `cleanText` is exported as `cleanCommunityText` so the directory and the
  account view share one Markdown/HTML cleaner.

## Page and navigation

`src/pages/communityIndex.vue`

- One page-level `h1`; filters are semantic button groups with `aria-pressed`.
- Reuses `CommunityCard` and `ui/InfiniteScroll`.
- Search is debounced, resets paging and guards late responses with a request
  token. The route query (`?q=`, `?sort=`) is the source of truth, including
  back/forward navigation.
- Exact-name searches merge a cached `get_community` record with the server page.
- Stats describe only the loaded slice, with copy that says so.
- NSFW rows are hidden client-side without removing them from paging.
- `setPageMeta` publishes a `CollectionPage` with an `ItemList` of the first ten
  loaded communities.

Supporting changes:

- `CommunityCard` can render a neutral community-type badge (`Topic`, `Journal`,
  `Council`); the account view is unchanged when `typeLabel` is absent.
- `MainLayout` adds **Communities** to the explore drawer and footer.
- `CommandPalette` adds a **Communities** jump target.
- The account communities page always links to **Discover communities**, and
  its empty state offers discovery before the generic post feed.
- `scripts/lib/prerender-meta.mjs` prerenders `/communities`.
- nginx serves the prerendered `/communities.html`, redirects `/c` and keeps
  `/c/<community>` unchanged.
- `bun run icons:subset` added the `nature`, `sports` and `topic` ligatures that
  the new category/type strings reference.

## Verification

- `bun run lint` — clean.
- `bun run test` — 115 files, 977 tests passing. New coverage:
  - record normalisation, de-duplication, Markdown cleanup and truncation;
  - subscriber/active/newest sorting and rank order preservation;
  - category lookup, exact community names and summary totals;
  - directory paging arguments, sort fallback, response filtering and caching.
- `bun run build` — succeeded. The new `communityIndex` route chunk is 16.13 KB
  (5.25 KB gzipped) plus 5.17 KB of CSS, and the shared `CommunityCard` chunk is
  unchanged apart from the optional type badge.
- Fast E2E — the new `/c` → `/communities` flow passed: the directory renders,
  the search field filters to photography, and the Gaming category replaces it.
  It also passed inside the full one-worker fast run. The account-scoped
  `/c/<name>` route still loads.
- Axe — `/communities` is clean at 1440px and 390px in Chromium.
- Full Obscura fast suite at one worker: 71 passed, 6 skipped, 9 failed. The nine
  failures are pre-existing/unrelated: compose image-count timing, the community
  About tab visibility in Obscura, connection counts, two dashboard editor
  timing tests, three infinite-scroll timing tests and a POS invoice assertion.
  The community About-tab case passes in Chromium, and the directory test passes
  in both runners. A four-worker attempt also lost the shared Obscura process
  (`ECONNREFUSED 127.0.0.1:9222`) after 25 tests while another worktree was using
  the same browser/port; that attempt is treated as runner contention.

## Notes and follow-ups

- Hivemind does not expose a fixed category taxonomy. Category chips are
  curated title/description searches and the UI says so.
- Active-author sorting is a local sort over the pages loaded so far; the page
  tells the reader that loading more widens the sample.
- Long-tail communities still invisible to `list_communities` remain a Hivemind
  limitation, as noted in W29.

## Post-deploy fix

Quasar's clearable `q-input` emits `update:modelValue(null)` when the clear icon
is clicked. The page called `.trim()` on that value during render, which crashed
the component. Search state now goes through a null-safe `searchText` computed,
and `@clear` resets the query, URL and paging immediately. A regression test
covers both the cleared model and `clearSearch()`.

## Deployment

- SPA deployed from commit `ca5d29f` with `scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261122T090835Z.tar.gz`.
- Clear-field fix deployed from commit `a4e62c7`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261122T092239Z.tar.gz`.
  Live smoke: fill `photography`, click the clear icon, and the input returns to
  empty with 36 cards, no error boundary and no page errors.
- The live nginx file is root-managed and had diverged from the repo. Only the
  two W62 hunks were applied to the live file (the `/c` redirect and
  `communities` in the prerendered-static-pages regex), rather than replacing
  root-managed configuration wholesale.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev.nginx.20261122T091256Z`.
  `nginx -t` passed and nginx was reloaded.
- Live smoke:
  - `/c` returns a 301 to `/communities`;
  - `/communities` returns 200 with the directory title and metadata;
  - the directory shows cards from the live Hive node;
  - searching `photography` and selecting `Gaming` each render 36 community
    cards;
  - `/c/hive-174578` still returns 200 and renders the OCD community page;
  - no page errors in the browser console.
