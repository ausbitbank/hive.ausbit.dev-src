# W73 Phase 2 — Downvote transparency

Date: 2026-11-24
Status: implemented, deployed and live-smoked (client route).

Contract: issue #94. Phase 1:
[`W73-moderation-policy.md`](W73-moderation-policy.md).

## Scope

Per-account downvote transparency and per-post vote context without a backend,
leaderboard or automatic punishment.

Shipped:

- `/@:username/downvotes` with received downvotes for any account and a Given
  view for the viewer's own account.
- Voter, weight, target and time per row, with the viewer's local relationship
  (follows / muted / blacklist / followed list / unknown).
- Summary cards: count, distinct voters, targets, estimated total deducted, largest deduction and share.
- Per-row estimated dollar impact from the voter's current Hive Power and downvote mana,
  priced with the post reward fund and median feed; the exact signed weight stays visible.
  Vote history stores only the weight, so historical stake/mana cannot be replayed exactly
  and the estimate is labelled as current-stake, not a historical promise.
- Filters for time range, relationship, voter, target, impact state, local
  notes, watched voters and new-since-last-visit; grouping by voter, target or
  day. The filter set is deep-linkable via query parameters.
- **Saved views**: name the current filter set, reload it from the Views menu,
  copy a shareable filter link, or delete it. Views are local to the device and
  signed-in account.
- Conservative “Possible coordinated downvotes” evidence: voter count, shared
  targets, time window and pairwise target overlap. Always qualified as
  possible and never used to hide or punish.
- Per-voter local exclusion: ignored voters are marked/removed from the local
  table view, while the raw summary keeps the full chain impact.
- “Load older” reads one more 1,000-operation page on demand and never caps the
  total; “Load all older” keeps going until the filtered history is exhausted,
  with a Stop control. The progress line shows operations scanned and downvotes
  found.
- **Exact financial impact** where the target post is readable: `get_content`
  provides the voter's `active_votes.rshares`, `net_rshares`, the post's own HBD
  payout and cashout time. The downvote's share of the payout is
  `|rshares| / net_rshares`; votes cast after cashout are labelled as signals
  with no payout impact. Rows without a target post fall back to the
  current-stake estimate and say so.
- Finalized vs pending loss, the approximate author/curator split, post-payout
  signal counts, exact-row coverage and a same-period author-reward comparison.
- **Timing**: daily count/impact bars, cumulative loss line, post-age-at-vote
  buckets, UTC-hour histogram, voter-by-week activity heatmap and
  same-target/same-voter burst detection.
- **Monitoring**: a local voter watchlist with a watched-only filter and stars
  in the top-voter and table views; a last-visit marker showing new downvotes
  and their estimated impact, with a New-only filter and Mark seen action.
- **Patterns**: repeat targeting, vote changes, weight escalation, new accounts
  and after-payout signal votes, in addition to the conservative coordination
  card.
- **Context drawer**: comments by the downvoter in the target discussion, the
  author's replies, and comments the voter left on the author's other posts near
  the vote. Excerpts show before/after timing and keyword hits; comments are
  labelled as context, not proof.
- **Private notes and tags** per row, stored on this device, plus CSV and
  Markdown report exports.
- Post vote dialog now shows distinct up/down voters, top stake share and net
  direction; if the post payload has no `active_votes`, it fetches
  `condenser_api.get_active_votes`.
- Account header gains a downvotes tab; the narrow-screen tab rows adjust from
  four to five per row for the ninth tab.

## Data

- `condenser_api.get_account_history` with the vote bitmask (`"1"`, `null`),
  paged backwards at 1,000 rows per call. The first visit reads three pages;
  every later page is fetched from the returned index cursor. Raw `vote` rows
  carry `weight` only, so direction comes from the sign of `weight`.
- No total page cap: the page keeps a cursor until the node returns a short
  page or the oldest index. Duplicate history indices are dropped and each page
  is sorted newest-first before it is appended.
- A cursor that does not move backwards stops the loader instead of looping.
- `condenser_api.get_content` for target posts, cached per author/permlink.
  Target hydration is bounded (four concurrent reads, 500 posts per pass) and
  the page reports exact coverage and failures. The visible page is hydrated
  automatically; larger filtered sets use “Calculate exact impact”.
- `bridge.get_discussion` and `bridge.get_account_posts` (comments) are lazy
  reads used only when the context drawer opens. Both are cached for five
  minutes.
- `fetchAccountRewardHistory` supplies the same-period author/curation reward
  comparison, labelled as a sample when the page budget is reached.
- `condenser_api.get_active_votes` for current per-post rshares/percent.
- Cached for 5 minutes per history cursor (`fetchAccountVoteHistoryPage`,
  `fetchActiveVotes`); the filter bitmask and 1,000-row page size are enforced
  in the service.
- Malformed responses (OpenAPI schema stubs) reject instead of rendering an
  empty successful result.
- Filter state is mirrored to the route query (`range`, `rel`, `weight`,
  `impact`, `group`, `voter`, `target`, `notes`, `ignored`, `watch`, `new`) and
  sanitized on read. Saved views, watchlists and last-visit timestamps are
  local to the viewer/account; they never write to the chain.
- The voter-by-week matrix is computed from the filtered rows using UTC Monday
  week starts, so the heatmap needs no additional RPC reads.

## Evidence heuristic

`coordinationEvidence()` requires all of:

- at least 3 distinct voters;
- at least 3 shared targets inside 72 hours;
- pairwise target-set overlap of at least 0.6.

The UI shows the voters, targets, count, window and overlap. A single whale,
two voters, or an old pattern does not produce the label. No automated action
is taken from the label.

## UI

- Semantic table with a caption; real buttons for ignore/unignore and Context;
  all actions keyboard-operable.
- Empty, loading and error states; raw summary stays visible when local
  exclusion hides rows.
- Financial impact, timing, patterns and top voters/targets panels above the
  filter bar; each panel respects the active filters.
- The filter bar is deep-linkable; the Views menu saves/reloads filter sets,
  copies a filter link and deletes local views.
- The timing panel includes a voter-by-week heatmap. The summary shows new
  downvotes since the last visit, and watched voters carry a star in the top
  voter and table views.
- Pattern evidence is an advisory card with “not a verdict”.
- Grouping is a separate aggregate view; the flat table remains for review.
- The flat table shows 40 matching rows at a time; “Show more rows” expands
  the loaded page without another chain read.
- The context drawer shows comment excerpts, before/after timing, keyword hits,
  the voter's recent downvote targeting share on demand, and a private note
  editor. Notes are local-only and included in exports.
- Markdown reports copy to the clipboard; CSV exports the filtered rows with
  impact provenance, notes and tags.
- The post vote dialog context is a compact line; existing top-voter/full-data
  tabs are unchanged.

## Authorities

- Read-only. No signing, queue items or chain writes.
- Local ignored-voter choices live in the existing per-account moderation
  policy and export/import with it.
- Ignoring a voter changes only this device's view; the raw totals and the
  public chain data remain fully visible.

## Tests

- `tests/unit/downvotes.spec.js` — normalization, received/given split,
  summaries, grouping, coordination evidence positive/negative, post context,
  relationships and ignored-voter filtering.
- `tests/unit/account-downvotes.spec.js` — cursor pagination, terminal pages,
  filtered-gap retry, malformed responses, active votes.
- `tests/unit/downvote-impact.spec.js` — exact payout share, paid/pending
  states, post-payout signals, superseded/offset/inactive votes, timeline, post
  age, hour buckets, bursts, repeat targeting, vote changes, weight escalation,
  new accounts, the voter-by-week matrix and the reward comparison.
- `tests/unit/downvote-views.spec.js` — saved-view save/replace/remove,
  scope isolation, caps and filter normalization.
- `tests/unit/downvote-watchlist.spec.js` — watch/unwatch, scope isolation,
  name normalization and caps.
- `tests/unit/downvote-visit.spec.js` — per-account last-visit timestamps and
  invalid values.
- `tests/unit/downvote-context.spec.js` — markdown excerpts, keyword hits,
  target-thread comments, author replies, voter comments on other posts and
  de-duplicated merged context.
- `tests/unit/downvote-sources.spec.js` — bounded target hydration, failures,
  malformed discussions, voter comment feeds and recent-vote aggregation.
- `tests/unit/downvote-notes.spec.js` — local save/read/remove, scope isolation,
  note/tag caps.
- `tests/unit/downvote-report.spec.js` — CSV provenance/notes, Markdown case
  file and filename.
- `tests/unit/vote-breakdown.spec.js` — existing votes dialog still green.
- `e2e/moderation.spec.js` — downvotes tab with mocked posts and discussion:
  exact $9.00 impact, 100% exact badge, context drawer, local note, evidence
  card, voter-by-week heatmap, deep-link filters, watchlist filter, saved view
  load and ignore-voter local exclusion; a second test loads three full pages,
  expands the table and then loads the final older page without a cap.
- Axe: `/@ausbitbank/downvotes` at 1440×900 and 390×844, plus the open context
  drawer and Views menu.

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean |
| `bun run test` | 153 files, **1339 tests**, all green |
| `bun run build` | green |
| `bun run perf:check` | all budgets pass |
| `e2e/moderation.spec.js` | 9/9 green |
| axe `/settings/moderation`, `/@ausbitbank/downvotes` | green at both widths |
| vote E2E | 3/3 green |

### Deep-dive follow-up (2026-11-29)

| Check | Result |
| --- | --- |
| `bunx eslint` on the changed downvote files | clean |
| `bun run test` | 262 files, 2466 tests, all green |
| `bun run build` | green |
| `e2e/moderation.spec.js` downvotes | 2/2 green |
| Axe `/@ausbitbank/downvotes` and the open context drawer | clean |
| Live smoke `@hive3/downvotes` | exact hydration, reward comparison, deep links, watchlist and heatmap rendered with no page errors |

Repo-wide `bun run lint` currently also flags unrelated in-progress
`src/components/feed/FeedFilters.vue` prop mutations; the downvote files are
clean under the same config.

## Deployment

Deployed on 2026-11-24 with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T032027Z.tar.gz`
  (`sha256 e585f3f9…988c9e`).
- Production index matches local `assets/index-CCiC5rZx.js`.
- Live browser smoke through the SPA router (the account route is behind the
  existing Cloudflare challenge for direct automated requests):
  `@hive3/downvotes` rendered 378 received downvotes, 19 distinct voters, 40
  table rows, the first row `@thefed -99.0% hive3/buzz-invite-mwscp86m`, with
  no page errors. `@ausbitbank/downvotes` rendered its empty state cleanly.
- Direct `GET /@ausbitbank/downvotes` still returns a Cloudflare 403 for
  automated clients; the account-subroute nginx regex now includes `downvotes`
  and needs a root install/reload for the ideal direct metadata path.

## Remaining and notes

- There is no global downvoter leaderboard; the view is per account only.
- Given downvotes are shown only for the viewer's own account to reduce
  harassment.
- Target post/comment classification is not fetched for every row; the target
  link is the source of truth and avoids hundreds of content reads.
- The nginx vhost's account sub-route regex now includes `downvotes`; it needs a
  root install/reload to serve direct requests with a real 200. Client
  navigation already works.
- Phase 3 (list subscriptions, community context, shareable profiles) remains.
