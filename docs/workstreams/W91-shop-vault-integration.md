# W91 — Shop and Banksia Vault integration

Date: 2026-11-28
Status: implemented, verified locally, deployed and live-smoked

## Scope

Make the Hive Open Market shop Vault-aware without changing the Vault protocol,
key handling or encryption.

Banksia Vault membership products are ordinary HOM subscription products. Their
purchase memo also carries a public reader key and subscription id so the
creator can wrap the ring key. A generic `/pay` transfer or cart checkout would
be a valid HOM payment but an invalid Vault payment: it would take money without
issuing access.

W91 fixes the routing and adds guards:

- The shop labels Vault membership products and sends their Subscribe CTA to
  `/subscribe?blog=<creator>&product=<author/permlink>`.
- Product detail pages explain the reader-key flow, show membership benefits and
  hide the cart/quantity controls.
- `/pay` refuses to queue a generic membership transfer and offers the
  membership page instead.
- Cart checkout rejects membership lines with an explicit reader-key reason;
  the cart disables checkout while a membership is present.
- `/orders` labels Vault payments and subscriptions and sends membership
  management to `/subscriptions` instead of offering a second cancellation
  path.

Not in this workstream: changing Vault metadata, crypto, grant issuance,
bulletins, gift issuance, tiers, relay/delegation or the membership price
source. The HOM product post remains the only source of truth for amount and
recurrence.

## Components

| Area | Files |
| --- | --- |
| Detection and URLs | `src/services/shopMembership.js` |
| Checkout guard | `src/services/shopCart.js` |
| Storefront | `src/pages/blog/BlogShop.vue` |
| Product detail | `src/pages/blog/BlogProduct.vue` |
| Legacy payment | `src/pages/pay.vue` |
| Cart | `src/pages/cart.vue` |
| Order labels and management | `src/services/shopOrders.js`, `src/pages/orders.vue` |
| Tests | `tests/unit/shop-membership.spec.js`, extended `shop-orders`, `e2e/blog.spec.js` |

## Detection rules

`membershipFromProduct` reuses `parseVaultProduct`, so the shop agrees with the
Vault paywall:

- a product with `banksia_vault_product` is a membership;
- an ordinary HOM subscription tagged `membership` or `vault` is a membership;
- ordinary one-time products and unrelated subscriptions are not.

The detection reads only public post metadata. It never reads a reader key or
any local Vault state.

## Authority and privacy

- No new signing authority. Membership payments still queue `recurrent_transfer`
  or one-time `transfer` with the active key on the apex.
- No new crypto and no protocol changes.
- The shop never builds a Vault memo. It only routes to the existing Subscribe
  flow, which owns reader-key generation and memo construction.
- `/orders` detects the Vault memo extension locally for display; it does not
  import the Vault crypto layer or decrypt anything.

## Verification

Local, 2026-11-28:

- `bun run lint` — clean.
- `bun run test` — 219 files, 2,101 tests passing. New `shop-membership` suite
  plus extended `shop-orders`.
- `bun run build` — succeeded.
- `bunx playwright test e2e/blog.spec.js --config=playwright.config.js` — 18
  checks passed, including axe at 1440×1100 and 390×844 for the membership
  catalogue, membership detail and the pay/checkout guards.
- `bunx playwright test e2e/vault.spec.js --config=playwright.config.js` — all 8
  Vault checks still pass (paywall, grant unlock, expiry, tamper, subscribe,
  creator dashboard, reader subscriptions, composer).
- The existing normal-product `/pay` and checkout E2E checks still queue the
  exact expected operations.
- Deployed from a clean worktree at app commit `8fc408b`; live stamp
  `20261127T172544Z-8fc408bc5e08`. Deploy verification passed. The Worker was
  unchanged by W91.
- Live smoke against `ausbit.vsc`:
  - `ausbit--vsc.banksia.io/shop` shows one “Membership” card whose Subscribe
    link is `https://banksia.io/subscribe?blog=ausbit.vsc&product=ausbit.vsc%2Fmembership`;
  - the membership detail page shows the reader-key explanation and has no Add
    to cart button;
  - `/pay?product=ausbit.vsc/membership` shows the Vault warning, has no queue
    button and links to `/subscribe`;
  - `/checkout?items=ausbit.vsc%2Fmembership:1` shows the reader-key error,
    renders zero checkout lines and disables queueing;
  - no console or page errors.

## Remaining

- Membership gift purchase is not exposed in the shop; the Vault Subscribe flow
  owns `gift_for` and remains the only path.
- The shop does not yet filter “memberships only”; tag chips and search already
  expose the `membership`/`vault` tags.
- The product-wide seller trust card now covers membership products too; a
  membership-specific completed-sale count is still future work.
- The optional Vault relay remains W90 work in a separate repository.
