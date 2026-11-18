# W25 — Governance and community intelligence

Status: complete (2026-11-18)

## Scope

W25 adds read-only intelligence on top of the W22–W24 performance and
resilience work. Nothing in this workstream changes signing authorities or adds
new write paths.

Delivered:

- **Witness analytics** on `/witnesses`: approval-stake concentration (top-21
  and top-50 share, HHI, Gini, consensus cutoff), price-feed freshness buckets,
  version drift, cumulative missed-block leaders with a local trend column, and
  on-demand per-witness voter segments by effective HP and account age.
- **Proposal analytics** on `/proposals`: committed daily funding, 30/90-day
  projections, estimated paid-to-date, monthly funding outlook, top creators,
  top receivers and inferred topic mix.
- **Voter overlap** on `/proposals/:id`: comparison between a proposal's
  recorded voters and the return proposal's voters, with shared-voter avatars.
- **Delegation explorer** on `/@:username/delegations`: outgoing and incoming
  delegations, effective HP, delegation share, and a recent delegation change
  timeline.
- **Community insights** on `/c/:username`: subscribers, active authors,
  posting cadence, pending payouts, top recent authors, reward concentration and
  visible moderation signals.
- **Account authority risk** on `/@:username`: owner/active/posting key reuse,
  shared account authority, single-key control, voting proxy, governance-vote
  expiry, owner-key age and a readable diff for queued `account_update`
  permission changes.

## Components and services

New services:

- `src/services/governance.js` — pure witness, proposal and voter analytics.
- `src/services/witnessVoters.js` — witness voter list reads and HP/age
  segmentation.
- `src/services/governanceHistory.js` — bounded local snapshots for missed-block
  and feed trends.
- `src/services/delegations.js` — outgoing delegation reads, history parsing,
  inbound verification and summaries.
- `src/services/community.js` — community post aggregation and
  `bridge.get_ranked_posts` wrapper.
- `src/services/authority.js` — authority normalisation, risk findings,
  permission diffs and queued-change previews.

New UI:

- `src/components/witness/WitnessAnalytics.vue`
- `src/components/witness/WitnessVoterSegments.vue`
- `src/components/proposal/ProposalAnalytics.vue`
- `src/components/proposal/VoterOverlapCard.vue`
- `src/components/account/AuthorityRiskCard.vue`
- `src/components/community/CommunityInsights.vue`
- `src/pages/delegations.vue`

Integration points:

- `/witnesses` renders `WitnessAnalytics` below the directory.
- `/proposals` renders `ProposalAnalytics` below the proposal sections.
- `/proposals/:id` renders `VoterOverlapCard` in the sidebar.
- `/@:username` gains a Delegations quick link and the authority risk card.
- `/c/:username` renders `CommunityInsights` above the feed.

## Authorities

- All new reads use the central `rpcRequest` client with existing timeout,
  retry and node-failover behaviour.
- Witness votes, proposal votes and delegation actions keep their existing
  authority requirements. The new pages do not queue any operation.
- Authority checks are descriptive only. Queued permission diffs read the
  existing signing queue and never broadcast.
- No new third-party requests or embeds were added.

## Verification

- `bun run lint` — clean.
- `bun run test` — **46 files / 330 tests passing**.
- `bun run build` — succeeded (SPA, Cloudflare compatibility and RSS steps).
- `bun run perf:check` — passed. Browse stays inside its 730 KB total-transfer
  budget after card previews request compact `hqdefault` YouTube thumbnails
  instead of `maxresdefault` images. W25-final run: Home 642.8 KB / 1748 ms LCP,
  Browse 703.3 KB / 2324 ms LCP, Post 782.6 KB / 2092 ms LCP.
- `./scripts/deploy.sh` — build, feed, prerender, timestamped backup, staged
  rsync and release activation completed.
- Live smoke on `https://hive.ausbit.dev`: the live entry asset matches the local
  build; `/witnesses`, `/proposals`, `/@ausbitbank`,
  `/@ausbitbank/delegations` and `/c/hive-174578` return 200 and render the new
  analytics, authority, delegation and community sections.
- Deployment backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261118T064801Z.tar.gz`
  (sha256 `477ccec85261bbfd7a43bfdf7b9733a508033bf106d5b42762b12f28fee32827`).
- `bun run test:e2e` — **40 Playwright tests** (32 before W25, plus 6 governance
  flows and 2 new axe route checks at 1440px and 390px).
- New axe coverage: `/@ausbitbank/delegations` and `/c/hive-174578`.
- New 390px overflow test covers `/witnesses`, `/proposals`,
  `/@ausbitbank/delegations`, `/@ausbitbank` and `/c/hive-174578`.
- Governance E2E covers witness analytics, proposal analytics, the delegation
  explorer, account authority risk and community insights.

## Notes and limits

- **Witness trends are local.** Hive exposes cumulative missed-block counters
  and the latest feed timestamp, not per-witness trend history. The analytics
  card records at most one snapshot every six hours and keeps 30 snapshots in
  `localStorage`; the trend column starts at the first recorded visit.
- **Inbound delegations are history-derived.** Hive has no delegatee index, so
  inbound rows are reconstructed from the last 1,000 account operations and
  verified against up to 60 recent delegators' current outgoing lists. The page
  states this limit.
- **Proposal projections are estimates.** The chain stores current proposal
  state rather than a payment ledger. Paid-to-date, remaining commitments and
  the monthly outlook are derived from payment windows and are labelled as
  projections.
- **Topics are inferred.** Proposals have no category field, so the topic mix
  uses keyword signals from the subject and falls back to `other`.
- **Voter overlap is capped.** Overlap uses the first 1,000 recorded voters on
  each side and is presented as a signal, not a judgement.
- **Voter segments are a sample.** A witness's voter list is fetched up to 1,000
  records; the first 250 voters are resolved to accounts for HP and age bands.
  The card labels the sample size and keeps the returned voter total visible.

## Follow-ups

- The origin nginx config in `deploy/nginx/hive.ausbit.dev.conf` now has a
  dedicated `/@account/delegations` metadata location and a wallet-style title.
  The live origin still serves the previous config until a privileged
  `nginx -t` + reload can be run; the SPA route works, but crawlers currently
  see the generic `@author: permlink — Hive post` title for delegation URLs.
- Consider caching governance snapshots in an optional backend if a true
  multi-device trend is wanted.
- Revisit inbound delegation coverage if a Hive API adds a delegatee index.
- Add proposal vote-history charts if a reliable payment ledger endpoint is
  adopted.
