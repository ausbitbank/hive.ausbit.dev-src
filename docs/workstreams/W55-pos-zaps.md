# W55 — Point of sale and post zaps (v4vapp Phase 4)

Date: 2026-11-21
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/banksia.io/issues/87)

## Scope

- A public **point-of-sale page** at `/@account/pos`: keypad, currency choice,
  optional public note, fresh invoice per sale, paid state and local session
  totals.
- A **Zap** button on posts and short-form posts that opens the Lightning
  receive dialog for the author with 1k/5k/10k/21k sats presets.

Both reuse the existing public invoice flow. No login, keys or new backend.

Out of scope: a persisted sales ledger, receipts/printing, cash drawer
integration, global zap counts, creator analytics and POS offline mode.

## Point of sale

`src/pages/pos.vue` + `src/services/pos.js`

- Public route `/@account/pos`; invalid account names show an explicit error.
- Currency: sats, HBD, HIVE or USD. Sats has no decimal key; fiat has 2–3
  decimals. The keypad also accepts the physical keyboard (digits, `.`,
  Backspace, Enter, Escape) and ignores keystrokes while typing in the note.
- Merchant receive asset: HBD (default) or HIVE.
- One invoice per sale: the **Create invoice** button disables while an invoice
  is open, so a QR can never be reused. **New sale** clears the invoice and
  amount.
- Status polling is visibility-aware (2.5s), stops at paid/expired, and tolerates
  two transient failures before showing "status unavailable".
- Paid state confirms the sats and points at the merchant wallet for the Hive
  transfer from `@v4vapp`.
- Session totals are computed locally from paid invoices and labelled as such.
- If invoice creation is blocked/offline, the page shows the account's Lightning
  address card as a fallback.
- Invoice memo: optional public note (sanitised, no `|`) plus
  `POS via hive.ausbit.dev`.
- QR: the live API did **not** return `qr_code_base64` on 2026-11-21 even with
  `qr_image: true`. `LightningInvoiceCard` now falls back to a lazy `uqr`
  generated SVG for the `lightning:` URI. The dependency is only loaded when an
  invoice card renders.

## Zaps

`src/components/lightning/SatsZapButton.vue`,
`src/components/lightning/LightningReceiveDialog.vue`

- Button on the post actions sidebar and the short-form footer.
- Opens the existing dialog in `intent="zap"` mode: title "Zap @author",
  presets 1k/5k/10k/21k sats, default 1,000 sats, author receives HBD.
- The invoice memo carries `Zap · <permlink> · hive.ausbit.dev` so the on-chain
  transfer can be attributed to the site and post.
- No global zap counter is claimed. The paid dialog is session-local.

## Authorities and safety

- No key is requested to create an invoice or to show a QR. The payer signs in
  their own Lightning wallet.
- The site never holds the sats; settlement is a Hive transfer from `@v4vapp`.
- The POS page stores no customer data and no server-side totals.
- Public notes are bounded and stripped of `|`; the UI warns they are public.
- The zap dialog is the same tested invoice flow, not a second implementation.

## Verification

- `bun run lint` — clean.
- `bun run test` — 85 files, 810 tests (5 new POS helper tests).
- QR fallback exercised in E2E with the invoice mock omitting
  `qr_code_base64`; the card renders a generated SVG QR.
- `bun run build` — succeeded.
- Chromium E2E (3 tests): POS creates two fresh invoices with the requested
  amounts, shows paid and `2 sales · 6,000 sats`; POS axe-clean at 1440px and
  390px; post zap opens with presets, sets 5,000 sats and settles.
- Obscura fast suite: all 3 pass.
- `/@ausbitbank/pos` added to the a11y route list; clean.
- 1440px/390px: zero horizontal overflow; keypad, invoice and paid state render
  correctly.
- `bun run perf:check` — passed (Post total 840.7/860 KB after the zap button).

## Routing and metadata

- Router: `@:account/pos` (`account-pos`).
- `deploy/nginx/hive.ausbit.dev.conf` now includes `pos` in the account
  sub-page metadata regex. **The live nginx file is root-managed and still needs
  that one-line install**; until then a crawler may see the generic post-title
  metadata for `/@account/pos` (the SPA sets the correct title client-side).
- No new prerender shell: the route is account-specific. The Cloudflare
  metadata Worker also treats `/@account/pos` as `@account/permlink`; its chain
  lookup misses and falls back. A future Worker update can special-case `pos`.

## Known limitations

- Session totals are in-memory only. Reloading the page clears them by design;
  there is no sales ledger and no daily server-side total.
- No receipts, printing, refunds or cash-drawer integration.
- The invoice status comes from polling; there are still no webhooks.
- `/v1/new_invoice_hive` omitted `qr_code_base64` in live tests on 2026-11-21,
  so the client generates the QR. Keep the server-provided QR when it returns.
- Zap attribution is site-local and approximate: a fixed invoice memo marker is
  public, but there is no global index of zaps.

## Next

- W56: explorer bridge legibility (custom JSON cards, invoice memo decoding,
  search for invoices/addresses), markets sats quotes and wallet/tax CSV.
- Later: creator sats analytics, POS persistence if a ledger is acceptable.

## Deploy

Deployed on 2026-11-21 via `./scripts/deploy.sh` (twice: the first release was
missing the client-side QR fallback).

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T130039Z.tar.gz`
  (the earlier `…125435Z` backup covers the pre-W55 release).
- Live `https://hive.ausbit.dev/@ausbitbank/pos`: created a real 1,000 sat
  invoice, QR image rendered as a generated SVG (150×150), status "Waiting for
  payment", zero page errors and zero horizontal overflow at 1440px and 390px.
- Live post zap dialog: title "Zap @ausbitbank", presets 1k/5k/10k/21k,
  default 1,000 sats, zero errors.
- The live nginx metadata still says "@ausbitbank: pos — Hive post" for a
  crawler because the `pos` regex line is not installed (no non-interactive
  sudo). The SPA sets the correct title client-side; the repo config is ready
  for the next root-managed maintenance window.
