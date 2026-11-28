# W109 — Proposal vote, funding and expiry truth

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A governance audit found that two Hive list endpoints paginate past the item
they are asked for, so the app attributed other proposals' and witnesses'
voters. It also found funding analytics that summed the return proposal and
spam requests, an epoch timestamp treated as an expired governance vote, and
several proposal cards that claimed more than the data supported.

## Fixes

1. **Proposal voter lists are filtered.** `listProposalVotes(id)` keeps only
   rows whose `proposal.id` matches the requested id. The API returns the next
   proposals after the target.
2. **A voter's proposal ids are filtered.** `getVoterVoteIds(account)` keeps
   only rows whose `voter` matches the account. Previously a 1,000-row response
   for `ausbitbank` contained dozens of other voters and produced a false
   “Voted” set. This fixes the proposals page, per-card Unvote state, voter
   overlap and the governance dashboard widget together.
3. **Funding analytics exclude the threshold and spam.** Proposal #0 is the
   funding threshold, not a payment; it is no longer counted in
   `dailyRequested`, committed totals, creators/receivers or topics. Requests
   above `MAX_PLAUSIBLE_DAILY_HBD` (1,000,000 HBD/day) are excluded from sums and
   rankings and reported as `outlierCount`. The monthly outlook, `fundedCount`
   and `estimatedPaid` use the same filter.
4. **The epoch sentinel is “never voted”, not “expired”.** `governanceVoteExpiry`
   returns `available: false` for a missing or `<= 0` timestamp. The account
   page no longer renders “Expires 56 years ago”, and the authority card no
   longer raises `governance-expired` for accounts that never voted.
5. **Price-feed freshness treats the sentinel as missing.** A 1969/1970
   `last_hbd_exchange_update` is counted as `missing`, not a stale 56-year-old
   feed.
6. **Proposal detail cannot claim “Funded” without the threshold.**
   `returnProposalVotes` no longer falls back to the proposal itself. If the
   return-proposal read fails, an active proposal shows “Funding unknown”,
   support is “—”, and the support/progress values stay empty instead of 100%.
7. **Upcoming proposals show time to start.** A new `daysUntilStart()` drives
   “Starts in N days” instead of reusing the whole payment-window length.
8. **The funding section is active-only.** An upcoming proposal above the
   threshold is no longer listed as “currently in line for funding”; it moves to
   “Other proposals” until its window starts.
9. **The proposals count is honest.** The line now says “M of N matching
   proposals shown”, where M counts the rendered active/other cards plus the
   visible expired slice, instead of claiming all 335 proposals are shown while
   only 12 expired cards are rendered.
10. **The proposals load is identity-bound.** A login switch during the initial
    read cannot apply the previous account's vote set or clear the new load's
    spinner.

## Components

| Area | Files |
| --- | --- |
| Proposal reads | `src/services/proposals.js` |
| Funding/expiry | `src/services/governance.js`, `src/services/governanceWatch.js` |
| Pages | `src/pages/proposal.vue`, `src/pages/proposals.vue`, `src/pages/account.vue` |
| Tests | `tests/unit/proposals-votes.spec.js`, `tests/unit/proposals.spec.js`, `tests/unit/governance.spec.js`, `tests/unit/authority.spec.js` |

## Authority and privacy

- No signing or authority change. Every fix is a read or a display decision.
- The funding and vote filters stop a misleading governance surface; they do not
  hide proposals from the directory.
- The epoch fix removes a false security warning rather than suppressing a real
  one.

## Verification

- `bun run lint` — clean.
- `bun run test` — **248 files / 2,347 tests** passing.
- `bun run build` — succeeded.
- `bunx playwright test e2e/governance.spec.js` — **6/6** passing.
- Axe clean at 1440×900 and 390×844 for `/witnesses`, `/proposals` and
  `/@ausbitbank`.
- Full Chromium suite: **213 passed** (four unrelated checks were disrupted by a
  concurrent session rebuilding `dist` and passed on isolated rerun).
- `bun run perf:check` passed in an isolated worktree.

## Remaining

- A proposal with more than 1,000 voters still stops at the first page; the
  detail page says so. Cursor pagination (`start: [proposalId, lastVoter]`) is
  the follow-up.
- The funding “estimated paid” value is a nominal payment-window estimate, not a
  settled ledger; the page already labels it as an estimate.
- `votesDialog` now shows loading/error/retry, but the dialog still reads only
  the active-vote endpoint and does not page beyond its limit.
