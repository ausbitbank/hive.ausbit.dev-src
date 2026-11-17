# W5b — Visual polish

Status: implementation complete (pending coordinator integration).

Branch: `improve/phase-2`. Dark-only presentation was preserved; no theme
toggle, data-flow, router, store, service, test or W4 page logic was changed.

## What changed

### 1. Design tokens and shared typography

- `src/css/app.scss`
  - Added `:root` tokens for spacing (`--space-*`), radii (`--radius-*`),
    shadows (`--shadow-*`), borders, surfaces, and type scale
    (`--font-page-title`, `--line-body`, …).
  - Consistent `--radius-card` for `.q-card`, dialog/menu cards and popups.
  - Button labels are sentence case again (`text-transform: none`), with a
    small letter-spacing.
  - Link hover underlines (except tabs/buttons/chips/carousel titles), plus
    shared `.page-title`, `.page-intro`, `.section-title` and `.section-divider`
    helpers.
  - Article typography for `.postbody`: comfortable 1.65 line-height, heading
    scale, blockquote callout, inline/pre code, tables (horizontal scroll on
    mobile), images, lists and rules.
  - Carousel caption dark boxes replaced with a bottom gradient overlay and
    title/author/time/summary hierarchy classes.
  - Footer and mobile search layout classes.
  - Focus states and the existing reduced-motion rules were kept; no colour
    contrast values that currently pass axe were lowered.

### 2. Home hero

- `src/pages/Index.vue`
  - Replaced the visually hidden home `h1` with a visible glass dashboard hero:
    `h1` “Hive block explorer & toolkit”, one-line tagline and chips for
    Browse posts, Latest blocks, Nodes and Witnesses.
  - Responsive (one or two chip rows at 390px), still exactly one `h1`, with the
    existing two-column dashboard and carousels below unchanged.

### 3. Carousel polish

- `recentPostsCarousel`, `rankedPostsCarousel`, `communityFeedCarousel`,
  `recentVotedPostsCarousel`, `coingeckoCarousel`
  - Hard `rgba(0,0,0,.9)` captions replaced with gradient overlays.
  - New hierarchy: clamped title, author/account link + timestamp meta, clamped
    summary; avatar stays above the caption.
  - Rounded/clipped `hive-carousel` images and consistent heights/widths.
  - Preserved `aria-label`s, `alt` text, q-carousel autoplay/swipe/arrow
    behaviour, image helpers and card links.
  - Coin carousel uses a softer full-slide gradient (`carousel-caption--overlay`)
    because its data block is taller than a bottom caption.

### 4. Post page

- `src/pages/post.vue`
  - Article card now has a title section with its own separator, a larger
    clamped `.post-title` (`h1`), roomier body padding and max-width layout
    helpers replacing inline widths.
  - Sidebar card is fluid (`min-width: 0`, full width) instead of forcing
    `300px`, preventing narrow-viewport pressure while keeping the desktop
    column.
  - Comments are wrapped in a full-width `.post-comments` region for consistent
    spacing.
  - Removed the post-body bounce transition so article text is visible
    immediately (this also fixes the body staying at `v-enter-from`/opacity 0
    when animations are paused, e.g. some headless or reduced-motion cases).
  - Scoped heading flattening (`h1…h6 { font-size: 1em }`) removed; article
    headings now use the `.postbody` scale.

### 5. Account header

- `src/components/accountHeader.vue`
  - Softer cover gradient (0.2 top → 0.86 bottom) with dark fallback colour,
    text shadows for contrast over covers, and a bordered avatar ring.
  - Name uses a clamped `.account-header__name`; profile block is constrained
    and line-spaced; service icons use wrapping gap spacing; balances card is
    inset and turns inline/centred below 600px.
  - Tabs bar gets a translucent dark surface, border, radius and consistent
    min-height, while keeping W2's mobile arrows/left alignment/no-caps rules.
  - `headingTag` behaviour is unchanged (still `h1` on account pages, `div` on
    post pages).

### 6. Mobile search dialog

- `src/layouts/MainLayout.vue`
  - Dialog now has a card header (icon + “Search Hive”), hint text, close button
    with accessible name, and a padded full-width input region.
- `src/components/searchbox.vue`
  - Added a `fullWidth` prop used by the dialog: full-width outlined input, no
    toolbar margins/text alignment. Desktop toolbar search is unchanged.

### 7. Wallet / transaction polish

- `src/pages/wallet.vue`
  - Added presentational classes (`wallet-shell`, `wallet-balances`,
    `wallet-tokens`, `wallet-tx`, `wallet-section-title`) and scoped spacing.
  - Wallet shell is `width:100%; max-width:1000px; min-width:0` instead of the
    old `min-width:50%`.
  - Balance/token rows have more vertical rhythm; transaction rows get padding,
    tabular-nums amount emphasis and compact caption styling. Below 600px rows
    tighten and side amounts cap at 45% width so long memos/ids cannot push the
    layout sideways. Data, filters and handlers untouched.

### 8. Site footer

- `src/layouts/MainLayout.vue`
  - In-page `<footer class="site-footer">` under the router-view inside
    `q-page-container` (not a fixed `q-footer`), so it cannot overlap content.
  - Internal links: Browse, Blocks, Proposals, Nodes. Meta: “Powered by Hive”
    (hive.io) and “Source on GitHub” (site repo), both `target="_blank"` with
    `rel="noopener noreferrer"`.
  - Wraps and centres on mobile; visible on `/nodes` at 390px.

### 9. Comments and general spacing

- `src/components/comments.vue`: comments card spacing, header separator and
  nested reply card margins.
- `src/components/comment.vue`: padded comment items, reply indent/divider and
  slightly smaller comment body type on mobile.
- Removed a pre-existing recursive self-import in `comment.vue`
  (`import comment from 'components/comment.vue'`) that caused
  `ReferenceError: Cannot access 'comment' before initialization` and a blank
  post page on initial navigation. The component's own `name: 'comment'`
  provides recursive self-reference.

## Checks run

- `bun run lint` (`eslint .`) → passes, 0 errors/warnings.
- SFC parse/compile check with `@vue/compiler-sfc` for all 13 modified `.vue`
  files → all OK.
- `sass src/css/app.scss` → compiles cleanly.
- `git diff --check` → clean.
- `rg` for newly introduced fixed widths → only `max-width`s, media queries and
  the existing 400px popup remain; no new fixed >390px layout widths.
- Headless Chromium smoke at 390×844 (mobile emulation) and 1440×1200:
  - Home: exactly one `h1`, horizontal overflow `0`, hero chips present,
    footer present.
  - Account `@ausbitbank`: one `h1`, overflow `0`, footer present.
  - Post: one `h1`, overflow `0`, article body + sidebar render, footer present.
  - Wallet `@ausbitbank/wallet`: balances, Hive-Engine tab and transaction rows
    readable; amounts right-aligned and emphasised.
  - Mobile search: dialog opens, header/hint/close present, input full width
    (294px inside the 390px card), input autofocused.
  - `/nodes` at 390px: footer wraps below content without overlap.
- Did **not** run `bun run build` or `bun install` (per workstream rules).
- Screenshots were taken to `/tmp/opencode/*.png` for the smoke run only; they
  are not committed.

## Notes / left for coordinator

- Account tab strips still auto-scroll to the active tab on mobile (W2
  behaviour); the strip is horizontally scrollable with `mobile-arrows`, so no
  tab is lost, but the leading label can be partially off-screen when the last
  tab is active.
- The balance/transaction API calls were exercised through the dev server; no
  data handling changed. A full production build/test pass remains part of the
  final integration checklist.
- Pre-existing Vite console warning (`communityInfo` Pinia getter/state name
  collision) was observed but is unrelated to this workstream and was not
  changed.
