# W100 — Lightning payment links with HIVE/HBD amounts

Date: 2026-11-28
Status: complete — built, unit-tested and fast-E2E verified

## Scope

Make a Lightning payment link carry an invoice value in HIVE or HBD, and let the
pay dialog convert that value into sats from the live rate. This serves the
"top up a Lightning address with a fixed HBD amount" flow, for example:

```text
https://banksia.io/lightning?pay=ausbitbank@bitrefill.me&account=ausbitbank&amount=5&currency=hbd
```

The link never auto-sends anything. It prefills the existing review dialog; the
payer still checks the invoice, the fee and the total, then queues a normal
`transfer` to `@v4vapp` for active-key review.

## Link contract

| Query | Meaning |
| --- | --- |
| `pay` | Mainnet BOLT11 invoice or Lightning address (unchanged) |
| `account` | Hive account that pays (unchanged) |
| `amount` | Invoice value, interpreted in `currency` |
| `currency` | `hbd`, `hive` or `sats` (defaults to `sats` when omitted) |
| `sats` | Shorthand for `amount` in sats |

A bare `amount` defaults to sats rather than HBD so a link that forgets
`currency` cannot quietly commit a much larger HIVE/HBD payment. Invalid or
non-positive amounts are ignored.

`amount` is the value the invoice is for. The bridge fee is added on top, and
the dialog shows the invoice sats, the fee and the total sats before queueing.
For example, with 1 HBD ≈ 1,602 sats, `amount=5&currency=hbd` quotes an 8,011
sat invoice and an 8,294 sat total at the 2.9% + 50 sat bridge fee.

## Components

| File | Change |
| --- | --- |
| `src/services/lightning.js` | `PAY_AMOUNT_UNITS`, `normalizeAmountUnit`, `payLinkAmount`, `satsRatesFromBridgeQuote`, `satsFromAssetAmount` |
| `src/pages/lightning.vue` | Reads `amount`/`currency`/`sats`, passes them to the pay dialog, shows the requested amount in the logged-out banner and remounts the dialog when the link amount changes |
| `src/components/lightning/LightningPayDialog.vue` | Amountless payments get a sats/HBD/HIVE unit toggle; HBD/HIVE values are converted to invoice sats after the live rates resolve; switching units clears the old value instead of reinterpreting it |
| `tests/unit/lightning.spec.js` | Link parsing, unit normalisation and asset-to-sats conversion |
| `tests/unit/lightning-pay-dialog.spec.js` | Link prefill, HBD-to-sats quote and unit-switch safety |
| `e2e/lightning-search.spec.js` | `/lightning?pay=…&amount=5&currency=hbd` opens the review at 8,294 total sats |

## Rates and authority

- The bridge's own `v4vapp.sats_Hive` / `v4vapp.sats_HBD` rates are preferred.
  The bridge's CoinGecko-shaped `GET /v1/cryptoprices/` fields are the next
  fallback, then the site's `getHivePrices()` feed.
- The quote still uses `getSatsToHive()` for the authoritative fee-inclusive
  HBD/HIVE cost.
- No new keys, no new signing path and no auto-broadcast. The existing
  `manualOnly` queue item is the only write.

## Verification

- `bun run lint` — clean (ESLint and theme-token scan).
- `bun run test` for the touched suites — 51 tests across `lightning`,
  `lightning-pay-dialog`, `pos` and `v4vapp`.
- `bun run build` — succeeded.
- Fast Obscura E2E: `e2e/lightning-search.spec.js` 4/4 and
  `e2e/lightning.spec.js` 1/1 passed against the built bundle.
- The new E2E asserts the mocked 5 HBD link resolves to an 8,011 sat invoice
  and an 8,294 sat total, which also proves the bridge quote rates win over the
  live market feed during the test.

## Known limitations

- The feature prefills the pay dialog for an existing target. It does not mint
  a BOLT11 invoice for a third-party Lightning address; the recipient's LNURL
  server still owns that invoice. v4vapp resolves the address when it settles
  the Hive transfer.
- `amount` is the invoice value, not the total wallet spend; the fee is shown
  separately and the total is the value to compare with the wallet balance.
- An HBD/HIVE amount cannot be converted when all three rate sources are
  unavailable; the dialog blocks queueing and shows the missing-price message.
