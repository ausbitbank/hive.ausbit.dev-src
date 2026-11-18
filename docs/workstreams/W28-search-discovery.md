# W28 — Unified search and discovery

Date: 2026-11-18
Status: complete

## Scope

Search was split between the command palette (`src/services/search.js`) and
per-page lookups. W28 adds one search surface and one results model:

- `/search` with `q`, typed result tabs, facets and a shareable URL.
- Accounts, posts, tags, communities, blocks, transactions, proposals and
  witnesses in a single grouped result set.
- Typed input handling (accounts, tags, blocks, transactions, proposals, post
  URLs) with the existing direct-route parser preserved.
- Topic analytics for tag/community searches and author facets for accounts.
- Saved searches on this device, with JSON export/import.
- Keyboard-first navigation and a command-palette hand-off.

## Server capability check

The public Hivemind nodes used by the app expose `bridge.list_communities`,
`bridge.get_ranked_posts` and `bridge.get_account_posts`, but **not**
`bridge.search_accounts` or `bridge.search_ranked_posts` (every configured node
returned `unknown method` for both; `list_communities` also requires
`query: null`, not `""`, to return results). The search stack therefore uses:

- `condenser_api.lookup_accounts` for account prefix lookup, enriched with
  `condenser_api.get_accounts`.
- `bridge.list_communities` for community search.
- `bridge.get_ranked_posts` with tag/community paging for topic searches, and a
  combined trending/newest/hot feed ranked locally for keyword searches.

This keeps every read inside the central `api.js` client (timeouts, retries,
failover and telemetry) and inside the cached read layer.

## Query model

`src/services/unifiedSearch.js` (pure, unit tested):

- `parseSearchState` / `normalizeSearchState` / `searchToQuery` — one state
  shape for type, sort, period, tag/community/author facets, order, window,
  style and page. Invalid values fall back rather than throwing.
- `searchUrl` — shareable `/search?q=…&type=…` links.
- `buildSearchPlan` — turns a query into lookups (account, tag, block,
  transaction, proposal, post) using the existing `parseSearchRoute`.
- `scorePost`, `rankPosts`, `filterByPeriod`, `filterByFacets` — relevance
  ranking (exact tag, community, author, title, body) with stable tie-breaks and
  chronological sorting.
- `rankAccounts`, `tagFacets`, `rankCommunities`, `rankWitnesses`,
  `rankProposals`, `exploreFacets`.
- `tagAnalytics` — posts/day, active days, cadence, median/average/total payout,
  top-decile reward share, top authors and related tags.

`src/services/chainData.js` adds cached reads with budgets and in-flight
de-duplication: `fetchAccountNameSearch`, `fetchCommunitySearch`,
`fetchPostSearch`, `fetchBlockHeader`, plus `invalidateSearchCache`.

`src/services/searchReads.js` orchestrates the reads, tolerates a failing group
(partial results with a per-group error notice) and builds author facets and
topic analytics.

## Surface

`src/pages/search.vue`:

- Search field with a clearable value and an explicit run button.
- Typed tabs: All, Accounts, Posts, Tags, Communities, Blocks, Transactions,
  Proposals, Witnesses, each with a result count.
- Grouped result panels (`src/components/search/ResultList.vue`) using real
  buttons for keyboard and screen-reader access.
- Sort (relevance/trending/newest/hot) and posting window (all/day/week/month).
- Facet chips for tags and communities, plus active-filter removal for tag,
  community and author filters.
- Topic analytics card (cadence sparkline, stats, top authors, related tags) with
  author filtering.
- Saved searches list with save/remove, export and import.
- Empty state with example searches and query tips.
- Keyboard shortcuts: `/` or `Ctrl K` focuses search, `↑/↓` move, `Enter` opens,
  `Esc` clears focus/query.

## Entry points

- Header search button opens `/search` (desktop quick-jump stays on `Ctrl K`).
- Drawer links: **Search Hive** and **Quick jump**.
- `f` opens the full search page from anywhere (ignored while typing).
- Command palette: new **Search Hive** command and a `Search for “…”` action
  that opens the full results page (also `Ctrl+Enter`). On `/search`, `Ctrl K`
  focuses the page search instead of stacking the palette.
- Command palette Escape now closes the dialog without clearing the page query.

## Analytics and discovery

- Tag and community searches show posting cadence, reward distribution, top
  authors and related tags.
- Account searches show facets from the author's own posts.
- **Chronological results stay first-class**: they are a sort value
  (`Newest`), never hidden behind recommendations.

## Saved searches

`src/services/savedSearches.js`: versioned local records
(`/search`-scoped URLs only), newest-first de-duplication, 30-entry cap,
tolerant storage reads, and a JSON envelope for export/import.

## Verification

- `bun run lint` — clean.
- `bun run test` — 52 files / 391 tests.
- `bun run build` — succeeds; `search` route chunk 32.4 KB raw / 10.1 KB gzip.
- `bun run test:e2e` — 23 tests: 22 passed, 1 Chromium-only skip.
- `bun run test:e2e:full` — 50 Playwright tests passing, including axe at
  1440px and 390px for `/search`, the search mobile/desktop layout check and
  four search flows (grouped results, shared URL filters, saved-search
  persistence, palette deep link).
- `bun run perf` / `bun run perf:check` — search added to the dashboard:
  LCP 344 ms, route JS 92.7 KB, total 643.1 KB; all budgets pass.
- Live smoke: `/search` 200 on production, 31 results for “photography” across
  2 groups, no console errors, no mobile overflow.

## Files

- `src/pages/search.vue`, `src/components/search/ResultList.vue`.
- `src/services/unifiedSearch.js`, `src/services/searchReads.js`,
  `src/services/savedSearches.js`.
- `src/services/api.js` (lookup/community/ranked/block reads),
  `src/services/chainData.js` (cached search reads).
- `src/router/routes.js`, `src/layouts/MainLayout.vue`,
  `src/components/CommandPalette.vue`, `src/components/ui/KeyboardShortcuts.vue`.
- `tests/unit/unified-search.spec.js`, `tests/unit/saved-searches.spec.js`.
- `e2e/search.spec.js`, `e2e/a11y.spec.js`, `e2e/polish.spec.js`.
- `scripts/perf-baseline.mjs`, `scripts/prerender.mjs`,
  `docs/performance/budgets.json`, `deploy/nginx/hive.ausbit.dev.conf`.

## Notes and limits

- Keyword search ranks the union of the newest trending/newest/hot feeds. It is
  fast and resilient but not a full-text index: a very rare word may not appear
  in those 60 posts. Tag, community and account searches are exhaustive for the
  most recent pages.
- `lookup_accounts` is a prefix lookup. Names whose first characters are not the
  search term (e.g. "ausbitbank" for "bitbank") only match through the exact
  account fallback.
- Saved searches are local to one browser profile and are not synced.
- Rendered result bodies are not indexed; matching uses title, body, tags,
  community, author and category from the ranked feed response.

## Deployment and live smoke

- `./scripts/deploy.sh` completed on 2026-11-18.
  - Build backup:
    `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261118T095431Z.tar.gz`.
  - Prerendered `/search` metadata shell installed.
- The canonical nginx config now serves `/search` (and its query variants) from
  the SPA shell with a real 200 instead of the 404 fallback. The production
  config was backed up, validated with `nginx -t` and reloaded.
- Live checks:
  - `GET /search` and `GET /search?q=hive` → 200, `text/html`.
  - Production Playwright smoke: `search?q=photography` rendered 2 groups and 31
    results with the “31 results for “photography”” status, and
    `search?q=ausbitbank` rendered results with no console or page errors. No
    horizontal overflow at 390px.

## Review notes

- Fixed during the workstream: the search page crashed when the Quasar
  `clearable` input emitted `null` on clear (replaced with an explicit clear
  button and a null-safe `canSave`).
- Fixed during the workstream: the search page's breadcrumb query watcher
  re-hydrated on every programmatic navigation and dropped filter-triggered
  events; the page now owns its state and only re-hydrates on route changes.
- Command palette Escape now closes the dialog without clearing the underlying
  search query, and `Ctrl K` on `/search` focuses the page search rather than
  stacking the palette.
