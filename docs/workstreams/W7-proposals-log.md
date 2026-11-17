# W7 — Proposals parity with PeakD: implementation log

Branch: `improve/proposals`
Date: 2026-11-17

## API findings

- `database_api.list_proposals` with
  `{ start: ['-1'], limit: 1000, order: 'by_total_votes', order_direction: 'descending', status: 'all' }`
  returned 335 proposals. Status values observed: `active` (14), `inactive` (6), `expired` (315).
- A proposal has no `total_days` field. Payment projections must be derived from
  `start_date`/`end_date`. The whole-day total is `ceil((end - start) / 1 day)`.
- `daily_pay` is a typed asset `{ amount, precision, nai }` where amount /
  10^precision is HBD. For example `{ amount: '540000', precision: 3 }` = 540 HBD/day.
- `total_votes` is a micro-VESTS-like integer string. HP is
  `hive.formatter.vestToHive(total_votes, total_vesting_shares, total_vesting_fund_hive) / 1e6`
  when global props are in actual units (condenser strings, or typed assets
  normalised by precision). This yields e.g. ~79.08M HP for proposal 373 and
  ~47.1M HP for the return proposal, which matches the observed funded set.
- The return proposal is `id === 0` (receiver `steem.dao`, subject
  "Return Proposal"). Normal proposals are funded when their `total_votes` is at
  least the return proposal's. Note that `Number()` on the ~7.5e16 value loses
  the final digits, which is harmless for ordering/comparison but should not be
  displayed verbatim.
- `database_api.find_proposals` `{ proposal_ids: [id] }` returns an empty
  `proposals` array for unknown ids (not an RPC error), so the detail page can
  show a clean not-found state.
- `database_api.list_proposal_votes`:
  - by proposal: `start: [id]`, `order: 'by_proposal_voter'`, ascending, status all.
  - by voter: `start: [username]`, `order: 'by_voter_proposal'`, ascending, status all.
  - The response does not include per-vote stake; per-voter stake is therefore
    not computed (which also avoids hundreds of extra account requests).
- `bridge.get_post` `{ author, permlink, observer }` returns the proposal post
  (including `body`) and works for proposal posts.
- `update_proposal_votes` is an **active authority** operation in Hive core
  (`get_required_active_authorities`). Queue entries use `'active'` in both the
  list cards and the detail page; UI notes say “Requires your active key.”
- `hive.fund` is fetched through the existing store action
  (`getAccountsAsync` → condenser strings), so balances are normalised by the
  shared `assetAmount` helper. Current balance on 2026-11-17: ≈23,255,495 HBD
  → max daily budget ≈2,325,549 HBD.

## Decisions

- Created `src/services/proposals.js` as the single source of truth for API
  wrappers, date/payment math, filtering, sorting and funding summaries.
- `assetAmount` accepts numbers, condenser strings (`"12.345 HBD"`) and typed
  assets (`{ amount, precision }`) so helpers work with either API shape.
- Payment projections use whole-day elapsed/remaining values derived from the
  same total so `paid + toPay` never exceeds `daily_pay * total_days`.
  `daysElapsed` is floored and clamped; `daysRemaining` is `total - elapsed`.
- `proposalPhase` prefers the API status but also falls back to dates:
  expired if ended, upcoming if `inactive` or not started, active otherwise.
- `isFunded` special-cases the return proposal (id 0) as part of the funded
  section so it can be shown as the threshold with an explanatory note. Payment
  projections are hidden for the return proposal (its stored `daily_pay` is a
  sentinel, not a real stream).
- `fundingSummary` only counts **active** proposals. `dailyFunded` excludes the
  return proposal and `hbdstabilizer`; `hbdStabilizerDaily` is tracked
  separately; `maxDailyBudget = hive.fund HBD / 100`; `totalBudget` is the full
  HBD balance. The function accepts `globalProps` for signature symmetry and a
  third options argument for the fund balance/return votes.
- List page: stats strip, tabs (All/Active/Upcoming/Expired/Voted only when
  logged in), sort (votes/daily pay/newest/ending soon), search across
  subject/creator/receiver/id/permlink, and funded/other sections split at the
  return proposal.
- The list page fetches the logged-in user's votes once with
  `getVoterVoteIds` (limit 1000) and keeps them in a `Set`; vote/unvote emits
  from the card and updates the set optimistically.
- Detail page: `/proposals/:proposalId` (route added after `/proposals` and
  `/dao`), proposal + return proposal + votes + own vote loaded in parallel,
  post loaded via `bridge.get_post`. Sidebar shows payment projections, support
  target/progress and up to 24 voter avatars with an expandable list of up to
  1,000 votes. FAQ accordion and not-found state included.
- Vote/support controls show a visible “Requires your active key.” note; the
  login hint is shown when signed out. Broadcasts still go through the shared
  queue and are not sent directly.
- Tab/sort/search are synced to the URL query (debounced) with
  `router.replace`, so proposal list state is shareable/back-button friendly.
- Existing dark visual system, Quasar components and `setPageMeta` are retained.
  No new dependencies and no dead external endpoints were introduced.

## Files

- `src/services/proposals.js` (new): API wrappers and pure helpers.
- `src/pages/proposals.vue` (rewritten): list, stats, tabs, sort/search,
  funded/other sections, queue voting state.
- `src/pages/proposal.vue` (new): detail page, post render, sidebar, votes, FAQ.
- `src/components/proposal.vue` (rewritten): responsive proposal card with
  payment stats, support progress, vote/unvote and external links.
- `src/router/routes.js`: `/proposals/:proposalId` → detail; `/proposals` and
  `/dao` remain the list, ordered before the detail route.
- `docs/workstreams/W7-proposals.md`: active-key note and vote API fact.
- `docs/workstreams/W7-proposals-log.md` (this file).

## Checks

- `bun run lint` — passes with no errors/warnings.
- `bun run test` — 12 files / 98 tests pass (no test files changed).
- Template compilation of all three SFCs with `@vue/compiler-sfc` — no
  template or script errors.
- Helper smoke test against live API data (2026-11-17): list returns 335,
  proposal 373 = 540 HBD/day, 365 days, 186 elapsed, 179 remaining,
  ~79.08M HP; return proposal ~47.1M HP; funding summary dailyFunded = 835 HBD
  (proposals 373/379/348), HBD Stabilizer = 12,000 HBD, maxDaily ≈232,555,
  totalBudget ≈23,255,495; filter counts active 14 / upcoming 6 / expired 315.
- `getVoterVoteIds('ausbitbank')` returned 236 ids; `findProposal`,
  `listProposalVotes` and `getProposalPost` returned expected data.
- `rg` check: no `api.ausbit.dev` or
  `hivesigner.com/sign/update-proposal-votes` references in the changed code.
- Route order verified: `/proposals`, `/dao`, then `/proposals/:proposalId`.
- Queue key check: no `update_proposal_votes` entry uses `'posting'`; both use
  `'active'`.

## Open issues / left for coordinator

- `bun run build` was intentionally not run (per W7 task instructions for this
  subagent); coordinator should run it. `bun run test` passes.
- No new test files were added (tests/** was out of scope); helper tests for
  date/unit math are recommended.
- Browser smoke at 390px/1440px and axe checks were not run here; layout uses
  auto-fit grids and wrapping flex rows, but a real viewport pass is still
  recommended.
- Votes and voter ids are capped at 1,000 per request (covers current proposal
  counts). A proposal with more than 1,000 votes shows “Showing the first 1,000
  votes.” and the count is the fetched count, not the on-chain total.
- Payment projections use whole-day approximation rather than exact block-time
  proration; they are display estimates, not settlement values.
- The stats strip counts active `hbdstabilizer` proposals separately even if
  the return proposal were above them; this is a display choice for the
  stabilizer line item.
- `fundingSummary` accepts `globalProps` for the requested signature but only
  uses the fund balance/return votes passed via options; future helpers could
  use global props directly if the fund account is folded into the API layer.

## Coordinator follow-up

- Corrected max daily budget to 1% of the `hive.fund` HBD balance (matches PeakD).
- Added a separate Expired proposals section; on the All tab only the first 12
  expired cards are rendered with a “View all” action, and the Expired tab
  loads 24 at a time to avoid rendering 300+ cards at once.
- Added `proposalVoteQueueItem()` in the service and a unit test asserting the
  queue key type is `active` (Hive core requires active authority).
- Demoted rendered post/content `h1` elements to `h2` so proposal and post pages
  keep exactly one page-level `h1`.
- Changed the layout router-view key from fullPath to path so proposal
  tab/sort/search query updates do not remount the page or steal input focus.
- Verified list/detail at 390px and 1440px, zero overflow, axe clean, 105 tests
  passing and production build succeeding.
