# W65 — Dashboard widget expansion

Date: 2026-11-23
Status: Phase 0–3 safe/read-only widgets complete locally; signing and historical/exploratory items deferred
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
  mounted and defers only the widget body.
- Settings kinds for `list`, `accounts`, `window` and `amount`, with
  sanitisation and unit tests.
- Deep-copied default settings so array defaults (the governance watchlist) are
  not shared between widget instances.
- Shared widget-action pattern is still pending; read-only widgets shipped
  first, as planned.

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

Still open for Phase 2: a "my communities" merged feed source for the existing
posts widget, and HIVE-in-sats on the market widget.

## Phase 3 — actions and experiments

Done (read-only):

- **Magi network** — Magi head, version, latency, witness counts, recent
  contracts and DEX token prices.
- **Account watchlist** — reputation, HP and optional HIVE/HBD balances for up
  to 10 configured public accounts.
- **Price alert** — an in-page HIVE USD target with above/below direction,
  distance and triggered state. No browser notifications.
- **Follower growth** — followers/following plus deltas measured from a local
  365-day baseline. A new baseline clearly says tracking starts now.

Deferred deliberately:

- Widget actions (claim/cancel) need the shared action/authority framework and
  a reviewed signing pass.
- Lightning/keepsats needs the session/custody review.
- Portfolio trend needs price and balance history.
- Account safety needs a curated external bad-actor list and a warning-only
  design.
- KE ratio (#86) remains exploratory and controversial; it needs a contextual
  accountability view, not a bare badge.
- Hive news digest can be a posts-widget preset rather than a new widget.
- The shared layout gallery is already covered by persona presets plus the
  existing `HIVE-DASH-1.*` export/import.

## Verification

- `bun run test` — 140 files, 1,201 tests passed.
- `bun run build` — succeeded; home snapshot generated.
- `bunx playwright test e2e/dashboard.spec.js` — 28 passed (Chromium).
- `bunx playwright test e2e/a11y.spec.js -g "custom dashboard templates"` —
  axe clean at 1440px and 390px for the Everyday and Creator templates.
- `bunx playwright test e2e/a11y.spec.js -g "axe clean: /$"` — home axe clean
  at 1440px and 390px.
- Targeted ESLint on every changed/new file — clean.
- `bun run lint` — clean after the concurrent theme work fixed the earlier
  `badges.js` warning.
- `node scripts/check-theme-tokens.mjs` — clean.

## Notes

- Read-only first. Active-key actions are a separate, reviewed step.
- No auto-broadcast; the existing queue is the only signing path.
- Estimates (vote value, pending rewards, curation APR, HBD interest) are
  labelled as estimates.
- No unbounded lists or background polling.
- The HBD widget excludes the `@hive.fund` treasury balance from the debt ratio
  to match `/hbd`.
- The governance widget excludes active requests above 1,000,000 HBD/day from
  the funding totals; the current chain has two spam proposals around
  1e15 HBD/day that would otherwise overflow the card.
