# W65 — Dashboard widget expansion

Date: 2026-11-24
Status: complete — all Phase 0–3 items implemented, deployed and live-smoked
Epic: <https://github.com/ausbitbank/hive.ausbit.dev-src/issues/93>
Research: [`docs/dashboard-widgets-research.md`](../dashboard-widgets-research.md)

## Goal

Grow the customisable home dashboard from ten widgets into a useful daily home
for Hive power users: account vitals, pending wallet actions, creator stats,
governance watch, HBD peg/yield, community pulse, then network, L2 and
discovery widgets.

The full candidate list, data sources and acceptance criteria live in the epic
and the research document. This record tracks implementation and verification.

## Phase 0 — platform (done)

- Persona presets / layout gallery (`DASHBOARD_PRESETS`): Everyday, Creator,
  Witness, Trader, Community, Governance and Developer. Exposed from the
  editor's Layouts menu and loaded into the draft for review before Save.
- Presets default to masonry, with a mobile fallback to the packed one-column
  grid below 800px so cards stack instead of overlapping at desktop widths.
- Lazy, visibility-aware widget mounting (`DashboardWidgetViewport`) for
  registry entries with `defer: true`; the grid keeps the shell and header
  mounted and defers only the widget body. Widgets outside the default layout
  are also async chunks, so a default home never downloads the expanded
  catalogue.
- Settings kinds `list`, `accounts`, `window` and `amount`, with sanitisation
  and unit tests.
- Deep-copied default settings so array defaults (the governance watchlist) are
  not shared between widget instances.
- Shared widget-action pattern: `WidgetActionButton` with an explicit authority
  label, operation list, confirmation and queue hand-off. Read-only widgets
  shipped before it; Phase 3 wires the actions through it.

## Phase 1 — account, creator, governance, community, HBD (done)

- **Account vitals** — voting power, downvote power, resource credits, vote
  value and effective HP. Uses the account mixin, `rc_api.find_rc_accounts`, the
  post reward fund, the median feed and the existing vote-value helpers.
- **Wallet actions** — power-down, savings withdrawals, conversions, open
  orders, claimable rewards and HBD interest. Read-only; links to the wallet's
  pending section. No signing or claim/cancel buttons yet.
- **Creator stats** — 7/30/90-day author and curation rewards, pending payouts,
  posts/votes/comments, top post and curation APR. Uses the blog feed (capped at
  the bridge's 20-post limit) and up to 1,000 history rows; labels truncated
  history.
- **Governance watch** — DHF daily budget, committed daily pay, daily headroom,
  unfunded requests, active/funded/unfunded counts, proposals ending within 30
  days, optional watchlist and personal governance vote expiry. Implausible
  outlier requests are excluded from the totals and called out.
- **HBD peg & yield** — internal HIVE price vs the 3.5-day median, implied HBD
  premium/discount, savings APR and projection, debt ratio (treasury HBD
  excluded), print rate and haircut distance.
- **Community pulse** — one community or up to three of the signed-in user's
  communities: subscribers, active authors, pending rewards, role and top post;
  not-found and NSFW states.

## Phase 2 — next wave (done)

- **Delegations** — outgoing totals and rows always; incoming reconstructed from
  recent account history and verified against each delegator only when the
  setting is enabled. Effective HP is read from the account record so the lists
  are not double-counted.
- **Witness round** — current producer, round position, upcoming producers,
  missed-block counts and an optional account highlight.
- **Node health** — active API node, latency, failures/cooldowns, head block,
  version/health status, and optional Hive-Engine/Magi probes behind a setting.
- **Hive-Engine watchlist** — chosen L2 tokens with price, 24h change, volume,
  optional balances/value, and links to `/token/:symbol`.
- **Trending tags** — chain tag ranks with a trending-feed fallback, post and
  comment counts, compact payout labels and tag links.
- **Drafts & queue** — local draft counts, oldest draft and signing-queue status
  counts from the Pinia store. The queue is a header popup, not a route.
- **Community spotlight** — a deterministic daily community pick from the
  public directory, NSFW filtered.
- Presets extended: Creator (drafts), Witness (round), Trader (Hive-Engine),
  Community (spotlight + tags), Governance (round), Developer (node health +
  Hive-Engine), Everyday (tags + spotlight).

Phase 2 is now complete: the posts widget can show a merged "my communities"
feed (W69), Community pulse's "mine" mode shows a three-community overview with
the full list on the account's communities page, and HIVE-in-sats ships on the
Coin prices widget (W68).

## Phase 3 — actions and experiments (done)

Read-only widgets:

- **Magi network** — Magi head, version, latency, witness counts, recent
  contracts and DEX token prices.
- **Account watchlist** — reputation, HP and optional HIVE/HBD balances for up
  to 10 configured public accounts.
- **Price alert** — an in-page HIVE USD target with above/below direction,
  distance and triggered state. No browser notifications.
- **Follower growth** — followers/following plus deltas measured from a local
  365-day baseline. A new baseline clearly says tracking starts now.

Final wave:

- **Widget actions** — `src/services/widgetActions.js` builds the exact
  operations for claim rewards (posting), claim HBD interest (active, the same
  transfer/cancel pair as the wallet), cancel power-down, cancel savings
  withdrawal and cancel market order (all active). `WidgetActionButton` shows a
  confirmation dialog with the authority label, the operation names and an
  explicit "nothing is broadcast automatically" warning, then queues through
  `addToQueue`. Actions are off by default (`enableActions`), only appear for
  the signed-in account, and stay in the row with the queue error if signing
  fails. HiveAuth remains manual-only.
- **Community growth** — subscriber, active-author and `sum_pending` deltas from
  a local 365-day baseline. One `bridge.get_community` read; a new baseline says
  tracking starts now.
- **Portfolio trend** — current portfolio value, a local balance baseline
  (one point per six hours, capped at 90) and public HIVE price history from
  CoinGecko (7/30 days, cached ten minutes). The two lines are labelled
  separately and the card says it is not P&L.
- **Lightning / keepsats** — a read-only card that reads an existing v4v.app
  session from memory. With no session it explains how to connect in the
  wallet; it never opens a session, never shows a token and cannot move funds.
- **Account safety** — warning-only comparison against the curated phishing and
  spam lists already used by the moderation layer. It reports every matching
  source with its owner and as-of date, treats a failed list as "not checked"
  rather than "clear", and never hides, downvotes or blocks.
- **Accountability (KE ratio, #86)** — opt-in contextual view. It counts author,
  curation, comment, beneficiary, witness, interest and proposal income, shows
  the reward-source breakdown and always prints the limitations. It is not a
  badge, score or ranking.
- **Hive news digest** — a merge of up to five curated ecosystem accounts'
  blog feeds, deduplicated and bounded, explicitly labelled curated rather than
  editorial.
- Presets extended: Everyday (news digest), Creator (portfolio trend), Trader
  (portfolio trend) and Community (community growth).

## Verification

- `bun run test` — 160 files, 1,413 tests passed.
- `bun run build` — succeeded; home snapshot generated.
- `bunx playwright test e2e/dashboard.spec.js` — 32 passed (Chromium), including
  the new drawer, guest-state, public-discovery and signing-opt-in cases.
- `bunx playwright test` — the full Chromium suite passed: 167 tests, including
  all dashboard, axe, perf, PWA and resilience specs.
- `bunx playwright test e2e/a11y.spec.js -g "custom dashboard templates"` —
  axe clean at 1440px and 390px for the Everyday, Creator, Community and Trader
  templates. The deferred-widget skeleton lost its invalid `aria-label` (generic
  divs cannot carry one), and the price-alert "no target" badge moved to
  `--c-text-subtle` to meet contrast.
- `bun run perf:check` — all route budgets passed. Home total is 421.8 KB; the
  home route JS budget moved from 174 KB to 176 KB for the larger registry and
  settings catalogue. Every non-default widget stays an async chunk, including
  all six new cards.
- `bunx playwright test e2e/a11y.spec.js -g "axe clean: /$"` — home axe clean
  at 1440px and 390px.
- Targeted ESLint on every changed/new file — clean.
- `node scripts/check-theme-tokens.mjs` and `bun run icons:subset` — clean.
- New unit coverage: `widgetActions`, `widget-action-button`, `communityGrowth`,
  `portfolioTrend` (including price-history normalisation), `accountSafety`,
  `keRatio` and `newsDigest`.

## Deployment and live smoke

The dashboard shipped with the 2026-11-24 production release (feature commit
`17a2f13`, deployed inside master `ce38d36`).

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T094544Z.tar.gz`
  (`sha256 b8d5083d…5f7448`).
- Rollback: `./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261124T094544Z.tar.gz`.
- Production `index.html` SHA-256 `07ccb17a…1f7571` matches the local build.
- Live Chromium smoke on `/` with a saved guest layout:
  - Hive news digest rendered curated account posts.
  - Community growth loaded `hive-139531` (3,622 subscribers, 76 active
    authors) and showed “Tracking starts now” with a local baseline.
  - Portfolio trend, Accountability view, Account safety and Lightning balance
    each showed the honest signed-out state.
  - No horizontal overflow at 1440px and no page errors.

## Notes

- Read-only first. Active-key actions are a separate, reviewed step.
- No auto-broadcast; the existing queue is the only signing path.
- Estimates (vote value, pending rewards, curation APR, HBD interest) are
  labelled as estimates.
- No unbounded lists or background polling. The six new cards use manual
  refresh, one bounded read per source and deferred mounting where the read is
  expensive.
- Account safety and the KE view are opt-in and deliberately non-punitive; both
  include their provenance and limits in the card, not just in the docs.
- The HBD widget excludes the `@hive.fund` treasury balance from the debt ratio
  to match `/hbd`.
- The governance widget excludes active requests above 1,000,000 HBD/day from
  the funding totals; the current chain has two spam proposals around
  1e15 HBD/day that would otherwise overflow the card.
