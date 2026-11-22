# W64 — Community search and discovery

Date: 2026-11-22
Status: implemented and deployed

## Scope

W62 shipped a public directory, but search felt limited: the UI showed only the
first 36 communities and did not make it clear that every Hive community was
being searched. W64 improves both jobs:

- search runs against the whole community set, with relevance ranking and an
  explicit way to fetch more matches;
- partial `hive-123` community names are searchable;
- the empty-search view gets real discovery shelves instead of only a ranked
  list.

## Search

`src/services/communityDirectory.js`

- `rankDirectoryCards(cards, query)` scores community names, exact titles,
  title prefixes, title words and descriptions, then falls back to subscribers
  and active authors. This makes title hits lead over description-only hits,
  which Hivemind's `rank` ordering cannot express.
- `sortDirectoryCards` accepts a query and supports a `relevance` sort.
- `COMMUNITY_SORTS` gains `Relevance`, shown only while a search is active.

`src/services/chainData.js`

- `fetchCommunityNameMatches(prefix, limit)` handles partial community ids.
  `bridge.list_communities` only searches titles/descriptions, so a prefix such
  as `hive-1745` is resolved through `condenser_api.lookup_accounts`, filtered
  to `hive-*` accounts, then filled in with cached `get_community` reads.
- Existing `fetchCommunityDirectoryPage` paging is reused and cached.

`src/pages/communityIndex.vue`

- Search pages request 100 communities per call (Hivemind's maximum) instead of
  36. Browse pages stay at 36.
- Search defaults to relevance unless the reader has explicitly chosen another
  sort. Choosing a sort is preserved while refining the query.
- The heading says “Searching all Hive communities for …” and the result count
  is described as matches, not as the loaded directory.
- A visible **Load more matches** button sits beside the heading, so the limit
  is not hidden behind infinite scroll.
- Exact and partial `hive-*` lookups are merged ahead of title/about results and
  de-duplicated by `buildDirectoryCards`.

## Discovery

- When no search is active, the page loads three cached highlight sets:
  - **New communities** (`sort=new`);
  - **Active right now** (top-ranked sample sorted by active authors);
  - **Largest communities** (`sort=subs`).
- `src/components/community/CommunityMiniCard.vue` renders compact avatar,
  title, subscriber and active-author metadata in horizontally scrollable
  shelves.
- The shelves de-duplicate across sections and respect the NSFW filter.
- Each shelf has a **See all** action that switches the directory to the
  matching sort.
- Search hides the shelves so results stay focused; clearing the search brings
  them back.

## Verification

- `bun run lint` — clean in the isolated commit tree.
- `bun run test` — 117 files, 983 tests passing. New coverage:
  - title/name relevance ordering and the `relevance` sort;
  - partial `hive-*` lookup, malformed account filtering, failed record
    resolution and cache reuse.
- `bun run build` — succeeded. The directory chunk is 21.81 KB JS (6.77 KB
  gzipped) and 7.21 KB CSS.
- Local browser smoke:
  - three discovery shelves render (New communities, Active right now, Largest
    communities);
  - searching `art` loads 100 matches and **Load more matches** grows the list;
  - searching `hive-174578` returns OCD as the first card;
  - clearing the field restores the shelves, with no page errors.
- Axe: zero WCAG A/AA violations at 1440px and 390px, zero horizontal overflow.

## Deployment

- SPA deployed from commit `9ef919d` with `scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261122T104725Z.tar.gz`.
- Live smoke:
  - New communities, Active right now and Largest communities shelves render;
  - searching `art` loads 100 matches and **Load more matches** grows the list
    to 135;
  - the first relevance result is the community titled “Art”;
  - searching `hive-174578` returns OCD as the only match;
  - clearing the search restores the shelves and the 36-item directory;
  - no page errors in the browser console.

## Notes and limits

- Hivemind exposes no total count for `list_communities`, so the UI reports
  loaded matches and exposes paging instead of a fake total.
- `list_communities` still only matches title and description. Partial name
  lookup is a separate path, and category chips remain curated title/about
  searches.
- Active-author shelves use the top-ranked sample (100 communities), not an
  exhaustive activity scan.
- Highlight requests are cached for five minutes and run in parallel with the
  directory's first page.
