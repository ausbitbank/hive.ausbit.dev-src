# W65 — Dashboard widget expansion

Date: 2026-11-23
Status: in progress
Epic: <https://github.com/ausbitbank/hive.ausbit.dev-src/issues/93>
Research: [`docs/dashboard-widgets-research.md`](../dashboard-widgets-research.md)

## Goal

Grow the customisable home dashboard from ten widgets into a useful daily home
for Hive power users: account vitals, pending wallet actions, creator stats,
governance watch, HBD peg/yield, community pulse, then network, L2 and
discovery widgets.

The full candidate list, data sources and acceptance criteria live in the epic
and the research document. This record tracks implementation and verification.

## Phase 0 — platform

- Persona presets / layout gallery.
- Lazy, visibility-aware widget mounting for expensive widgets.
- Settings kinds for lists, accounts, windows and amounts.
- Shared widget-action pattern (read-only widgets can ship first).

## Phase 1 — account, creator, governance, community, HBD

- Account vitals.
- Wallet actions (read-only).
- Creator stats.
- Governance watch.
- HBD peg & yield.
- Community pulse.

## Phase 2 — next wave

Delegations, witness round, node health, Hive-Engine watchlist, trending tags,
drafts/queue, community spotlight, my-communities source, HIVE-in-sats.

## Phase 3 — actions and experiments

Widget actions, growth snapshots, portfolio trend, Lightning/keepsats, Magi,
account watchlist, safety warning, KE ratio (#86), news digest, shared layout
gallery, price alerts.

## Verification

Filled in as each phase lands:

- `bun run lint`
- `bun run test`
- `bun run build`
- targeted E2E / axe at 1440px and 390px
- browser smoke of add/configure/persist and guest states

## Notes

- Read-only first. Active-key actions are a separate, reviewed step.
- No auto-broadcast; the existing queue is the only signing path.
- Estimates (vote value, pending rewards, curation APR, HBD interest) must be
  labelled as estimates.
- No unbounded lists or background polling.
