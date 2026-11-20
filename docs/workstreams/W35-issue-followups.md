# W35 — Re-opened issue follow-ups

Date: 2026-11-20
Status: complete — deployed and live-verified

## Scope

Five issues were reopened after W34 with specific follow-ups. This pass
addresses those reports only.

## #44 — Account tab arrow still showed

The arrow elements are always rendered by Quasar; W34 only toggled the
`outside-arrows` prop, which left Quasar's initial `leftArrow` ref at `true`.
The strip now keeps Quasar's normal arrow behaviour and hides the arrow
elements with CSS until the measured `scrollWidth` exceeds `clientWidth` by
more than 2px. Web-font loading triggers a second measurement.

Verified at 1440, 1200, 1024 and 980px: `scrollWidth === clientWidth` on all
four, and both arrows compute to `display: none`.

## #58 — No un-reblog control on the full post

`condenser_api.get_content` returns an empty `reblogged_by`, so the post page
could never know the viewer had reblogged the post. The page now calls
`condenser_api.get_reblogged_by` and falls back to the post field when the
viewer is signed out. The `@emrebeyler/introducing-hivescan-io-yet-another-block-explorer`
post now renders an active **Reblogged** button with the title “Remove your
reblog” for `@ausbitbank`.

## #60 — 3Speak placeholder was an empty, unclickable anchor

`render-helper` emits `<a class="markdown-video-link markdown-video-link-speak"
data-embed-src="…">` with no `href`, no text and no image. The anchor had zero
size, so the play badge floated beside it and clicks landed on the paragraph.
The anchor now gets a real 16:9 block (`display:block`, full width, aspect
ratio, border), `role="button"`, `tabindex="0"`, a “Play video” label, and
Enter/Space support.

Verified on `@buzzer11/buzzer11-vmhagj6`: the placeholder is 710×399 and one
click replaces it with the Snapie player iframe.

## #70 — Follower cards were cluttered

`userCard` was written for the pre-revamp pages. It is now a compact card:

- avatar, display name and handle on one row;
- a two-line clamped bio;
- one metadata row (HP, location, last active);
- a compact Follow/Following button, lazily reading the relationship on first
  click.

Verified at 1440px: cards are 278px wide, 121px tall, with consistent rows and
no website/cover clutter.

## #72 — Add Magi information to the wallet page

New `wallet/MagiBalances.vue` section:

- reads `bridge.getMagiAccount`-style balances from the Magi GraphQL API;
- shows a USD total plus liquid HIVE/HBD, staked, savings, unstaking and
  pending balances;
- lists the five most recent Magi ledger transactions;
- links to Altera;
- renders only when the account actually has Magi assets.

A **Magi** hash tab is added to the wallet portfolio header only when those
assets exist. Verified on `@ausbitbank/wallet`: tab and section appear with
0.025 HBD / $0.03.

## Verification

- `bun run lint` — clean.
- `bun run test` — 74 files, 684 tests passed.
- `bun run build` — succeeded.
- `./scripts/deploy.sh` — deployed. Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261120T004050Z.tar.gz`.
- Live Playwright checks for all five reports passed.
