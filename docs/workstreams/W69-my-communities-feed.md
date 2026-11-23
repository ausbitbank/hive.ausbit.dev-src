# W69 — My communities feed

Date: 2026-11-23
Status: deployed and live-smoked
Epic: <https://github.com/ausbitbank/hive.ausbit.dev-src/issues/93>
Builds on: W65 dashboard widget expansion, W62 public community browser

## Goal

Close the last open W65 Phase 2 item: let the existing posts widget show one
merged feed across the signed-in account's community subscriptions, instead of
duplicating the posts widget with a "my posts" variant.

## Behaviour

- The posts widget's **Network feed** setting gains **My communities**.
- The reference field also understands `/@me/communities` and
  `communities/mine`, so the mode can be shared as a plain Hive path like the
  other feed references.
- The card header reads **My communities**, keeps the manual refresh action, and
  links **View all** to the signed-in account's `/@account/communities` page.
- Guests see "Log in to see posts across your communities." instead of an empty
  or failed feed.
- The 7-day/quick-sort switcher is hidden because this is a feed mode, not a
  sort.

## Data bounds

- One `bridge.list_all_subscriptions` read, served by the existing cache.
- Up to **6** community ranked reads (`MAX_MY_COMMUNITIES`). The per-community
  page is derived from the card limit, clamped to 3–20.
- Posts are merged round-robin with the existing `mergeCommunityFeeds` helper so
  one busy community cannot fill the card. Pinned posts are excluded: this is a
  "what is new across my communities" view.
- Partial failures are tolerated (`Promise.allSettled`); the feed only throws
  when every community read fails.
- No background polling is added. The widget keeps whatever refresh interval the
  user configured.

## Bundle

- `src/services/myCommunitiesFeed.js` is dynamically imported from
  `postFeed.js`, and the community merge helper is imported inside it. A default
  home dashboard never downloads the subscription/merge code.
- The UI wiring (feed descriptor, guest state, link) costs about 0.5 KB of home
  route JavaScript. The measured value is 165.5 KB against the 165 KB budget, so
  the `/` `routeJsKb` budget moves to **166 KB**. Total home transfer is 410.8 KB,
  still below the 560 KB total budget.

## Files

- `src/services/myCommunitiesFeed.js` — bounded subscription + ranked reads and
  error handling.
- `src/services/postFeed.js` — lazy dispatch for `method: 'communities'`.
- `src/services/feedReference.js` — `/@me/communities` and
  `communities/mine` descriptors.
- `src/services/dashboardEditing.js` — **My communities** source option.
- `src/components/HomeTrendingPosts.vue` — guest state, per-account snapshot and
  feed keys, true source propagation, dynamic View all link.
- `tests/unit/postFeed.spec.js`, `tests/unit/feedReference.spec.js`,
  `tests/unit/dashboardEditing.spec.js` — parsing, source whitelist, bounds,
  guest behaviour.
- `e2e/dashboard.spec.js` — guest prompt, signed-in heading, 4 rows and View all.
- `docs/performance/budgets.json` — home route JS 165 → 166 KB.

## Verification

- `bun run lint` — clean; theme-token scan clean.
- `bun run test` — 140 files, 1,208 tests passed.
- `bun run build` — succeeded.
- `bun run test:e2e -- e2e/dashboard.spec.js -g "my communities feed"` — 1 passed.
- `bunx playwright test e2e/a11y.spec.js -g "custom dashboard templates"` — axe
  clean at 1440px and 390px.
- `bun run perf:check` — all budgets passed; home 410.8 KB total.
- Browser smoke with mocked subscriptions/ranked feeds: four rows merged evenly
  from two communities, no page errors; guest layout shows the login prompt.

## Deployment

- Deployed 2026-11-23 from commit `f689f70` with `./scripts/deploy.sh`.
- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261123T073206Z.tar.gz`.
- Rollback: `./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261123T073206Z.tar.gz`.
- Production `index.html` SHA-256 `2875fdaa…f848f` matches the local build.

Live browser smoke (Chromium, 1440px):

- The signed-in dashboard with a `myCommunities` posts widget rendered the **My
  communities** heading and four live posts round-robin across subscriptions.
- **View all** pointed at `/@ausbitbank/communities`.
- The guest dashboard showed "Log in to see posts across your communities."
- Home returned 200 with no page errors.

## Notes

- No signing or authority changes; the feed is read-only.
- The signed-in snapshot key and local snapshot key include the account, so one
  user's merged feed cannot appear for another.
- W65 Phase 2 is now complete.
