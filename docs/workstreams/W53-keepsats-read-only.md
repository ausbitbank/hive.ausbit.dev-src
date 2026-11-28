# W53 — Keepsats read-only session (v4vapp Phase 2)

Date: 2026-11-21
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/banksia.io/issues/87)

## Scope

A read-only view of a Hive account's v4v.app keepsats balance, using the
posting-key challenge flow verified in the Phase 2 spike. No writes, no active
key, no token persistence and no new backend.

Deliberately out of scope: keepsats deposits, withdrawals, conversions,
invoice payments, POS and zaps. Those stay on-chain (mode B) in a later phase.

## Decisions

- Keepsats is acceptable but not encouraged. The panel lives inside the wallet's
  Lightning section, is visually secondary, and shows nothing until the user
  explicitly connects.
- Only Keychain and SmartLock logins can connect. A password login without a
  signing method sees an explanation.
- The session is read-only. The UI never offers transfer/convert/pay actions.
- `KEEPSATS_ENABLED` in `src/services/lightning.js` is the kill switch.

## Session model

1. `GET /auth/{account}?clientId=…&appId=hive.ausbit.dev&scope=hive:posting`.
2. Sign the exact challenge with the **posting** key (Keychain
   `requestSignBuffer` or SmartLock `signBufferWithPublicKey`).
3. `POST /auth/validate/?clientId=…` with the signed proof.
4. Hold the bearer token in module memory only; read
   `GET /v2/v4vapp/keepsats?hive_accname=…`.

The token is never returned to a component, never written to `localStorage` or
`sessionStorage`, and never logged. Only the non-secret `clientId` is persisted
(`v4vapp:clientId`). The session is keyed by account, and logout clears it via a
`hive:auth-logout` DOM event so the header does not import the session chunk. A
page reload drops it; the user must connect again.

## Components

| File | Responsibility |
| --- | --- |
| `src/services/v4vappSession.js` | In-memory session record, client id, expiry and account scoping. Kept dependency-free so the logout path can clear it without loading the signing stack |
| `src/services/v4vappAuth.js` | Challenge → sign → validate orchestration, Keychain/SmartLock signers, expiry, 401 handling, injectable signer for tests |
| `src/services/v4vapp.js` | `getAuthChallenge`, `validateAuthSignature`, `getKeepsats`; bearer header support in the shared request helper |
| `src/services/keepsats.js` | `normalizeKeepsats`, tolerant history parsing; kept out of `lightning.js` so Home/tip chunks do not carry it |
| `src/services/lightning.js` | `KEEPSATS_ENABLED` kill switch |
| `src/components/smartlock/api.js` | `signBufferWithPublicKey` (signature plus matching posting public key) |
| `src/components/lightning/KeepsatsPanel.vue` | Connect/disconnect, balance, in-progress, conversion estimate, last activity, optional history, custody disclosure, expiry |
| `src/components/lightning/LightningWalletPanel.vue` | Hosts the panel inside the wallet Lightning section |
| `src/components/userLogin.vue` | Clears the session on logout |

## Authorities and security

- Posting key only. The active key is never requested for this feature.
- No Hive transaction is broadcast; the challenge signature is off-chain.
- Read-only: only `GET /v2/v4vapp/keepsats` is called with the token.
- Token in memory only; cleared on logout, account change and expiry.
- If v4vapp returns `401`/`403`, the session is cleared and the user is asked to
  reconnect instead of retrying with a dead token.
- The panel labels the balance **Custodial** and states that keepsats are an IOU
  held by v4v.app, not by hive.ausbit.dev.
- No history is invented: the undocumented payload's history array is read
  opportunistically and the section is hidden when absent.

## Verification

- Live spike (2026-11-21, `@ausbit.vsc`): validate `200`, token
  `scope=hive:posting`, ~49 minute lifetime, keepsats `200` with a zero-balance
  liability object.
- `bun run lint` — clean.
- `bun run test` — 84 files, 800 tests passed (11 new session tests, 1 logout
  test, 2 new normaliser tests).
- `bun run build` — succeeded.
- Chromium E2E: reads `12,345 sats`, shows the custody copy, asserts no token or
  signature in local/session storage, verifies reload disconnects, and reports a
  rejected signature without leaving a session. Axe clean on the connected
  wallet page.
- Obscura fast suite: both keepsats flows pass (axe is Chromium-only).
- Headless checks at 1440px and 390px: zero horizontal overflow; balance,
  in-progress and custody copy render correctly.

## Known limitations

- History is unverified: no account with keepsats history was available, so the
  payload shape for transaction rows is not confirmed. The UI hides history
  unless a plausible array is present.
- The session cannot be refreshed silently. It lasts ~50 minutes and then the
  panel asks to reconnect. The refresh cookie is deliberately unused.
- A reload always disconnects. This is intentional (no token storage) but it
  costs one Keychain prompt per browser session.
- The balance is read on demand; there is no polling. A refresh button and
  reconnect-on-expiry cover the read-only use case.
- SmartLock requires an unlocked posting key; the panel prompts for the
  SmartLock password when needed and never stores it.

## Next

- W54 (candidate): mode B on-chain keepsats actions — deposit `#sats`,
  `#balance_request`, withdraw/convert `v4vapp_transfer`, pay invoice — through
  the existing signing queue with `manualOnly`. Reuse the notification parser.
- POS/zaps and explorer/tax work remain later phases in issue #87.

> Implemented as W54: `docs/workstreams/W54-keepsats-onchain-actions.md` covers
> deposit, conversion and invoice/address payment. Balance-request UI and user
> transfers are still open.

## Deploy

Deployed with W52 and W54 on 2026-11-21 (backup
`hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T122832Z.tar.gz`).

- The deployed `KeepsatsPanel` chunk contains the read-only panel and actions.
- Live wallet smoke with a temporary logged-in session at 1440px and 390px:
  panel renders, actions expand, conversion quote resolves from the bridge,
  zero page errors and zero horizontal overflow.
- No live balance read was performed during deployment because that needs a
  real Keychain prompt; the flow is covered by the mocked E2E and the earlier
  live spike.
