# W54 — Keepsats on-chain actions (v4vapp Phase 3, mode B)

Date: 2026-11-21
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/hive.ausbit.dev-src/issues/87)

## Scope

The on-chain (mode B) keepsats action set:

- deposit HBD/HIVE into keepsats with a normal transfer and `#sats`;
- convert keepsats back to HBD/HIVE with a `v4vapp_transfer` custom JSON;
- pay a BOLT11 invoice or Lightning address from keepsats.

Everything is queued through the existing signing queue as `manualOnly` and
requires the active key. No v4vapp API session is used for writes, and no new
backend is involved.

Out of scope: one-click mode C writes, keepsats transfer to another Hive user,
the on-chain `#balance_request` fallback UI, POS and zaps.

## Operation shapes

Taken from the bridge's public `docs/custom_json.md` (v4vapp-backend-v2) and
verified against the documented examples:

**Deposit**

```
transfer to @v4vapp, memo "#sats"
```

The transfer amount is credited as keepsats after the bridge fee. This is an
ordinary Hive/HBD transfer; the active key signs it.

**Convert**

```json
{ "id": "v4vapp_transfer",
  "json": { "from_account": "alice", "to_account": "v4vapp",
            "sats": "1234", "memo": "#HBD" } }
```

`#HIVE`/`#HBD` select the output asset (HIVE by default).

**Pay a Lightning address**

```json
{ "id": "v4vapp_transfer",
  "json": { "from_account": "alice", "to_account": "v4vapp",
            "sats": "5000", "memo": "bob@getalby.com" } }
```

**Pay a BOLT11 invoice**

```json
{ "id": "v4vapp_transfer",
  "json": { "from_account": "alice", "to_account": "v4vapp",
            "memo": "lnbc1..." } }
```

`sats` is omitted for a fixed-amount invoice; the invoice decides. For a
zero-amount invoice the UI asks for sats.

All `custom_json` actions are broadcast with `required_auths: [from_account]`
and the active key. `to_account` is always `v4vapp`, as the backend requires for
conversion, address and invoice payments.

## Components

| File | Responsibility |
| --- | --- |
| `src/services/keepsats.js` | `buildKeepsatsDeposit`, `buildKeepsatsConvert`, `buildKeepsatsTransfer`, `parseKeepsatsCustomJson`, `describeKeepsatsCustomJson`, normalisation |
| `src/components/lightning/KeepsatsActions.vue` | Deposit/convert/pay forms, live deposit rate, conversion quote, invoice/address validation, custody consent, queueing |
| `src/components/lightning/KeepsatsPanel.vue` | Hosts the actions below the read-only balance; forwards `queued` |
| `src/services/queue.js` | Human labels for `v4vapp_transfer`/`v4vapp_notification` and `#sats` deposits |
| `src/services/wallet.js` | Classifies both custom JSON ids as Lightning activity, with direction, amount and labels |

## Authorities, consent and safety

- **Active key** only for the custom JSON actions; the deposit is a normal
  transfer. Nothing is auto-broadcast: everything is `manualOnly` and must be
  reviewed and signed one item at a time in the queue.
- A one-time `Keepsats are custodial` dialog explains that v4v.app holds the
  sats and that hive.ausbit.dev does not. Acceptance is stored locally as a
  non-sensitive preference.
- Invoice validation is local: mainnet `lnbc` only, expiry checked, description
  shown. LNURL strings are rejected in favour of the address, matching the pay
  dialog.
- Amounts are public on chain; the UI says so. No private data is added.
- No token, key or signature is involved beyond the normal queue signing flow.

## Verification

- `bun run lint` — clean.
- `bun run test` — 84 files, 805 tests passed (builders/parsers, queue labels,
  wallet classification, plus the W53 session tests).
- `bun run build` — succeeded.
- Chromium E2E (5 keepsats tests): read-only balance, rejected signature,
  deposit queue, conversion queue, address payment queue. The deposit test also
  runs axe with the actions open; clean.
- Obscura fast suite: all 5 keepsats tests pass.
- Queue assertions: deposit is `['transfer', { to:'v4vapp', memo:'#sats' }]`
  with `manualOnly: true`; conversion/payment are `custom_json` with
  `required_auths: [account]`, `id: v4vapp_transfer`, and the expected JSON.
- 1440px and 390px: zero horizontal overflow; forms and toggles fit.
- `bun run perf:check` — passed after raising the Home route JS budget from 150
  to 152 KB. The Home total stays at 723/730 KB. The extra weight is the queue
  labels plus the SmartLock signing helper; initial JS remains 355/355 KB.

## Known limitations

- No live broadcast in CI. A real 0.1 HBD deposit and one small conversion are
  operator-assisted follow-ups; the queue payloads are verified, not the
  bridge's settlement.
- Deposit estimates use the bridge's mid-market `sats_Hive`/`sats_HBD`; the
  actual deposit fee is deducted by v4vapp. The UI labels it as an estimate.
- Conversion quotes use `sats_to_hive` before the bridge's conversion fee. The
  exact fee is not shown because it is not published as a separate config value.
- Paying a Lightning address requires an explicit sats amount; there is no
  amountless address flow.
- The on-chain `#balance_request` fallback (0.001 HIVE transfer + public reply)
  is documented but has no button; the read-only API session is the primary way
  to see a balance.
- `v4vapp_transfer` custom JSON is signed with active authority. SmartLock asks
  for the active password per action; Keychain prompts each time.

## Next

- Operator live smoke: one small deposit, one conversion, and an invoice payment
  from a keepsats balance, verifying the resulting Hive transfer/notification.
- Optional: keepsats transfer to another Hive user (`to_account` + sats) and the
  on-chain balance-request fallback.
- Then POS/post zaps and explorer/tax work remain in issue #87.

## Deploy

Deployed with W52 and W53 on 2026-11-21 via `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T122832Z.tar.gz`
- Live wallet smoke at 1440px and 390px: the keepsats panel and the collapsed
  actions render, the conversion quote resolves against the live bridge
  (`1,234 sats ≈ 0.803 HBD` at the time), zero page errors and zero horizontal
  overflow.
- No live queue signing or broadcast was performed during deployment.
