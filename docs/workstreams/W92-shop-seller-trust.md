# W92 — Shop seller trust signals

Date: 2026-11-28
Status: implemented, verified locally, deployed and live-smoked

## Scope

Add public, honest seller context to a shop product page. This is the first
Phase A item from [`docs/HIVE_OPEN_MARKET.md`](../HIVE_OPEN_MARKET.md): make the
current direct-payment model easier to judge without inventing a hidden score.

Shipped:

- A compact seller card on every product page with:
  - account creation date and age;
  - Hive reputation, formatted from the raw chain value;
  - public post count;
  - a link to the seller's Banksia profile.
- A “Seller edited this product on …” note when the chain `last_update` differs
  from the original `created` time.
- Graceful degradation: a failed account read hides the card; it never blocks
  the product or payment review.
- The existing seller link, membership panel, Vault routing, gallery, cart and
  payment guards are unchanged.

Not in this workstream: a numerical trust score, buyer-protection claims,
purchase-count aggregation, moderation labels, or a server-side reputation
database. The card explicitly says these are public Hive account signals, not a
buyer-protection rating.

## Components

| Area | Files |
| --- | --- |
| Signals and formatting | `src/services/shopSeller.js` |
| Product page | `src/pages/blog/BlogProduct.vue` |
| Tests | `tests/unit/shop-seller.spec.js`, `e2e/blog.spec.js` |

## Signals

- **Reputation** uses the familiar Hive conversion:
  `(log10(abs(raw)) - 9) * 9 + 25`, negative for negative raw values. Unknown
  raw values are hidden rather than displayed as a fake 25.
- **Age** is whole days from the account `created` timestamp, labelled as days,
  months or years.
- **Post count** is the account's public `post_count`.
- **Edit note** compares chain `last_update` with `created`; a difference over
  one minute is shown. The API's missing edit timestamp is not guessed.

These are context signals only. They do not prove delivery, quality, identity or
intent.

## Authority and privacy

- No new authority and no signing.
- One cached public account read per product page (`fetchAccount`), plus the
  existing product post read.
- No server call, analytics, tracking or reputation service.
- No Vault key or grant code is touched.

## Verification

Local, 2026-11-28:

- `bun run lint` — clean.
- `bun run test` — 221 files, 2,116 tests passing. New `shop-seller` suite.
- `bun run build` — succeeded.
- `bunx playwright test e2e/blog.spec.js --config=playwright.config.js` — 18
  checks passed, including the seller card and edit note with axe at 1440×1100
  and 390×844.
- `bunx playwright test e2e/vault.spec.js --config=playwright.config.js` — all 8
  Vault checks still pass.
- Deployed from `master` at app commit `4677ccf`; live stamp
  `20261127T180956Z-4677ccf6e265`. Deploy verification passed. No Worker change.
- Live smoke on
  `https://bzlatanov--dev.banksia.io/shop/test-subscription`:
  - seller card showed `On Hive Mar 18, 2025 · 1.7 years`, reputation `25.0`,
    `Posts 3`;
  - the edit note showed “Seller edited this product on May 29, 2025.”;
  - the profile link resolved to `https://banksia.io/@bzlatanov.dev`;
  - no console or page errors.

## Remaining

- Completed-sale counts and repeat-buyer signals need an explicit read policy;
  they are not inferred from a raw history page yet.
- No seller response/review surface; reviews remain Phase B.
- The card does not replace escrow or buyer protection.
