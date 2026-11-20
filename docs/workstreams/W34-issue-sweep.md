# W34 — GitHub issue sweep (issues #42–#72)

Date: 2026-11-20
Status: complete for the SPA surface; two metadata follow-ups remain deployment-only

## Scope

A systematic pass over every open issue from the 2026-11-19 QA audit. The work
was grouped into three passes: small bugs and cleanups, UX revamps, then larger
dashboard, search, performance and crawler work.

## Small fixes

- **#68** `/@user/replies` now says “Latest replies to @user from others.”
- **#67** `/tax` and every link to it were removed (page, route, menu, wallet
  links, prerender list, sitemap, nginx route).
- **#71** The obsolete BlockTrades and Upbit links were removed from `/hbd`.
- **#53** `relativeTime()` treats the Unix epoch as “never”, so witnesses with
  no feed show “No feed”/“never” instead of “57 years ago”.
- **#54** The communities page only renders empty-state copy after the request
  settles, and clearing the search box no longer crashes (`null` model value).
- **#57** The coin sparkline fills and shrinks with its flex slot instead of
  drifting left over the coin name.
- **#52** The account menu is narrower and the Keychain blurb moved into a
  tooltip on “Signed in with Hive Keychain”.
- **#44** Account tabs only mount Quasar’s arrows when the strip really
  overflows, removing the dead left arrow.
- **#42** Verified the existing wallet hash deep-linking (`#overview`,
  `#activity`, `#pending`, `#tokens`); no code change was needed.
- **#61** TradingView was blocked by the CSP. `s3.tradingview.com`,
  `s.tradingview.com` and `*.tradingview.com` were added to the policy.

## SEO and crawler fixes

- **#66** `/browse` permanently redirects to `/created` at the origin and in
  the router; it is gone from the sitemap and internal links. `/search` and
  not-found states are `noindex` and carry no canonical. The prerendered
  `search.html` and `404.html` shells carry the same signal without JavaScript.
- **#63** Account, post, block and transaction not-found states set robots
  `noindex` and remove the canonical. The 404 template no longer advertises
  `/404` as canonical.
- **#62** Prerendered routes and the SSI shell now contain a static `<h1>`,
  summary and internal nav inside the mount element. Vue replaces it on mount;
  crawlers see real content and links. Partial by design: the links are the
  explorer sections, not chain-specific neighbours.
- **#64** Fixed. Account/post SSI shells use the author avatar as `og:image`,
  and `deploy/cloudflare/metadata-worker.mjs` reads
  `bridge.get_post`/`bridge.get_profile` at the edge. It rewrites the title,
  description, cover image, canonical and JSON-LD, caches for five minutes and
  falls back to the origin on failure. Verified live: the `@gtg` post returns
  its real title and cover image with `x-hive-meta: hit`.

## UX revamps

- **#70** Followers/following have a new cached connection surface with search,
  sorting (name, HP, reputation, last activity), profile/activity filters and
  progressive loading.
- **#69** The account menu shows the estimated USD value of a 100% vote and the
  time to a full voting bar.
- **#51** The witnesses page has a jump nav for directory, analytics, voter
  segments and the calculator. Voter segments can resolve 250, 1,000, 2,500 or
  all returned voters (up to 5,000) with paginated vote reads.
- **#58** Reblogs can be removed after a confirmation. The Hivemind convention
  is `reblog` + `delete: "delete"`; the previous `unreblog` command was ignored
  by the indexer. Post pages and short-form cards now reflect chain state.
- **#59** The merged community feed can use the top 12, all communities or a
  chosen subset, and can hide pinned posts. The preference is stored per
  observer. The community filter now explains it only covers joined
  communities.
- **#60** Suspended video thumbnails have an explicit play badge, and 3Speak
  links use the Snapie player embed inside the site.
- **#45** Snaps and other container comments now go through Keychain
  `requestBroadcast` instead of `requestPost`, which added post-only
  `comment_options` and was rejected.

## Dashboard and data work

- **#49** Layouts export as a compact `HIVE-DASH-1.*` string (raw JSON also
  accepted) and import into another dashboard.
- **#46** The wallet widget supports USD/AUD/EUR/GBP, includes Hive-Engine
  tokens, and labels its account.
- **#56** New “Live operations” widget: per-account history, operation-family
  and `custom_json` id filters, configurable limit and polling, multiple
  instances.
- **#50** Optional masonry tiling for customised dashboards. Edit mode keeps the
  predictable 12-column grid.
- **#48** “Posts on Hive” and “Account posts” merged into one content browser
  with account/reference feeds, list/compact/card views, inline post and comment
  text, vote state and optional auto-refresh. Saved `accountPosts` widgets
  migrate automatically.
- **#72** Magi Network (formerly VSC) GraphQL reads: balances in the wallet
  widget and ledger transactions merged into the operations widget.
- **#47** Relevance search is semantic-first. Keyword candidates that do not
  mention the query no longer pad HiveSense results, and relevance ranking
  drops unrelated popular posts. The UI labels keyword-only fallback.
- **#65** Card images are resized through images.hive.blog, hashed assets are
  cached for a year, the post renderer loads lazily, and the witness list
  renders 60 rows at a time instead of the whole directory.

## Verification

- `bun run lint` — clean.
- `bun run test` — 74 files, 684 tests passed.
- `bun run build` — succeeded.
- `node scripts/prerender.mjs` — metadata and static body shells written for all
  static routes.
- `bunx playwright test e2e/dashboard.spec.js e2e/infinite-scroll.spec.js` —
  17 passed in Chromium.
- `bun run test:e2e` (Obscura fast suite) — 39 passed, 1 skipped, 3 scroll
  tests failed inside Obscura. The same three pass in Chromium, so this is a
  harness limitation rather than an app regression.
- `bun run perf:check` — passed. The initial and home JS budgets were raised by
  ~2–9 KB to account for the new dashboard widgets; LCP stayed under 2.2s.
- Cloudflare Worker live check — `x-hive-meta: hit` on a post and an account;
  real title, description, cover image and JSON-LD returned to a Discordbot
  user agent. Account subpages and unknown accounts fail open unchanged.

## Deployment

- `./scripts/deploy.sh` completed: lint, build, prerender, backup, upload and
  activation. Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261119T232933Z.tar.gz`.
- The updated nginx config is installed and reloaded. Verified live: `/browse`
  301, search/404 noindex shells, TradingView CSP, account avatar `og:image`,
  and origin `Cache-Control: max-age=31536000` for `/assets/*`.
- Cloudflare still serves its previously cached 4-hour header for the hashed
  asset requested before the reload; newly built assets receive the year-long
  policy.

## Remaining

None. #63's optional server-side existence check (returning 404 at the edge for
impossible block numbers or malformed transaction ids) remains a future
hardening idea, not a reported regression.
