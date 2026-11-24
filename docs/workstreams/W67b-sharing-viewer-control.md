# W67b — Sharing and viewer control

Date: 2026-11-23
Status: implemented, deployed and live-smoked

## Scope

- Theme code export/import with preview before apply.
- Remix from the Theme Wall with attribution.
- Adopt a published palette as a local site theme.
- Theme Wall mode/tag/credential/recent/featured filters and search.
- Viewer controls for calm effects, hidden status, hidden shelf extras and
  ignored authors.

## Theme codes

`src/themes/shareCode.js` encodes a validated theme as
`hive-theme:1:<g|j>:<base64url>`. Export prefers gzip through
`CompressionStream` and falls back to plain JSON. Import checks the prefix,
size, base64, gzip and finally runs the strict theme validator. The Studio
shows a preview and requires “Use this theme” before the draft changes. Nothing
is applied from a query string.

## Remix and adoption

- Wall cards set `remixedFrom` to the original author and open the Studio with a
  local draft. The skin badge preserves attribution on publish. “Reset to
  original” restores the remix snapshot.
- “Use palette” previews the palette in a dialog, then stores a validated site
  theme in `ausbit:appearance.customTheme` on this device. It never modifies the
  author's on-chain skin. Appearance can remove the adopted palette at any time.

## Theme Wall

- Search by author/theme name.
- Mode filter: any, dark, light.
- Tag filter built from the visible themes.
- Kind filter: credential, achievement, minimal.
- Tabs: Built-in, Following, Recent and Featured. Featured includes explicitly
  tagged themes and published skins with a curated credential.
- Empty and failure states do not block the wall.

## Viewer controls

`src/stores/appearance.js` persists `skinEffects` (`full`/`calm`),
`showSkinStatus`, `showSkinExtras`, `profileSkins`, `ignoredSkinAuthors` and the
adopted custom theme. The Appearance page exposes each control and the ignored
author list. Calm removes drift/grain/hover motion while keeping palette and
static atmosphere; hiding extras keeps the look but removes Circle, badges and
the post card. “Ignore this skin” and “Hide all skins” remain; there is no
report action.

## Verification

- `bun run lint` — clean.
- `bun run test` — 136 files, 1,168 tests passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passes on the W65–W67b tree (theme-only worktree,
  measured at commit `28e2927`). The shared working tree currently fails the
  Home route/total JS budgets because of the concurrently developed dashboard
  widgets, which are outside W65–W67.
- Chromium E2E — 3/3 in `theme-share.spec.js` (wall filter, remix, adopt,
  viewer-control persistence, code import preview/rejection) plus 4/4 in
  `themes.spec.js` and `badges.spec.js`.
- Axe at 1440px and 390px — all 23 routes, including `/appearance`, `/themes`
  and `/settings/skin`. One full run reported a transient `/browse` violation;
  the route passed immediately on a focused re-run.

## Final gate and production smoke (2026-11-24)

- `bun run test` — 162 files, 1,416 tests passed on current master.
- `bunx playwright test e2e/themes.spec.js e2e/badges.spec.js e2e/theme-share.spec.js --project=chromium`
  — 8 passed.
- `bunx playwright test e2e/a11y.spec.js --project=chromium -g "axe clean: (/appearance|/themes|/settings/skin|/@ausbitbank$)"`
  — 4 passed, both widths per route.
- Deployed with the 2026-11-24 release; backup
  `hive.ausbit.dev-20261124T094544Z.tar.gz`, production `index.html` hash
  `07ccb17a…1f7571`.
- Production origin smoke (the deployed origin over an SSH tunnel; Cloudflare
  challenges direct automated profile requests):
  - `@ausbitbank` loaded its published skin: “Skin by @ausbitbank”, a halftone
    atmosphere and five selected badge chips (PeakD and HiveBuzz). No sticker
    tray or ticker was present.
  - “Hide all skins” removed the skin scope; clearing the local appearance
    preference restored it on reload.
  - `/themes` showed 10 built-in cards and the Built-in/Following/Recent/Featured
    tabs; searching “hive” narrowed the wall to 3 cards.
  - `/appearance` exposed the status and shelf-extras controls; toggling the
    status preference persisted.
  - `/settings/skin` rendered the Skin Studio as a guest.
  - No page errors.

## Deliberate simplifications

- PeakD membership is confirmed with the chain-native follow relationship for
  the six selected badge accounts instead of a Worker proxy; the Studio
  suggestion scan paginates the author's followers.
- The Studio lists earned badges only. Unearned HiveBuzz catalog entries are not
  shown because they cannot be selected.
- Named skin drafts and skin version history are not implemented; the Studio
  keeps the active draft and a remix snapshot. This is the only section 7 item
  not shipped.
- “Used by people you follow” is not shown; the Following tab is the signal.
