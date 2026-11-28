# W111 — Proposal voter paging and delegation limits

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W109 filtered proposal vote reads and documented the 1,000-row cap as remaining
work. This slice adds cursor paging so a proposal with more voters can be read in
full, and makes the delegation dialog reserve stake already committed to an
active powerdown.

## Fixes

1. **Proposal voters page with a cursor.** `listProposalVotes(id, { startVoter })`
   sends `start: [proposalId, lastVoter]` while still filtering rows to the
   requested proposal. The detail page appends a new page, de-duplicates by
   voter, and stops when a page is short or adds no new names.
2. **The voter list is no longer silently truncated.** The “Showing the first
   1,000 votes” note is replaced by a “Load more voters” action; after the last
   page the card states how many voters were loaded.
3. **Delegation max reserves powerdown stake.** `availableDelegationVests()`
   subtracts outgoing delegations and `(to_withdraw - withdrawn) / 1e6` from the
   owned VESTS. A max delegation can no longer be built from stake that is
   already being powered down and rejected by the chain.

## Components

| Area | Files |
| --- | --- |
| Proposal reads/page | `src/services/proposals.js`, `src/pages/proposal.vue` |
| Delegation | `src/services/delegations.js`, `src/components/delegationDialog.vue` |
| Tests | `tests/unit/proposals-votes.spec.js`, `tests/unit/delegations.spec.js` |

## Authority and privacy

- No signing change. Proposal voting still queues `update_proposal_votes` with
  active authority and explicit review.
- Delegation remains active-authority and still requires a positive amount.
- Paging reads public proposal-vote rows only.

## Verification

- `bun run lint` — clean.
- `bun run test` — **248 files / 2,351 tests** passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- The voter page still requests 1,000 rows per click; a smaller page with an
  explicit page size would be friendlier on very large proposals.
- Delegation availability still does not model a voting-mana cap if the chain
  applies one; the powerdown and outgoing-delegation reservations are the parts
  verified against the account fields.
- `voter-overlap` and the analytics cards use the loaded voter set, so they grow
  as more pages are loaded rather than reading the full list up front.
