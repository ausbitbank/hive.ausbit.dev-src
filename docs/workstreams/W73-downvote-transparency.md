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
- Filters for time range and relationship; grouping by voter, target or day.
- Conservative “Possible coordinated downvotes” evidence: voter count, shared
  targets, time window and pairwise target overlap. Always qualified as
  possible and never used to hide or punish.
- Per-voter local exclusion: ignored voters are marked/removed from the local
  table view, while the raw summary keeps the full chain impact.
- “Load older” reads one more 1,000-operation page on demand and never caps the
  total; “Load all older” keeps going until the filtered history is exhausted,
  with a Stop control. The progress line shows operations scanned and downvotes
  found.
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
- `condenser_api.get_active_votes` for current per-post rshares/percent.
- Cached for 5 minutes per history cursor (`fetchAccountVoteHistoryPage`,
  `fetchActiveVotes`); the filter bitmask and 1,000-row page size are enforced
  in the service.
- Malformed responses (OpenAPI schema stubs) reject instead of rendering an
  empty successful result.

## Evidence heuristic

`coordinationEvidence()` requires all of:

- at least 3 distinct voters;
- at least 3 shared targets inside 72 hours;
- pairwise target-set overlap of at least 0.6.

The UI shows the voters, targets, count, window and overlap. A single whale,
two voters, or an old pattern does not produce the label. No automated action
is taken from the label.

## UI

- Semantic table with a caption; real buttons for ignore/unignore; all actions
  keyboard-operable.
- Empty, loading and error states; raw summary stays visible when local
  exclusion hides rows.
- Pattern evidence is an advisory card with “not a verdict”.
- Grouping is a separate aggregate view; the flat table remains for review.
- The flat table shows 40 matching rows at a time; “Show more rows” expands
  the loaded page without another chain read.
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
- `tests/unit/vote-breakdown.spec.js` — existing votes dialog still green.
- `e2e/moderation.spec.js` — downvotes tab with mocked history: 9 rows, evidence
  card, ignore voter removes rows locally, summary stays at 9, Show ignored
  restores them; a second test loads three full pages, expands the table and
  then loads the final older page without a cap.
- Axe: `/@ausbitbank/downvotes` at 1440×900 and 390×844.

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
