# Account creation — refined implementation plan

**Status:** static phase and Hivedex paid embed implemented — see
`docs/workstreams/W82-account-creation.md`  
**Research:** 2026-11-26  
**Constraints from the operator:**

- New-user signup **and** existing-user gifting are both priorities.
- Willing to spend account tokens and act as recovery account for a **capped free pool**.
- **No automation may hold or use `@ausbitbank`'s active authority.** Ausbitbank is a
  witness/stakeholder; the active key must stay human-controlled.
- Prefer **static / no-backend**. A Worker is acceptable only if the benefit is
  concrete.
- Prefer **Hive-native auth** (Keychain / HiveAuth / SmartLock), but Google/X/GitHub
  signup is valuable for outsiders.
- Interested in monetizing account creation **securely**, and happy to route
  payments to trusted providers (user choice is king).

See `docs/account-creation-research.md` for the provider evidence and source log.

---

## 1. The constraint that shapes everything

Hive **Account Creation Tokens** (`pending_claimed_accounts`) are:

- earned by `claim_account` using RC,
- consumed by `create_claimed_account`,
- **non-transferable**, and
- only spendable by the account that owns them, with its **active** authority.

So:

- We **cannot** move `@ausbitbank`'s tokens into a Worker, a database, or a new
  onboarding account.
- Any automated use of those tokens would require storing/using
  `@ausbitbank`'s active key. **We will not do that.**
- There are only two safe ways to use them:
  1. **Human-in-the-loop batch signing** — Ausbitbank reviews a batch and approves
     it once in Keychain/HiveAuth. No key is stored or automated.
  2. **Do not use those tokens for automation** — use a separate, low-value
     onboarding account with its own active key and its own HIVE/HP instead.

This plan uses both, for different lanes.

---

## 2. Recommended architecture: three lanes

### Lane A — Community/free pool, signed by Ausbitbank in batches

**Use case:** capped free accounts, community invites, paid orders that can wait
for a manual batch, events.

**How it works:**

1. A new user generates keys locally and submits a **claim request** containing
   only `{username, owner/active/posting/memo public keys, nonce, timestamp}`.
2. Requests queue up (see §3 for static vs Worker options).
3. Ausbitbank opens an admin batch page, reviews the queue, selects up to N
   requests, and approves **one transaction** containing N
   `create_claimed_account` operations in Keychain/HiveAuth.
4. The site polls the chain, marks requests complete, and notifies the users.
5. The new user's waiting page verifies the on-chain keys match their public
   keys, then offers SmartLock/Keychain import.

**Security properties:**

- No active key is stored anywhere.
- Ausbitbank sees every request before it is signed.
- The transaction is atomic; pre-check all usernames/keys before signing.
- Batch size should stay small (start with 5–10 ops) to limit all-or-nothing
  failure and transaction size. Test on testnet first.
- Creator = `@ausbitbank`; recovery account = `@ausbitbank`. Disclose this. The
  new user can change recovery later (30-day delay) with their owner key.

**Trade-offs:**

- Not instant; depends on Ausbitbank signing a batch.
- Manual review is the abuse control and the bottleneck.
- Uses existing tokens at no HIVE cost, which is the cheapest free-account path.

**Monetization:** the same queue can handle paid orders. The user pays HIVE/HBD
to a **dedicated payment account** (not Ausbitbank's personal/witness account),
the queue records the order, and the next batch creates the account. This is
secure but not instant; price accordingly.

### Lane B — Instant paid accounts, isolated dedicated account (optional)

**Use case:** instant paid signup, bulk API, or a scalable free pool where a
human batch is too slow.

**How it works:**

1. Create a dedicated Hive account, e.g. `banksia.onboard`.
   - Its owner key is offline.
   - Only its **active** key is available to the automation, and only for
     `account_create` / `create_claimed_account`.
2. Fund it with a **small** amount of liquid HIVE (e.g. 50–100 HIVE) and enough
   RC to broadcast. RC comes from HP; delegate a small amount of HP/RC from
   Ausbitbank **once, manually**, or from another account. This is a one-time
   active action, not ongoing automation.
3. The Worker/service creates accounts with `account_create` (3 HIVE burn) or
   `claim_account` + `create_claimed_account` if the dedicated account
   accumulates its own tokens.
4. Top up manually; monitor balance and rate; pause on anomalies.
5. Creator/recovery account = `banksia.onboard`, **not** Ausbitbank.

**Security properties:**

- Ausbitbank's active authority is never in the automation.
- The hot key is isolated to a low-value account with a limited balance.
- If the hot key leaks, the attacker can spend the small balance/create accounts,
  but cannot touch Ausbitbank's accounts, tokens, witness, or funds.
- Keep the owner key offline; rotate active authority if needed.

**Trade-offs:**

- Hot-key risk (bounded).
- Needs a backend/Worker and operational monitoring.
- Does not use Ausbitbank's existing tokens (they cannot be transferred).

**Monetization:** this is the clean path for instant paid accounts. Charge
3 HIVE + a service fee (e.g. 1–2 HIVE), or a fixed price comparable to Hivedex.
Accept HIVE/HBD to the dedicated account; verify the transfer before creating.

### Lane C — External providers (no custody)

**Use case:** users who want a familiar provider, free email signup, crypto
payment, or OAuth.

- **Ecency** — free, email/reCAPTCHA. Deep link with `?referral=ausbitbank`.
- **Hivedex** — $0.49, anonymous, crypto. Embed the API or deep link.
- **HiveDapps** — free/delayed, community sponsor. Link or use as a reference.
- **Actifit** — $2 in HIVE, fitness niche. Optional link.
- **Butter Auth** — Google/GitHub/Discord/email OAuth. Later, with a Worker.
- **v4vapp** — Lightning. Later, with custody/CORS caveats.
- **HiveInvite** — gift cards/PINs for events. Partner or fork.
- **More options** — `signup.hive.io`, with a “verify before use” note.

Lane C is the pressure valve: it gives users choice without Banksia holding keys
or funds.

---

## 3. Static first, Worker only when it earns its keep

### 3.1 Static MVP (recommended first release)

No backend required:

- `/join` page with verified provider cards and live Hivedex price.
- New user: choose username → generate keys locally → download backup → copy a
  **claim link** (username + public keys in the URL fragment).
- Existing user: `/create` → generate keys → create now with token/HIVE, or copy
  a claim link.
- Sponsor: open claim link → sign in → create with token/HIVE.
- Admin batch: a static `/create/batch` page where Ausbitbank pastes one or more
  claim links (or imports a JSON file), reviews them, and signs one batch in
  Keychain.
- Hivedex embed: client-side keys, invoice, status polling.

Static benefits: no server, no keys, no database, no new attack surface. The cost
is manual link collection and no public status page.

### 3.2 Keyless Worker (worth it when volume grows)

A Worker is worth adding when at least one of these is true:

- Free/paid requests are frequent enough that manual link collection is painful.
- We want a public “request an account” queue with status.
- We want payment reconciliation (watch a dedicated account's transfers).
- We want rate limiting/Turnstile and audit logs.
- We want provider status checks and funnel analytics.

**What the Worker stores:** only public data — username, public keys, nonce,
timestamps, request status, order/payment references. **No private keys, no
mnemonic/password, no active key.**

**What the Worker does:**

- `POST /api/onboarding/requests` — create a claim request (Turnstile, rate
  limits, one per username/nonce).
- `GET /api/onboarding/requests/:id` — status for the waiting page.
- `POST /api/onboarding/requests/:id/paid` — attach a payment reference (or
  verify a transfer).
- `GET /api/onboarding/admin/queue` — admin-only pending queue (Cloudflare
  Access or a secret).
- `POST /api/onboarding/admin/batch` — record a signed batch/transaction id.
- `GET /api/onboarding/providers` — cached provider status/price/last verified.

**What it does not do:** hold keys, sign transactions, spend tokens, or create
accounts. Signing stays in Ausbitbank's browser/Keychain.

**Effort:** ~1–2 weeks, reusing the existing metadata Worker and KV/D1. Add
Turnstile and an admin auth boundary. This is a **keyless coordination service**,
not a custodial service.

**Verdict:** start static. Add the Worker when the queue/admin workflow is
actually used; do not build it speculatively.

### 3.3 Custodial Worker (Lane B) — only if instant automation is required

This is a separate decision. It holds `banksia.onboard`'s active key, not
Ausbitbank's. Keep the balance small, restrict operations to account creation,
and treat it as a hot wallet. If we do not need instant automated accounts, skip
it and route instant paid users to Hivedex.

---

## 4. Google / X / GitHub signup

### What exists

- **Butter Auth** supports Google, GitHub, Discord and email. It creates or links
  a Hive account and grants the integrator's Hive service account posting
  authority. It requires a backend, and new accounts default to a **warm-up**
  identity (handle, no Hive account) unless a funded provider creates them.
- Butter Auth does **not** list X/Twitter as a provider today. X would require a
  separate OAuth integration and account-provisioning flow.

### Recommendation

1. **Short term:** Ecency (email) is the no-backend “outsider” path; Hivedex is
   the paid/no-verification path. This covers most users without adding OAuth.
2. **Medium term:** if data shows OAuth demand, add **Butter Auth** as a clearly
   labelled “Easy signup with Google/GitHub/Discord” option via the Worker.
   - Use a dedicated service account, not Ausbitbank.
   - Prefer the “create account then export keys to SmartLock/Keychain” flow;
     do not make Banksia the permanent posting authority unless the user opts in.
   - Disclose the posting authority and offer a revoke step.
   - Run its account provider on the dedicated onboarding account (Lane B), not
     Ausbitbank's tokens.
3. **X/Twitter:** defer. It needs custom OAuth + account provisioning, and the
   security/recovery story is the same as Butter Auth. Revisit after Google/GitHub.
4. **Hive-native stays primary:** Keychain, HiveAuth and SmartLock are the
   default. OAuth is an alternative front door, not a replacement.

A possible future convenience improvement: passkey/WebAuthn unlock for SmartLock
(platform authenticator instead of typing the SmartLock password). That does not
create accounts, but it makes Hive-native login easier for outsiders.

---

## 5. Monetization without active-key automation

**Clarify the product:** account tokens are non-transferable, so we cannot sell
“credits” as tokens. We can sell **account creation** (a service) or route users
to a provider.

Three secure options:

### Option 1 — Route to Hivedex (simplest, no custody)

- User pays Hivedex directly; Hivedex creates the account.
- Banksia gets a referral/attribution if Hivedex supports it; confirm terms.
- No hot wallet, no refunds, no accounting, no legal exposure beyond the link.
- Best default for instant paid signup.

### Option 2 — Human-signed paid queue (uses Ausbitbank's tokens, not instant)

- User pays HIVE/HBD to a dedicated `banksia.pay` account with an order memo.
- The Worker records the order; Ausbitbank reviews and signs the next batch.
- No active key storage; recovery = Ausbitbank; slower.
- Price: 3 HIVE + service fee, or a fixed price.
- Refunds handled manually from the payment account (no hot key needed if a human
  signs the refund).

### Option 3 — Dedicated instant onboarding account (Lane B)

- Automated `account_create` from `banksia.onboard` with a small balance.
- Instant; hot-key risk limited to that account's balance.
- Price comparable to Hivedex; refunds/support policy required.
- Keep payment and onboarding balances separate; top up manually.

**Do not:**

- put payments into Ausbitbank's personal/witness account,
- store an active key in a Worker to spend Ausbitbank's tokens,
- promise “credits” that can be transferred,
- sell accounts without terms/refund/support text.

**Operational separation:**

- `@ausbitbank` — witness/stakeholder; human-signed batches only.
- `banksia.pay` — dedicated payment/reconciliation account (no automation key, or
  a human-held key).
- `banksia.onboard` — optional hot account for instant automation, small balance,
  owner key offline, active key in Worker secret.

---

## 6. Recovery-account policy

The account creator becomes the recovery account. Be explicit:

- **Lane A (Ausbitbank-signed):** `@ausbitbank` is the recovery account. Publish a
  short policy: what recovery means, what is required from the user, expected
  turnaround, and what is not recoverable. Recovery is a trust relationship; the
  user can change it later with their owner key (30-day delay).
- **Lane B (dedicated account):** `banksia.onboard` is the recovery account. The
  owner key is offline; the operator can help recover. Disclose that Banksia, not
  Ausbitbank personally, is the recovery party.
- **Lane C (providers):** recovery is the provider's policy; link to their terms.
- **Friend-sponsored claim links:** the friend becomes the recovery account.
  Warn the new user and suggest changing it to a trusted party after 30 days.

Do not advertise recovery you cannot operationally provide.

---

## 7. Phased delivery

### Phase 0 — safety and cleanup (1–2 days)

- Remove `hiveonboard.com` links from `src/pages/create.vue` and
  `src/layouts/MainLayout.vue`.
- Rewrite `/create` copy into two modes: “I have an account / create for
  someone” and “I'm new / create keys”.
- Add `/join` with four verified providers and live Hivedex price.
- Add provider metadata (`status`, `lastVerified`, `cost`, `verification`,
  `integration`).
- Add `/join` to routing, prerender, sitemap and any static route lists.

### Phase 1 — native claim link (3–5 days)

- Keygen + backup UI for users without an account.
- Claim payload encode/decode (public keys only, URL fragment, nonce,
  fingerprint).
- Waiting page with `getAccounts` polling and key matching.
- Sponsor claim page with Keychain/HiveAuth/SmartLock signing, token/HIVE choice,
  and clear recovery warning.
- SmartLock import after creation.
- Static batch page for Ausbitbank: paste/import claim links, pre-check, sign one
  batch in Keychain.

### Phase 2 — Hivedex paid embed (implemented)

- Reuse keygen/backup UI.
- `GET /price` cache + live display.
- `POST /invoice` with public keys + `returnUrl` + `referrer`.
- Open pay link; poll `/status/{trackId}`; confirm on-chain; show keys/import.
- Error states: expired, paid-but-not-created, provider down.

### Phase 3 — RC/HP delegation and polish (2–3 days)

- Optional `delegate_rc` (posting custom_json `rc`) so the new account can
  transact.
- Optional `delegate_vesting_shares` for a small HP delegation.
- Fee/affordability display; token claim shortcut; success notifications.
- Tests: payload encode/decode, key validation, fee math, status reducer, batch
  pre-check.

### Phase 4 — decide on Worker queue (1–2 weeks, only if volume justifies)

- Keyless request queue + admin batch page + status page + payment references.
- Turnstile, rate limits, audit log.
- Provider status/price cache, funnel analytics.

### Phase 5 — optional experiments

- Dedicated instant onboarding account (Lane B).
- Butter Auth Google/GitHub/Discord signup.
- v4vapp Lightning (custody/CORS decision).
- HiveInvite event cards / partnership.
- Passkey SmartLock unlock.

---

## 8. Security checklist

### Keys

- Generate keys only in the browser; never log them.
- Claim links contain public keys only; use the URL fragment.
- Never store a password/private key in a Worker, database, analytics event or
  localStorage.
- SmartLock/Keychain import only posting/active/memo; owner key stays offline.
- Do not add Banksia/Ausbitbank as a posting authority by default.
- Verify on-chain keys match the claim payload before showing success.

### Ausbitbank's active authority

- No stored active key for `@ausbitbank` anywhere.
- Batch signing happens in Keychain/HiveAuth, approved by a human.
- Pre-check every op; keep batches small; test on testnet.
- If a batch partially fails, remove the offending request and retry; Hive
  transactions are atomic.

### Worker (if added)

- Stores only public claim data and status.
- Admin endpoints behind Cloudflare Access or a strong secret; no public admin.
- Turnstile + per-IP/per-username rate limits + expiry.
- No signing keys in the Worker (Lane A). Lane B is a separate, explicit
  custodial decision.
- Audit log for request creation, batch signing and status changes.

### Payments

- Dedicated payment account, not Ausbitbank's personal/witness account.
- Verify transfers by memo/amount before creating.
- Refund policy and support path; handle “username taken after payment”.
- Do not custody user funds longer than necessary.

### Recovery/support

- Publish the recovery policy and limitations.
- Train/support the person who handles recovery requests.
- Keep owner keys offline and backed up.

---

## 9. What this buys us

- **New users:** Ecency (free), Hivedex (paid), community claim queue, HiveDapps,
  and later OAuth — clear, user-choice-driven.
- **Existing users:** generate a claim link and gift an account without ever
  handling the recipient's private keys.
- **Ausbitbank:** can use existing tokens for a capped free pool without putting
  active authority in automation; batch signing is a deliberate human action.
- **Monetization:** route to Hivedex (no custody) or sell accounts via a
  human-signed queue / isolated dedicated account.
- **Static-first:** the core flow needs no backend; a keyless Worker is an
  optional convenience, not a requirement.

---

## 10. Decisions still needed

1. **Free-pool policy:** open request queue, invite-only, or community-nominated?
   What cap per week, and who reviews?
2. **Recovery:** is Ausbitbank personally the recovery account for Lane A, and
   what is the published policy/SLA?
3. **Batch size:** start with 5, 10, or 20 ops per transaction? (Test on testnet.)
4. **Worker:** launch static and add later, or build the keyless queue in Phase 1?
5. **Monetization:** route to Hivedex only, human-signed paid queue, or dedicated
   instant account? What price/refund policy?
6. **OAuth:** is Butter Auth (Google/GitHub/Discord/email) wanted soon, or after
   the native flow proves demand? X is a separate custom integration.
7. **Dedicated accounts:** names for `banksia.pay` / `banksia.onboard`, owner-key
   custody, and who can operate them.

---

## 11. Recommended first commit

1. Remove the `hiveonboard.com` links.
2. Add `/join` with the four verified providers and a “create keys / share link”
   entry point.
3. Add claim-link generation and a static claim page (no signing yet), so the
   gifting flow can be tested end-to-end with a fake/mocked broadcast.
4. Then add the sponsor signing path and the static batch page.

That delivers both priorities — new-user entry points and existing-user gifting —
without a backend, without custody, and without any automation touching
`@ausbitbank`'s active authority.
