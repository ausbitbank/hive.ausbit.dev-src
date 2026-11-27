# Hive Open Market on Banksia

Protocol reference, current implementation, honest limitations and the plan to
become a competitive shop surface.

Last verified: 2026-11-27
Implementation: W88 (`docs/workstreams/W88-shop-refinements.md`)

This document is deliberately split into **verified protocol facts**,
**what Banksia does today**, **what is still weak**, and **future plans**. Do
not read a future plan as shipped behaviour. Every payment surface still says
what it is: a direct Hive transfer with no escrow or buyer protection.

---

## 1. Executive summary

### What works today

- A product is an ordinary Hive post with Hive Open Market (HOM) metadata.
- Banksia can discover, filter, search, sort and paginate products.
- Product detail pages show the full description, gallery, price, status,
  seller, subscription cadence and Product/Offer JSON-LD.
- Owners can publish and edit products from the normal composer.
- Buyers can add multiple products to a local cart, review every line at
  checkout, and queue one exact Hive operation per line for wallet approval.
- `/orders` reads purchases, sales and active subscriptions from public account
  history and can queue a subscription cancellation.
- The blog host remains read-only: no keys, no broadcasting, no custom
  JavaScript.

### What is still weak

- **No escrow or buyer protection.** A payment is a direct transfer. If the
  seller does not deliver, Banksia cannot reverse it.
- **No reviews or ratings.** Buyers can inspect a seller's public history, but
  there is no purchase-bound review surface.
- **No shipping calculation or fulfilment workflow.** Digital products work;
  physical products still require the buyer and seller to agree off-platform.
- **No fiat/card checkout.** Buyers need HBD or HIVE (or an external on-ramp).
- **No combined payment memo.** HOM is per product. A cart queues one operation
  per item, which is honest but not as tidy as a single order total.
- **Public purchases.** Hive transfers and memos are public chain data. Privacy
  is a protocol-level limitation, not a Banksia bug.
- **Indexer dependency.** Market-api is convenient but centralized; a deleted
  product can leave a stale row. Banksia re-reads chain data before display and
  checkout, but a fully independent index is still future work.
- **No versioned HOM RFC.** The de facto spec is a launch post plus the
  reference backend. That is a governance risk for every client.

### The strategic bet

Banksia should not pretend HOM is something it is not. It should be the most
**trustworthy, legible and usable client** for what HOM actually is, then add
**opt-in, chain-native extensions** for the missing commerce pieces without
taking custody of funds or keys. The differentiators are:

1. **Chain-first truth.** Never trust a catalog price, seller or status when
   money is involved.
2. **No key custody.** Signing stays in the user's wallet; the blog stays
   read-only.
3. **Local-first commerce.** Cart, preferences and purchase badges live on the
   device; no server-side order database.
4. **Honest UX.** The warning is not buried. The exact memo and amount are shown
   before queueing.
5. **Protocol stewardship.** Publish a versioned schema and compatibility tests
   so other clients can implement the same extensions.

---

## 2. Verified protocol facts

### 2.1 What a product is

A product is a normal Hive post (the spec also allows a comment) whose
`json_metadata` contains:

```json
{
  "content_type": "product",
  "version": 0.1,
  "currency": "HIVE:HBD",
  "price": 25,
  "subscription": 0,
  "subscription_recurrence": 730,
  "status": 1,
  "tags": ["hosting", "linux"],
  "image": ["https://images.hive.blog/hosting.png"]
}
```

Required by the reference indexer:

| Field | Rule |
| --- | --- |
| `content_type` | exactly `product` |
| `version` | non-null and numeric |
| `currency` | `HIVE:HIVE` or `HIVE:HBD` |
| `price` | numeric, non-negative (Banksia requires > 0 to sell) |
| `status` | `1` active, `2` inactive, `3` out of stock |
| `subscription` | boolean/0/1, optional |
| `subscription_recurrence` | hours; required 24–8760 when subscription is on |

Optional: `tags`, `image`, `app`, and any other metadata keys. Unknown keys are
ignored by the indexer, which is why Banksia treats unknown blog-settings keys
as warnings rather than unclaiming a blog.

**There is no required tag, community, beneficiary or depth.** Live data
confirms products indexed from `hive-open-market`, `test`, `hive-106130` and
`peakd` categories. The spec explicitly allows a product to be a post or a
comment. Beneficiaries are a post-reward choice, not a payment path.

The canonical description is the @borislavzlatanov launch post
`borislavzlatanov/hive-open-market-buy-and-sell-products-and-services-with-crypto`
(2025-12-05). The reference backend is
<https://gitlab.com/hive-open-market/hive-open-market-backend>.

### 2.2 Purchase memo

A purchase is a `transfer` or `recurrent_transfer` with a JSON memo:

```json
{
  "product": "author/permlink",
  "quantity": 1,
  "custom": { "optional": "json" }
}
```

`custom` is optional. Banksia ignores it today; it is the natural extension
point for shipping choices and order references because it does not change the
HOM-required keys.

### 2.3 Price units

This is the easiest place to get money wrong:

- On-chain `json_metadata.price` is in **whole currency units** (`0.001`).
- `GET https://market-api.hivehub.dev/products` is the raw table and its
  `price` is **milli-units** (`1` means `0.001`). The backend writes
  `v_price * 1000`.
- `GET https://market-api.hivehub.dev/rpc/products` is the documented HOM RPC
  and returns whole units again (`0.001`).

Banksia never displays a market-api price. It uses the API only to discover
`author`/`permlink` candidates and re-reads the post from chain.

HBD and HIVE use three decimals. Banksia does not invent sub-milli precision.

### 2.4 market-api behaviour

Verified 2026-11-27:

- PostgREST JSON array plus `content-range`, e.g. `0-46/*`.
- `limit`/`offset`, `Range` + `Range-Unit: items`, and keyset filters
  (`id=gt.N`) work.
- Filters: `author=eq.<name>`, `tags=cs.%5B%22hosting%22%5D` (JSON
  containment), `parent_permlink=eq.hive-open-market`.
- No dedicated by-account or by-tag endpoint; those are ordinary PostgREST
  filters.
- `access-control-allow-origin: *`; no documented rate limit and no
  `RateLimit-*` headers. Treat it as unbounded and be polite.
- No `updated`/`last_edited` field. `created` is immutable.

### 2.5 Edits and stale rows

The backend upserts by `(author, permlink)`:

```sql
ON CONFLICT(author, permlink) DO UPDATE SET
  post_title = EXCLUDED.post_title,
  post_body = EXCLUDED.post_body,
  price = EXCLUDED.price,
  status = EXCLUDED.status,
  ...
```

Edits re-index within roughly one scheduler tick. But:

- the API exposes no edit timestamp;
- `created` stays the original creation time;
- a deleted post, or an edit that removes required metadata, is skipped and the
  **old row remains**.

Banksia therefore treats the chain post as the source of truth and re-fetches
it for product pages and checkout. Sellers should use `status: 2` or `3`
instead of deleting a product.

### 2.6 Subscriptions

`recurrent_transfer` fields:

```text
from, to, amount, memo, recurrence (hours), executions, extensions[]
```

Verified rules:

- recurrence minimum 24 hours; maximum duration 730 days;
- a new transfer needs `executions >= 2`;
- `amount: 0` deletes/updates an existing transfer and cannot create one;
- mainnet was on HF28 at verification, so cancellation keeps `executions: 2`
  (HF29 relaxes this, but is not live);
- since HF28, `pair_id` in `extensions` distinguishes multiple transfers to the
  same receiver;
- listing is available through `condenser_api.find_recurrent_transfers`;
- a subscription is identified at the HOM layer by the product metadata plus
  the `(buyer, seller)` pair and the purchase memo.

Banksia queues cancellations; it never broadcasts them.

### 2.7 schema.org and HBD

- schema.org `priceCurrency` accepts ISO 4217 codes **or crypto tickers** such
  as `BTC`.
- HBD and HIVE are not ISO 4217 currencies.
- Banksia writes `priceCurrency: "HBD"` / `"HIVE"` and documents why. It does
  not fake `USD`.
- Google merchant-listing rich results want ISO 4217 and may reject the offer.
  Product-snippet parsing is more forgiving. This is an honest trade-off.
- Availability maps `1/2/3` to `InStock`/`Discontinued`/`OutOfStock`.

---

## 3. What Banksia ships today

### 3.1 Surfaces

| Surface | Behaviour |
| --- | --- |
| `username.banksia.io/shop` | Catalog with search, tag chips, sort, sold-out toggle and load-more. Source is the owner's account or a Hive tag; featured products first. |
| `username.banksia.io/shop/<permlink>` | Owner product detail. |
| `username.banksia.io/shop/@author/<permlink>` | Third-party product detail. |
| `/compose` | Product mode: price, currency, subscription + recurrence, status, tags, image, preview and validation. |
| `/cart` | Local cart, grouped by seller, quantity rules, per-ticker subtotals. |
| `/checkout?items=...` | Re-fetches every product, shows exact memos/operations and queues one operation per line. |
| `/orders` | Purchases, sales and active subscriptions from public history; cancellation queued for review. |
| `/pay?product=...` | Legacy single-product handoff, kept working. |

### 3.2 Data flow

```text
blog shop / product page
        │
        ├─ market-api discovery (optional)
        │        └─ author/permlink only; price ignored
        │
        └─ Hive chain post (authoritative)
                 ├─ price, currency, status, tags, images
                 └─ Product/Offer JSON-LD

buyer clicks Buy / Add to cart
        │
        ├─ blog host: local cart + link carrying items
        └─ apex /cart or /checkout
                 ├─ re-fetch every product post
                 ├─ validate status, currency, quantity
                 ├─ show exact memo + amount
                 └─ $hiveStore.addToQueue(active operation)
                          └─ wallet review, no auto-broadcast
```

### 3.3 Authority and privacy

- Blog settings are posting-key `account_update2` metadata.
- Purchases, subscriptions and cancellations are active-key operations queued
  on `banksia.io`.
- The blog host never holds keys and never broadcasts.
- The cart is localStorage. Orders are re-read from public history. There is no
  Banksia order database.
- Product titles, descriptions, tags and seller names are rendered as text, not
  HTML.
- The exact amount, seller and memo come from the fetched product post, never
  from the URL or a tampered cart.

---

## 4. Honest limitations

| Limitation | Impact | Current mitigation | Residual risk |
| --- | --- | --- | --- |
| No escrow | Buyer pays first; no automatic refund | Prominent warning; seller history visible; exact memo review | Buyer must trust the seller |
| No buyer protection | Fraud is not reversible by Banksia | No custody, no promises | Chargeback-like protection does not exist on-chain |
| No reviews/ratings | Buyers cannot see purchase-bound feedback | Public account history, posts, reputation | Sybil/off-platform reputation |
| No shipping calculation | Physical goods need manual agreement | Product description can explain shipping | Surprise costs, disputes |
| No fiat/card checkout | Requires HBD/HIVE or an external on-ramp | HBD is a stablecoin; low fees | Onboarding friction |
| No combined payment | One operation per cart line | Checkout shows every exact operation | More wallet prompts |
| Public chain data | Purchases and memos are public | No extra PII is written | Privacy loss is inherent |
| Centralized index | market-api outage/stale rows | Chain re-fetch at display/checkout | Discovery can be incomplete |
| No versioned HOM RFC | Semantics can drift | Defensive parsing; unknown keys warn | Cross-client incompatibility |
| Three-decimal money | Cannot express <0.001 HBD | Exact 3-decimal formatting | Micro-payments below the unit |
| No auto-renewal reminders | Subscription may run longer than intended | `/orders` shows remaining executions; cancel queued | Buyer must act |
| Order history bound | Older orders not walked | 3,000 recent rows | Long-tail history |
| Blog read-only | No one-click buy on the blog host | Apex checkout link with cart items | Extra navigation step |

### 4.1 Threat model and defences

| Threat | What can happen | Defence today | Planned defence |
| --- | --- | --- | --- |
| Fake seller / impersonation | Buyer pays an account that is not the real seller | Exact seller shown; account history link; no URL-supplied seller | Trust panel, verified social links, reputation signals |
| Bait-and-switch edit | Product changes after the buyer saw it | Checkout re-reads the post; exact memo shown | Show `last_update`; reviews bound to the purchase transaction |
| Stale index row | A deleted product still appears in a catalog | Chain re-fetch before payment | Multi-indexer + provenance labels |
| Fake reviews | Sybil accounts praise a seller | No reviews today | Require `purchase_tx` from the buyer; one review per purchase |
| Phishing memo | A crafted link asks for a different memo/amount | Amount/seller/memo derived from chain, not URL | Keep the exact-operation preview in every surface |
| Address leak | Shipping address written to public metadata | No address field exists | Encrypted memo fulfilment; never public metadata |
| Price unit confusion | 0.001 HBD displayed as 1 HBD | API price ignored; chain price used | Compatibility tests and fixtures |
| Subscription overrun | Recurring payments continue longer than intended | Remaining executions and cancel action | Local reminders, clearer pre-purchase cadence |
| Index poisoning | Spam products flood discovery | Status/tag filters, client moderation | Seller allowlists and opt-in directories |
| Wallet fatigue | Many prompts cause careless approval | One operation per line, exact preview | Batch signing in one transaction |

### 4.2 Things that are not bugs

- **A signed-out checkout cannot queue.** That is intentional.
- **A stale product link can fail.** The chain post may be gone or no longer a
  product; checkout refuses rather than guessing.
- **HBD JSON-LD may not earn a Google rich result.** HBD is not ISO 4217.
- **The blog does not auto-broadcast.** The wallet is the authority.
- **A deleted product can remain in market-api.** That is the indexer's
  behaviour; Banksia re-reads the chain.

---

## 5. Non-goals and why

These are current non-goals, not permanent bans. Each has a condition that
would justify revisiting it.

### 5.1 Server-side order storage

**Not now.** A server-side order book would need identity, retention, breach
response and jurisdiction. It would also become a second source of truth next
to the chain.

**Why it is safe to skip.** Hive history already records purchases, sales and
subscriptions. Local caching plus public history covers the normal buyer.

**What would change our mind.** A seller dashboard that needs fast aggregate
queries across millions of rows, or a legal invoicing requirement that cannot be
met from chain data. Even then, the server should hold an **opt-in encrypted
index**, not keys or funds.

### 5.2 Key custody and auto-broadcast

**Never.** The product is built around user-held keys and explicit wallet
review. A hosted key would make Banksia a custodial exchange and a single point
of failure.

**What we do instead.** Queue exact operations, show the memo, support the
existing wallet/keychain/HiveAuth paths, and keep the blog read-only.

### 5.3 Custom JavaScript on blog hosts

**Not now.** Custom JS would turn every blog into an arbitrary code host and
break the CSP/read-only model. Custom CSS already gives owners strong visual
control.

**What would change our mind.** Nothing for arbitrary JS. A constrained,
reviewed widget system could be considered later, but not free-form script.

### 5.4 Fiat/card checkout inside Banksia

**Not now.** Accepting cards means custody, KYC/AML, chargebacks, tax and
payment-provider integration. It would fundamentally change the trust model.

**Plan instead.** Display fiat estimates as **informational only**, and link to
regulated on-ramps. The settlement remains HBD/HIVE to the seller.

### 5.5 Shipping calculation as an on-chain protocol requirement

**Not now.** HOM has no shipping fields. Inventing required fields would make
Banksia products incompatible with other HOM clients.

**Plan instead.** Optional, namespaced metadata plus the memo `custom` field
(see §6.3). Products without it remain fully HOM-compatible.

### 5.6 Reviews as a required on-chain protocol

**Not now.** A review protocol needs proof of purchase, sybil resistance,
moderation and edit/delete semantics. Shipping a half-designed review system
would be worse than none.

**Plan instead.** A purchase-bound `custom_json` extension with explicit
verification and client-side aggregation (see §6.2).

### 5.7 Analytics and tracking

**Not now.** No third-party analytics, remote fonts or hidden tracking. Shop
metrics should be local or aggregate and privacy-preserving.

---

## 6. Future plans

The sequence is deliberate: **trust signals first**, then **fulfilment**, then
**dispute protection**, then **protocol stewardship**. Each phase must preserve
the read-only blog, user-held keys and chain-first money.

### 6.1 Phase A — Make the current model trustworthy (next)

**A1. Seller trust panel**

Show, on the product page and checkout:

- account age, Hive reputation and posting history;
- number of completed HOM purchases/sales from public history;
- products currently active vs inactive;
- a link to the seller's apex profile and blog.

All signals are computed from public chain data. No score is hidden; show the
inputs.

**A2. Purchase receipts and export**

Generate a local receipt from the transfer transaction and product post:
product, quantity, amount, memo, timestamp, transaction ID, seller. Offer JSON
and CSV export. This helps buyers and small sellers without a server.

**A3. Subscription reminders**

Add an opt-in local reminder when a subscription is close to its next
execution. The reminder links to `/orders` and the cancellation flow. A browser
notification is local-only; no push server.

**A4. Batch signing**

Queue a cart's transfers as **one transaction with multiple operations** where
the wallet supports it. The memo stays per product; the buyer reviews the whole
batch once. This removes the "many wallet prompts" limitation without inventing
a combined-payment memo.

**A5. Better history reads**

Use keyset pagination or a public HiveSQL/HAFSQL read path to walk older orders
without a Banksia database. Keep the current history path as fallback.

**A6. Edit visibility**

Show `last_update` from the chain post and a "seller edited this product" note.
The API lacks an edit timestamp, so read it from chain.

**Success metrics:** fewer abandoned checkouts, more products with a completed
sale, fewer support questions about "did my payment go through", no increase in
key-handling surface.

### 6.2 Phase B — Reviews and fulfilment extensions

**B1. Purchase-bound reviews (`custom_json`)**

Design a small, versioned extension:

```json
{
  "id": "banksia.shop.review",
  "json": "{\"protocol\":\"banksia.shop.review\",\"version\":1,\"product\":\"author/permlink\",\"purchase_tx\":\"…\",\"rating\":1,\"body\":\"…\",\"created\":\"…\"}"
}
```

(The second layer is the normal Hive `custom_json` envelope: a short `id` plus
a JSON string. The example shows both for clarity.)

Verification:

- the buyer must be the `from` account on the referenced transfer;
- the transfer memo must match the product and quantity;
- one review per purchase transaction;
- clients re-check the chain before displaying.

Aggregation is client-side. No global ban list. Moderation uses the existing
Banksia moderation policy and local overrides.

Open questions: edit/delete semantics, seller replies, rating scale, how to
treat refunds/chargebacks (which do not exist on-chain).

**B2. Fulfilment and shipping**

Use optional metadata namespaced under `banksia` so HOM clients ignore it:

```json
{
  "banksia": {
    "shop": {
      "fulfilment": "digital" | "physical",
      "shipping": {
        "regions": ["AU", "NZ"],
        "flat": { "HBD": "5.000" },
        "free_over": "50.000"
      }
    }
  }
}
```

At checkout, the buyer chooses a region and the shipping amount is added to the
line total. The memo stays HOM-compatible and can carry the choice in `custom`:

```json
{
  "product": "author/permlink",
  "quantity": 1,
  "custom": { "shipping": "AU", "shipping_amount": "5.000 HBD" }
}
```

The seller sees the same memo on-chain. No server is required. Products without
the extension remain ordinary HOM products.

**B3. Private fulfilment details**

Never put a shipping address in public metadata. Use the existing Hive memo
encryption path: after purchase, the buyer sends a small transfer with an
encrypted memo containing an order reference and address. Only the seller's
memo key can decrypt it. The UI can guide this flow and keep the ciphertext
on-chain rather than on a Banksia server.

Limitations to solve: wallet support for encrypted memos, UX for key handling,
and how to avoid asking for PII when the product is digital.

**B4. Fiat estimates and on-ramp links**

Show an informational fiat estimate using a public price feed, clearly marked
"estimate, settlement in HBD". Link to regulated on-ramps rather than accepting
cards. No custody, no KYC data stored by Banksia.

### 6.3 Phase C — Dispute protection without custody

**C1. Native Hive escrow**

Hive already has escrow operations: a buyer locks HIVE/HBD with an agent, the
seller and agent approve before a ratification deadline, and release/dispute is
handled by the parties or the agent. Fees go to the agent.

A future Banksia flow could:

1. Let a seller opt into "escrow available" and name an agent/arbiter.
2. Queue `escrow_transfer` instead of `transfer` for eligible products.
3. Show the fee, ratification deadline and release conditions before signing.
4. Track `escrow_approve`, `escrow_release` and disputes in `/orders`.

This is **not** part of HOM today. It must be an explicit, labeled extension and
must never be presented as HOM's default.

Risks: agent trust, fees, arbitration capacity, deadline UX, and the fact that
escrow does not cover off-chain quality disputes by itself.

**C2. Optional mutual-cancellation and reputation**

For digital goods, a seller can voluntarily refund; for escrow, the agent can
release back to the buyer. Record outcomes as review evidence, not as a hidden
score.

**C3. Graduated protection**

Offer three checkout modes, clearly labeled:

- **Direct** — cheapest, no protection (today's HOM behaviour).
- **Escrow** — agent fee, dispute path.
- **Reputation-only** — no custody, but seller history and purchase-bound
  reviews are prominent.

The buyer chooses. Defaults should be conservative, not deceptive.

### 6.4 Phase D — Protocol stewardship and independent indexing

**D1. Publish a versioned Banksia shop schema**

Add JSON Schema files and a compatibility test suite:

- core HOM product metadata;
- Banksia namespaced extensions;
- purchase memo and review custom_json;
- explicit unknown-key policy.

The canonical HOM spec has no RFC. Banksia can publish a clear implementation
guide and propose it to the HOM maintainers without claiming ownership.

**D2. Multi-indexer and chain-first fallback**

- Keep market-api as one discovery source.
- Add a second read-only indexer or a public HiveSQL/HAFSQL query path.
- Always re-fetch the chain post before money moves.
- Surface index provenance ("discovered via market-api; price from chain").
- Never let an indexer outage make a known product unpayable.

**D3. Own fallback index (only if needed)**

A read-only index in Cloudflare KV/D1 or a static snapshot could cover
discovery during market-api outages. It would store only public post
references and refresh from chain. No orders, no keys, no PII. This is an
operational fallback, not a second source of truth.

**D4. Compatibility and deprecation policy**

- Version every extension.
- Treat unknown keys as warnings.
- Keep reading old versions.
- Publish migration notes and fixture posts for other clients.

### 6.5 Phase E — Competitive polish

- **Mobile-first checkout** with a single review sheet and clear fee breakdown.
- **Accessibility:** keyboard-complete gallery/cart, reduced motion, axe matrix
  across themes and widths.
- **Performance:** lazy routes, no heavy dependencies, stable layouts.
- **Internationalisation:** UI strings only; product content stays in the
  seller's language.
- **Seller dashboard:** local sales view, product status, subscription
  cancellations, no server.
- **Export/backup:** cart, purchases and product drafts as JSON.
- **Offline:** PWA shell, queued actions survive reconnect.

---

## 7. Competitive position

A generic marketplace wins on convenience because it custodies money and data.
Banksia cannot win that game without becoming custodial. It can win a different
one:

| Buyer need | Custodial marketplace | Banksia today | Banksia plan |
| --- | --- | --- | --- |
| Pay with card | Yes | No | Fiat estimate + regulated on-ramp links |
| Buyer protection | Platform policy | None (explicit) | Optional native Hive escrow |
| Reviews | Platform-owned | None | Purchase-bound on-chain reviews |
| Shipping | Calculated | Manual | Namespaced shipping extension + memo custom |
| Product discovery | Platform search | market-api + chain fallback | Multi-indexer, provenance |
| Fees | Platform take rate | Hive resource credits, no platform cut | Same |
| Custody | Platform holds funds | User wallet only | Same |
| Privacy | Platform database | Public chain + local cart | Encrypted fulfilment memos |
| Censorship | Platform decides | Chain + client moderation | Local-first moderation |
| Identity | Platform account | Hive account | Reputation and history signals |

The honest pitch is: **“Cheapest settlement, no custody, no platform take rate,
and you can verify every number on-chain. If you need escrow, choose an escrow
seller and pay the agent fee.”**

That is a real option for Hive-native buyers and sellers, especially digital
goods, services, subscriptions and community commerce. It is not a replacement
for a card-first global marketplace, and the UI should not pretend otherwise.

---

## 8. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-27 | Chain is authoritative for price/seller/memo | market-api price is milli-units and can be stale |
| 2026-11-27 | Unknown blog-settings keys are warnings | A new shop field must not unclaim a blog |
| 2026-11-27 | Blog host stays read-only | No key custody, no custom JS, smaller attack surface |
| 2026-11-27 | Cart is local; checkout re-fetches | URL/localStorage cannot be trusted for money |
| 2026-11-27 | One operation per line | HOM has no combined-payment memo |
| 2026-11-27 | HBD stays `priceCurrency: "HBD"` | schema.org allows tickers; do not fake ISO/USD |
| 2026-11-27 | No server-side order DB | Public history + local cache is enough for now |
| 2026-11-27 | Escrow/reviews/shipping are extensions, not HOM core | Keep compatibility with other clients |

---

## 9. Open questions

1. Should Banksia publish a formal HOM JSON Schema and ask the HOM maintainers
   to adopt it?
2. Which escrow agent model is viable: a Banksia-operated agent (custodial
   reputation risk), community arbiters, or seller-chosen agents?
3. How should reviews handle refunds, disputes and edited reviews without a
   server?
4. Can wallets reliably sign encrypted memos for fulfilment details?
5. Is a second indexer worth the operational cost, or is chain-first fallback
   enough?
6. What is the right default: direct payment or escrow-optional?
7. How do we measure "completed sale" without a server-side order book?

---

## 10. References

- HOM launch post:
  <https://hive.blog/@borislavzlatanov/hive-open-market-buy-and-sell-products-and-services-with-crypto>
- HOM backend:
  <https://gitlab.com/hive-open-market/hive-open-market-backend>
- market-api:
  <https://market-api.hivehub.dev/> (OpenAPI at `/`)
- Hive recurrent transfer:
  <https://developers.hive.io/apidefinitions/#broadcast_ops_recurrent_transfer>
- Hive escrow operations:
  <https://developers.hive.io/apidefinitions/#broadcast_ops_escrow_transfer>
- schema.org Offer:
  <https://schema.org/Offer>
- Google product snippet:
  <https://developers.google.com/search/docs/appearance/structured-data/product-snippet>
- ISO 4217 list:
  <https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml>
- Banksia W87/W88 records:
  [`W87`](workstreams/W87-blog-portfolio-shop.md),
  [`W88`](workstreams/W88-shop-refinements.md)
