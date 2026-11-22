# W63 — Theme system and profile skins

Date: 2026-11-22
Status: implemented, deployed and verified

## Scope

A token-first theming layer for the whole app, plus a safe, on-chain profile
skin format.

- Ten built-in themes: Hive Dark (default), Hive Light, Honeycomb, Solarpunk,
  Cyberdeck, Neon Tide, Paper & Ink, Aurora, Retro Relay and Graphite.
- An Appearance page (`/appearance`) with theme previews, system-follow,
  profile-skin visibility, motion and high-contrast settings.
- A Theme Wall (`/themes`) with built-in themes and skins published by accounts
  the viewer follows.
- A Skin Studio (`/settings/skin`) that designs, validates, previews and queues
  a profile skin for publishing.
- A `ProfileSkin` scope on account, blog and post pages. Site chrome, wallet,
  settings, login, queue and composer stay on the viewer's theme.
- Public metadata under `posting_json_metadata["hive.ausbit.dev"]`, written
  with `account_update2` and posting authority.

## Why the format is the security boundary

A skin is a strict JSON manifest of hex colours, closed enums, short strings
and app-owned asset IDs. It is never turned into a `<style>` element or a CSS
string. `url()`, `position: fixed`, `@import`, selectors, remote fonts and
arbitrary geometry have no representation in the schema. Each token is applied
with `style.setProperty` or Vue's style binding; unknown keys are rejected.

The validator also enforces:

- `#rgb`/`#rrggbb` colours only;
- 4.5:1 text and muted-text contrast against the surface;
- a 6 KB theme cap, depth cap, control-character and bidi rejection;
- a closed profile enum set and a curated sticker list;
- `https:` image URLs only (rendered as `<img>`, never as CSS backgrounds);
- plain-text tickers (no `<`/`>`), 140 characters maximum.

The renderer adds `isolation: isolate` and `contain: paint` to the skin scope,
keeps the site header/footer/skip link/badge outside it, and excludes
security-sensitive surfaces entirely.

## Implementation

`src/themes/`

- `color.js` — hex parsing, mixing, alpha, luminance/contrast, contrast repair,
  deterministic HSL palettes and avatar colour extraction helpers.
- `registry.js` — ten built-in manifests and lookup helpers.
- `tokens.js` — primitives to derived app tokens, Quasar variables, chart
  palette, font stacks and high-contrast overrides.
- `schema.js` — strict validator and hostile-input limits.
- `account.js` — read/merge/remove the namespaced metadata, build the
  `account_update2`, and preserve unrelated profile fields.

`src/stores/appearance.js`

- Device preferences persisted under `ausbit:appearance`.
- A tiny `ausbit:appearance:boot` cache for the pre-paint script.
- Applies tokens, `data-theme`/`data-mode`/`data-texture`/`data-motion`,
  `color-scheme`, Quasar dark mode and `<meta name="theme-color">`.
- Fixes Quasar's Dark plugin hand-off by applying the real app `$q` after
  mount; the boot `$q` is a different instance.

`src/boot/theme.js`, `src/css/tokens.scss`, `src/App.vue`

- Theme boot, token defaults, Quasar surface overrides, texture layer, motion
  and high-contrast rules, skin-scope decoration, avatar frames, nameplates,
  card materials, ticker and sticker styles.
- `index.html` applies the last cached background/text before first paint so a
  light theme does not flash the dark splash.

`src/pages/appearance.vue`, `src/pages/themeWall.vue`,
`src/pages/skinStudio.vue`, `src/components/theme/ProfileSkin.vue`

- Appearance gallery, following wall, authoring studio and scoped renderer.
- The studio has built-in presets, an avatar-derived palette, 13 colour
  controls, type/shape/backdrop/frame/nameplate/card controls, a ticker, a
  sticker shelf, live preview, contrast meters, JSON copy/download and a
  publish/unpublish confirmation with a metadata diff.
- Publishing re-reads the account, refuses to merge if the on-chain metadata
  changed while the studio was open, preserves unknown keys, sends the legacy
  `json_metadata` back verbatim and queues the operation for the existing
  signer.

`src/pages/account.vue`, `src/pages/browse.vue`, `src/pages/post.vue`

- Wrap eligible content in `ProfileSkin`; the viewer can ignore one author's
  skin or hide all skins immediately, and the author's skin is left untouched
  on chain. Ignored authors are managed from Appearance.

`src/components/settings.vue`, `src/components/propsEditor.vue`

- Appearance section in the settings popup.
- `propsEditor` no longer sends an empty `json_metadata` string when updating
  `posting_json_metadata`.

## Token migration

The old palette was spread across 154 Vue style blocks and the global
stylesheet: 1,672 hex occurrences and 637 `rgba()` occurrences. A one-off
codemod (`scripts/theme-codemod.mjs`) mapped the palette to `--c-*` tokens and
`color-mix()` overlays. `scripts/check-theme-tokens.mjs` now fails CI when a
style block reintroduces a raw colour, with a narrow allowlist for deliberate
fixed white in QR/media overlays. The W62 community browser landed while this
workstream was in progress; its pages were tokenised afterwards, so light-mode
community cards, the community header and the public directory are checked too.

The codemod left `#fff` only where it is intentional: QR plinths and icons over
dark media scrims. They are documented as fixed visual constants in the
scanner.

## Verification

- `bun run lint` — 0 errors and the token scanner is clean. One unrelated
  warning remains in `communityIndex.vue` for an in-progress
  `CommunityMiniCard` registration from the separate community workstream.
- `bun run test` — 118 files, 1,006 tests passing.
- `bun run build` — succeeded.
- `bun run perf:check` — all budgets passed.
- `bun run test:e2e` (fast Obscura suite) — 71 passed, 10 failed, 7 skipped.
  The failures are the known Obscura/live-data set: compose media checks,
  community rules, browse filters, connections, two dashboard flows, three
  infinite-scroll flows and the v4v.app POS response shape. Every affected spec
  was re-run in Chromium and passed (`actions`, `infinite-scroll`, `pos`,
  `browse`, `connections`, `dashboard`, `themes`).
- `e2e/a11y.spec.js` in Chromium — 19/19 passing.
- New `e2e/themes.spec.js`: theme switch and persistence pass in both engines;
  the mocked published-skin test runs in Chromium.
- Playwright screenshots at 1440px for all ten themes, the Appearance page, the
  Theme Wall and the Skin Studio. Light-mode checks also cover the public
  community directory, a community page and a profile with a cover image.
- A mocked chain response was used to render a published Neon Tide skin on
  `/@ausbitbank`: badge, ticker, sticker tray, mesh backdrop, halo avatar,
  gradient nameplate and glass cards all rendered inside the skin scope while
  the site header stayed on the viewer's Hive Dark theme.
- System-follow + light OS preference resolves to Hive Light; high contrast
  resolves to black/white tokens.
- Theme data unit tests cover CSS injection, unknown keys, prototype keys,
  oversized/deep input, contrast failures, unsafe image URLs, ticker markup,
  bidi controls, metadata merge/preserve/remove and the `account_update2`
  shape.

## Deployment

Deployed on 2026-11-22 with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261122T112629Z.tar.gz`
- Live GET requests return 200 for `/appearance`, `/themes` and
  `/settings/skin`; the Cloudflare metadata Worker serves their prerendered
  shells with `x-hive-meta: theme-shell` until the nginx vhost config is
  reloaded. The repo nginx config now has exact locations for those routes.
- Live smoke: all ten theme cards render; Hive Light switches the document and
  body classes and persists across reload; the Theme Wall renders ten built-in
  cards; the signed-out Skin Studio shows its sign-in state; the profile page
  loads with no page errors.
- Publish fix: `account_update2` now sends an empty legacy `json_metadata`
  (Hive means "leave unchanged") and only `posting_json_metadata`. Echoing the
  current `json_metadata` back escalated the operation to active authority and
  caused `Missing Active Authority` on publish. A live queue smoke confirms the
  queued action uses the `posting` key type and has no active/owner/memo fields.
- Queue repair: restored `account_update2` items signed with posting authority
  are normalised to an empty legacy `json_metadata` before retry, so a failed
  action queued by the earlier build is repaired after a reload instead of
  failing again. Live smoke seeded a stale failed item and confirmed the store
  held an empty `json_metadata` with the posting key type.
- Viewer control: the skin badge has no report action. “Ignore this skin” hides
  only that author and can be undone from Appearance; “Hide all skins” remains
  the global switch. Live smoke confirmed the badge actions, per-author
  persistence and restore with no page errors.

## Follow-ups

- Install the updated `deploy/nginx/hive.ausbit.dev.conf` with sudo and reload
  nginx. The edge Worker already covers the three routes, so this is an
  infrastructure tidy-up rather than a functional blocker.
- Community skins (the community account already has metadata; the mechanism is
  ready, the route scope is intentionally disabled).
- Named theme libraries and a curated public gallery (theme codes, import and
  collage atmosphere landed in W67b).
- Optional self-hosted display fonts if the measured bundle budget allows.
- Deployment and production live smoke.
