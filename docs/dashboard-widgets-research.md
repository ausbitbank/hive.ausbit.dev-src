# Dashboard widget research — what to build next

**Date:** 2026-11-23
**Status:** research + proposal. No code changes.
**Scope:** new widgets for the customisable home dashboard
(`src/components/dashboard/`, `src/services/dashboardLayout.js`).

---

## TL;DR

Six widgets are worth building next:

1. **Account vitals** — voting power, resource credits, vote value, effective HP.
2. **Wallet actions** — power-down, savings withdrawals, conversions, open orders,
   claimable rewards.
3. **Creator stats** — weekly author/curation rewards, pending payouts, top post,
   curation APR.
4. **Governance watch** — DHF budget, proposals closing soon, your governance
   votes nearing expiry.
5. **HBD peg & yield** — internal price vs median, savings APR, haircut distance.
6. **Community pulse** — subscribers, active authors, pending rewards, top post,
   your role.

Two platform changes make all of them more valuable:

- **Persona presets / a layout gallery.** The layout model, named layouts and
  `HIVE-DASH-1.*` export/import already exist; the missing piece is a gallery of
  ready-made dashboards (Creator, Witness, Trader, Community, Governance,
  Developer). This is the cheapest way to make a growing widget catalogue
  discoverable.
- **Lazy, visibility-aware widget mounting.** The registry has a `live` flag
  that nothing reads, and the grid mounts every widget body immediately. As the
  catalogue grows, a six-widget home will otherwise pay for six or more
  first-paint reads.

The short version of the reasoning: the site's real audience is Hive power
users, and the most-used routes are witnesses, proposals, accounts, wallets and
the composer. The dashboard currently answers "what is happening on Hive?" well;
it does not yet answer "how is my account doing?", "what needs my attention?"
or "how is my community doing?". Those are the highest-retention questions.

---

## 1. What the dashboard can do today

The dashboard is an ordered list of instances on a 12-column grid. Widths are
`quarter`, `third`, `half`, `twoThirds` and `full`; each widget declares a
minimum width. A layout holds at most 20 widgets. Layouts and named layouts are
stored per account (or guest) in `localStorage`; `HIVE-DASH-1.*` strings support
sharing between browsers. The editor supports drag/keyboard reorder, width
steps, auto-optimise, rows/masonry and import/export.

Current catalogue (`WIDGET_REGISTRY`):

| Type | Category | What it answers | Account? |
| --- | --- | --- | --- |
| `block` | Network | What just happened in the latest block? | No |
| `market` | Markets | What are my chosen assets worth? | No |
| `witnesses` | Governance | Who is producing blocks, and how healthy are they? | No |
| `posts` | Community | What is being published in a feed? | No |
| `wallet` | Account | What is my portfolio worth, and what can I claim? | Yes |
| `myWitness` | Governance | Where does my witness rank? | Yes |
| `witnessHealth` | Governance | How healthy are the witnesses I vote for? | Yes |
| `network` | Network | What is the chain doing right now? | No |
| `notifications` | Account | What replies, votes and mentions are new? | Yes |
| `operations` | Account | What has this account been doing? | Yes |

Settings are described declaratively in `settingsFieldsFor()` and support
`text`, `number`, `select`, `multi`, `toggle`, `currency` and `coins`. The
dashboard has guest/loading/error/stale presentation, shared cached chain reads,
a build-time home snapshot for the block/market/witness/network/feed cards, and
visibility-aware polling on the widgets that poll.

What is missing is not infrastructure. It is **coverage of the account, creator,
governance and community jobs.**

---

## 2. What the evidence says

### 2.1 The audience is Hive power users

`docs/analytics-review.md` estimates roughly 400–900 real visits per day, with
direct/bookmark traffic dominating and almost no search or social acquisition.
The residual landing-page signal is directional, but coherent:

- `/` — 1,150 loads
- `/witnesses` — 150
- account profiles — around 140 each for the top few
- `/proposals` — 130
- `/search` — 120
- `/@ausbitbank/wallet` — 120
- `/@ausbitbank/blog` — 100
- `/compose` — 80
- `/shorts`, `/browse`, `/hbd` — 40–80

That is not drive-by traffic. It is people checking witnesses, proposals,
accounts, wallets and their own publishing workflow. A dashboard that compresses
those daily checks is more valuable than one that adds another content shelf.

Caveat: the analytics review is explicit that Web Analytics is contaminated and
that SPA navigation is under-counted. Treat these as directional, not precise.

### 2.2 Competitor benchmark

| Tool | What it offers | What it tells us |
| --- | --- | --- |
| **hivescan.info** (HAF block explorer) | Modular drag-and-drop dashboard with **7 templates**: Me, Network, Market, Governance, Creator, Growth, Essentials; signed-in VP/downvote mana/RC; balances, pending rewards, open orders, pending conversions, proposal vote history, incoming RC delegations, witness missed-blocks; DAU, retention, HP distribution, TVL, financial sunburst, influence/delegation map, community/DApp usage; Keychain and HiveSigner sign-in; synced workspaces | The benchmark for breadth. Its network-growth and account-analytics widgets depend on `haf_stats` / `balance_tracker`; a public-API-only SPA cannot match those without a new data source. The **Me, Creator and Governance** widgets are directly reproducible. |
| **HivePulse** (browser extension) | HUD for unread notifications, price, **VP/RC levels**, RC cost estimator, wallet actions, scam shield, dApp switcher, For You feed | Confirms that VP/RC and notification count are the two numbers users want permanently visible. Also shows that "safety" is a real user need, but it is a separate trust/product problem. |
| **HiveStats.io** | Account stats: **curation APR**, vote value, HP, delegations, power-down, RC, reputation, reward history, vote slider | Confirms the creator/curator metrics worth showing. The "curation APR" formula (7-day curation × 52 ÷ HP) is the recognised shorthand. |
| **@ausbitbank's desktop Hive Witness widget** | Witness rank, votes, share of vesting pool, missed blocks; balances and stake; power-down next drip and countdown; portfolio; 7-day sparkline | A direct statement of the owner's own daily checks. Most of it is already available in this app's services, but not on the dashboard. |
| **PeakD / Ecency** | Feeds, wallet, governance and profiles; not user-arranged dashboards | Table stakes, not a dashboard benchmark. |
| **hivetop** | CLI witness monitor | Witness operators want a compact monitor, not a full page. |

### 2.3 What the community repeatedly needs

Across those tools and the site's own workflows, the recurring jobs are:

1. **"Am I okay to transact?"** — voting power, resource credits, recharge time.
2. **"What needs my attention?"** — claimable rewards, power-down drip, savings
   withdrawals, conversions, open orders, governance votes about to expire.
3. **"How is my content doing?"** — pending payouts, weekly author/curation
   rewards, top post, comments and votes.
4. **"How is my community doing?"** — subscribers, active authors, pending
   rewards, top post, my role.
5. **"What is happening on Hive?"** — HBD peg and yield, DHF funding, witness
   round and health, node/API status, Hive-Engine and Magi activity.
6. **"Where do I go next?"** — a link to the full wallet, proposal, community or
   market page, not a dead-end card.

---

## 3. Selection criteria

Each candidate was judged on:

- **Daily value** — does a real Hive user check this most days?
- **Audience** — guests, signed-in users, creators, witnesses, community
  leaders, traders, developers.
- **Data readiness** — can it be built from the existing read layer (public Hive
  APIs, Hive-Engine, Magi, CoinGecko, v4v), or does it need a new indexer?
- **Effort** — S (≈0.5–1 day), M (≈1–2 days), L (≈3–5 days), including tests,
  states, settings and docs.
- **Risk** — signing authority, privacy, false positives, third-party
  dependency, rate limits.
- **Uniqueness** — does it duplicate a page or an existing widget, or does it
  compress a workflow the site already owns?

A widget should do **one job**, work at its minimum width, degrade cleanly when
the network fails, and link to the full page that owns the detail. It should not
become a second copy of `/wallet` or `/markets` inside a card.

---

## 4. Candidate catalogue

### 4.1 Account and wallet

| Candidate | Job | Data / reuse | Effort | Call |
| --- | --- | --- | --- | --- |
| **Account vitals** | Can I transact, and what is my vote worth? | `account` (voting power, manabars, HP), `rc_api.find_rc_accounts`, reward fund, median price, `voteValue.js`, `rc.vue` | S | **P1** |
| **Wallet actions** | What is waiting, and what can I do? | account fields, open orders, conversions, savings withdrawals, pending rewards; `WalletPendingPanel` logic; queue actions | M (read-only), M+ (actions) | **P1** |
| **Delegation snapshot** | Who backs me, and who do I back? | `delegations.js`; incoming needs history reconstruction and per-delegator checks | M | P2 |
| **Rewards & curation** | What did I earn this week? | account history + `bridge.get_account_posts` | M/L | P2 (or fold into Creator stats) |
| **Portfolio trend** | Is my portfolio growing? | 7/30-day price history plus balance snapshots; CoinGecko market chart; local snapshots | M/L | P3 |
| **Account watchlist** | How are the accounts I care about? | account records, follow counts, recent posts; new multi-account setting | M/L | P3 |
| **Account safety check** | Is this account flagged? | external bad-actor list; read-only warning | M | P3 (risk) |
| **Account accountability (KE ratio)** | Is this account retaining its rewards? | account history (author/curation/beneficiary rewards), staked HP, transfers/outflows; issue #86 | M/L | P3 / exploratory |
| **Price alert** | Tell me when HIVE hits X. | local threshold, `getHivePrices()` cache plus a small local poll, in-page state | S | P3 |

Notes:

- **Account vitals** and **Wallet actions** are deliberately separate: one is a
  glance ("am I healthy?"), the other is a task list ("what can I do?").
- A dedicated **power-down widget** is probably not worth it. Power-down fits
  naturally as one row in Wallet actions, and the account page already shows it.
- A **rewards** widget overlaps Creator stats. Start with pending payouts and
  post performance; add historical rewards only if the history read is cheap
  enough.
- A **portfolio trend** sparkline is a nice differentiator (the owner's desktop
  widget has one), but it needs both price history and balance history. Treat it
  as a later enhancement, not a first-wave widget.
- The **KE ratio** (issue #86) needs care. `(author + curation rewards) / staked
  HP` is easy to compute but misleading: it ignores witness, proposal and
  staking income, beneficiary splits, and legitimate reasons rewards leave the
  account (L2 liquidity, NFTs, spending). If it ships, show the reward-source
  breakdown and the limitations, not a bare number or a badge.

### 4.2 Creator and community

| Candidate | Job | Data / reuse | Effort | Call |
| --- | --- | --- | --- | --- |
| **Creator stats** | How is my publishing doing? | `bridge.get_account_posts` (blog), account history, pending payouts, median price | M/L | **P1** |
| **My posts performance** | Which of my posts are earning? | Already partly in the `posts` widget (votes, comments, payout); add a "performance" view rather than a duplicate widget | S/M | **P1** (as part of Creator stats) |
| **Community pulse** | How is this community doing? | `bridge.get_community`, `bridge.get_ranked_posts`, subscriptions/roles | M | **P1** |
| **My communities overview** | Which of my communities need attention? | `buildCommunityCards`, `list_all_subscriptions`, community records | M | P2 (or a Community pulse mode) |
| **My communities feed** | What is new across my communities? | `mergeCommunityFeeds`, subscription list | M | P2 (extend the `posts` widget source) |
| **Community growth** | Are we growing? | local snapshots of subscribers/authors/pending rewards | M | P3 |
| **Community spotlight** | What community should I discover? | `list_communities`, rotating pick | S | P2 |
| **Who to follow** | Who is worth following here? | top authors in your communities; no follower-of-follower graph | M | P3 |
| **Moderation queue** | What needs moderating? | No reports/moderation read API in Hivemind bridge | — | **Not now** |

Notes:

- The existing `posts` widget already shows votes, comments and payout, and can
  browse an account feed. A separate "my posts" widget would duplicate it. Better:
  add a **Performance** view to the posts widget (pending payout, payout date,
  votes/comments per post) and let Creator stats own the totals.
- Community roles come from `bridge.list_all_subscriptions`; `sum_pending` and
  `num_authors` are available in `bridge.get_community`. Verify the exact
  meaning of `num_pending` against Hivemind before presenting it as "weekly
  interactions".
- Moderation is a genuine gap, but there is no public read API for reports or
  flagged content. Community teams still use PeakD/Ecency for that.

### 4.3 Governance and network

| Candidate | Job | Data / reuse | Effort | Call |
| --- | --- | --- | --- | --- |
| **Governance watch** | What does the DHF fund, and what is closing? | `listProposals`, `fundingSummary`, `proposalFundingAnalytics`, `governanceVoteExpiry`, `@hive.fund` balance, `getVoterVoteIds` | M | **P1** |
| **Vote expiry** | Are my witness/proposal votes about to expire? | `governanceVoteExpiry` (already in `authority.js`) | S | **P1** (inside Governance watch) |
| **Witness round & schedule** | Who produces the next block? | `condenser_api.get_witness_schedule`, head block, witness records | M | P2 |
| **Vote concentration** | Is consensus too concentrated? | `witnessVoteConcentration` (top 21/50 share, HHI, Gini) | S | P2 |
| **API / node health** | Are the nodes healthy? | `getApiNodeHealth`, `hiveNodes`, `network.js`, beacon; reuse `/health` logic | M | P2 |
| **HBD stabilizer status** | Is the stabilizer active? | `/hbdstabilizer` reads | S | P3 |
| **Hardfork / version drift** | Are nodes current? | `versionDrift`, config/version reads | S | P2 (fold into Node health) |
| **Treasury / TVL** | How much is locked? | needs `balance_tracker` or indexed history | — | P3 |
| **Network growth (DAU, retention, HP distribution)** | Is Hive growing? | needs `haf_stats` or another indexer | — | P3 (optional integration) |

Notes:

- Governance is unusually well supported by this repo already: funding
  analytics, vote overlap, voter concentration, vote expiry and proposal
  filtering all exist. A compact Governance watch widget is mostly presentation.
- The witness round is a genuinely distinctive, cheap widget. It needs one new
  read (`get_witness_schedule`) and a small amount of care around schedule
  changes.
- Node health should not probe every node on every home load. Use the session's
  existing `getApiNodeHealth()` first, and only run a bounded probe when the
  widget is visible and the cached result is stale.

### 4.4 Markets and layer 2

| Candidate | Job | Data / reuse | Effort | Call |
| --- | --- | --- | --- | --- |
| **HBD peg & yield** | Is HBD at peg, and what does savings pay? | `get_ticker`, `get_order_book`, median price, global props, `/hbd` maths | S/M | **P1** |
| **Hive-Engine watchlist** | How are my L2 tokens doing? | `getHiveEngine()`, `market.metrics`, `hiveEnginePortfolio`, balances | M | P2 |
| **Magi network** | What is Magi doing? | `magi.js`: witnesses, recent contracts, tokens, prices | M | P2/P3 |
| **Lightning / keepsats** | What is my sats balance? | `v4vapp`, `keepsats`, session token | M/L | P2/P3 (sensitive) |
| **HIVE in sats** | What is HIVE worth in BTC? | `getHivePrices()` already returns `btc` | S | P2 (add to market widget) |
| **Internal order book** | Where is the spread? | `get_order_book`, `market.js` normalisers | M | P3 (the `/market` page owns it) |

Notes:

- HBD is the one market widget that is clearly missing. It is public, cheap, and
  directly relevant to savers and traders. The network stats widget shows the
  debt ratio but not the peg, APR or haircut distance.
- Hive-Engine and Magi are differentiators because this app already supports
  them. They must be lazy-mounted and capped: Hive-Engine rate-limits bursts,
  and Magi has its own node selection and probing.
- Lightning is valuable but sensitive. A read-only "recent sats" card is safer
  than a balance/actions card until the session and custody story is settled.

### 4.5 Discovery, platform and quality

| Candidate | Job | Data / reuse | Effort | Call |
| --- | --- | --- | --- | --- |
| **Persona presets / layout gallery** | Give me a useful dashboard in one click. | `DEFAULT_LAYOUT`, `LOGGED_IN_STARTER_LAYOUT`, named layouts, export/import | S/M | **P1 platform** |
| **Lazy widget mounting** | Keep the home fast as widgets grow. | grid wrapper + `IntersectionObserver`; `live` flag | M | **P1 platform** |
| **Action framework** | Let me claim/cancel from a widget safely. | shell action slot, confirm dialog, queue, authority labels | M/L | P2 platform |
| **New settings kinds** | Configure lists of tokens/proposals/accounts. | `list`, `accounts`, `window`, `amount` | S | As needed |
| **Trending tags** | What topics are hot? | `condenser_api.get_trending_tags` (new cached read) or aggregate the trending feed | S | P2 |
| **Hive news digest** | What did the ecosystem announce? | curated accounts/communities, merged feed | M | P2/P3 |
| **Drafts & queue** | What am I in the middle of? | `drafts.js`, `queue.js`, local only | S | P2 |
| **Follower growth** | Am I growing? | `fetchFollowCount` + local snapshots | M | P3 |
| **Shared layout gallery** | What dashboards do others use? | existing `HIVE-DASH-1.*`, static presets, Hive posts | S/M | P3 |

---

## 5. Detailed specs for the first six

### 5.1 Account vitals

**Job:** answer "can I transact, and what is my vote worth?" in one glance.

**Why now:** it is the most requested class of number across HivePulse,
HiveStats and hivescan, and the account page already computes every value. The
dashboard is the natural place for the daily glance.

**What it shows:**

- Voting power: percentage, bar, "full in 2d 4h".
- Downvote power: percentage (or "unavailable").
- Resource credits: percentage, bar, health label, approximate operation budget.
- Vote value: estimated USD and HIVE for a 100% vote at current VP.
- Effective HP: owned + received − delegated − powering down.

**Data and reuse:**

- `fetchAccount()` — `voting_power`, `last_vote_time`, `downvote_manabar`,
  `vesting_shares`, `received_vesting_shares`, `delegated_vesting_shares`,
  `vesting_withdraw_rate`.
- `rc_api.find_rc_accounts` — extract the existing `rc.vue` read into a cached
  service function so the widget, account page and account menu share one call.
- `fetchGlobalProps()`, `fetchMedianHistoryPrice()`, `apiGetRewardFund('post')`.
- `voteValue.js` for the estimate and recharge formatting.
- Use the same formulas as `pages/account.vue`; do not re-derive them.

**Settings:** account (default signed-in user), refresh interval (30/60/300s
or manual), show vote value.

**States and edge cases:**

- Guest: show a log-in prompt, or allow an explicit account for a public
  "any account" mode (see open questions).
- Missing `last_vote_time`: show "—", not 0%.
- RC unavailable: show the percentage as unavailable; never claim 0%.
- Vote value is an estimate: label it "≈" and explain in a tooltip.

**Actions:** none in v1. Link to `/@name` and `/@name/wallet`.

**Effort:** S. **Risk:** low. The main risk is formula drift; centralise the
calculation in `dashboardWidgets.js` and test it.

**Acceptance checks:** works at third width and at 390px; unit tests for VP
regen, RC state and vote value; axe clean; no more than about five first-paint
reads, with global props, prices and median shared with the other widgets.

---

### 5.2 Wallet actions

**Job:** answer "what is waiting on the chain, and what can I do about it?"

**Why now:** the wallet page already computes power-down, savings withdrawals,
conversions, open orders, pending rewards and HBD interest. The owner's own
desktop widget includes the power-down countdown. This is a high-value,
low-invention widget.

**What it shows (read-only first):**

- Power down: next drip, countdown, progress, cycles left.
- Savings withdrawals: amount, destination, due date.
- Conversions: amount, direction, completion date.
- Open market orders: pair, amount, price, cancel link (page).
- Claimable rewards: HIVE/HBD/HP and USD value.
- HBD savings interest: pending amount and whether it is claimable.

**Data and reuse:**

- Account fields, `apiGetOpenOrders()`, `getConversionRequestsAsync()`,
  `getSavingsWithdrawFromAsync()`, global props and prices.
- Extract the pending-action shaping from `WalletPendingPanel.vue` into a pure
  `walletActionsSummary()` in `dashboardWidgets.js` (or a small service) so the
  widget and the wallet page cannot disagree.

**Settings:** account, which sections to show, "enable actions" (default off).

**Actions (phase 2):**

- Claim rewards — posting authority (`claim_reward_balance`), as in
  `claimRewards.vue`.
- Claim HBD interest — active authority.
- Cancel power-down / savings withdrawal / market order — active authority.
- Every action goes through the existing queue, with an explicit authority
  label and confirmation. No auto-broadcast. HiveAuth stays manual-only.

**States and edge cases:**

- "All clear" state is a feature; make it explicit.
- A non-owner viewing the widget sees counts but no action buttons.
- A failed action must leave the row in place and show the queue error.
- The read-only version is useful without any signing risk and should ship first.

**Effort:** M read-only; M+ with actions. **Risk:** medium for actions (active
key), low for read-only.

**Acceptance checks:** counts match the wallet page for the same account;
actions are hidden for non-owners; queue confirmation shows authority; no key
material enters the widget.

---

### 5.3 Creator stats

**Job:** answer "how is my publishing doing this week?"

**Why now:** creator analytics is already a listed follow-up in the roadmap, and
the site's audience includes `/compose`, `/@account/blog` and short-form
publishers. HiveStats and hivescan both make this a first-class surface.

**What it shows:**

- Author rewards and curation rewards for the selected window (7/30 days).
- Pending payouts across recent posts.
- Posts published, votes received, comments received.
- Top post by pending payout (or by votes, selectable).
- Curation APR estimate: 7-day curation × 52 ÷ HP.

**Data and reuse:**

- `bridge.get_account_posts` (sort `blog`, limit ~50) for posts, pending
  payouts, votes and comments.
- `get_account_history` for `author_reward`, `curation_reward` and
  `comment_reward` operations. This is the expensive part. Cap the window and
  the number of pages; if the history is truncated, label it as "last N days of
  loaded history" rather than implying completeness.
- `fetchAccount()`, `fetchGlobalProps()`, `fetchMedianHistoryPrice()`.

**Settings:** account, window (7/30/90 days), show curation APR, show top post,
show pending payouts.

**States and edge cases:**

- No posts in the window: a friendly empty state with a "Compose" link.
- History truncated: show a data notice.
- Rewards are not the same as payouts; pending payouts are estimates until
  payout time.
- Do not mix Hive-Engine or Magi income into "author rewards".

**Actions:** none. Link to `/compose`, `/@name/blog` and the top post.

**Effort:** M/L. **Risk:** low; the main risk is an expensive history read.
Consider shipping the fast version first (pending payouts + post performance)
and adding the historical rewards in a second pass.

**Acceptance checks:** numbers reconcile with a known account for a fixed
fixture; truncated history is labelled; the widget stays under its call budget.

---

### 5.4 Governance watch

**Job:** answer "what is the DHF funding, what closes soon, and are my votes
about to expire?"

**Why now:** `/proposals` and `/witnesses` are among the most-visited routes,
and the repo already has the analytics. Governance is a differentiator for this
app, not an afterthought.

**What it shows:**

- DHF daily budget vs daily committed; projected 30-day commitment.
- Active, funded and unfunded proposal counts.
- Proposals ending in the next N days, with a link.
- Your governance vote expiry: days left before witness/proposal votes lapse.
- Return proposal threshold, with a short explanation.
- Optional watchlist: specific proposal ids you care about.

**Data and reuse:**

- `listProposals()`, `fundingSummary()`, `proposalFundingAnalytics()`,
  `proposalPhase()`/`daysRemaining()`.
- `getVoterVoteIds()` when signed in.
- `@hive.fund` account balance for the total budget.
- `governanceVoteExpiry(account)`.

**Settings:** proposal count, watchlist ids (new `list` setting), show DHF
budget, show vote expiry.

**States and edge cases:**

- The return proposal is not funded like a normal proposal; explain it.
- The HBD stabilizer is excluded from "committed" in `fundingSummary()`; keep
  the same rule.
- A missing `governance_vote_expiration_ts` means "not available", not
  "expired".
- Voting stays on `/proposals`; a widget-level vote is a phase-2 action.

**Effort:** M. **Risk:** low. **Uniqueness:** high for a dashboard.

**Acceptance checks:** funding numbers match `/proposals`; expired/upcoming
proposals are excluded from "active"; vote expiry links to the right page.

---

### 5.5 HBD peg & yield

**Job:** answer "is HBD at peg, and what does savings pay?"

**Why now:** HBD is central to Hive's economy, `/hbd` is already a route, and
the network widget shows the debt ratio but not the peg, APR or haircut
distance. It is public, cheap and useful to savers and traders.

**What it shows:**

- Internal market price vs the 3.5-day median.
- Premium/discount to $1 (or to the median, explained).
- HBD savings APR and a projection for a configurable amount.
- Debt ratio, soft/hard limit distance and print rate.
- "Haircut conditions" status.

**Data and reuse:**

- `getTicker()` / `getOrderBook()` for the internal market.
- `getCurrentMedianHistoryPrice()`, `getGlobalProps()`.
- `network.js` `hbdDebtRatio()`, `parseAsset()`, `hbd_interest_rate`.
- Reuse the `/hbd` page maths; do not duplicate the formula in the template.

**Settings:** projection amount (default 1,000 HBD), show projection, compact
mode.

**States and edge cases:**

- Thin order book: label the internal price as "latest trade", not a guarantee.
- Median unavailable: show "—" for the peg comparison.
- CoinGecko is not needed; median + ticker are enough and cheaper.
- Do not add a TradingView chart; the `/markets` page owns charts.

**Effort:** S/M. **Risk:** low. **Uniqueness:** medium-high; few dashboards put
the peg and savings yield together.

**Acceptance checks:** numbers match `/hbd` and `/markets`; the peg is explained
in one sentence; no third-party price call on first paint.

---

### 5.6 Community pulse

**Job:** answer "how is this community doing, and what is my role?"

**Why now:** community discovery and community pages are strong surfaces in this
app (`/communities`, `/c/:name`, `/@name/communities`), but the dashboard has no
community manager view. This is the missing loop for community leaders.

**What it shows:**

- Subscribers, active authors, pending rewards, weekly activity (verify the
  `num_pending` semantics).
- Your role (owner/admin/mod/member/guest) when signed in.
- Top post by trending score, with payout and comments.
- Optional: a compact list of "my communities" instead of one community.

**Data and reuse:**

- `bridge.get_community` via `fetchCommunity()`.
- `bridge.get_ranked_posts` for the top post.
- `fetchAccountSubscriptions()` and `buildCommunityCards()` for roles.
- `communityInsights()` where a deeper view is needed.

**Settings:** community name (default: the first subscribed community, or
`hive-139531`), mode (one community / my communities), show top post, NSFW
handling.

**States and edge cases:**

- A community that does not exist: a clear "not found" state, not an empty card.
- NSFW communities should respect the existing hide-NSFW preference.
- Pending rewards are not your rewards; label them "community pending rewards".
- Do not imply moderation ability; the read API does not provide it.

**Effort:** M. **Risk:** low. **Uniqueness:** high for community leaders.

**Acceptance checks:** a community card matches `/c/:name`; role is correct for
a known member; NSFW preference is respected; the widget links to the community
page.

---

## 6. Next wave (six more, shorter specs)

| Widget | What it shows | Notes | Effort |
| --- | --- | --- | --- |
| **Delegation snapshot** | Incoming/outgoing totals, effective HP, top delegators/delegatees, recent changes | Incoming reconstruction is expensive (`resolveInboundDelegations` checks up to 60 delegators). Default to outgoing + a cached inbound summary; make history opt-in. | M |
| **Witness round & schedule** | Current round, next producers, your witness's next slot, missed slots | One new read (`get_witness_schedule`). Compute the slot from `head_block_number % 21`; guard schedule changes. | M |
| **API / node health** | Active node, latency, failures/cooldowns, head lag, version drift, Hive-Engine/Magi status | Start from `getApiNodeHealth()` (no probe). Add a bounded probe only when visible. | M |
| **Hive-Engine watchlist** | Chosen tokens: price, 24h change, volume, your balance/value | New `list` setting for symbols; cap at 8; cache 60s; lazy mount. | M |
| **Trending tags** | Top tags with post counts and rewards | Add a cached `get_trending_tags` read or aggregate the trending feed. | S |
| **Drafts & queue** | Draft count, oldest draft, queued operations | Local-only, no network. Useful for the composer-heavy audience. | S |

### 6.1 Suggested sequence

Each line is small enough to be its own workstream with a
`docs/workstreams/W*.md` record.

1. **Platform first** — persona presets, lazy mounting, `list`/`window`
   settings. This makes every later widget discoverable and keeps the home fast.
2. **Account pair** — Account vitals and Wallet actions (read-only). These turn
   the dashboard into a daily home for signed-in users.
3. **Public pair** — HBD peg & yield and Governance watch. These serve guests
   and the site's most-visited governance surfaces.
4. **Creator/community pair** — Creator stats (fast version first) and
   Community pulse. These close the publishing and community-leader loops.
5. **Next wave** — Delegations, witness round, node health, Hive-Engine
   watchlist, trending tags, drafts.
6. **Actions and experiments** — widget actions, follower growth, portfolio
   trend, Lightning/keepsats, Magi, account watchlist, safety warnings.

---

## 7. Platform work that multiplies the widgets

### 7.1 Persona presets / layout gallery

The hardest part of a widget catalogue is discovery. A new user will not add
six widgets one by one. Presets solve that.

Add `DASHBOARD_PRESETS` alongside `DEFAULT_LAYOUT` and
`LOGGED_IN_STARTER_LAYOUT`, then expose them in:

- the one-time setup prompt ("Start with a Creator dashboard"), and
- the editor's Layouts menu ("Start from a template").

Suggested presets:

- **Everyday** — HBD peg, network stats, trending posts, top witnesses,
  community spotlight.
- **Creator** — account vitals, creator stats, posts (own blog/performance),
  drafts, notifications, wallet actions.
- **Witness** — my witness, witness health, witness round, governance watch,
  account vitals, network stats.
- **Community** — community pulse, my communities feed, creator stats,
  notifications, wallet actions.
- **Trader** — market, HBD peg, wallet actions, operations (market), network
  stats.
- **Governance** — governance watch, vote concentration, top witnesses,
  proposals, network stats.
- **Developer** — node health, network stats, Magi, Hive-Engine watchlist,
  block, operations.

Loading a preset should fill the **draft** first, so it can be reviewed and
cancelled, matching the existing editor semantics. The presets should be pure
data, unit-tested like `DEFAULT_LAYOUT`.

**Effort:** S/M. **Value:** the highest of any item in this document.

### 7.2 Lazy, visibility-aware widget mounting

The `live` flag in `WIDGET_REGISTRY` is declared but never read, and
`DashboardGrid` mounts every widget immediately. With 10 widgets this is
tolerable; with 20 and several account/L2 widgets it is not.

Implement one of:

- a small `WidgetViewport` wrapper in the grid that renders a skeleton until the
  cell is near the viewport, or
- a `defer` prop on `DashboardWidgetShell` plus an `IntersectionObserver` in the
  grid.

Keep public, cheap widgets (block, network, HBD) eager. Defer expensive ones
(Hive-Engine, Magi, Lightning, account history, delegations). Also make sure
timers use `pollWhileVisible` and stop when the widget is removed or hidden.

**Effort:** M. **Value:** protects the performance budgets as the catalogue
grows.

### 7.3 Settings schema additions

Today the editor supports `text`, `number`, `select`, `multi`, `toggle`,
`currency` and `coins`. New widgets need:

- `list` — comma-separated token symbols, proposal ids or tags, with max length
  and validation.
- `accounts` — a multi-account list for a watchlist (normalise, dedupe, cap).
- `window` — a 7/30/90-day select.
- `amount` — a positive number for HBD projections.

Add these to `settingsFieldsFor()` and `sanitiseWidgetSettings()` with unit
tests, following the existing clamping and whitelist style.

### 7.4 Widget actions

Read-only widgets are safe and fast. Actions are where the real utility is:
claim rewards, claim HBD interest, cancel a power-down, cancel an order. They
also carry the most risk.

Add a shared `WidgetActionButton` / `WidgetActions` component that:

- checks ownership and login,
- shows the authority ("posting" / "active") before the user commits,
- opens a confirmation dialog,
- calls `$hiveStore.addToQueue()` exactly like the wallet page,
- never auto-broadcasts, and respects HiveAuth's manual-only rule,
- refreshes the widget after the queue is sent.

Do not put signing logic inside individual widgets. Do not add active-key
actions until the read-only version has shipped and been used.

**Effort:** M/L. **Value:** high, but phase it after the read-only widgets.

### 7.5 Snapshot and cache policy

The build-time home snapshot currently pre-warms block, market, witnesses,
network and feeds. Extending it to every new widget would grow the build time
and the shell payload.

Policy:

- Snapshot only public widgets that appear in the default or preset layouts and
  are cheap (HBD, governance summary, community spotlight).
- Never snapshot account data.
- For repeat visits, use the existing `snapshots.js` bounded localStorage cache
  with a visible "updated" time.
- Treat the snapshot as first paint only; live reads replace it.

### 7.6 Shared layouts

`serialiseLayout()` / `parseLayoutText()` already produce pasteable
`HIVE-DASH-1.*` strings. Add a "Copy share text" button and "Import from
clipboard" to the editor. A static preset gallery covers most discovery; a
curated gallery of community layouts can live in docs or Hive posts without a
backend.

---

## 8. Implementation checklist for any new widget

1. **Registry** — add the entry to `WIDGET_REGISTRY`: `type`, `component`,
   `label`, `description`, `category`, `icon`, `defaultWidth`, `minWidth`,
   `defaultSettings`, `singleton`, `requiresAccount`, `live`.
2. **Settings** — add fields in `settingsFieldsFor()` and sanitisation in
   `sanitiseWidgetSettings()`.
3. **Pure shaping** — put the numbers in `dashboardWidgets.js` (or a small
   service) with unit tests. Widgets should not own formulas.
4. **Component** — create `components/dashboard/Widget*.vue`; use
   `DashboardWidgetState` for guest/loading/error, `accountWidgetMixin` for
   account reads, and the cached chain services.
5. **Grid** — import the component, add it to `RENDERED_TYPES`, and add the
   `v-else-if` branch with `settingsFor()` props.
6. **States** — guest, loading, error, stale, empty; a link to the full page.
7. **Data budget** — define the maximum calls on first paint and per refresh;
   lazy-mount if the widget is expensive.
8. **Accessibility** — progress bars with labels, no colour-only status,
   semantic headings, keyboard-operable controls.
9. **Tests** — unit tests for shaping/settings; e2e for add/configure/persist;
   axe at 1440px and 390px.
10. **Docs** — add the widget to the roadmap/workstream record and note its
    data source and limitations.

Quality bar:

- One job per widget.
- Works at its registry minimum width and at 390px.
- No horizontal overflow, no unlabelled charts.
- Honest "stale" and "estimated" labels.
- No key material, no auto-broadcast, no background polling when hidden.
- Links to the page that owns the detail.

---

## 9. Deliberately not recommended (or not yet)

| Idea | Why not |
| --- | --- |
| **DAU, retention, signup cohorts, HP distribution, TVL, top holders** | Needs `haf_stats` / `balance_tracker` or another indexer. The app is a public-API SPA; adding a HAF dependency is a separate product decision. |
| **Moderation queue / reports** | No public read API for community reports or flags. PeakD/Ecency own that workflow. |
| **P&L / cost basis** | The chain has no acquisition cost basis. Any "profit" number would be invented or require manual entry. |
| **AI summaries, price predictions, sentiment** | Off-mission for a trustworthy explorer, slow, and hard to keep honest. HiveSense semantic search is already the appropriate AI surface. |
| **Network firehose** | The block widget already shows the latest block and operation mix; a full firehose is heavy and noisy. |
| **Full price charts inside a widget** | `/markets` and TradingView already own charts. A widget should show the number and link out. |
| **Bad-actor blocking** | A read-only warning is plausible, but blocking is a liability and false positives are likely. If added, it must be a clearly labelled warning with a source and a last-updated date. |
| **Duplicate "my posts" widget** | The posts widget already renders votes/comments/payout. Extend its view instead. |
| **Duplicate account page** | Widgets should compress the glance, not reproduce the full profile. |

---

## 10. Open questions

1. **Public account widgets or self-only?** HiveStats and hivescan expose any
   account's vitals publicly. This app's account widgets currently require
   sign-in. A public "Account vitals" with an explicit account setting would be
   more useful and still privacy-safe (all data is public), but it changes the
   `requiresAccount` convention.
2. **Do we integrate HAF stats?** It is the only way to match hivescan's growth
   and holder analytics. It adds a third-party dependency, CORS/proxy work and
   a new failure mode.
3. **Are widget actions in scope this cycle?** Read-only Wallet actions is
   clearly worth it; signing from a widget needs a shared, tested action
   framework.
4. **Preset gallery or community gallery?** Static presets are cheap and
   reliable. A community gallery needs curation and a place to publish layouts.
5. **What is the first-paint API budget?** A six-widget home should probably
   stay under ~12 reads, with expensive widgets deferred.
6. **Should account widgets be repeatable per account?** Two Account vitals
   widgets for two accounts could be useful, but it doubles the reads. The
   current registry allows repeats unless `singleton` is set.
7. **`num_pending` semantics.** Verify against Hivemind before presenting it as
   "weekly activity" in Community pulse.
8. **KE ratio (#86).** Should the app show the raw Krampus ratio, a contextual
   accountability view, or nothing? The issue is explicitly exploratory and
   skeptical. If added, make it opt-in, explain the formula and limitations,
   and never use it as a ranking or badge.

---

## 11. Sources

- Repository:
  - `src/services/dashboardLayout.js`, `dashboardEditing.js`,
    `dashboardWidgets.js`, `dashboardPrefs.js`
  - `src/components/dashboard/` (shell, grid, state, widget components)
  - `src/services/` (chainData, wallet, proposals, governance, community,
    delegations, market, network, hiveEngine, magi, voteValue, prices)
  - `docs/analytics-review.md`
  - `docs/workstreams/W33-customisable-dashboard.md`,
    `W37-dashboard-magi-tokens.md`, `W38-dashboard-followups.md`,
    `W39-issue-80-default-dashboard.md`
  - `docs/ROADMAP.md`
- Hive tooling:
  - hivescan.info / Hive Dev Proposal #3 — modular dashboard, seven templates,
    account analytics, governance hub:
    <https://hivedocs.info/news/core/development/2026/10/29/hive-dev-proposal-3.html>
  - HivePulse v1.4.0 — notifications, price, VP/RC, RC estimator, wallet,
    scam shield:
    <https://ecency.com/hive-139531/@hdev/hivepulse-v140-the-heartbeat-of-hive-gets-stronger--real-time-prices-user-notifications--more>
  - HiveStats.io — curation APR, vote value, delegation, power-down, RC:
    <https://hivestats.io/>
  - @ausbitbank, "I built a Hive witness widget for my desktop":
    <https://peakd.com/dev/@ausbitbank/i-built-a-hive-witness-widget-for-my-desktop-dmsdux>
  - Hive developer docs, Resource Credits:
    <https://developers.hive.io/tutorials-recipes/calculate_rc_recipe.html>
  - Hive blog, Resource Credits overview:
    <https://hive.blog/wiki/@propolis.eng/resource-credits>
  - GitHub issue #86 (KE ratio investigation):
    <https://github.com/ausbitbank/hive.ausbit.dev-src/issues/86>
  - @cryptoreforma comment requesting the KE ratio:
    <https://peakd.com/hive-139531/@cryptoreforma/re-ausbitbank-tossno>
  - @techcoderx, "Thoughts on krampus ratio, stake shaming and accountability":
    <https://peakd.com/hive-111111/@techcoderx/thoughts-on-krampus-ratio-stake-shaming-and-accountability>
