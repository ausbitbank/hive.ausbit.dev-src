# W32 — HiveSense semantic search

Date: 2026-11-19
Status: complete

## What HiveSense is

[HiveSense](https://tools.openhive.network/hivesense) is a public semantic
(vector) search index for Hive posts, served as a REST API under
`<node>/hivesense-api/`. It is not a JSON-RPC plugin: calling
`hivesense_api.*` over JSON-RPC returns "Could not find API". The beacon
monitor's `hivesense_api` feature flag means the node reverse-proxies the REST
service.

Endpoints used (CORS-open, no auth):

| Endpoint | Purpose |
| --- | --- |
| `GET /posts/search?q=…&limit=…` | Semantic post search (relevance order, no score) |
| `GET /posts/{author}/{permlink}/similar?limit=…` | Nearest-neighbour posts |
| `GET /authors/search?topic=…&limit=…` | Accounts ranked by topic specialisation |

Notes discovered while probing:

- `limit` is capped at 100 regardless of the value sent.
- Large limits pad the tail with **sparse rows** that carry only
  `author`/`permlink` (no title, body or created date). These are filtered.
- `techcoderx.com` returns 503 and `api.deathwing.me` returns 404 for the
  service, even though both are healthy API nodes.

## Node selection

`src/services/hiveSense.js` derives host candidates from the beacon feature map
(`hivesense_api`), ordered by reliability score, then falls back to a static
list (`HIVESENSE_HOSTS`). Hosts are cached for the session. Each request tries
hosts in order until one answers, so a single bad node never blocks search.

## Search integration (`/search`)

- New `smart` flag in search state (`unifiedSearch.js`), on by default and
  persisted as `?smart=0` when disabled, so shared links keep the setting.
- For free-text keyword queries, `runUnifiedSearch` fetches semantic posts and
  merges them into the Posts group via `mergeSemanticPosts`: HiveSense order
  first (tagged `semantic: true`), then unseen local keyword results. Facet and
  posting-window filters still apply to both.
- The Posts group shows a **Semantic** badge and semantic rows use a sparkle
  icon.
- A **Smart search** toggle in the search sidebar turns it off; it degrades
  silently to local ranking if no host answers.
- Recommended authors from `/authors/search` appear in an "Authors who write
  about this" panel for keyword and tag searches.

### Pre-existing bug fixed

`buildSearchPlan` used to set `tags`/`communities` to the entire free-text
query, so a phrase like "landing on the moon" was passed as a `tag` to
`bridge.get_ranked_posts`, which rejects multi-word tags. Phrase queries now
search posts only and the tag facets derive from the returned posts.

## Similar posts (`/@author/permlink`)

`src/pages/post.vue` loads up to six similar posts after the post resolves and
renders them in a "Similar posts" panel. Empty titles fall back to a body
excerpt, then "Untitled post".

## Services

| File | Responsibility |
| --- | --- |
| `src/services/hiveSense.js` | REST client, host selection, normalisation, session host cache |
| `src/services/chainData.js` | Cached `fetchHiveSenseSearch`, `fetchHiveSenseSimilar`, `fetchHiveSenseAuthors` |
| `src/services/unifiedSearch.js` | `smart` state flag, `mergeSemanticPosts` |
| `src/services/searchReads.js` | Semantic merge into posts, author recommendations, plan fix |

## Verification

- `bun run lint` — clean.
- `bun run test` — 57 files / 471 tests passing, including `tests/unit/hive-sense.spec.js`.
- `bun run build` — succeeded.
- Headless Chromium against the live HiveSense API:
  - "landing on the moon" returns semantic posts first (moon-landing content),
    no sparse "Untitled post" rows, no group errors;
  - the Smart toggle writes `smart=0` and removes semantic results;
  - author recommendations render;
  - similar posts render on a real post page;
  - zero axe WCAG A/AA violations and zero horizontal overflow at 1440px on
    both the search page and a post page.
