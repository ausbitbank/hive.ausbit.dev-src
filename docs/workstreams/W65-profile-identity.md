# W65 — Profile identity cleanup

Date: 2026-11-23
Status: implemented, deployed and live-smoked

## Scope

Replace decoration with identity on profile skins, without changing the
security boundary of the theme manifest.

- Remove the sticker tray and animated marquee ticker from `ProfileSkin` and
  the Skin Studio.
- Keep `profile.stickers` and `profile.ticker` accepted for themes published
  during W63. Stickers are ignored; ticker text migrates to a static status
  line.
- Add optional `profile.status` with plain text (80 characters), a closed icon
  enum and no HTML or URLs.
- Add the fixed Profile Shelf shell on account pages only.
- Add Hive Circle: up to six accounts from the author's public following list.
- Add a latest or pinned post module.
- Extend the Studio with status, Circle and post controls and a legacy-sticker
  migration note.

## Schema

`profile.status: { text, icon }`, `profile.circle: [name]` and
`profile.post: "latest" | "pinned" | "none"` are additive W63-compatible
fields. `profile.stickers` and `profile.ticker` stay accepted but are no longer
returned by the validator; ticker text becomes `profile.status.text`.

Limits: status 80 characters, Circle 6 valid Hive account names, deduplicated,
post a closed enum. Images still require HTTPS on an approved image host.

## Components

- `src/components/theme/StatusLine.vue` — static, one line on desktop and two
  on mobile, no animation.
- `src/components/theme/HiveCircle.vue` — avatar row with visible names,
  links and accessible labels; at most six accounts.
- `src/components/theme/ProfileShelf.vue` — fixed order: status, Circle,
  latest/pinned post. Only mounted on the account page; lazy and fail-open.
- `src/components/theme/ProfileSkin.vue` — no ticker/sticker rendering; exposes
  the resolved theme to slot content and resolves light/dark variants.
- `src/pages/account.vue` — renders the shelf under the account header.
- `src/pages/skinStudio.vue` — status, Circle and post controls; no sticker
  controls; legacy note.
- `src/stores/appearance.js` — `showSkinStatus`, `showSkinExtras` and
  `skinEffects` viewer controls.
- `src/css/tokens.scss` — ticker/sticker styles removed.

## Verification

- `bun run lint` — 0 errors (one unrelated warning in `communityPulse.js`); the
  theme token scanner is clean.
- `bun run test` — 136 files, 1,168 tests passing at the final W67b gate.
- `bun run build` — succeeded after the unrelated dashboard workstream landed.
- Targeted Chromium E2E and axe — covered by the W65–W67b verification pass.
