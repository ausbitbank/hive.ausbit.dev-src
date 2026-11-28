# W56 — Explorer, markets and tax legibility (v4vapp Phase 5)

Date: 2026-11-21
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/banksia.io/issues/87)

## Scope

- Explorer: render `v4vapp_transfer` / `v4vapp_notification` as human-readable
  operations, and label Lightning memos on transfers without showing the raw
  BOLT11 string.
- Markets: a live sats quote card with HIVE/HBD rates, a 1,000-sat estimate and
  a small converter.
- Wallet: export the loaded activity as a tax-friendly CSV with the bridge fee,
  sats amount, reference and parent id.

Search integration for `lnbc…` and Lightning addresses is deliberately not in
this pass; it needs a dedicated result card and a `lightning?pay=` deep link.

## Explorer

`src/components/BlockOperation.vue`

- `v4vapp_transfer`: amber **Keepsats** badge, human label (convert, pay
  invoice, send to address, transfer), sats amount, from/to account links.
- `v4vapp_notification`: orange **v4vapp notice** badge, parents/reference,
  human memo.
- Transfers from `@v4vapp` with converted/received memos: **⚡ Lightning** badge
  and the cleaned "Converted N sats … fee …" summary, using the existing memo
  parser.
- Any transfer memo containing a BOLT11 invoice is labelled "Lightning invoice
  payment" and the raw invoice is not printed in the summary; it remains in the
  raw JSON view.
- Unrelated custom JSON keeps the generic "custom JSON · open JSON for payload"
  rendering.

Unit tests mount the component with keepsats, notification, invoice-memo,
converted-memo and unrelated custom JSON operations.

## Markets

`src/components/market/SatsQuoteCard.vue`, added to `/markets`.

- `1 HIVE` and `1 HBD` in sats from the bridge's `v4vapp.sats_Hive` /
  `sats_HBD`, with a CoinGecko-derived fallback.
- `1,000 sats` in HBD and HIVE from `sats_to_hive`, plus a sats converter input.
- Live/stale/unavailable badge, quote age and a manual refresh.
- Copy says the conversion fee is deducted at settlement; it does not pretend
  the mid-market rate is the final payout.
- Link to `/lightning`.

## Wallet CSV

`src/services/walletExport.js`, button in `WalletActivity.vue`.

Columns:
`timestamp, rail, direction, asset, amount, sats, fee_sats, hive_equivalent,
counterparty, invoice_hash, parent_id, txid, status`.

- `rail` is `lightning`, `keepsats` or `hive`.
- Transfers from `@v4vapp` keep the converted sats and fee; outgoing invoice
  transfers are `lightning`; `#sats` deposits are `keepsats`.
- `v4vapp_transfer` / `v4vapp_notification` rows use the custom JSON rail, sats,
  parent id and direction.
- `§` reference ids go in `invoice_hash` because the bridge does not expose the
  payment hash in the memo. This is documented in the workstream, not hidden.
- Exports the currently filtered/loaded rows, not an unbounded ledger. The
  notification row is kept so a spreadsheet can reconcile it, but it must not
  be double-counted with the matching transfer.
- RFC4180-style quoting for commas, quotes and newlines; timestamp sort.

## Verification

- `bun run lint` — clean.
- `bun run test` — 87 files, 817 tests (5 BlockOperation, 2 CSV export).
- `bun run build` — succeeded.
- Chromium: `/markets` sats card shows live rates and conversion (mocked
  bridge), axe-clean; wallet CSV downloads with the expected header and at
  least two data rows against live chain activity.
- Obscura: markets sats card passes. CSV download is Chromium-only.
- 1440px/390px: zero horizontal overflow on the sats card.
- `bun run perf:check` — passed.

## Known limitations

- The explorer labels are display-only. There is no global index of zaps or
  Lightning volume; the numbers are what the operation says.
- The CSV's `invoice_hash` column carries the `§` reference, not a payment hash.
  The bridge does not publish the hash in the Hive memo.
- CSV exports only the rows the wallet has loaded (currently 50 by default, more
  on demand), not the full lifetime history.
- Search does not yet decode invoices or Lightning addresses.
- The sats quote is mid-market; conversion and routing fees are deducted at
  settlement.

## Next

Remaining from the study: search integration for invoices/addresses, creator
sats analytics, and optional keepsats user-transfer/balance-request UI.

## Deploy

Deployed on 2026-11-21 via `./scripts/deploy.sh` (one follow-up release for the
duplicated "sats sats" suffix and the markets fallback).

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T131725Z.tar.gz`
- Live `/tx/24ff0eb2…`: `v4vapp_notification` renders as **⚡ v4vapp notice**
  with its reference and human memo.
- Live `/tx/f4044255…`: the v4vapp transfer renders **⚡ Lightning · Deposit of
  6 sats (fee 52 sats)** instead of raw memo text.
- Live `/markets`: sats card shows `1 HIVE ≈ 57 sats`, `1 HBD ≈ 1,544 sats`,
  `1,000 sats ≈ 0.648 HBD · 17.458 HIVE`, quote age and Live badge, with the
  converter using the same quote.
- Live wallet CSV download: `hive-wallet-ausbitbank-2026-11-21.csv`, expected
  header and 7 loaded rows, including `lightning` and `keepsats` rails.
- Zero page errors and zero horizontal overflow in all checks.
