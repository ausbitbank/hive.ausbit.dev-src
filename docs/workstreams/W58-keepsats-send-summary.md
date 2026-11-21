# W58 — Keepsats user transfers and local sats summary

Date: 2026-11-22
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/hive.ausbit.dev-src/issues/87)

## Scope

- Add “Send” to the keepsats actions: transfer sats to another Hive account
  through `v4vapp_transfer` (`to_account` = recipient).
- Add a wallet card summarising incoming Lightning sats from the rows already
  loaded, with fees and latest date.

Creator analytics beyond the loaded wallet rows (weekly totals, top zaps,
unique supporters) still needs an indexer decision and is not in this pass.

## Keepsats user transfer

`src/components/lightning/KeepsatsActions.vue`

- Fourth action tab: **Send**.
- Fields: recipient Hive account, sats, optional public memo.
- Validates the recipient with `isValidHiveAccount`; refuses `v4vapp` (use
  Convert or Pay for the server account).
- Queues:
  ```json
  { "id": "v4vapp_transfer",
    "json": { "from_account": "alice", "to_account": "bob",
              "sats": "500", "memo": "thanks" } }
  ```
  with `required_auths: [alice]`, active key and `manualOnly`.
- Same custody consent as deposit/convert/pay.
- Copy notes that this is an internal v4v.app ledger move, not a Hive transfer,
  and the recipient must already have a keepsats balance.

## Local sats summary

`src/services/lightningStats.js` + `src/components/lightning/LightningReceivedCard.vue`

- Sums incoming `@v4vapp` transfers with a converted/deposit memo and incoming
  `v4vapp_notification` rows with `msats > 0`.
- Shows total sats, payment count, bridge fees and latest date.
- Uses only `hiveTransactions` already loaded by the wallet; the card is hidden
  when there are no matching rows.
- Explicit copy: this is not a global Lightning index and may include a
  notification plus its matching transfer, so it is a local view rather than a
  tax ledger.
- Pure `lightningReceivedStats(entries, username)` keeps the logic testable.

## Verification

- `bun run lint` — clean.
- `bun run test` — 95 files, 871 tests (2 stats tests, plus the send builder and
  queue coverage).
- `bun run build` — succeeded.
- Chromium and Obscura: all 6 keepsats E2E flows pass, including the new user
  transfer queue payload (`to_account: bob`, `sats: 500`, `manualOnly`).
- `bun run perf:check` — passed.
- Wallet layout checked at 1440px and 390px; no horizontal overflow.

## Known limitations

- The recipient must already have a keepsats balance; the bridge rejects
  unknown accounts and the UI cannot check registration.
- The summary is loaded-rows-only and may double count a notification with its
  matching transfer. It is not a replacement for the CSV export.
- No recipient autocomplete yet; the field is a plain Hive account input.
- User transfers still require active authority and a manual queue review.

## Next

- Creator analytics (weekly sats, top zaps, unique supporters) if an indexer or
  a bounded history scan is acceptable.
- Optional on-chain `#balance_request` UI.

## Deploy

Deployed on 2026-11-22 via `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T141200Z.tar.gz`
- Live wallet (temporary logged-in session): **Send** tab renders, and the
  **Sats received** card shows `3 payments · +184,810 sats`, `5,511 sats` fees
  and a latest date from the loaded rows.
- 1440px and 390px: zero horizontal overflow, zero page errors.
