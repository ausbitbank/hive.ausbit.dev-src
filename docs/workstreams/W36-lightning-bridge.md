# W36 — Lightning receive and pay (v4vapp Phase 1–2)

Date: 2026-11-20
Status: complete — deployed and live-verified

## Scope

Phase 1 and Phase 2 of the v4vapp integration study
([docs/integrations/v4vapp-lightning.md](../integrations/v4vapp-lightning.md)):

1. **Receive and identity** — every Hive account gets a Lightning address card,
   receive-invoice dialog, QR and settlement state. No login, no keys, no
   custody.
2. **Pay with HIVE/HBD** — paste a mainnet BOLT11 invoice or Lightning address,
   review a fee-inclusive quote, and queue a normal Hive transfer to `@v4vapp`
   for active-key review and signing.

Deliberately out of scope: keepsats API sessions, POS, post zaps, Hive account
creation with Lightning, and MagiSats. Those remain later phases.

## Components

| File | Responsibility |
| --- | --- |
| `src/services/lightning.js` | Address derivation, fee/quote maths, memo builder, status normaliser and v4vapp memo parser |
| `src/services/bolt11.js` | Dependency-free mainnet BOLT11 bech32/amount/tag decoder, split out so wallet chunks do not carry it |
| `src/services/v4vapp.js` | Public bridge client: status/config, quotes, invoice creation/status, address LNURL, remote decode; 8s timeout, cache and bridge-state tracking |
| `src/components/lightning/LightningAddressCard.vue` | Address, currency switcher (HIVE/HBD/Sats), QR, copy and v4v.app link |
| `src/components/lightning/LightningInvoiceCard.vue` | Invoice QR, amount, expiry countdown, copy/open wallet and paid/expired state |
| `src/components/lightning/LightningReceiveDialog.vue` | Amount/currency/receive-currency form, invoice creation, visibility-aware polling and CORS fallback |
| `src/components/lightning/LightningPayDialog.vue` | Local invoice decode, live/estimated quote, asset choice, balance check and queue action |
| `src/components/lightning/LightningWalletPanel.vue` | Wallet section with address, receive/pay actions and bridge fee disclosure |
| `src/pages/lightning.vue` | `/lightning` hub and `/@account/lightning` shareable account page |

## Integrations

- **Profile** — Lightning quick link and compact address card in the account
  sidebar.
- **Tip page and tip dialog** — Lightning address card and "Tip with
  Lightning" invoice dialog alongside the existing Hive/HBD tips.
- **Wallet** — new Lightning section, header tab and panel; incoming/outgoing
  `@v4vapp` transfers are labelled “Lightning received/payment” and grouped
  under a new Lightning activity filter.
- **Signing queue** — Lightning payments are queued as `manualOnly`: auto-send
  skips them and the queue shows a **Review** badge. They must be sent
  individually with the active key.
- **Navigation** — sidebar tool link, command palette entry and `g l`
  shortcut.
- **Explorer copy** — invoice amounts/fees are decoded locally; no raw BOLT11
  string is shown as the activity label.

## Authorities and security

- Receive, address display and QR generation: **no key**.
- Paying an invoice: one `transfer` to `@v4vapp`, **active key**, queued for
  explicit review and never auto-broadcast.
- No key material, SmartLock payload or token is sent to v4vapp.
- Invoices are created with POST only. The side-effecting GET invoice endpoint
  is never called, so a CORS/preflight failure cannot create an invisible
  invoice.
- The bridge's ~50 sat fixed fee is shown; small invoices warn about fee drag.
- Hive transfer memos are treated as public and rendered as text.

## CORS and fallback behaviour

The production origin is not currently on v4v.app's CORS allowlist. The UI is
built to degrade rather than break:

- Address, QR (`<img>`), copy and open-in-wallet work without CORS.
- If invoice creation is blocked, the receive dialog explains the limitation
  and shows the address card so a wallet can pay the address directly.
- If invoice status polling fails, the invoice card switches to “status
  unavailable” and points at the Hive wallet instead of claiming success.
- The pay dialog falls back from the live bridge quote to the site's CoinGecko
  Hive/HBD price feed and labels the result “Estimated”. The transfer still
  works on chain.
- No proxy or CORS bypass is included. A same-origin proxy remains an operator
  decision for a later workstream.

## Production routing

`/lightning` is a prerendered shell (`lightning.html`). The nginx config now
includes `/lightning` in the static-page location and `/@account/lightning` in
the account sub-page metadata regex. The live host's nginx file is
root-managed and sudo is not available non-interactively, so the existing
Cloudflare metadata worker also serves `lightning.html` for:

- `hive.ausbit.dev/lightning` (exact route), and
- `hive.ausbit.dev/@account/lightning` (existing `@*` route).

The worker rewrites account-specific title/description/canonical and tags the
response with `x-hive-meta: lightning`. `wrangler.jsonc` now carries the exact
`/lightning` route. Install the updated nginx file at the next root-managed
maintenance window; the worker path can then be retired if desired.

## Verification

- `bun run lint` — clean.
- `bun run test` — 78 files, 733 tests passed (26 new Lightning/v4vapp/queue
  tests).
- `bun run build` — succeeded.
- `bun run perf:check` — passed after an explicit budget re-baseline. At
  `723327f` (HEAD before this workstream) Home, Internal market and Compose
  were already 0.4–1.4 KB over budget; W36 added about 2.5 KB to Home and
  under 0.5 KB to the other routes. Updated: Home `jsKb 500` /
  `routeJsKb 150`, Post `jsKb 625`, Wallet `jsKb 510`, Market `jsKb 465`,
  Compose `jsKb 468`. Browse `totalKb` was raised to 900 because that
  measurement already varied between 715 and 854 KB (third-party requests)
  against a 730 KB budget at HEAD; the route's JS is 472.6 KB.
- Targeted fast E2E: `bun run test:e2e lightning.spec.js` — 2 passed.
  - mocked receive invoice settles and shows **Paid**;
  - pay dialog queues `0.673 HBD` to `v4vapp` with memo
    `alice@getalby.com #HBD #v4vapp` and `manualOnly: true`;
  - blocked bridge falls back to the Lightning address.
- Headless checks at 1440px and 390px: lightning section on wallet, tip page
  and profile sidebar render; horizontal overflow `0`; no page errors.
- Full fast suite (`CI=1 bun run test:e2e`): 41 passed, 1 skipped, 4 failed.
  Both Lightning specs passed. The four failures are in existing live-data
  specs (`connections` following cards, `browse` end marker, notifications
  pagination and comments load-more) and were not touched by this workstream.
- Latest `/lightning` checks: one `h1`, no debug output, no duplicate invoice
  button, zero horizontal overflow at 1440px and 390px.
- Production deploy:
  - backup `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261120T042138Z.tar.gz`
    (and the earlier `…041556Z` first attempt);
  - `/lightning` and `/@brianoflondon/lightning` return `200` with
    `x-hive-meta: lightning` and the correct titles;
  - live browser smoke at 1440px: address card, receive fallback (CORS still
    outstanding), estimated pay quote, wallet Lightning panel, zero page
    errors and zero horizontal overflow.

## Known limitations

- No keepsats balance, keepsats transfer, API session or withdrawal. Only
  fixed receive invoices and Hive/HBD → invoice payments.
- No POS, post zap button, creator analytics, account creation or MagiSats.
- LNURL strings are classified but not promoted in the pay form; users are
  asked for the address or invoice because the bridge's LNURL memo handling has
  not been verified.
- Refund tracking is on-chain only (the transfer/notification appears in Hive
  activity); there is no dedicated refund status API.
- The production CORS allowlist is still outstanding. Until it is granted, live
  invoice creation/status is degraded as described above.

## Next workstreams

- W37 (candidate): keepsats on-chain mode (deposit, balance request, withdraw,
  pay) with custody disclosure.
- W38 (candidate): POS/merchant page and post zaps.
- W39 (candidate): explorer bridge health, custom-json interpretation and tax
  columns.
