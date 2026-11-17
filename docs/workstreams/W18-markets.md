# W18 — Markets, HBD tools and the internal market

Date: 2026-11-18
Status: complete

## Scope

Priority 3 rebuild: the external market chart page, the Hive internal market and
the HBD peg, savings and conversion tools. Both pages use the existing design
tokens, `.home-card` / `.home-panel` card language, one page-level `h1`, and
section `h2` headings.

Review of the previous surfaces found a fixed 1000×1000 TradingView widget, a
monolithic 376-line `internalMarket.vue` with fixed-width content, no order-book
depth, no open-order table, no fee/balance explanation, and a home market card
that sent HIVE and HBD straight to CoinGecko.

## Market chart page (`/markets`)

`src/pages/markets.vue` is now a chart-and-tools page instead of a chart above a
second copy of the internal market.

- Responsive TradingView chart. The widget fills its container and uses a
  `clamp(360px, 56vh, 660px)` height with a 320px minimum. It measured
  879×616 at 1440px and 366×473 at 390px during browser smoke.
- Pair selection for Binance HIVE/USDT, Binance HIVE/BTC, Upbit HIVE/BTC and
  Bithumb HIVE/KRW, plus 1H/4H/1D/1W interval switching.
- Pair and interval are stored in the URL (`?pair=BINANCE:HIVEUSDT&interval=240`)
  so views can be linked and browser back/forward stays in sync.
- Market snapshot card: HIVE price and 24h change, HBD price and peg badge,
  internal-market HIVE price, spread and 24h volume.
- HBD peg card: external HBD quote, internal-market implied HBD price and median
  feed implied HBD price, each with premium/discount against $1.00.
- HBD savings APR card: consensus `hbd_interest_rate`, paid-monthly note and
  annual/monthly projections for 1,000 HBD.
- HIVE ↔ HBD conversion calculator: direction, amount, internal-market or median
  price source, estimated receive, implied rate and USD estimate. It is
  explicitly an estimate; it does not broadcast.
- Market resources section links into the internal market, the HBD monitor,
  wallet conversions, the HBD stabilizer and the original market interface.
- The `#hbd-tools` anchor is used by the home market card and now scrolls the
  section below the fixed header.

## Internal market (`/market`)

`src/pages/market.vue` keeps the page shell and metadata; the rebuilt
`src/components/internalMarket.vue` is an orchestrator for focused components.

- Ticker strip: last price, 24h change, best bid/ask, spread and 24h volume,
  with a live indicator, last-updated label and refresh action.
- Order book: asks and bids with cumulative depth totals, a spread row and the
  nearest 14 levels per side. Prices are buttons that prefill the order form.
- Recent trades: newest-first tape with side, price, HIVE amount, HBD total,
  relative time and taker account link.
- Open orders: side, amount, receive amount, price, expiry and active-authority
  cancel action. Logged-out and empty states use the standard card patterns.
- Trade panel: buy/sell tabs, price / amount / total inputs, best bid/ask/last
  quick fills, 25/50/75/100% size buttons, balance-aware Max, fill-or-kill and
  inline validation.
- Balances: liquid HIVE, liquid HBD and HBD savings.
- Fees: trading fee is 0% with no deposit or withdrawal step; limit orders
  expire after 27 days. The footer states that orders queue for review.
- Market information explains the native exchange, thin-book arbitrage, active
  authority and links to charts, the HBD stabilizer and the original interface.
- Data refreshes every 15 seconds; failures keep the last values and show a
  retryable warning strip. Account and open orders refresh after login changes
  and after a broadcast refreshes the account through the existing queue.

## Home market card

`src/components/HomeMarketCard.vue` now routes Hive assets into the market
experience instead of CoinGecko:

| Row | Destination |
| --- | --- |
| HIVE | `/markets?pair=BINANCE:HIVEUSDT` |
| HBD | `/markets#hbd-tools` |
| Bitcoin / Ethereum | CoinGecko, `target="_blank"` with `rel="noopener noreferrer"` |

Rows use a chevron for internal routes and an external icon for third-party
links. The footer adds internal-market and HBD-peg links while keeping the
CoinGecko source note.

## Components

| File | Responsibility |
| --- | --- |
| `src/pages/markets.vue` | Chart page orchestration, URL state, prices, median, peg, APR |
| `src/pages/market.vue` | Internal-market page shell, metadata and section actions |
| `src/components/TradingViewWidget.vue` | Singleton TradingView loader, autosizing, re-render on option change, fallback link |
| `src/components/market/MarketChartCard.vue` | Pair selector, interval toggle, chart frame and external chart link |
| `src/components/market/MarketSnapshotCard.vue` | HIVE/HBD snapshot, spread, volume and internal-market links |
| `src/components/market/HbdPegCard.vue` | External, internal and median implied HBD prices |
| `src/components/market/SavingsAprCard.vue` | HBD savings APR and projections |
| `src/components/market/HbdConversionCalculator.vue` | Direction/source/amount calculator with USD estimate |
| `src/components/internalMarket.vue` | Internal-market data loading, ticker, refresh and queue actions |
| `src/components/market/MarketOrderBook.vue` | Asks, bids, cumulative depth, spread and price prefill |
| `src/components/market/MarketTrades.vue` | Recent-trade tape |
| `src/components/market/MarketOpenOrders.vue` | User open orders and cancellation |
| `src/components/market/MarketTradePanel.vue` | Buy/sell form, validation, balances and fee disclosure |

## Services

| File | Responsibility |
| --- | --- |
| `src/services/market.js` | Pair/interval resolution, order-book and trade normalisation, ticker stats, order validation, active-authority queue builders, peg, APR and conversion helpers |

The old fixed-width internal-market feature list, sparklines and expansion
panels were removed. Wallet open-order display and cancellation (W16) are
unchanged.

## Queue authorities

| Action | Authority |
| --- | --- |
| Create limit order (`limit_order_create`) | active |
| Cancel limit order (`limit_order_cancel`) | active |

`buildLimitOrder` sells HBD and buys HIVE for buy orders, sells HIVE and receives
HBD for sell orders, and uses the chain's 27-day limit-order expiration. The
trade panel and open-orders card both state the active-key requirement.

## Verification

- `bun run lint` — clean.
- `bun run test` — 24 files / 199 tests passing (11 new market helper tests).
- `bun run build` — succeeded.
- Headless Chromium, local build:
  - one `h1` and zero horizontal overflow on `/markets` and `/market` at
    1440px and 390px;
  - TradingView iframe renders at 879×616 and 366×473; pair selection changes
    the URL to `?pair=BINANCE:HIVEBTC` and re-renders the chart;
  - `#hbd-tools` scrolls to the HBD section;
  - order book renders 28 ask/bid rows and the tape renders 20 trades;
  - logged-in smoke with a real account loaded balances, prefill from the book,
    queued a sell order as `["ausbitbank","active",["limit_order_create", …]]`
    with `amount_to_sell: 1.000 HIVE` and `min_to_receive: 0.039 HBD`;
  - an account with an open order queued `["quicktrades","active",
    ["limit_order_cancel", { orderid: 1506524981 }]]`;
  - HBD converter changed output when the amount changed and when the direction
    was swapped.
- Axe WCAG A/AA: zero violations on both routes at 1440px and 390px, logged out
  and logged in.
- Deployed with `./scripts/deploy.sh`. Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261117T151025Z.tar.gz`
  (`5468da44a9e382e1995ca06c6703f2bc2d1d4ab8112b9cb7fdf1535084453cf4`).
- Live smoke on `https://hive.ausbit.dev/markets` and `/market`: HTTP 200, one
  `h1`, zero overflow at 1440px and 390px, chart iframe present, snapshot/peg/
  APR/converter populated, order book and tape populated, zero axe violations,
  `#hbd-tools` anchor working, and the home HIVE/HBD rows pointing at the new
  internal routes.

## Notes

- The TradingView loader is now a singleton and the widget re-renders when the
  symbol or interval changes. A failed script load shows a link to the chart on
  TradingView rather than leaving an empty box.
- The internal market asks for 200 book levels but renders the nearest 14 per
  side, with cumulative totals for all loaded levels. The labels show how many
  levels are displayed out of the loaded count.
- Peg premiums compare external HBD, internal-market implied HBD and median-feed
  implied HBD against $1.00. The external quote can diverge from the internal
  and median prices.
- The converter is an estimate only. Chain conversions use the median price over
  the settlement window and require an explicit wallet transaction with the
  active key.
- The router now supports hash scrolling with an 84px header offset; this is
  what makes `/markets#hbd-tools` work from the home dashboard.
