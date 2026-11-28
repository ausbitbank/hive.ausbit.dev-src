# W100 — Lightning payment links with exact HIVE/HBD spend

Date: 2026-11-28
Status: complete — built, unit-tested and fast-E2E verified

## Scope

Make a Lightning payment link carry an exact amount to spend from the wallet,
and let the pay dialog calculate the recipient sats after the bridge fee. This
serves the everyday "send my liquid HIVE to a Lightning address" flow, for
example:

```text
https://banksia.io/lightning?pay=ausbitbank@bitrefill.me&account=ausbitbank&amount=12.345&currency=hive
```

The link never auto-sends anything. It prefills the existing review dialog; the
payer still checks the invoice, the fee and the total, then queues a normal
`transfer` to `@v4vapp` for active-key review.

## Link contract

| Query | Meaning |
| --- | --- |
| `pay` | Mainnet BOLT11 invoice or Lightning address (unchanged) |
| `account` | Hive account that pays (unchanged) |
| `amount` | Amount in `currency` |
| `currency` | `hbd` or `hive` = total wallet debit including the fee; `sats` = recipient invoice sats with the fee added |
| `sats` | Shorthand for `amount` in recipient invoice sats |

- A HBD/HIVE `amount` is the **wallet debit**, rounded to three decimals (the
  transfer precision). v4vapp charges its percentage on that gross amount and
  reserves a small routing buffer before paying the invoice, then returns any
  unused sats as change. The dialog shows the invoice, fee and buffer.
- A sats amount is the **recipient invoice amount**, matching the dialog's sats
  field; the bridge fee and routing buffer are added to the wallet debit.
- A bare `amount` defaults to sats rather than HBD so a link that forgets
  `currency` cannot quietly commit a much larger HIVE/HBD payment. Invalid or
  non-positive amounts are ignored.

Example: with 1 HBD ≈ 1,602 sats, `amount=5&currency=hbd` queues a 5.000 HBD
transfer. That is 8,011 sats of wallet value, split into a 7,670 sat invoice, a
283 sat bridge fee and a 58 sat routing buffer that the bridge returns as change.

## Components

| File | Change |
| --- | --- |
| `src/services/lightning.js` | `PAY_AMOUNT_UNITS`, `normalizeAmountUnit`, `payLinkAmount`, `satsRatesFromBridgeQuote`, `quoteSatsPayment`, `quoteSpendPayment`, `roundAmount`, LNURL-pay normalisation helpers |
| `src/services/v4vapp.js` | `resolveLightningAddress()` through `/v1/lnurlp/proxy/` and its callback proxy |
| `src/pages/lightning.vue` | Reads `amount`/`currency`/`sats`, passes them to the pay dialog, explains the total vs invoice amount in the logged-out banner and remounts the dialog when the link amount changes |
| `src/components/lightning/LightningPayDialog.vue` | Amountless payments get a sats/HBD/HIVE unit toggle; HBD/HIVE values become the exact wallet debit, the fee is solved out of the total, the spend asset follows the unit, and switching units clears the old value instead of reinterpreting it |
| `tests/unit/lightning.spec.js` | Link parsing, unit normalisation, asset-to-sats conversion and fixed-spend fee solving |
| `tests/unit/lightning-pay-dialog.spec.js` | Link prefill, exact HBD spend and unit-switch safety |
| `e2e/lightning-search.spec.js` | `/lightning?pay=…&amount=5&currency=hbd` opens the review at exactly 5 HBD: 7,670 sat invoice, 283 sat fee + 58 sat routing buffer, 8,011 sats total |

## Fee solving

For a total spend `S` in HBD/HIVE at `R` sats per unit, the wallet value is
`T = round(S × R)`. v4vapp charges its fee on the gross `T`, then reserves a
routing buffer before checking the invoice:

```text
bridgeFee = ceil(T × percent + fixed)
buffer = ceil(50 + (T − bridgeFee) × 0.001)
invoiceSats = T − bridgeFee − buffer
```

The queued transfer is still the rounded spend `S`; the bridge returns the
buffer and any unused sats as change. Sizing the invoice below the bridge's
`amount sent` check is what stops a large fixed invoice from being rejected.

## Rates and authority

- The bridge's own `v4vapp.sats_Hive` / `v4vapp.sats_HBD` rates are preferred.
  The bridge's CoinGecko-shaped `GET /v1/cryptoprices/` fields are the next
  fallback, then the site's `getHivePrices()` feed.
- The quote still uses `getSatsToHive()` for the authoritative fee-inclusive
  HBD/HIVE cost. In exact-spend mode the queued amount intentionally remains the
  entered spend, not the bridge estimate.
- No new keys, no new signing path and no auto-broadcast. The existing
  `manualOnly` queue item is the only write.

## Verification

- `bun run lint` — clean (ESLint and theme-token scan).
- `bun run test` — full suite green; the touched Lightning/POS/v4vapp suites
  pass, including the closed-form fee and exact-spend cases.
- `bun run build` — succeeded.
- Fast Obscura E2E: `e2e/lightning-search.spec.js` and
  `e2e/lightning.spec.js` passed against the built bundle.
- The new E2E asserts the mocked 5 HBD link resolves to a 7,670 sat invoice with
  a 283 sat fee and 58 sat routing buffer inside an exact 5.000 HBD spend, which
  also proves the bridge quote rates win over the live market feed during the test.

## Known limitations

- The feature prefills the pay dialog for an existing target. At queue time it
  resolves a Lightning address to a fresh BOLT11 invoice through v4v.app's
  `/v1/lnurlp/proxy/` endpoints, then queues that invoice. The recipient's LNURL
  server still owns the invoice; resolution failure blocks the queue instead of
  sending a bare address.
- Address payments are no longer queued as bare `name@domain` memos. The bridge
  re-resolves such a memo at settlement; a failed lookup (for example a provider
  that rejects the trailing app tag or a server-side block) converts the whole
  transfer into keepsats while the notification still says the invoice was paid.
  A resolved BOLT11 invoice either pays or is refunded. An address payment is
  still not a specific order invoice: a Bitrefill address, for example, tops up
  the account. Paste the BOLT11 invoice for an order payment.
- The precise recipient sats depend on the bridge's settlement rate; the dialog
  shows the live estimate and the exact wallet debit. A small final difference
  stays with the recipient or is refunded by the bridge.
- An HBD/HIVE amount cannot be converted when all three rate sources are
  unavailable; the dialog blocks queueing and shows the missing-price message.
- A HBD/HIVE amount rounds to three decimals because that is the Hive transfer
  precision. The dialog shows the rounded spend it will queue.
