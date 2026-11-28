# W102 — Search facets, account results and settings validation

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A search/settings audit found that search could show unrelated posts for an
account query, computed facets that were never rendered, reported an empty
result while requests had failed, and silently ignored the `page` it wrote to
the URL. Settings also accepted arbitrary API-node strings.

## Fixes

1. **Account search uses that account's posts.** `runUnifiedSearch()` reuses one
   `fetchAuthorContext()` read for both the Posts group and the author facets.
   An `@account` or author-filtered search no longer renders global posts that
   merely mention the name, and it no longer starts a redundant three-feed
   keyword search.
2. **Facets are real.** `runUnifiedSearch()` now returns
   `facets: { tags, communities }` built by `exploreFacets()` from the posts it
   actually read; author facets are assigned from the author read. The “Narrow
   down” panel can appear before a filter is selected.
3. **Status follows the submitted query.** The start panel and the status line
   use `submittedQuery`, not the live input. “No results” is only shown when at
   least one group loaded and every group is empty; per-group failures get their
   own message.
4. **Total count is honest.** The status counts the full result sets instead of
   only the rows currently rendered by “Show more”.
5. **`?page=` is applied.** A shared `/search?...&page=2` renders two pages of
   posts, “Show more” writes the page back to the URL, and changing a facet
   resets the page to 1.
6. **API nodes are validated.** Settings rejects a node that is not a valid
   `http(s)://` URL (including typos without a scheme) and leaves the previous
   value and dialog in place instead of persisting a broken endpoint.

## Components

| Area | Files |
| --- | --- |
| Search orchestration | `src/services/searchReads.js` |
| Search page | `src/pages/search.vue` |
| Settings | `src/components/settings.vue` |
| Tests | `tests/unit/search-reads.spec.js`, `e2e/search.spec.js` |

## Authority and privacy

- No signing/authority change.
- Search remains a read-only live view; no new storage or analytics.
- Node settings remain local and are only applied after URL validation.

## Verification

- `bun run lint` — clean.
- `bun run test` — **235 files / 2,277 tests** passing.
- `bun run build` — succeeded.
- Targeted Playwright `e2e/search.spec.js` plus the dashboard/core/action smoke.

## Remaining

- Search still reads one tag feed plus the first page of proposals per fresh
  query; the W96 shared cache removes duplicate reads within a run.
- Facet rows are capped by `exploreFacets()` (eight each) by design.
- Saved searches keep the page in their serialized state; reopening a saved
  search at page 1 is the normal path.
