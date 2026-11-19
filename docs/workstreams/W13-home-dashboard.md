# W13 — Front page dashboard

Date: 2026-11-17
Status: complete

## Goals

- Remove the oversized boxed header.
- Replace the narrow masonry of carousels with a readable dashboard.
- Improve the block preview, coin prices and witnesses while keeping useful
  live data and links.

## Layout

`src/pages/Index.vue` now uses a max-width dashboard shell:

- Compact unboxed header: “Hive at a glance”, short explanation and inline
  quick links.
- Main column:
  - Live block card.
  - Coin prices card.
  - “Posts on Hive” list with Trending / New / Hot tabs.
- Sidebar:
  - Top witnesses card.
  - “From the author” recent posts.
- Responsive: three-column composition on desktop, two cards across on tablet,
  single column on mobile.

## Live block card

`src/components/HomeBlockCard.vue`:

- Shows the latest available block with a live indicator.
- Produced-by witness, relative time, absolute timestamp.
- Metrics: transactions, operations, virtual operations and size.
- Top operation mix chips (e.g. `16× custom JSON`, `1× transfer`).
- Previous / next block navigation, refresh and “All blocks”.
- Automatic 15-second refresh while following the head; stops following when
  the user navigates back, and the refresh button returns to the live head.
- Handles head-1 fallback when the newest block is not yet available.

## Markets

`src/components/HomeMarketCard.vue`:

- Replaced the carousel with a compact market list.
- HIVE and HBD are always first, followed by the other selected coins.
- Each row shows logo, symbol/name, seven-day sparkline, price and 24h change.
- Rows link to CoinGecko; “Markets” opens the internal markets page.
- Refresh button, loading skeleton, error and stale-refresh states.
- The tune button opens “Coins & currency”: pick up to eight coins and a quote
  currency (USD, AUD, EUR, GBP, BTC, ETH). Preferences persist in `homeMarketPrefs`
  and the price snapshot key includes the mix so stale coins never appear.
- AUD has no reliable native CoinGecko market for every coin, so AUD is priced
  in USD and converted with CoinGecko's forex rates (`exchange_rates`), cached
  for 15 minutes. The footer and dialog note when a conversion is in use.

## Witnesses

`src/components/HomeWitnessCard.vue`:

- Top six witnesses instead of the full 25-row list.
- Rank, avatar, name, voting HP, running version and health indicator.
- Warns about disabled signing keys and stale price feeds.
- Shows the network consensus version and links to witness management.

## Posts

`src/components/HomePostRow.vue`:

- Reusable compact post row with thumbnail, title, author, time, community and
  (in the trending list) votes, comments and payout.

`src/components/HomeTrendingPosts.vue`:

- Trending / New / Hot tabs with a six-post list.
- “View all” goes to the corresponding browse route.

`src/components/HomeRecentPosts.vue`:

- Four recent blog posts from `@ausbitbank` in a compact sidebar card.

## Helpers and cleanup

- `src/services/home.js` adds number/USD/percent formatting, operation mix,
  witness HP conversion, market order, block size and operation counts.
- `tests/unit/home.spec.js` covers those helpers.
- Removed unused `coingeckoCarousel.vue` and `rankedPostsCarousel.vue`.
- Kept `recentPostsCarousel.vue` for account pages.

## Verification

- `bun run lint` clean.
- `bun run test` — 17 files / 129 tests passing.
- `bun run build` succeeds.
- Desktop and mobile: no overflow, one `h1`, no console errors.
- Verified block previous/refresh/live states, market refresh, trending tab
  switching and responsive layout.
- Axe WCAG A/AA: zero violations on desktop and mobile.
