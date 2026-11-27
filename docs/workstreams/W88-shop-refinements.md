# W88 — Shop refinements

Date: 2026-11-27
Status: in progress

## Scope

Turn the read-only W87 shop into an owner-usable shop surface without changing
the blog's read-only trust model:

- Catalog: market-api discovery with chain fallback, cursor pagination, tag
  source, featured products, dedupe, status and sold-out filtering.
- Storefront: tag filter, sort, search, sold-out toggle, load more.
- Product detail: description, gallery, price, status, Buy/Subscribe, seller
  link and a local "You bought this" badge.
- Product/Offer JSON-LD and per-product Open Graph metadata on blog hosts.
- Authoring: a Product mode in the existing composer, with validation and an
  "Edit product" path that reuses the normal edit flow.
- Cart and checkout on the apex: local cart, one re-fetched product per line,
  exact memo per line, one queued operation per item.
- Orders and subscriptions read from public account history.
- No escrow, shipping, fiat checkout, reviews or server-side order storage.

## Research

### Canonical Hive Open Market specification

There is no versioned RFC repository. The de facto specification is the
@borislavzlatanov launch post,
`borislavzlatanov/hive-open-market-buy-and-sell-products-and-services-with-crypto`
(2025-12-05), with the reference backend at
<https://gitlab.com/hive-open-market/hive-open-market-backend>. The backend's
`fetch_data.sql` is what actually defines indexing:

- `content_type = 'product'` and a non-null numeric `version`;
- `currency` must be `HIVE:HIVE` or `HIVE:HBD`;
- `price` is numeric and non-negative;
- `status` must be 1, 2 or 3;
- a subscription requires `subscription_recurrence` between 24 and 8760
  hours;
- the index key is `(author, permlink)` and an edit is an upsert.

There is **no required posting tag, community, beneficiary or depth**. The
backend never reads `parent_permlink` or the community. Live data confirms
this: 43 products use `hive-open-market`, two use `test`, one uses
`hive-106130` and one uses `peakd`. The spec explicitly allows a product to be
a post **or a comment**, and no beneficiary is required.

A purchase memo is:

```json
{"product": "author/permlink", "quantity": 1, "custom": {"optional": "json"}}
```

`custom` is optional and is not used by the Banksia queue.

### Hive Open Market product metadata

A product is a normal Hive post whose `json_metadata` contains `content_type:
"product"`. The known live product
`jokes-on-you/jokes-on-you-send-hbd-get-a-joke` carries:

```json
{
  "content_type": "product",
  "version": 0.1,
  "currency": "HIVE:HBD",
  "price": 0.001,
  "status": 1,
  "tags": ["humour", "jokes"],
  "app": "peakd"
}
```

The post's category is `hive-106130`, while another indexed product uses the
plain category `test`. Indexing therefore follows the metadata, not one
mandatory tag or community.

### market-api.hivehub.dev

Verified on 2026-11-27:

- `GET https://market-api.hivehub.dev/products` is the raw PostgREST table and
  returns a JSON array with a `content-range` header, for example
  `content-range: 0-2/*`.
- `GET https://market-api.hivehub.dev/rpc/products` is the HOM-documented RPC
  and returns whole-unit prices. The raw table's `price` is milli-units.
- Pagination works with `limit`/`offset` (`content-range: 2-3/*`), `Range` plus
  `Range-Unit: items`, and keyset filters such as `id=gt.90`. Without
  `Prefer: count=exact` the total is `*`.
- Filters work PostgREST-style, for example `author=eq.jokes-on-you` and
  `tags=cs.%5B%22hosting%22%5D` (JSON containment on the tags array). There is
  no dedicated by-account or by-tag endpoint.
- `access-control-allow-origin: *`, so the browser can read it directly. No
  rate limit is documented and no `RateLimit-*` header is sent; treat it as
  unbounded and cache/paginate politely.
- **The raw `/products` `price` field is milli-ticker.** The API returned
  `price: 1` for `jokes-on-you/jokes-on-you-send-hbd-get-a-joke`, whose on-chain
  metadata says `price: 0.001`; `/rpc/products` returns `0.001`. `price: 1000`
  and `price: 15500` correspond to 1.000 and 15.500 HBD. Banksia never displays
  the API price: it uses market-api only to discover `author`/`permlink`
  candidates and reads money from the post.

### Recurrent transfers

The Hive `recurrent_transfer` operation body is confirmed by the `hive-tx`
serializer and the developer portal:

```text
from, to, amount, memo, recurrence (hours), executions, extensions[]
```

- `recurrence` is in hours, minimum 24. `executions` is the number of payments;
  a new transfer needs at least 2. The maximum duration is 730 days.
- HiveSQL and the operation evaluator agree: "If `amount` is set to 0, the
  recurrent transfer is be deleted. If there is already a recurrent transfer
  matching from and to, the recurrent transfer is updated." A zero amount
  cannot create a new transfer.
- Mainnet is on HF28 at the time of research, so a cancellation keeps
  `executions: 2` (HF29 relaxes this to 1 when modifying, but it is not live).
  Since HF28 an optional `pair_id` extension distinguishes multiple transfers
  to the same receiver; HOM itself identifies a subscription by the product
  metadata (`subscription: 1`, `subscription_recurrence`) plus the
  `(buyer, seller)` pair and the purchase memo.
- Listing is available through `condenser_api.find_recurrent_transfers`
  (account-scoped), which returns `amount` as a string and `pair_id` on current
  nodes. Cancellation is queued as the same `recurrent_transfer` with `amount`
  `0.000 HBD`/`0.000 HIVE`, the same `from`/`to` and `executions: 2`; Banksia
  leaves the exact operation in the wallet review rather than broadcasting on
  the user's behalf.

### schema.org Product/Offer

- schema.org expects `Product.name`, `image` and `offers`; an `Offer` carries
  `price`, `priceCurrency`, `availability`, `url` and `seller`.
- schema.org's own `priceCurrency` guidance allows "ISO 4217 currency format",
  "Ticker symbol for cryptocurrencies, e.g. BTC", and well-known local
  currencies. `priceCurrency: "HBD"` is therefore schema.org-valid.
- HBD and HIVE are absent from the ISO 4217 list, so Banksia writes the honest
  Hive ticker (`HBD`/`HIVE`) and documents the mapping. It does not substitute
  `USD`, which would misstate the asset.
- Availability maps status 1/3/2 to `InStock`/`OutOfStock`/`Discontinued`.
- Google's product rich-result documentation prefers ISO 4217 currency codes,
  so the HBD offer may not earn a Google rich result. The JSON-LD remains
  correct for other consumers; this is a documented trade-off, not an error.

### Edits and stale index rows

The spec is silent on edits, but the reference backend explicitly upserts by
`(author, permlink)`:

```sql
ON CONFLICT(author, permlink) DO UPDATE SET
  post_title = EXCLUDED.post_title, post_body = EXCLUDED.post_body,
  price = EXCLUDED.price, status = EXCLUDED.status, ...
```

- Edits are re-indexed within roughly one scheduler tick (the backend job runs
  every minute).
- The API exposes only the immutable `created`; there is no `updated`,
  `last_edited`, ETag or version field.
- A deleted post, or an edit that removes `content_type`/`version` or uses an
  invalid value, is skipped by the indexer and the **old row remains**. Clients
  must re-read the chain and should treat `status: 2/3` as the lifecycle signal
  rather than deletion.
- Banksia therefore always re-fetches the post at request/checkout time and
  never trusts an API price, status or seller.

### Pending protocol checks

None that block implementation. The canonical spec was verified from the
on-chain launch post plus the backend's `fetch_data.sql`; the public GitLab was
intermittently offline, so the research also used the GitHub HAFSQL mirror and
live market-api responses.

## Files

| Area | Files |
| --- | --- |
| Catalog/data | `src/services/hiveMarket.js`, `src/services/blogShop.js` |
| Storefront | `src/pages/blog/BlogShop.vue`, `src/pages/blog/BlogProduct.vue`, `src/services/blogProductPath.js` |
| Authoring | `src/components/ProductFields.vue`, `src/services/productDraft.js`, `src/pages/compose.vue`, `src/services/publish.js`, `src/services/drafts.js` |
| Cart/checkout | `src/stores/cart.js`, `src/services/shopCart.js`, `src/pages/cart.vue`, `src/pages/checkout.vue`, `src/pages/pay.vue` |
| Orders | `src/services/shopOrders.js`, `src/pages/orders.vue` |
| Contracts/routes | `src/config/blog.js`, `src/services/blogSettings.js`, `src/router/blogRoutes.js`, `src/router/routes.js` |
| Settings UI | `src/pages/blogSettings.vue` |
| Edge/origin | `deploy/cloudflare/metadata-worker.mjs`, `wrangler.jsonc`, `deploy/nginx/banksia.io.conf` |

## Authority and privacy

- The blog host stays read-only: it never holds keys and never broadcasts.
  Every payment or subscription is queued on `banksia.io` for explicit wallet
  review with `$hiveStore.addToQueue`.
- Shop settings are normal posting-key metadata in
  `posting_json_metadata["banksia.io"].blog`, under the same 12 KB cap.
- Products are public posts. The cart is local storage only. Orders are read
  from public account history; no order database is created.
- Checkout re-fetches every product post. URL parameters select only
  `author/permlink` and quantity, never a seller, price or memo.
- The no-escrow/no-buyer-protection warning is shown wherever payment is
  reviewed or queued.

## Authoring

The composer's Product mode writes the normal post title and body plus:

```json
{
  "content_type": "product",
  "version": 0.1,
  "currency": "HIVE:HBD",
  "price": 25,
  "subscription": 0,
  "status": 1,
  "tags": ["hosting", "linux"],
  "image": ["https://images.hive.blog/hosting.png"]
}
```

`subscription_recurrence` is written only when `subscription` is 1. The HOM
indexer expects a null/absent recurrence on one-time products and 24–8760 hours
on subscriptions, so writing `0` on a one-time product is avoided. Price is a
JSON number with at most three decimals; tags are capped at six; images must be
https. Turning product mode off on an edit removes the HOM-owned keys while
preserving other clients' metadata. The raw `json_metadata` review remains the
escape hatch.

## Verification

Local, 2026-11-27:

- `bun run lint` — clean (ESLint + theme-token check).
- `bun run test` — 200 files, 1,785 tests passing. New suites:
  `hive-market` (15), `blog-product-path` (7), `product-draft` (18),
  `shop-cart` (19), `shop-orders` (24); settings, blog-shop and metadata-worker
  suites extended.
- `bun run build` — succeeded. Icon subset regenerated for the new
  `subscriptions` icon.
- `bunx playwright test e2e/blog.spec.js` (full Chromium, build served) — 15
  checks pass, with axe at 1440×1100 and 390×844 for the shop, product detail,
  cart, checkout and orders pages. The checkout E2E verifies the queued
  operation is exactly
  `["ausbitbank","active",["transfer",{"to":"alice","from":"ausbitbank","amount":"50.000 HBD","memo":"{\"product\":\"alice/managed-hosting\",\"quantity\":2}"}]]`.
  The orders E2E verifies the cancellation is exactly
  `["recurrent_transfer",{"to":"alice","from":"ausbitbank","amount":"0.000 HBD","memo":"{\"product\":\"alice/consulting\",\"quantity\":1}","recurrence":730,"executions":2,"extensions":[]}]`.
- The fast Obscura run was attempted; its current CDP build does not expose
  intercepted POST bodies, so the network-mocked HOM tests are run with the
  full Chromium config. This is a harness limitation, not an app failure.
- Live smoke and deploy verification are recorded in the delivery report.

## Remaining

- Escrow, shipping, fiat checkout, reviews and buyer protection are non-goals.
- No server-side order or subscription database; reads are public history.
- Order history is bounded to the most recent 3,000 rows.
- The canonical HOM spec is still the launch post plus the reference backend;
  there is no versioned RFC to pin.
- Automatic portfolio inclusion and topic filters remain deferred.
- Full axe matrix for every blog theme and both variants remains deferred.
