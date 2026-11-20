# W41 — HiveSense API contract and search classification

Date: 2026-11-20
Status: implemented and verified against the live API

## Why

The "Similar posts" panel on a post page worked, but free-text searches on
`/search` rarely produced useful posts. Probing the deployed service showed
three independent bugs:

1. The client sent the wrong query parameters, so the API ignored them.
2. Single-word queries were classified as account lookups, which skipped posts,
   tags and semantic search entirely.
3. Period filters were applied only after fetching, so recent-window searches
   discarded every semantic result.

A fourth issue made the fallback noisy: common words such as "on" and "the"
counted as query matches, so unrelated popular posts padded semantic results.

## The real API contract

The deployed service is PostgREST. Its OpenAPI document is served from
`<node>/hivesense-api/` and is the source of truth. The marketing/docs page's
`limit` parameter is stale and is silently ignored by the deployed service.

| Endpoint | Parameters that matter |
| --- | --- |
| `GET /posts/search` | `q` (text), `result_limit` (total rows, 1–1000), `full_posts` (hydrated rows, 0–50), `truncate` (body chars, 0 = full), `observer`, `author`, `from-block`, `to-block` |
| `GET /posts/{author}/{permlink}/similar` | `result_limit`, `full_posts`, `truncate`, `observer` |
| `GET /authors/search` | `topic`, `result_limit` (1–100) |

Key consequences:

- `result_limit` is the total number of rows (full posts plus stubs).
- Only the first `full_posts` rows are full bridge-post objects. Every remaining
  row is a stub with just `author` and `permlink`.
- The default is 100 rows / 10 full posts. Sending `limit=60` returns exactly
  that default, not 60 results — which is why search was topped out at ten
  semantic posts and then padded with unrelated keyword results.
- `truncate=0` returns whole bodies. A 50-post search response is roughly
  417 KB; `truncate=400` brings the same request to roughly 100 KB.

## What changed

- `src/services/hiveSense.js` now sends `result_limit` and `full_posts` (and
  optional `truncate`, `observer`, `author`, `from-block`, `to-block`). `limit`
  is translated into both, with `full_posts` clamped to 50. Author search uses
  `result_limit`.
- `src/services/chainData.js` passes `truncate=400` for search and similar
  results. The search UI never renders a body, and the similar panel only needs
  a short excerpt, so whole bodies were wasted bandwidth. Cache keys include the
  new options.
- `src/services/unifiedSearch.js`: `buildSearchPlan` no longer accepts a bare
  word as an explicit account. `parseSearchRoute('photography')` still reports an
  account (the command palette relies on that), but a search-box query only
  treats an account as explicit when it starts with `@` or is a URL. Bare words
  fall through to the keyword branch, which still includes an account lookup and
  now also enables posts, tag facets and semantic search.
- `src/services/searchReads.js` maps the `period` filter to HiveSense's
  `from-block` timestamp (`periodStartTimestamp` in `unifiedSearch.js`). Without
  it, the API ranked the whole index, then the client filtered the old results
  away, so "Past week" searches returned no semantic posts at all. The
  client-side period filter still runs for exactness.
- `src/services/unifiedSearch.js`: the relevance tokenizer drops stopwords and
  single-character tokens. Previously a query like "landing on the moon" matched
  almost every post through "on"/"the", so the keyword-padding guard let
  unrelated popular posts into the results whenever semantic results were short.
- The Posts group now fetches up to 50 hydrated results and starts with 20,
  with a **Show more** control that reveals 20 at a time. `full_posts` is capped
  at 50 per request, so going deeper needs `/posts/by-ids-query` hydration.
- `src/components/CommandPalette.vue`: `resolveJumpResults` now mirrors the
  search-page classification. A bare word offers tag destinations and only
  reveals an account jump after the async check confirms that account exists;
  explicit `@name`, `#tag`, URLs and chain identifiers keep their direct jumps.

## Verification

- `bun run lint` — clean.
- `bun run test` — 79 files / 760 tests passing.
- Live `runUnifiedSearch` checks:
  - `photography`, `bitcoin`, `hive` now report `kind: keyword` and return 50
    semantic rows (the API's full hydration cap).
  - `landing on the moon`, `hive development` return 50 semantic rows with no
    keyword padding.
  - `period: 'week'` for `hive development` returns recent, on-topic posts
    instead of an empty semantic set.
  - author recommendations still resolve.
- Direct API checks: `result_limit=20&full_posts=20` returns 20 full rows;
  `limit=20` returns the 100-row / 10-full default.

## Notes / follow-ups

- Queries longer than 50 results need `/posts/by-ids-query` to hydrate the
  remaining stubs. The current UI caps at 20 rows, so that is not needed yet.
- `observer` is supported by the client but the search page does not pass the
  signed-in account yet, so mute lists are not applied to semantic results.
