# W15 — Command palette and navigation

Date: 2026-11-17
Status: complete

## Command palette

`src/components/CommandPalette.vue`:

- Opens from the header search trigger, the mobile search button, the drawer
  “Search / jump” item, or `Ctrl/Cmd+K`.
- Focuses the query input immediately.
- Keyboard navigation with ↑/↓, Enter to open, Esc to close.
- Groups results into Jump to / Recent / Commands.
- Parses accounts, posts, account subpages, tags, block numbers, transaction
  ids, proposal commands and Hive front-end URLs.
- Account queries offer profile, wallet, posts, blog and followers actions.
- Tag queries offer Trending, New and Hot actions.
- Remembers the last five destinations in localStorage.
- Includes global commands for home, browse, trending, blocks, witnesses,
  proposals, markets, internal market, HBD, API nodes, network health and
  account creation, plus personal wallet/profile shortcuts when logged in.
- Responsive full-width top dialog on mobile.

## Search parser

`src/services/search.js` was extracted from the old header searchbox and
extended:

- Block numbers and `block 123…`
- Transaction ids and `tx …`
- `@account`, `@account/post` and account subpages
- `#tag`, `hive-123…`
- `proposal 373`
- hive.ausbit.dev, hive.blog, peakd.com and ecency.com URLs

Covered by `tests/unit/search.spec.js`.

## Navigation

- Header now shows a “Search or jump to…” control with a `Ctrl K` hint.
- Mobile search opens the palette instead of a separate search dialog.
- Drawer includes a “Search / jump” command with shortcut hint.
- Removed the old `searchbox.vue` component.

## Verification

- `bun run lint` clean.
- `bun run test` — 18 files / 135 tests passing.
- `bun run build` succeeds.
- Verified header, mobile and drawer triggers, Ctrl+K, account/block/tag/proposal
  routing, keyboard selection, recent history and mobile layout.
- Axe WCAG A/AA: zero violations with the palette open.
