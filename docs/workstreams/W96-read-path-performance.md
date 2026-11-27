# W96 — Read-path performance follow-ups

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A performance audit of the cached read layer and the main reading routes found
eight places where the app still did avoidable work. This workstream fixes the
ones that can be verified without changing signing or server behaviour:

1. **Account page loaded twice per switch.** The old `username` and `$route`
   watchers both called `init()`, and `init()` assigned `username` again. A
   single account view issued two forced account reads, two marker reads and two
   history pages. The page now watches the username param and the query
   separately and fetches the account through the shared cache.
2. **The marker read fetched 1,000 rows to read one index.** Filtered history
   now asks `get_account_history` for one row; the rendered page still uses the
   existing 50-row request. Pagination buttons now push the query and let the
   watcher load, instead of assigning a promise to `page`.
3. **Inbound delegation checks read each delegator's whole list.** A busy
   delegator can have 1,000 outgoing rows. `get_vesting_delegations` accepts a
   delegatee cursor, so the verifier now asks for five rows at
   `(delegator, account)` and keeps the exact match. The number of delegators
   checked is unchanged.
4. **Every dashboard widget asked CoinGecko for prices.** `getHivePrices()` had
   a post-response cache but no in-flight dedupe, so widgets mounting together
   produced several identical requests and shared the public rate limit. The
   promise is now shared, with `resetHivePricesCache()` for tests.
5. **`/trail` hydrated each vote with an uncached full post read.** It now uses
   the shared `fetchPostContent` cache, caps hydration at ten posts, skips
   duplicates already shown and guards unmount.
6. **Search fetched the same tag feed three times.** The analytics, posts and
   tag groups all used `bridge.get_ranked_posts` with a tag but different plan
   objects, so the cache keys differed. Tag reads now share one canonical key.
   `listProposals()` is cached for 60 seconds as well.
7. **Wallet downloaded 250 Hive-Engine transactions for a collapsed section.**
   The transaction list now loads on first expand and shows a loading/empty
   state. The balances, token metadata and market reads are unchanged.
8. **Post navigation could render a stale article.** `post.vue` now uses the
   shared post cache and a request token; an older `get_content` response can no
   longer replace the newer post or fan out its follows, community, similar and
   Vault reads.

## Components

| Area | Files |
| --- | --- |
| Account activity | `src/pages/account.vue` |
| Delegation verification | `src/services/delegations.js` |
| Prices | `src/services/prices.js` |
| Trail carousel | `src/components/recentVotedPostsCarousel.vue` |
| Search feeds | `src/services/chainData.js`, `src/services/proposals.js` |
| Wallet Hive-Engine section | `src/components/wallet/HiveEngineTokens.vue` |
| Post page | `src/pages/post.vue` |
| Tests | `tests/unit/delegations-inbound.spec.js`, `tests/unit/prices.spec.js`, `tests/unit/recent-voted-carousel.spec.js` |

## Authority and privacy

- No authority, signing or queue change.
- Fewer public reads and fewer third-party requests.
- The history and post caches remain local; no new storage key or server call.

## Verification

- `bun run lint` — clean.
- `bun run test` — **231 files / 2,228 tests** passing.
- `bun run build` — succeeded.
- Targeted unit suites: delegation cursor, prices in-flight, carousel retry and
  the existing search/proposal suites.

## Remaining

- `loadCached` still has no `AbortSignal` plumbing. Navigating away leaves a
  large history or post read running even though the result is no longer
  rendered. Sharing an in-flight promise makes cancellation non-trivial; a
  future change should only abort requests the caller owns.
- The unified search still fires one analytics tag read plus the keyword feed on
  a fresh query; the shared tag cache removes the duplicate repeats within a
  single run, not the first request.
- The wallet still reads all Hive-Engine balances and token metadata on every
  visit; a route-level TTL would reduce repeat navigation cost.
