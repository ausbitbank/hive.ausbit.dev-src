# W87 — Blog portfolio and Hive Open Market shop

Date: 2026-11-27
Status: complete — implemented, tested and deployed

## Scope

Add two owner-controlled pages to the blog:

- **Portfolio** (`/portfolio` on the blog host): a curated image gallery from
  selected posts, with grid or masonry layout and a full-screen viewer.
- **Shop** (`/shop` on the blog host): a catalog of the account's Hive Open
  Market products, with price, status and Buy/Subscribe links.
- **Payment handoff** (`/pay` on `banksia.io`): reviews a product post, derives
  the amount and memo from chain data, and queues a normal Hive transfer or
  recurrent transfer on the apex. The blog itself stays read-only.

Also shipped:

- Settings for portfolio title/description/layout/permlinks and shop
  title/description, with automatic Portfolio/Shop nav links when enabled.
- Worker metadata for `/portfolio` and `/shop` (blog host) and `/pay` (apex).
- Nginx metadata shell for `/pay`.

Not shipped: a cart, shipping calculation, escrow, reviews, product creation
inside Banksia, a subscription-management UI, or a full-page portfolio editor.

## Research

### Hive Open Market

A product is a regular Hive post (or comment) whose `json_metadata` contains:

```json
{
  "content_type": "product",
  "version": 0.1,
  "currency": "HIVE:HBD",
  "price": 25,
  "subscription": 0,
  "subscription_recurrence": 730,
  "status": 1,
  "tags": ["hosting", "linux"]
}
```

- `currency` is `CHAIN:TICKER`; Banksia supports `HIVE:HBD` and `HIVE:HIVE`.
- `status`: 1 active, 2 inactive, 3 out of stock.
- `subscription: 1` with `subscription_recurrence` in hours.
- A purchase is a transfer or `recurrent_transfer` with the memo
  `{"product":"author/permlink","quantity":N}`.
- The protocol MVP has no escrow or reviews and warns that there are no buyer
  guarantees. Banksia shows the same warning and does not auto-broadcast.

### PeakD portfolio

PeakD marks a post “Show in Portfolio”, then shows its first image in a gallery
with topic filters and a full-screen viewer. Banksia uses an explicit curated
permlink list instead, which is easier to edit from posting metadata and does
not require a new post-level flag.

## Files

| Area | Files |
| --- | --- |
| Portfolio images | `src/services/blogPortfolio.js` |
| Product parsing, memo, totals | `src/services/blogShop.js` |
| Portfolio page | `src/pages/blog/BlogPortfolio.vue` |
| Shop page | `src/pages/blog/BlogShop.vue` |
| Payment handoff | `src/pages/pay.vue` |
| Routes/nav | `src/router/routes.js`, `src/router/blogRoutes.js`, `src/layouts/BlogLayout.vue` |
| Settings | `src/pages/blogSettings.vue`, `src/services/blogSettings.js` |
| Edge/origin | `deploy/cloudflare/metadata-worker.mjs`, `wrangler.jsonc`, `deploy/nginx/banksia.io.conf` |

## Authority and privacy

- Portfolio and shop settings are normal on-chain blog metadata written with
  the posting key.
- The shop reads public product posts; no product data is copied to a server.
- The `/pay` page requires the buyer to be signed in and queues an **active-key**
  transfer. The amount, seller and memo are derived from the fetched product
  post, not from URL parameters, so a crafted link cannot change the amount.
  Quantity is constrained to 1–99, status must be active, and only HIVE/HBD
  products are payable. The queue still requires explicit wallet approval and
  never auto-broadcasts.
- The warning on the page is explicit: direct Hive transfer, no escrow, no buyer
  protection.

## Verification

- `bun run lint` — clean.
- `bun run test` — 195 files, 1,694 tests passing. New `blog-shop` and
  `blog-portfolio` suites; schema and worker suites extended.
- `bun run build` — succeeded.
- `e2e/blog.spec.js` — 10 checks pass with axe at 1440×1100 and 390×844,
  including portfolio viewer, shop listing and the pay review/queue flow.
- The pay E2E verifies the queued operation is exactly:
  `["ausbitbank","active",["transfer",{"to":"alice","from":"ausbitbank","amount":"25.000 HBD","memo":"{\"product\":\"alice/managed-hosting\",\"quantity\":1}"}]]`.
- Deployed with `./scripts/deploy.sh`; deploy verification passed.

## Remaining

- Reviews, escrow, cart and shipping.
- Product creation/editing inside Banksia (use the composer with HOM metadata
  for now).
- Automatic portfolio inclusion via a post flag, plus topic filters.
- Subscription management beyond the initial 12-payment queue.
- Full axe matrix for every theme and both variants.
