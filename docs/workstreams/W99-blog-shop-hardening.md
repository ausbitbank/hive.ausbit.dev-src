# W99 — Blog and shop input hardening

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A security review of blog settings, the metadata Worker and the Hive Open Market
found several places where owner- or chain-controlled text could break a
document, bypass the custom-CSS policy or create an unsafe payment. This
workstream fixes the confirmed cases.

## Fixes

1. **Worker replacement patterns.** `rewriteHead()` built `String.replace()`
   replacements from metadata. A title containing `$&` or `$'` expanded into the
   rest of the document, duplicating head/body markup. Every dynamic replacement
   is now a function replacement (or uses an explicit `open + value + close`
   callback), so dollar sequences stay literal.
2. **Custom CSS escapes.** CSS escape sequences such as `@\69mport` bypassed the
   literal `@import`/`expression` checks. Backslashes are removed before the
   policy checks, and `data:` is rejected anywhere in the stylesheet. Quoted
   `url()` values are parsed with a quote-aware pattern, so a value such as
   `url('javascript:alert(1)')` becomes `about:blank` instead of a relative URL.
   Non-string input returns an empty stylesheet.
3. **Navigation URLs.** Blog navigation accepted `/\evil.example`, which a
   browser can normalise to an off-site URL. Relative hrefs now reject both a
   second slash and any backslash; protocol-relative and backslash forms fail
   validation.
4. **Route and reserved-label collisions.** `shop` and `portfolio` were missing
   from `BLOG_ROUTE_SLUGS`, so a post with those permlinks rendered the shop or
   portfolio page. Service and route names (`checkout`, `cart`, `orders`,
   `subscribe`, `subscriptions`, `settings`, `shop`, `portfolio`, `wallet`, `p`)
   are now reserved blog labels as well.
5. **RSS XML controls.** `escapeXml()` strips XML-1.0-invalid control characters
   and bidi overrides, so one malformed post title cannot invalidate the whole
   feed.
6. **Product prices.** A product price must be a positive HOM asset with at most
   three decimals and below the transfer cap. `formatProductAmount()` returns an
   empty label for values that round to zero, and checkout refuses a line whose
   amount is not a positive Hive asset.
7. **Order memo quantities.** `parsePurchaseMemo()` caps quantity at the cart
   limit (99) instead of accepting any finite number, so a 0.001 HBD transfer
   cannot claim a million-unit sale.

Not changed: blogs remain owner-controlled; custom CSS is still allowed but the
stated policy is now enforced. The open-market MVP still has no escrow or
buyer-protection claims.

## Components

| Area | Files |
| --- | --- |
| Edge metadata | `deploy/cloudflare/metadata-worker.mjs` |
| Blog settings and host | `src/services/blogSettings.js`, `src/services/blogHost.js`, `src/config/blog.js` |
| Feed | `src/services/blogFeed.js` |
| Shop | `src/services/hiveMarket.js`, `src/services/shopCart.js`, `src/services/shopOrders.js` |
| Tests | `tests/unit/blog-worker.spec.js`, `tests/unit/blog-settings.spec.js`, `tests/unit/blog-host.spec.js`, `tests/unit/blog-feed.spec.js`, `tests/unit/hive-market.spec.js`, `tests/unit/shop-orders.spec.js` |

## Authority and privacy

- No authority or signing change.
- No new server, analytics or storage key.
- The shop still queues direct transfers for explicit wallet review.

## Verification

- `bun run lint` — clean.
- `bun run test` — **232 files / 2,255 tests** passing.
- `bun run build` — succeeded.
- Targeted blog/worker/shop suites pass.

## Remaining

- `image-set("data:...")` is now defanged by stripping `data:`, but a full CSS
  parser would be more precise than the current allowlist regexes.
- Order amounts are not cross-checked against the product price when history is
  read; quantity is capped but a mismatched memo/amount pair is still display
  data from the chain.
- Custom domains remain a W84 follow-up.
