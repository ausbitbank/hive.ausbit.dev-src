# W2 — Mobile / UX / accessibility

Status: implementation complete (pending coordinator integration + browser smoke).

Branch: `improve/phase-2`. This workstream stayed out of W4-owned files
(`blocks.vue`, `create.vue`, `rc.vue`, `proposal.vue`, stores/services/router).

## What changed

### Mobile search

- `src/components/searchbox.vue`
  - Removed `debounce="3000"` and the `gt-xs` class from the form, so the same
    component can render in the mobile header dialog.
  - Submits through the form and Enter (with a 500 ms duplicate-submit guard).
  - Replaced the heuristic-only routing with `parseQuery` / `parseUrl`:
    - numeric → `/block/<n>`
    - 40-char hex → `/tx/<id>`
    - `@user` → account, `@user/permlink` → post
    - full `hive.ausbit.dev`, `hive.blog`, `peakd.com`, `ecency.com` URLs
      (`/@user`, `/@user/permlink`, `/trending/tag`, `/created/tag`, `/b/<n>`,
      `/tx/<id>`, `www.` variants); query strings and fragments are ignored
    - `#tag` and `hive-123456` → `/trending/<tag>`
    - a bare valid account name → account route
    - anything else → `q-notify` error explaining the accepted formats
  - Added `autofocus` prop for the mobile dialog.
  - Search/clear icons became real `q-btn`s with accessible names.
- `src/layouts/MainLayout.vue`
  - Desktop search wrapped in `gt-xs`; mobile (`lt-sm`) search icon button opens
    a full-width top `q-dialog` containing the shared search box.
  - Username text in the toolbar title is hidden below `sm`; the logo link has an
    accessible label.

### Responsive account header

- `src/components/accountHeader.vue`
  - `q-tabs` now use `mobile-arrows`, left alignment below `sm`, `no-caps` and
    `inline-label`; removed `shrink` and per-tab colour classes.
  - Inactive tabs inherit `text-grey-4` on the dark toolbar (better contrast;
    active colour stays white).
  - Profile service icons are wrapped in a flex/wrap container and the
    `userServices` root is a centred wrapping flex row, so long service lists no
    longer overflow.
  - Account name heading is a real `h1` by default (via a new `headingTag` prop);
    `post.vue` passes `headingTag="div"` so the post title remains the only `h1`.

### Fluid carousels / home overflow

- `src/pages/Index.vue`: removed the fixed `400px` wrapper and inline widths;
  uses a fluid `.home-column` (`max-width: 450px`), plus a visually hidden `h1`.
- `coingeckoCarousel`, `coingecko`, `recentPostsCarousel`,
  `rankedPostsCarousel`, `communityFeedCarousel`, `recentVotedPostsCarousel`:
  responsive carousel widths (`100%` below `sm`, `400–450px` above), taller
  mobile heights where content wraps, responsive skeletons, carousel region
  labels, and avatar/coin image `alt` text.
- `comments.vue` loading skeleton is now fluid instead of fixed `400px`.

### Mobile browse toolbar

- `src/components/browseContainer.vue`
  - Desktop advanced bridge toolbar is hidden below `sm`.
  - Mobile gets a `Filters` button that opens a full-width dialog with the same
    method/account/sort/tag/limit/observer/start_author/start_permlink fields and
    a Browse action.
  - The Full/Preview/Media/Table toggle becomes a compact `View` select below
    `sm`.
  - Added explicit empty states: “No posts found.” and “No posts match the
    current filters.”
  - Passes loading to the table view.
- `src/components/browseTable.vue`: accepts the `loading` prop and labels the
  expand row button.

### Internal navigation

- `src/components/EssentialLink.vue`: added an optional `to` prop. Internal
  entries render router links; external entries render real anchors with
  `target="_blank"` and `rel="noopener noreferrer"` (no `openURL`).
- `src/layouts/MainLayout.vue` drawer:
  - **Explore**: Home, Browse posts, Latest blocks, Witnesses, Proposals.
  - **Tools**: HBD monitor, Internal market, API nodes, Health, Tax export,
    Create an account.
  - **Community & links**: the previous external/affiliate links.
  - Drawer closes on navigation.

### Accessibility

- `index.html`: viewport is now `width=device-width, initial-scale=1` (zoom is
  no longer blocked).
- `src/css/app.scss`: `.sr-only`, `.skip-link` (visible on focus), global
  `:focus-visible` outline, and `prefers-reduced-motion` handling (including the
  animated gradient background).
- `MainLayout`: skip-to-content link and `id="main-content"` + `tabindex="-1"` on
  the page container; accessible names for menu/settings/mobile search; title
  logo label.
- `h1` per primary page: home, account/wallet (account header), post, block, tx,
  browse, proposals, witnesses, nodes, HBD, market, markets.
- Accessible names added to icon-only controls in the touched header, browse,
  wallet, witness, settings, queue/notification components; `aria-label`s match
  their `title`s.
- Avatar/coin/token images have `alt` text; decorative icons are `aria-hidden`.
- `aria-label` added to voting/downvote progress bars (`account.vue`), the HBD
  debt-ratio bar (`hbd.vue`) and the header vote-power bar (`userLogin.vue`).
- Account tabs, browse controls, carousels, wallet actions and user-card follow
  FAB have names.

### Empty / error / loading states

- `browseContainer`: explicit no-posts / no-filter-match states (above).
- `coingecko` + `coingeckoCarousel`: track loading/error, show
  “Price data unavailable” with a Retry button instead of silently vanishing.
- `wallet.vue` Hive-Engine tab: loading spinner, error banner with Retry, and a
  “No Hive-Engine token balances” empty banner; token/market metadata requests
  now resolve to `[]` when the account has no tokens.
- `proposals.vue`: loading spinner, load error + Retry, and “No proposals match
  the current filters.”
- `nodes.vue`: “No API nodes are configured.” empty state.

### Copy

- `settings.vue`: background toggle labels are now “Dark background” /
  “Animated background” with an explanation; default beneficiary section
  explains that the default entry supports the site and can be edited/removed.
- `userLogin.vue`: “Remember me” explains it stores only the username, and that
  SmartLock keys are memory-only and need the password after a reload.
- Username text hidden in the mobile header; the account button label reflects
  the logged-in user.

## Checks run

- `bun run lint` (`eslint .`) → **passes, 0 errors, 0 warnings**.
- Compiled every modified SFC with `@vue/compiler-sfc` (`parse`,
  `compileTemplate`, `compileScript`) → all parse/compile OK.
- `rg` for fixed carousel widths (`400px`/`450px`/`width:400px`) → only
  non-carousel `max-width` cards remain.
- Scripted audit of `<q-btn icon=…>` in every touched file → no unnamed
  icon-only buttons remain except deliberate `v-if="false"` placeholders and one
  commented-out block in `wallet.vue`.
- Scripted audit of `q-img`/`img` in home/account/wallet/browse components → all
  rendered images have `alt` (one remaining match is inside an HTML comment).
- `git diff --check` → clean.
- Did **not** run `bun run build` / `bun install` (per workstream rules).
- Did not take browser screenshots: no headless browser/screenshot tooling is
  installed and installing is out of scope. Recommend a coordinator smoke at
  390px for home/account/wallet/browse/blocks.

## Decisions / notes

- Kept the search parser self-contained in `searchbox.vue`; adding another Hive
  front-end only requires extending `URL_HOSTS`.
- URLs are parsed with the browser `URL` API and only explicit `http(s)` hosts in
  the allowlist are accepted; `javascript:`/protocol-relative input is rejected.
- `accountHeader` owns the page `h1` by default because it is the prominent
  title on account/wallet/browse pages; post pages override to `div`.
- Mobile browse keeps the existing post-filter popup as a separate button; the
  new `Filters` dialog is for the advanced bridge fields.

## Open issues / coordinator actions

- **W4**: `/blocks` route/page does not exist yet. The drawer links to `/blocks`
  now, so it will 404 until W4 lands.
- **W4**: `src/components/rc.vue` (W4-owned) still needs an `aria-label` on its
  `q-linear-progress`; not edited here by ownership rule.
- Browser smoke at 390px is still required to confirm no overflow and that all
  account tabs are reachable with the mobile arrows.
- `communityHeader.vue` tabs were not redesigned for mobile in this batch; its
  avatars did get `alt` text.
- Other low-contrast labels outside the touched components may remain; audit with
  axe after integration.
