# W57 — Lightning search and payment links

Date: 2026-11-21
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/banksia.io/issues/87)

## Scope

- Recognise mainnet BOLT11 invoices, `lightning:` prefixes and Lightning
  addresses in the search/route parser.
- Show a Lightning result card on the search page with an **Open payment** link.
- Support `/lightning?pay=<invoice-or-address>`: logged-in users get the pay
  dialog prefilled and reviewed; logged-out visitors get a login hint.
- Default amountless addresses to 1,000 sats, editable in the dialog.

LNURL strings remain rejected in favour of the address, matching the existing
pay dialog. No invoice decoding is done on the search page; the pay dialog owns
validation, expiry and fee quotes.

## Components

| File | Change |
| --- | --- |
| `src/services/search.js` | `lnbc…` / `lightning:` / `address@domain` detection returns a `kind: 'lightning'` route with `/lightning?pay=…`; adds `lightning`/`pos` account subpages |
| `src/pages/search.vue` | Lightning result card with label, target, bridge attribution and Open payment button |
| `src/pages/lightning.vue` | Reads `?pay=`, opens the pay dialog for logged-in users, shows a login banner otherwise |
| `src/components/lightning/LightningPayDialog.vue` | `initialInput` + `initialSats` props; auto-review when opened with a target |

## Behaviour

- `alice@getalby.com` → search result “Lightning address” → Open payment →
  `/lightning?pay=alice%40getalby.com` → pay dialog at review with 1,000 sats.
- `lnbc…` → search result “Lightning invoice” → Open payment → the dialog
  decodes locally, rejects testnet/expired/malformed invoices and shows the
  amount and description.
- Logged out: the Lightning page shows “A Lightning payment link is ready” with
  the target and a login instruction. No dialog, no keys.
- Command palette and 404 search use the same parser, so pasting an invoice or
  address there jumps to the payment route.

## Verification

- `bun run lint` — clean.
- `bun run test` — 94 files, 869 tests; the search parser covers invoices,
  `lightning:` prefixes, addresses and the new `pos` subpage.
- `bun run build` — succeeded.
- Chromium E2E: search results for invoice and address; logged-in deep link
  opens the dialog with the address and a 1,079-sat all-in quote for 1,000 sats;
  logged-out deep link shows the banner and no dialog.
- Obscura fast suite: all three pass.
- `bun run perf:check` — passed.

## Known limitations

- LNURL strings are still rejected; paste the address instead.
- The search card does not decode the invoice; it links to the dialog. This is
  deliberate so the search route chunk stays small.
- Amountless addresses default to 1,000 sats; the payer can change it in the
  dialog.
- The target appears in the URL and is public; never paste a private invoice
  into a shared link.

## Deploy

Deployed on 2026-11-21 via `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T140100Z.tar.gz`
- Live `/search?q=alice%40getalby.com`: Lightning address card with the target
  and **Open payment**, zero page errors and zero overflow.
- Live logged-out `/lightning?pay=alice%40getalby.com`: "A Lightning payment
  link is ready" banner with the login hint; no dialog.
- Live logged-in deep link: pay dialog at review for `alice@getalby.com` with a
  live `1,079 sats` all-in quote for 1,000 sats.
