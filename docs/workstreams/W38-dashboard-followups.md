# W38 — Dashboard refresh, community headers and layout follow-ups

Date: 2026-11-20
Status: implemented and verified locally

## Scope

The three issues still open after W37:

- **#78** — a content-browser community feed kept showing the chain name
  (`#hive-xxxxx`) instead of the community's display name and avatar.
- **#77** — dashboard widget data could look frozen: the operations footer's
  relative timestamp never moved, the content browser had no refresh control,
  a manual/timed refresh could be answered by the stale-while-revalidate cache,
  and a hidden tab did not refresh when it became visible again.
- **#50** — the masonry/rows toggle was outside the editor, the editor did not
  preview the final masonry positions, there was no auto-optimize action, and
  there was no way to keep several named layouts.

## #78 — Community title and avatar

- `services/feedReference.js` now exposes `feedHeader(feed, community)` and
  `feedAvatar(feed)`. The header falls back to the `#hive-xxxxx` chain name
  until the community record arrives, so the card never renders an empty title.
- `components/HomeTrendingPosts.vue` reads `bridge.get_community` through the
  existing cached `fetchCommunity()` when the feed is a community. The card then
  shows the community title and the standard
  `images.hive.blog/u/<community>/avatar` image. Metadata failures are silent;
  the chain-name fallback stays.
- The community metadata key is separate from the post-feed key, so changing
  the post limit does not re-fetch or flicker the title.

## #77 — Live widget data

- `services/postFeed.js` accepts `force` and passes it to the ranked/account
  read layer. Manual feed refreshes and every auto-refresh tick bypass the 30s
  stale-while-revalidate cache.
- `components/HomeTrendingPosts.vue`:
  - adds an explicit **Refresh posts** button;
  - reloads immediately when the auto-refresh setting is enabled;
  - uses `pollWhileVisible()`, so returning to the tab refreshes instead of
    waiting for the next interval;
  - shows a footer with the refresh cadence and a relative “Updated …” time
    that advances on a 30-second clock;
  - ignores out-of-order responses with a request token.
- `components/dashboard/WidgetOperations.vue`:
  - reads account history with `cache: 'no-store'`;
  - uses `pollWhileVisible()` and refreshes on tab return;
  - re-derives row timestamps and the footer from a 30-second clock instead of
    freezing the last computed relative label;
  - reloads immediately when the refresh interval is changed.
- **#77 reopen root cause:** `condenser_api.get_account_history` returns its
  page oldest-to-newest. The widget filtered the page and then took the *first*
  N rows, so a busy account showed the oldest operations in the latest 100
  (about two hours behind) and each refresh merely walked the old window
  forward. `latestOperations()` in `services/operationsFeed.js` now sorts the
  merged Hive/Magi rows newest-first before slicing, with a regression test
  covering an ascending history page.
- `services/api.js` forwards an optional `cache` mode to `fetch`, which the
  operations widget uses to keep intermediary/browser caches out of the live
  account-history path.

## #50 — Layout and masonry improvements

- The Rows/Masonry toggle moved out of the page header and into the editor bar.
  It is part of the draft, so Cancel restores the previous tiling and Save
  persists it. Changing tiling now counts as a customisation even when the
  widget list itself still matches the default.
- `DashboardGrid` renders edit mode with the same absolute masonry placement
  when the draft is in masonry mode. Dragging, keyboard reordering, resizing
  and the end-of-layout target all work against the measured layout, so the
  final columns/order match what was previewed. The edit bars still add height
  in edit mode, so the exact pixel gap can differ, but the tile order and width
  do not.
- **Auto-optimize** (`optimiseLayout()` in `services/dashboardLayout.js`):
  - respects each widget's registry minimum width;
  - tries width-token combinations that fill each 12-column row, preferring the
    fewest width changes, then more widgets, then original order;
  - rearranges widgets between rows when that removes leftover columns;
  - applies to the draft only, so it can be reviewed, cancelled or saved.
- **Named layouts** (browser-local, per account/guest scope):
  - stored beside the current dashboard as
    `{ id, label, widgets, tiling, savedAt }[]` under the existing
    `hive:dashboard:v1:<scope>` document;
  - Save current as…, Load, Rename and Delete are available from the editor's
    Layouts menu;
  - loading a snapshot fills the draft; Save applies it and marks the snapshot
    active;
  - saving an editor change updates the active snapshot as well;
  - corrupt snapshots and stale active ids are dropped safely on read;
  - the library is capped at 20 entries and labels at 40 characters.

## Accessibility follow-up

The full axe run on `/@ausbitbank` exposed a pre-existing contrast failure on
the Lightning address currency toggle (white text on `amber-9`). Both Lightning
toggles now use `toggle-text-color="black"`, and axe is clean again.

## Verification

- `bun run lint` — clean.
- `bun run test` — 79 files, 747 tests passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/dashboard.spec.js` — 16 passed in Chromium and the
  three dashboard tests re-run green in Obscura.
- `bunx playwright test e2e/a11y.spec.js` — 15 passed at 1440px and 390px.
- `bun run test:e2e` (Obscura fast suite) — 42 passed, 1 skipped, 6 failed.
  None of the failures are on the dashboard surface: they are the known
  live-data/harness cases in connections (follow state), three infinite-scroll
  tests, the wallet transfer action and the Lightning queue-payment test.
- Unit coverage added for `feedHeader`/`feedAvatar`, forced feed reads,
  `optimiseLayout`, named-layout storage/round-trip, and the API cache option.
- Manual Chromium smoke: the content browser's refresh button reloads the feed
  and updates its footer; a saved operations widget for `@ausbitbank` renders
  rows and its footer, and its refresh button re-reads the account history.

## Status

Code, tests and documentation are complete. Deployment is left to the owner
because the working tree also contains unrelated, uncommitted Lightning panel
and metadata-worker changes.

## Notes

- Named layouts are local to this browser, like the dashboard itself. Sharing
  between devices still uses the `HIVE-DASH-1.*` export/import string.
- Masonry stays a view-mode feature; the editor now previews it, but edit
  chrome is still shown on every card.
