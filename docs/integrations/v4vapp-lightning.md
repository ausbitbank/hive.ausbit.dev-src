# v4vapp / Lightning integration study

Status: research + options, not a delivery commitment. Verified against the live
v4vapp API on 2026-11-20 (API `6.6.0`); CORS and the public contract
re-verified on 2026-11-21 (API `6.6.1`, see §3).

Scope: how hive.ausbit.dev could use the v4vapp Hive ↔ Bitcoin Lightning bridge
across the site (profiles, posts, tips, search, health, markets) and the wallet
tools (wallet, transfers, activity, tax, POS).

## 1. TL;DR

v4vapp is a **bidirectional Hive ↔ Lightning bridge** operated by
[@brianoflondon](https://hive.blog/@brianoflondon). It offers four rails:

1. **Lightning → Hive/HBD** — create a BOLT11 invoice (or use a Lightning
   address such as `alice@v4v.app`) and the recipient gets a Hive transfer.
2. **Hive/HBD → Lightning** — send HIVE/HBD to `@v4vapp` with a BOLT11 invoice or
   Lightning address in the memo; v4vapp converts and pays it.
3. **Keepsats** — a custodial sats balance held by v4vapp, usable for transfers,
   invoice payments and conversions back to Hive/HBD.
4. **MagiSats** — sats bridged to the Magi (VSC) `hive:<account>` BTC balance.

There are three ways to integrate, and they should be kept separate:

| Mode | What it needs | Trust | Best for |
| --- | --- | --- | --- |
| **A. Public API / LNURL** | No login, no keys | Trust v4vapp to create invoices and settle them | Receiving, tips, POS, quotes, decoding |
| **B. On-chain instructions** | Hive active key (Keychain/SmartLock), existing queue | Non-custodial signing; balance still custodial | Paying invoices, keepsats deposit/withdraw |
| **C. v4vapp API session** | Posting/active-key challenge + JWT | Custodial balance + account session | Balance/history convenience, one-click keepsats |

**Recommendation:** ship in phases. Start with A (read-only, no custody),
then B (everything the site can do with a normal Hive signature), and only
then consider C behind an explicit opt-in. Do not make a custodial balance or
an always-on API session a default part of the wallet.

The biggest concrete wins are:

- v4vapp serves a Lightning address for Hive accounts (`alice@v4v.app`,
  `alice@hbd.v4v.app`, `alice@sats.v4v.app`). Put it on profiles, the tip page
  and the wallet.
- A "Tip with Lightning" flow on posts and profiles: LN payer scans/pays, the
  creator receives HIVE/HBD on-chain. No Hive account or keys needed by the payer.
- "Pay a Lightning invoice with HBD/HIVE" from the wallet, built on a normal
  `transfer` to `@v4vapp` reviewed in the existing signing queue.
- Explorer-level interpretation of `v4vapp_transfer` / `v4vapp_notification`
  operations and Lightning transfers, so the bridge is visible and auditable.
- A POS/receive page for merchants: customer pays Lightning, merchant receives
  Hive/HBD.

## 2. What v4vapp actually exposes

### 2.1 Rails and who pays the fee

| Rail | Trigger | Recipient gets | Fee / limits |
| --- | --- | --- | --- |
| LN → Hive | Invoice from `/v1/new_invoice_hive`, or LNURL `alice@v4v.app` | HIVE transfer from `@v4vapp` | Embedded in the sats/Hive rate; fixed ~50 sat return fee; min 50 sats |
| LN → HBD | `receive_currency=hbd`, or `alice@hbd.v4v.app` | HBD transfer | Same |
| LN → Keepsats | `receive_currency=sats`, or `alice@sats.v4v.app` | Off-chain keepsats balance | Deposit/withdraw fee, ~3% observed |
| LN → Magi BTC | `alice@magi.v4v.app`, memo `#magisats #v4vapp` | Magi (VSC) BTC balance | Bridge + forwarding fee |
| Hive → LN | Transfer to `@v4vapp` with BOLT11/address in memo | LN payee | 2.9% + 50 sats; 50–180,000 sats per invoice |
| Hive → Keepsats | Transfer to `@v4vapp` with `#sats` | Keepsats balance | ~3% observed |
| Keepsats → Hive/HBD | `v4vapp_transfer` to `@v4vapp` with `#HIVE`/`#HBD` | Hive transfer | Conversion fee |
| Keepsats → LN | `v4vapp_transfer` with invoice/address memo | LN payee | LN routing only (no conversion fee) |
| Keepsats → user | `v4vapp_transfer` with `to_account` | Another keepsats user | No fee |

Live config on 2026-11-21: `conv_fee_percent=2.9%`, `conv_fee_sats=50`,
`hive_return_fee=0.002`, `maximum_invoice_payment_sats=180000`, rate limits of
600k sats/4h, 1.2M sats/72h and 2M sats/168h. The effective minimum is 50 sats:
`config.minimum_invoice_payment_sats` briefly reported `1.0` while
`config.min_max.min.sats` stayed at `50`, so read both and use the larger value.
Treat all of these as server-controlled, not constants: read them from `GET /v1`
and show them in the UI.

### 2.2 Endpoint inventory (verified)

Public, no auth:

| Endpoint | Use |
| --- | --- |
| `GET /v1` | Health, version, fee/limit config, LND state |
| `GET /v1/cryptoprices/` | BTC/HIVE/HBD prices, sats per Hive/HBD, staleness |
| `GET /v1/cryptoprices/sats_to_hive/?sats=N` | Mid-market Hive/HBD cost of N sats |
| `GET /v1/new_invoice_hive` | Create invoice for a fixed Hive/HBD/USD/sats amount (also `POST` with explicit amount fields) |
| `POST /v1/new_invoice` | Create invoice for a fixed sats amount with a `hive_accname \| memo` memo |
| `POST /v1/check_invoice` (`{r_hash}`) | Invoice status. Prefer POST: `payment_hash` is base64 and contains `/`, `+`, `=`, so the GET path needs careful encoding. |
| `GET /v1/decode_lightning/?pay_req=...` | Decode BOLT11 (amount, expiry, description, destination) |
| `GET /v1/lnurlp/bech32/{acct}` | LNURL/bech32/`lightning:` string for an account |
| `GET /v1/lnurlp/qrcode/{acct}` | PNG QR for an account's Lightning address |
| `GET /.well-known/lnurlp/{acct}` | LNURL-pay response (wallet-facing) |
| `GET /v1/lnurlp/callback/{acct}?amount=msat` | Invoice for a wallet paying the address |
| `GET /v2/v4vapp/account/cost` | Live Hive account creation cost in Hive/HBD/sats |
| `POST /v2/v4vapp/account/create` | Start account creation, returns a payable invoice |
| `POST /v2/v4vapp/account/create_complete` | Finish account creation after payment |
| `GET /v2/v4vapp/magisats/fee_out` | All-in sats cost for a MagiSats payout |
| `GET /v2/beacon/nodes/` | v4vapp's view of healthy Hive API nodes |

Authenticated (HTTP 401 without a token):

| Endpoint | Use |
| --- | --- |
| `GET /v2/v4vapp/keepsats?hive_accname=...` | Balance, in-progress sats, optional history |
| `POST /v2/v4vapp/keepsats/transfer` | Move sats to another Hive account |
| `POST /v2/v4vapp/keepsats/convert` | Convert sats to HIVE/HBD |
| `POST /v2/v4vapp/keepsats/invoice` | Pay a BOLT11 invoice from keepsats |

Auth flow (reverse-engineered from the v4vapp frontend and verified live):

1. `GET /auth/{account}?clientId=<10–100 chars>&appId=hive.ausbit.dev&scope=hive:posting`
   returns a challenge string, e.g.
   `patch eagle dwarf ausbitbank 1795139814.363781 <clientId> hive.ausbit.dev`.
2. Sign that exact string with the **posting** key (Keychain `requestSignBuffer`
   or SmartLock).
3. `POST /auth/validate/?clientId=...` with
   `{success, publicKey, result, data:{username,message,key:"posting"}}`
   returns an `access_token` (and, on v4v.app's own origin, a refresh cookie).
4. Send `Authorization: Bearer <token>`.

**Verified 2026-11-21 with `@ausbit.vsc` and a posting-key signature:**
`/auth/validate/` returns `200` with a bearer token. The JWT claims are
`sub`, `username`, `scope: "hive:posting"`, `hive_pubkey`, `challenge`,
`expiry`, `state`, `jti`, `cf_country` — there is no `key` claim and no
active-authority grant. The token lived ~49 minutes. With that token,
`GET /v2/v4vapp/keepsats` returned `200` and a zero-balance liability object,
so the posting scope is sufficient for the read-only keepsats endpoints.
Active is **not** required to read a balance.

The posting scope is therefore enough for a **read-only** session. Do not
reuse it for writes without checking each endpoint's authority requirements;
if an endpoint demands active, keep that action on the on-chain path
(`custom_json`/`transfer` through the signing queue) instead of prompting for
active in a session. Tokens are short-lived (~50 minutes observed), so re-auth
on expiry rather than relying on the refresh cookie.

### 2.3 On-chain formats

Inbound payment seen on chain:

```
v4vapp -> kriszrokk  0.421 HIVE
Memo: Converted 77 sats to 0.421 HIVE with fee: 52 sats for kriszrokk |
      ⚡ zapped by @vikisecrets on cyberspace77.com #lightningaddress |
      § woVqr/s6PX | Thank you for using v4v.app
```

Keepsats deposit seen on chain:

```
hivemodular2 -> v4vapp  22.000 HBD  |  hivemodular2 Deposit to #SATS
v4vapp -> hivemodular2  0.001 HBD   |  Deposit 21.999 HBD to 34,082 sats
                                      with fee: 1,069 for hivemodular2 | ... § 0600_fc89fd_1
```

Instruction / notification custom JSON:

```json
{ "id": "v4vapp_transfer",
  "json": { "from_account": "alice", "to_account": "v4vapp",
            "sats": 0, "memo": "lnbc...", "parent_id": "..." } }
```

```json
{ "id": "v4vapp_notification",
  "json": { "from_account": "v4vapp", "to_account": "alice",
            "sats": 0, "msats": 0, "notification": true,
            "memo": "Paid Invoice with Keepsats | ... § 0614_32a715_1" } }
```

Notes:

- For a keepsats invoice payment, `sats` is `0` (the invoice encodes the
  amount). A non-zero `sats` is an upper limit.
- The site's queue already supports `custom_json` with active authority, so
  mode B can be added without a new signing stack.
- `parent_id` links the notification/transfer back to the originating ledger
  operation; it is the only reliable correlation id the bridge exposes.

### 2.4 Fee reality (important UX input)

Observed on chain:

- 77 sats inbound → 0.421 HIVE net, fee 52 sats. The recipient nets ~25 sats.
- 180,000 sats inbound → 2,960.375 HIVE, fee 5,270 sats (~2.9%).
- 22 HBD → 35,151 sats gross / 34,082 net keepsats, fee 1,069 sats (~3.0%).
- 1,000 sats outbound quote: 16.967 HIVE / 0.624 HBD mid-market; +79 sats fee
  (2.9% + 50) → 1,079 sats all-in.

Consequences for the UI:

- Do **not** offer 21/50/100-sat zap presets as if they were meaningful. The
  fixed fee eats them. Start at 1,000 sats and always show "recipient receives
  ~X after fee".
- For Hive users, a direct Hive/HBD tip is exact and costs only RC. Lightning
  is for people paying from LN wallets, not a replacement for the existing tip.
- Keepsats is cheaper for frequent LN payers (no conversion fee on invoice
  payments) but adds custody and a deposit fee. Position it as a power-user
  balance, not the default.

## 3. Integration constraints

| Constraint | Detail | Mitigation |
| --- | --- | --- |
| **CORS** | **Resolved 2026-11-21.** `https://hive.ausbit.dev` is on the allowlist: `GET /v1` returns `access-control-allow-origin: https://hive.ausbit.dev` with `access-control-allow-credentials: true`; `OPTIONS` preflights allow `POST`, `Authorization` and `Content-Type`; `401`/`422` responses carry the header too, so the browser can read errors. Dev origins are inconsistent: preflights work for `localhost:3000`, `localhost:5173`, `localhost:8080` and `127.0.0.1:3000`, but **not** for `127.0.0.1:8080`, `127.0.0.1:5173` or `localhost:9000` (those get an ACAO on simple GETs but not on preflight, so POSTs fail). Unlisted origins such as Playwright's `127.0.0.1:4173` get no header at all, and there is no wildcard reflection. | Treat production as a tested invariant: `scripts/v4vapp-contract-check.mjs` asserts the header and the public contract daily in CI. For live dev use `http://localhost:8080` (or `localhost:3000`), never `127.0.0.1:8080`. Preview and E2E origins stay mocked; do not ask the operator for more origins. |
| **Unreachable vs blocked** | A browser cannot tell a CORS block from some network failures, but it can tell whether it is offline and whether the request timed out. | Keep four distinct UI states (`offline`, `timeout`, `degraded`, `blocked`). Only `blocked` mentions browser/CORS restrictions; an outage must not be blamed on the allowlist. |
| **Refresh cookie** | v4v.app's httpOnly refresh cookie is first-party there; as a third-party cookie it may be blocked. | Use short-lived bearer tokens held in memory, re-auth on expiry. Do not build the product around silent refresh. |
| **Custody** | Keepsats is an off-chain IOU. The on-chain `v4vapp_transfer` is an instruction/notification, not escrow. | Label "held by v4v.app (custodial)", default off, show operator + terms, never imply hive.ausbit.dev holds funds. |
| **Single operator** | One bridge, one LND node, no SLA. `FAILURE_REASON_NO_ROUTE` is visible in public notifications. | Treat as best-effort, show pending/failed/refunded states, never claim success before settlement. |
| **No webhooks** | Only polling (`check_invoice`, Hive history, custom JSON). | Poll 2–3s while visible, back off, stop at expiry; use the existing visibility-aware timer pattern. |
| **Rate limits** | 600k sats/4h, 1.2M/72h, 2M/168h; invoice max 180k sats. | Client-side caps, show limits, avoid invoice spam. |
| **base64 paths** | `payment_hash` is base64 with `/`, `+`, `=`; path encoding is easy to get wrong and intermediaries can reject it. | Always `POST /v1/check_invoice` with `{r_hash}`. |
| **API drift** | Single-maintainer API, version `6.6.0`. | Pin a client module, feature-detect, contract-test nightly, fail soft to "open in v4v.app". |
| **Privacy** | Invoices and Hive memos are public; keepsats ledger notifications are public. | Disclose; keep memos short and free of personal data; fresh invoice per tip. |
| **Fees/limits change** | Server config is dynamic. | Read `/v1` config and display live values; never hard-code 2.9%/50 sats. |

## 4. Fit map

| # | Idea | Surface | Value | Effort | Risk | Phase |
| --- | --- | --- | --- | --- | --- | --- |
| A | Lightning address + tip jar | profile, `/@user/tip`, tip dialog | High | Low | Low | 1 |
| B | Receive-sats dialog (invoice, QR, status) | wallet, tip, POS | High | Low–Med | Low | 1 |
| C | Zap button on posts/shorts | post footer, short form | High | Med | Low–Med | 1–2 |
| D | Pay invoice with Hive/HBD | wallet, `/lightning/pay` | High | Med | Low | 2 |
| E | Keepsats balance + actions | wallet | Med–High | High | High (custody) | 3 |
| F | POS / merchant page | `/@user/pos`, `/tools/pos` | Med–High | Med | Low–Med | 3–4 |
| G | Wallet activity + tax classification | wallet, `/tax` | High | Low | Low | 1–2 |
| H | Explorer bridge interpretation + health | tx/block, account, `/health`, search | Med | Low | Low | 1–2 |
| I | Sats quotes + fee calculator | `/markets`, `/market`, wallet | Med | Low | Low | 2 |
| J | Create Hive account with Lightning | `/create` | Med | Med | High (master password) | 4 / exploratory |
| K | Magi BTC / MagiSats | Magi wallet card | Low–Med | High | Med | 5 |
| L | Creator analytics / zap leaderboards | dashboard, profiles | Med | Med | Low | 4 |

## 5. Ideas in detail

### A. Lightning identity on every profile

**What:** derive `<account>@v4v.app` (Hive), `<account>@hbd.v4v.app` (HBD) and
`<account>@sats.v4v.app` (keepsats); show a Lightning card with QR, copy,
"Open in wallet" and LNURL string. If the profile has `profile.lightning`, show
that first; otherwise fall back to the derived address.

**Why:** instant utility, no login, no custody, no new backend. It also fixes
the current gap where `tipDialog` can show a lightning link but the main tip
button's coin detector omits it.

**UX:** on `/@user`, `/@user/tip`, wallet and the tip dialog:

- A `⚡ Lightning` row with the address, QR, and a "Receive" tab.
- "Copy LNURL" / "Copy lightning: address" / "Show QR".
- A note: "Payments settle as a Hive/HBD transfer from @v4vapp. A ~50 sat
  return fee applies to small amounts."

**API:** `GET /v1/lnurlp/bech32/{acct}`, `GET /v1/lnurlp/qrcode/{acct}?currency=hive|hbd|sats`,
`GET /.well-known/lnurlp/{acct}`.

### B. Receive-sats dialog

**What:** a reusable dialog that creates an invoice for a chosen amount and
currency, shows QR + `lightning:` URI + expiry countdown, and polls until paid.

**UX:**

1. Choose destination: Hive, HBD or Keepsats (sats).
2. Choose amount: HBD, HIVE, USD or sats. Presets honour fees.
3. Show "payer sends ~N sats; recipient receives X HBD; fee ~Y sats; expires
   in M:SS".
4. Primary CTA: "Open Lightning wallet" on mobile; QR + copy on desktop.
5. On settle: "Paid — 5,000 sats → 3.12 HBD" with a link to the Hive transfer
   (or "view in wallet").

**API:**

```http
POST /v1/new_invoice_hive
{
  "hive_accname": "alice",
  "hbd_amount": 1.0,
  "receive_currency": "hbd",
  "message": "Tip from hive.ausbit.dev",
  "app_name": "hiveausbit",
  "expiry": 600,
  "qr_image": true
}
```

Response: `r_hash`, `payment_hash`, `payment_request`, `amount` (sats),
`expires_at`, `memo`, optional `qr_code_base64`. Poll with
`POST /v1/check_invoice {"r_hash": "..."}`. Use `state`/`paid`/`expired`; the
API returns `CANCELED` for expired invoices (observed), so do not only test for
`expired`.

**Notes:** `app_name` max 20 chars and cannot be `"string"`; use `hiveausbit`.
`message` max ~300 chars, no pipe `|`. Include a short site marker such as
`via hive.ausbit.dev` so on-chain transfers can be attributed, but do not put
post text or personal data in it.

### C. Post zaps / boosts

**What:** a `⚡ Zap` action next to the existing tip/vote actions on posts and
shorts. The payer pays a Lightning invoice; the author receives HIVE/HBD. A
memo can carry the post reference and an optional message.

**Why:** Lightning-native audiences can support Hive creators without a Hive
account; it is a growth channel, not just a wallet feature.

**UX:**

- Presets: 1k / 5k / 10k / 21k sats (or HBD equivalent).
- Show "author receives ~X HBD; fee ~Y sats".
- Optional message (short, public on-chain).
- After settlement, show a zap badge/count for the session; do not pretend it
  is a global count unless an indexer exists.
- "Boost" can also add a vote (posting key) or a comment, but keep the two
  signing intents separate: sats payment is LN/public; vote is posting.

**Attribution:** put a short marker in the invoice `message`, e.g.
`hive.ausbit.dev zap` plus the post permlink (truncated). The resulting Hive
transfer memo will contain it, so the site can later find its own zaps by
scanning transfers from `@v4vapp` with that marker.

**Caveat:** a true global zap counter requires indexing all `@v4vapp` transfers
(not just site-originated ones). Either accept a site-local count or add a
small cache/indexer later. Do not claim a global number without one.

### D. Pay a Lightning invoice with Hive/HBD

**What:** paste a BOLT11 invoice, Lightning address or LNURL; decode and
summarise it; pay by sending HIVE/HBD to `@v4vapp` with the invoice in the memo.

**Why:** this is the killer wallet tool for Hive users: spend HBD/HIVE on any
LN invoice without an exchange, using the signing flow the site already has.

**UX:**

1. Paste/scan. Decode with `GET /v1/decode_lightning/?pay_req=...`.
2. Show: amount in sats, fiat equivalent, description, destination node,
   expiry, and whether it is a Lightning address (amount unknown until paid).
3. Quote: `sats_to_hive` + live fee config → "costs ~19.1 HBD (incl. ~79 sat
   fee); any change is refunded".
4. Choose asset: HBD (recommended) or HIVE. Show balance and remaining.
5. Queue a `transfer` to `@v4vapp` with memo `<invoice> #v4vapp` (add `#HBD`
   only if the asset is HBD and the flag is needed; the asset already says it).
6. Sign with Keychain/SmartLock through the existing queue. Never auto-broadcast.
7. Track: the outgoing transfer is the request; a `v4vapp_notification` or a
   refund transfer from `@v4vapp` is the result. Show pending until then.

**Safety:**

- Reject `lntb`/`lnbcrt` on mainnet; accept only `lnbc` (or an LNURL/address).
- Decode server-side to avoid bundle weight; still validate the prefix, length
  and expiry locally.
- Cap at the live max (180k sats) and warn above a user-set limit.
- Show the invoice description; do not let a malicious invoice hide behind a
  truncated string.
- Warn that memos and payments are public.
- Do not include the invoice twice or add unescaped `|`.

**Memo builder:**

```js
export function lightningMemo (invoice, { hbd = false } = {}) {
  const clean = String(invoice).trim().replace(/\s+/g, '')
  if (!/^lnbc[0-9a-z]+$/i.test(clean)) throw new Error('Not a mainnet BOLT11 invoice')
  return [clean, hbd ? '#HBD' : '', '#v4vapp'].filter(Boolean).join(' ')
}
```

**Queue operation:**

```js
store.addToQueue([user, 'active', ['transfer', {
  from: user,
  to: 'v4vapp',
  amount: `${amount.toFixed(3)} HBD`,
  memo: lightningMemo(invoice, { hbd: true })
}]])
```

**Alternative (mode C):** if the user has a keepsats balance, pay from it with
`POST /v2/v4vapp/keepsats/invoice` (or a `v4vapp_transfer` custom JSON) and
avoid the Hive transfer + conversion fee. Keep this as a secondary button.

### E. Keepsats balance (opt-in, custodial)

**What:** a "Lightning balance" asset in the wallet, with deposit, withdraw,
send-to-user, pay-invoice and history.

**Why:** frequent LN users save the conversion fee and get instant internal
transfers. It also enables a "sats wallet" experience without leaving the site.

**Why not default:** the balance is an IOU from v4vapp. It needs explicit
disclosure, a feature flag, and a clear "withdraw to Hive" escape hatch.

**Implemented (W47 + W48):** the read-only half of option 2 and the complete
on-chain action set of option 1. A posting-key challenge yields a ~50 minute
bearer token held in memory; the wallet shows balance, in-progress sats, last
activity and (when present) history. Deposits (`#sats`), conversions
(`v4vapp_transfer` + `#HBD`/`#HIVE`) and Lightning invoice/address payments from
keepsats are queued as `manualOnly` active-key actions. No writes go through the
API session; no tokens are stored; no active key is held.

**Two implementation options:**

1. **No v4vapp login (recommended first):**
   - Deposit: normal `transfer` to `@v4vapp` with `#sats`.
   - Balance: on-demand `transfer` of 0.001 HIVE with `#balance_request`
     (public reply) or `#balance_request private` (needs memo key to decrypt).
   - Withdraw/convert: `custom_json` `v4vapp_transfer` to `@v4vapp` with
     `#HIVE`/`#HBD`; pay invoice/address with an invoice/address memo.
   - All signed by the active key through the existing queue.
   - Pros: no CORS/auth/cookie dependency; signing intent is visible.
   - Cons: each action is an on-chain op (RC, ~3s block), balance check is slow.
2. **v4vapp API session (mode C):**
   - `GET /v2/v4vapp/keepsats` gives balance and history in one request.
   - `POST /keepsats/transfer|convert|invoice` gives one-click actions.
   - Requires auth (challenge + JWT), CORS allowlist, token lifecycle.
   - Pros: best UX. Cons: custodial session, more moving parts.

**UX:**

- Asset card: "Lightning balance (Keepsats)" with a `Custodial` badge, sats and
  USD value, and "Held by v4v.app" tooltip.
- Actions: Receive, Send, Pay invoice, Convert to HBD/HIVE, View history.
- Pending strip: "1 LN payment in flight".
- History rows: deposit, withdrawal, internal transfer, invoice payment,
  conversion, fee, refund, notification.
- Empty state links to "Deposit HBD → sats" with the fee shown.
- A top-up option using a Hive recurrent transfer with `#sats` (fixed memo,
  works with recurrence) — clearly labelled as auto top-up.

**Do not:** hide the custody model in a tooltip alone; put it in the card and
the first-use dialog; never store the JWT in `localStorage`; clear it on logout
and account switch.

### F. POS / merchant mode

**What:** a public, kiosk-friendly page for a Hive account: amount pad,
currency (HBD/HIVE/USD/sats), memo, invoice QR, paid state, daily totals.

**Why:** merchants and meetups can accept Lightning and settle in HBD/HIVE
without a separate processor. It reuses the receive-invoice flow.

**UX:**

- `/@merchant/pos` (or `/tools/pos?to=merchant`) with a large numeric pad.
- Customer side: QR + "open wallet"; cashier side: "waiting / paid" state.
- Receipt: amount, sats, fee, Hive tx link, timestamp.
- Optional: "add a note" for the Hive memo.
- History: recent settlements from the Hive account (filter transfers from
  `@v4vapp`), no server needed.

**Caveat:** an invoice is single-use and expires (≤30 min). Generate a new one
per sale; never reuse a QR.

### G. Wallet activity and tax

**What:** classify bridge activity in the wallet and CSV export.

**Rows to add:**

- `transfer` to `@v4vapp` with an invoice memo → "Lightning payment".
- `transfer` from `@v4vapp` to the user → "Lightning received" (parse
  "Converted N sats ... fee ...").
- `transfer` to `@v4vapp` with `#sats` → "Keepsats deposit".
- `custom_json id=v4vapp_transfer` → "Keepsats transfer / invoice / conversion".
- `custom_json id=v4vapp_notification` → "Bridge notification" (success, error,
  refund, fee).

**Tax CSV columns:** `timestamp, rail, direction, asset, amount, sats,
fee_sats, hive_equivalent, counterparty, invoice_hash, parent_id, txid, status`.
Group refunds with the original payment; include the fee so cost basis is
accurate. This is a differentiator: most wallets do not reconcile LN bridge
fees.

**Caveat:** do not count the same economic event twice (the outgoing transfer
and the notification). Use `parent_id`/`§ id` where available and de-duplicate.

### H. Explorer: make the bridge legible

**What:** interpret v4vapp operations instead of showing raw JSON.

- `BlockOperation.vue` / account activity: render `v4vapp_transfer` and
  `v4vapp_notification` as human-readable cards: from/to, sats, memo, parent id,
  link to `v4v.app`.
- Transfer memos: detect a BOLT11 invoice, decode it, show "Lightning payment
  of N sats to <description>"; detect "Converted N sats ... fee ..." and show
  the net.
- Search: accept `lnbc...` and Lightning addresses (`user@domain`) and offer
  "decode invoice" / "open Lightning address" instead of a dead account search.
- `/health`: add a "Lightning bridge" row from `GET /v1` (alive/LOCKED, version,
  LND state, quote freshness, configured limits) and optionally the beacon
  node count. Keep it advisory; do not page on a third party.
- `/nodes`: optionally show v4vapp's beacon view, but do not replace the site's
  own node health.

**Why:** the site's identity is "trustworthy explorer". Showing that a transfer
was a Lightning settlement, with fee and status, is exactly the kind of
transparency users cannot get elsewhere.

### I. Markets: sats as a quote currency

**What:** display HIVE/HBD in sats, sats in Hive/HBD, and a fee-inclusive
"pay this invoice" calculator.

- `/markets`: add a sats row/card using `/v1/cryptoprices/` (BTC/USD, sats per
  Hive/HBD) and show quote age/staleness.
- `/market` and the conversion calculator: add "sats" as an output and
  "LN invoice" as a destination with the 2.9% + 50 sat estimate.
- Wallet: show the HBD cost next to an invoice before signing.
- HBD page: a small "HBD vs sats" comparison is enough; avoid implying a
  trading pair that does not exist.

**Why:** users think in sats when paying Lightning; the site already has BTC
prices, so this is mostly presentation and one cached API read.

### J. Create a Hive account with Lightning (exploratory)

v4vapp exposes `GET /v2/v4vapp/account/cost` and `POST /account/create` +
`/account/create_complete`: pay an invoice, receive a new Hive account. Live
cost on 2026-11-20 was 12 HIVE / 705.95 sats (with 2 HIVE back), dynamic.

**Why:** onboard Lightning users who have no Hive account. The site already has
`/create` with key generation and queue-based account creation.

**Why be careful:** the flow sends a master password to v4vapp to create the
account. That is a significant trust ask and duplicates key custody. Only
pursue if the operator documents key handling, or if a voucher/claim-ticket
flow can be used so the site never sends a master password. Keep the existing
`/create` flow as the default.

### K. MagiSats (later)

The site already reads Magi HIVE/HBD balances via GraphQL. v4vapp can receive
Lightning to `alice@magi.v4v.app` and forward sats to the Magi BTC contract.
Adding a "Bitcoin on Magi" balance would require reading the VSC BTC contract
state (not the current `getAccountBalance` fields), so treat this as a
separate research task. The receive flow itself (invoice tagged `#magisats
#v4vapp`) is straightforward; the balance display is the hard part.

### L. Creator dashboard / zap analytics

If the site wants creator tooling: show sats received this week, top zaps,
unique supporters, average tip, and fee drag. Source it from the creator's own
Hive transfers from `@v4vapp` (public), cache locally, and label it as
"settled on Hive", not "global Lightning volume". Avoid a global leaderboard
without an indexer.

## 6. Architecture

### 6.1 Modules

```
src/services/v4vapp.js        HTTP client: public endpoints, timeouts, error map
src/services/lightning.js     pure: decode validation, fee math, memo builders,
                              status reducer, address derivation, formatting
src/stores/lightning.js       Pinia: quotes, pending invoices, address cache,
                              optional keepsats session (mode C)
src/components/lightning/
  LightningIcon.vue
  LightningAddressCard.vue    address, QR, copy, open-in-wallet
  LightningInvoiceCard.vue    QR, amount/fee/expiry, aria-live status
  LightningReceiveDialog.vue  amount/currency → invoice → poll
  LightningPayDialog.vue      paste/decode/quote → queue transfer
  KeepsatsPanel.vue           balance + actions (mode C or B)
src/pages/lightning.vue       hub: receive / pay / address
src/pages/pos.vue             merchant mode
```

Do not put network calls in components; keep them in services so they are
testable and so the fee/decoding rules live in one place.

### 6.2 Client sketch

```js
// src/services/v4vapp.js
const BASE = 'https://api.v4v.app'

export async function v4v (path, { method = 'GET', body, signal, timeout = 8000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      referrerPolicy: 'no-referrer'
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw Object.assign(new Error(errorMessage(res.status, data)), { status: res.status, data })
    return data
  } finally {
    clearTimeout(timer)
  }
}
```

Error mapping: 422 `detail[0].msg`, 429 "Bridge rate limit", 503 "Bridge
pricing unavailable", 403 "Blocked by the bridge or an intermediary", network/abort "Bridge
unreachable". Never surface raw HTML.

### 6.3 Fee and quote helpers

```js
export function feeSats (sats, { percent = 0.029, fixed = 50 } = {}) {
  return Math.ceil(sats * percent + fixed)
}
export function allInSats (sats, config) {
  const fee = feeSats(sats, config)
  return { sats, fee, total: sats + fee }
}
```

Read `percent`/`fixed` from `GET /v1` `config.conv_fee_percent` and
`config.conv_fee_sats`; show `quote_age_s` and `stale`. For inbound, use the
invoice's `amount` (sats) and the requested Hive/HBD amount to derive the
effective rate, and show the observed fixed fee warning for small amounts.

### 6.4 Queue integration

- Add a queue item label: `transfer` to `@v4vapp` with an invoice memo should
  show "Lightning payment" rather than "Transfer".
- Store a small sidecar (invoice hash, decoded description, sats, fee, quote)
  in `queueMeta` so the review step can show what will be paid. The queue
  currently shows only the operation type; this is the one place where extra
  intent matters most.
- Never auto-broadcast these; keep `timerEnabled` off for Lightning items.
- For smartlock, active-key actions already prompt for the password. Keep it
  that way; do not cache the active key.

### 6.5 Polling and state

- Poll `POST /v1/check_invoice` every 2–3s while the dialog is visible; pause
  when hidden (use `src/mixins/timers.js` / `services/polling.js`).
- Stop at `expires_at`; show "expired" and offer a fresh invoice.
- Persist pending invoices in `sessionStorage` with `expires_at` so a refresh
  resumes; delete on settle/expire. Do not store more than the hash, amount,
  recipient and memo.
- For outbound payments, poll the user's account history for a `v4vapp`
  notification/refund; do not poll the bridge for a payment it did not create.

### 6.6 QR and dependencies

- Inbound: `qr_image: true` on `new_invoice_hive` returns `qr_code_base64`;
  no client dependency. For an address QR, use
  `GET /v1/lnurlp/qrcode/{acct}` (PNG) with `referrerpolicy="no-referrer"`.
- Outbound/invoice-generic: if a QR is needed for an invoice not created by us,
  lazy-load a small QR library only in the Lightning route chunk. Do not add it
  to the main bundle; the site has strict route budgets.
- If `window.webln` is present, offer `webln.sendPayment(payment_request)` as a
  one-click option. It is a progressive enhancement: time out and fall back to
  QR/copy, never make it a requirement.
- BOLT11 decode: use the server (`/v1/decode_lightning`) first; it keeps the
  bundle small and returns `num_satoshis` as a string. Feature-detect a local
  decoder only if the endpoint disappears.

### 6.7 Feature flag and configuration

- `LIGHTNING_ENABLED` (build/runtime flag) gates all UI.
- Base URL in one place (`services/v4vapp.js`); allow a dev override.
- `app_name=hiveausbit` on invoice creation; include a stable `clientId` for
  auth (random, 10–100 chars, stored locally, not a secret).
- Show bridge attribution and a link to v4v.app/terms near the first use.
- Bridge capability is a state, not an exception: `unknown | available |
  degraded | offline | timeout | blocked | unauthorized`. `probeBridge()`
  caches `GET /v1` for five minutes and never throws; screens use it to decide
  whether to promise a live quote. A caller abort is not a bridge failure.
- Read live fees/limits from `GET /v1` (including `min_max`) and label every
  fallback value as an estimate/default.

### 6.8 Security rules

1. Never send private keys, encrypted keys or SmartLock material to v4vapp.
2. Never auto-broadcast a Lightning payment; require an explicit queue review.
3. Verify invoice network and expiry; show the decoded recipient/description.
4. Cap amounts and warn above a user-set limit.
5. Do not store JWTs in `localStorage`; memory or `sessionStorage` with a short
   TTL; clear on logout/account switch.
6. Do not claim settlement from a client-side timer; require `paid/settled` or
   an on-chain confirmation.
7. Label custodial balances and third-party risk in the UI, not just docs.
8. Treat all memos, descriptions and profile metadata as untrusted text; never
   render them as HTML.
9. Keep the existing CSP `connect-src https:` or tighten to
   `https://api.v4v.app` once the endpoint set is fixed; QR images need
   `img-src https:` (already allowed).
10. Do not log full invoices or tokens; invoices are public but still correlate
    users and payments.

## 7. Phased plan

| Phase | Scope | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| **0. Contract** | ~~Confirm CORS allowlist~~, ~~posting-scope auth~~, rate limits, terms, support contact | CORS verified live 2026-11-21 (§3); posting-scope auth verified live 2026-11-21 (§2.2); `scripts/v4vapp-contract-check.mjs` runs daily in CI | **Contract done.** Terms/support still worth asking about before custody features |
| **1. Receive + identity** | Address derivation, profile/tip cards, receive dialog, status polling, wallet history classification (read-only) | `services/v4vapp.js`, `services/lightning.js`, `LightningAddressCard`, `LightningInvoiceCard`, `LightningReceiveDialog`, tip integration, `/lightning` hub | Unit tests (math, status, memo), E2E with mocked API, axe 1440/390, live smoke with 1 HBD invoice |
| **2. Pay with Hive/HBD** | Decode, quote, fee display, queue transfer to `@v4vapp`, pending/refund tracking | `LightningPayDialog`, queue label/sidecar, wallet/tax classification | E2E queue + mocked settlement/refund; manual live payment of a 100-sat invoice; no auto-broadcast |
| **3. Keepsats (opt-in)** | ~~Read-only balance/history (mode C)~~ **done W47**; ~~deposit/convert/pay via on-chain mode B~~ **done W48**; remaining: transfer to another user, on-chain balance-request UI, optional mode C writes | `KeepsatsPanel`, `KeepsatsActions`, `v4vappAuth`, `v4vapp_transfer` builders, notification parsing, custody disclosure | Read-only: explicit opt-in, posting key only, memory token, axe, no token leakage. Actions: explicit consent, `manualOnly` queue, live operator smoke |
| **4. POS + zaps + analytics** | Merchant page, post zap presets, creator weekly sats, dashboard widget | `pages/pos.vue`, `SatsZapButton`, `CreatorSatsCard` | Paid/expired/error states, receipt, mobile smoke |
| **5. Advanced** | Magi BTC, account creation, paywalls, LNURL-auth, alternative bridges | Research notes + spikes | Only after 1–4 are stable |

### Suggested first slice (a W36-sized workstream)

**"Lightning receive & tip identity"** — no custody, no API session, no new
backend:

- `services/lightning.js`: address derivation (`hive`/`hbd`/`sats`), invoice
  status reducer, fee display, formatting, memo/ref helpers; unit tests.
- `services/v4vapp.js`: `GET /v1`, `GET /v1/cryptoprices/`,
  `POST /v1/new_invoice_hive`, `POST /v1/check_invoice`,
  `GET /v1/lnurlp/bech32|qrcode`, `GET /v1/decode_lightning`; timeout/error map.
- `LightningAddressCard` on `/@user`, `/@user/tip` and the tip dialog.
- `LightningReceiveDialog` from the wallet HBD/HIVE cards and the tip page.
- `LightningInvoiceCard`: QR, amount/fee/expiry, aria-live status, copy,
  open-in-wallet; polls while visible.
- Wallet: classify `@v4vapp` transfers as "Lightning received"; add a
  `lightning` activity category.
- No keys, no keepsats, no payments out.

Acceptance: a logged-out visitor can open a profile, see the Lightning address
and QR, and create a 1 HBD receive invoice that settles and shows the Hive tx;
a logged-in user can do the same from the wallet; failed/expired/offline states
are explicit; no new dependency in the main bundle.

## 8. Risks and open questions

**Product/trust**

- Is a custodial sats balance acceptable to the site's audience? If not, skip
  mode C and keep B only.
- Who owns support when a payment fails or a refund is late? Link to v4v.app
  support, but the site will still get the complaint.
- Branding: "v4v.app" vs "Lightning" vs "sats" — pick one vocabulary and use it
  consistently. "Keepsats" is a v4vapp term; users will not know it.

**Technical**

- ~~Can `https://hive.ausbit.dev` be added to the API CORS allowlist?~~ **Yes,
  verified 2026-11-21.** `GET /v1`, the public reads and `POST` preflights
  return `access-control-allow-origin: https://hive.ausbit.dev`; unlisted
  origins get no header. The nightly contract check fails if the entry lapses.
  No proxy is needed. Preview/staging origins and Playwright's
  `127.0.0.1:4173` are not allowlisted and should stay mocked; do not ask for
  more origins.
- ~~Does `/auth/validate` accept `scope=hive:posting`, or is active required?~~
  **Answered 2026-11-21: posting is accepted.** A posting-key challenge for
  `@ausbit.vsc` validated with `200`, the token carried
  `scope: "hive:posting"`, and it read the keepsats balance endpoint with
  `200`. Tokens last ~50 minutes. Keep the session read-only unless an
  endpoint is explicitly verified to accept posting for writes.
- Is there a webhook/websocket or a batch status endpoint? Polling is the main
  scaling limit for POS.
- What is the refund SLA and how is a refund surfaced (Hive transfer,
  notification, both)?
- Is `receive_currency=sats` (keepsats) available to any Hive account without
  registration? What are the terms?
- Does `new_invoice_hive` with a BTC/EVM `hive_accname` pay out on-chain? What
  are the semantics and limits? (The schema says it accepts those addresses.)
- How do we read a Magi BTC balance (contract state), and is the VSC contract
  stable?
- Account creation: is sending a master password to v4vapp documented and
  acceptable? Is there a voucher/claim-ticket flow?
- What are the exact memo length and character rules? (Pipe `|` is forbidden;
  `#` tags are interpreted.)
- Can `app_name=hiveausbit` get dedicated rate limits or an allowlist entry?
- What is the upgrade/deprecation policy for the `/v1` and `/v2` endpoints?

**Testing**

- Live invoices in CI are not acceptable (they create real payment requests and
  hit rate limits). Use recorded fixtures + mocked fetch; run a nightly
  contract check against `/v1` and `/v1/cryptoprices/` only.
- E2E must cover: expired invoice, `NO_ROUTE`/failure notification, refund,
  offline, rate limit, malformed invoice, wrong network, and a slow bridge.

## 9. Appendix

### A. Endpoint cheat sheet

```http
GET  /v1
GET  /v1/cryptoprices/
GET  /v1/cryptoprices/sats_to_hive/?sats=1000
POST /v1/new_invoice_hive      {hive_accname, hbd_amount|hive_amount|usd_amount|sats_amount,
                                receive_currency: hive|hbd|sats|magisats, message, expiry,
                                app_name, qr_image}
POST /v1/new_invoice           {hive_accname, amount, memo, currency, expiry, app_name}
POST /v1/check_invoice         {r_hash}
GET  /v1/decode_lightning/?pay_req=lnbc...
GET  /v1/lnurlp/bech32/{acct}
GET  /v1/lnurlp/qrcode/{acct}?currency=hive|hbd|sats
GET  /.well-known/lnurlp/{acct}
GET  /v2/v4vapp/account/cost
POST /v2/v4vapp/account/create
POST /v2/v4vapp/account/create_complete
GET  /v2/v4vapp/magisats/fee_out?sats=1000
GET  /v2/beacon/nodes/
GET  /v2/v4vapp/keepsats?hive_accname=...          (Bearer)
POST /v2/v4vapp/keepsats/transfer|convert|invoice  (Bearer)
GET  /auth/{acct}?clientId=...&appId=...&scope=hive:posting
POST /auth/validate/?clientId=...                  (signed challenge)
```

### B. Invoice status

```
OPEN      → waiting; keep polling while visible
SETTLED   → paid=true, settled=true; show receipt
CANCELED  → expired=true (observed when expiry passes); offer a new invoice
```

Use `paid`/`settled`/`expired`, not `state` alone. Do not treat `state` as a
stable enum across versions. On 2026-11-21 an unknown `r_hash` also returned
`state: CANCELED` with `expired: true`, so never infer "it was never paid" from
this response alone — confirm on Hive.

### C. Amount math examples (2026-11-20)

| Case | Result |
| --- | --- |
| 1,000 sats outbound | 16.967 HIVE / 0.624 HBD mid-market; fee 79 sats; all-in 1,079 sats |
| 180,000 sats inbound | 2,960.375 HIVE; fee 5,270 sats (~2.9%) |
| 77 sats inbound | 0.421 HIVE net; fee 52 sats; recipient nets ~25 sats |
| 22 HBD keepsats deposit | 35,151 sats gross / 34,082 net; fee 1,069 sats (~3.0%) |

Always show gross, fee and net. Round fees up and label estimates as estimates.

### D. Memo grammar (outbound)

```
<bolt11>                       pay this invoice
<bolt11> #HBD                   use the HBD rate (when sending HIVE)
<bolt11> #paywithsats:5000      pay from keepsats, cap 5,000 sats
<user@domain>                   resolve and pay a Lightning address
<user@domain> #paywithsats:5000 same, from keepsats
<acct> #paywithsats:5000        transfer 5,000 keepsats to acct
#sats                           deposit the full amount as keepsats
#balance_request [private]      query balance, optional encrypted reply
#v4vapp                         app marker (stripped from public memos)
```

Do not invent flags. Unknown flags can be silently treated as a keepsats
deposit, which would be a costly surprise.

### E. User-facing copy suggestions

- "Lightning payments are bridged by v4v.app. Your sats become HIVE/HBD in the
  recipient's Hive wallet."
- "A ~50 sat bridge fee applies; small tips lose a large share. Start at 1,000
  sats."
- "Keepsats are held by v4v.app, not by hive.ausbit.dev. Withdraw to Hive at any
  time."
- "Lightning routing can fail. If it does, the bridge refunds the Hive/HBD
  (minus its fee). We show the refund on chain when it arrives."
- "Never share keys. Paying a Lightning invoice only needs a normal Hive
  transfer, reviewed in your queue."
