# W7 — Proposals parity with PeakD

Status: complete
Branch: `improve/proposals` (from `master`)
Worklog: `docs/workstreams/W7-proposals-log.md`

## Goal

Bring the DHF proposals experience close to PeakD: funding context, tabs,
sorting, funded/unfunded sections, per-proposal payment projections, proposal
detail pages, support levels, votes and in-app voting.

Preserve the existing dark visual system and the in-app broadcast queue.

## API facts

- List: `database_api.list_proposals`
  `{ start: ['-1'], limit: 1000, order: 'by_total_votes', order_direction: 'descending', status: 'all' }`
  returns ~335 proposals.
- Single: `database_api.find_proposals` `{ proposal_ids: [id] }`.
- Votes: `database_api.list_proposal_votes`
  - for a proposal: `{ start: [id], limit: 1000, order: 'by_proposal_voter', order_direction: 'ascending', status: 'all' }`
  - for a voter: `{ start: [username], limit: 1000, order: 'by_voter_proposal', order_direction: 'ascending', status: 'all' }`
- Post: `bridge.get_post` `{ author, permlink, observer }`.
- `daily_pay` = `{ amount, precision, nai }`; HBD = amount / 10^precision.
- `total_votes` is micro-VESTS-like; HP = `$hive.formatter.vestToHive(total_votes, total_vesting_shares, total_vesting_fund_hive) / 1e6`.
- Return proposal is `id === 0`; proposals with `total_votes >= returnProposal.total_votes` are funded.
- Voting: `update_proposal_votes` is an **active authority** operation
  (`get_required_active_authorities` in Hive core), so queue entries must use
  key type `'active'`, not `'posting'`. Both the list cards and the detail page
  show a small “Requires your active key.” note next to the vote controls.

## List page (`src/pages/proposals.vue`)

- Header: title, short DHF explainer, stats strip:
  - Daily funded (sum active funded proposals excluding return and `hbdstabilizer`)
  - HBD Stabilizer daily pay
  - Max daily budget (`hive.fund` HBD balance / 100)
  - Total budget (`hive.fund` HBD balance)
- Tabs: All, Active, Upcoming, Expired, Voted (only when logged in).
- Sort: Votes (default), Daily pay, Newest, Ending soon.
- Search: subject, creator, receiver, id, permlink.
- Sections: **Funded proposals** (`total_votes >= returnProposalVotes`) and
  **Other proposals**; return proposal included in funded with a note.
- Card contents:
  - creator (and receiver if different) avatar/name
  - subject + `#id` linking to `/proposals/:id`
  - status badge (Active/Funded/Upcoming/Expired)
  - date range + total days
  - `@creator/permlink` link
  - Daily pay, remaining days, paid, to pay, vote value HP
  - support-level progress vs return proposal
  - Vote/Unvote button (queue `update_proposal_votes` with the `active` key),
    or Login hint
  - Open post / PeakD links
- Mobile responsive card layout; loading/error/empty states; h1.
- URL query sync for tab/sort/search (nice-to-have).
- Do not show dead external endpoints.

## Detail page (`src/pages/proposal.vue` + route)

- Route `/proposals/:proposalId` uses the detail page; `/proposals` remains the list.
- Fetch proposal by id, its post via `bridge.get_post`, and votes.
- Header: back link, `Proposal #id`, status, title, creator/receiver, dates,
  Support/Unvote button, Open post, PeakD link.
- Right sidebar: created by, receiver, daily pay, remaining days, paid, to pay,
  support level target (return proposal votes), current vote value HP with
  progress, voter avatars/list.
- Render the proposal post body with the existing `render` component.
- FAQ accordion with concise DHF questions (what is it, who can vote, vote
  value, return proposal, proxy).
- Meta via `setPageMeta`.
- Handle missing/invalid proposal id with a clear not-found state.
- Votes: show up to ~24 avatars + a “View all votes” expandable list; each
  voter links to `/@voter`. Do not fetch hundreds of account balances.
- Voting uses the shared queue with the `active` key; optimistic `voted` state;
  login prompt; visible “Requires your active key.” note.

## Shared logic

Create `src/services/proposals.js` with pure helpers:
- `dailyPayHbd`, `voteValueHp(proposal, globalProps)`, `daysTotal`, `daysRemaining`, `daysElapsed`, `paidHbd`, `toPayHbd`, `isFunded`, `proposalPhase` (active/upcoming/expired), `sortProposals`, `filterProposals`, `fundingSummary`.
- API wrappers: `listProposals`, `findProposal`, `listProposalVotes`, `getVoterVoteIds`, `getProposalPost`.
- Use `hive` from `src/services/hive`; no new deps.

## Acceptance

- `bun run lint`, `bun run test`, `bun run build` pass.
- Local browser smoke: list/detail at 390px and 1440px, no overflow; vote button
  queues when logged in (can be inspected from source) and login hint otherwise.
- No axe regressions on the proposals list/detail.
- Worklog `docs/workstreams/W7-proposals.md` with decisions/checks.
