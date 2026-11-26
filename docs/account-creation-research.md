# Hive account creation & signup — provider research and integration plan

**Status:** research snapshot; static implementation tracked in
`docs/workstreams/W82-account-creation.md`  
**Verified:** 2026-11-26  
**Scope:** how Hive accounts are created, which services currently work, how they work,
and how Banksia should integrate them or replace them with a native flow.

**Refined implementation plan (operator constraints applied):**
see [`account-creation-plan.md`](./account-creation-plan.md). The key constraint is
that account tokens are non-transferable and require the owner's active signature,
so `@ausbitbank`'s existing tokens will only be used through human-approved batch
signing, never through stored/automated active authority.

---

## 1. Executive summary

- **The current `/create` page is an existing-user gift tool, not a signup flow.**
  It lets a logged-in Hive user generate a new account's keys, then broadcast
  `create_claimed_account` or `account_create`. A brand-new visitor has no path
  through it.
- **Our `hiveonboard.com` links are now dangerous.** `hiveonboard.com` no longer
  serves the Hive onboarding app; it redirects to an unrelated gambling site
  (`dragonballatino.com`). The Hive account `@hiveonboard` last posted in 2022 and
  the public repo is archived. These links must be removed from
  `src/pages/create.vue` and `src/layouts/MainLayout.vue` immediately.
- **`signup.hive.io` is actively curated and currently lists four working
  providers:** Ecency (free), Hivedex ($0.49, anonymous, API), HiveDapps
  (free/delayed, community sponsor), Actifit ($2 in HIVE). The provider list was
  last pushed to its repo on 2026-11-26; its source comments document why older
  providers were removed.
- **The best native replacement is a zero-custody “claim link” flow** that
  reproduces what HiveDapps already does: the new user generates keys locally,
  keeps the private keys, and shares a link containing only the username and
  public keys. An existing user opens the link, signs in with Keychain/HiveAuth/
  SmartLock, and creates the account with an account token or 3 HIVE. No backend,
  no key custody, and no private key ever leaves the new user's browser.
- **The best paid integration is Hivedex.** It has a small public API, generates
  keys client-side, accepts only public keys, supports crypto payments and
  `returnUrl`, and has open CORS. Current price is **$0.49** (dynamic via API).
- **v4vapp Lightning and Butter Auth are promising but should wait.** v4vapp's
  flow involves a master password at v4vapp (custody/trust ask) and its CORS
  allowlist does not yet include `banksia.io`. Butter Auth is an OAuth onboarding
  layer that grants a service account posting authority and needs a backend;
  it is a significant architecture/trust shift.
- **Do not integrate** HiveOnboard, InLeo, DBuzz, BeeAnon, HiveWallet, Discover
  Hive, or legacy BlockTrades for this flow. See §4.3 for the evidence/reasons.

Recommended sequence:

1. **P0:** remove dead/unsafe links; replace `/create` copy and add a curated
   `/join` page with the four verified providers.
2. **P1:** build the native claim-link gift flow; add SmartLock import and
   success polling.
3. **P1:** embed Hivedex as the paid instant option.
4. **P2:** add RC/HP delegation, a voucher pool for free invites (only if
   needed), or a HiveInvite partnership for events.
5. **P3:** evaluate v4vapp Lightning and Butter Auth behind explicit product
   decisions.

---

## 2. What exists in Banksia today

### 2.1 `/create` (`src/pages/create.vue`)

Current flow:

1. Enter a username, check availability with `getAccounts`.
2. Generate a master password and owner/active/posting/memo keys locally
   (`createPassword`, `generateKeys`).
3. Download/copy the keys and confirm they are saved.
4. If the logged-in user has `pending_claimed_accounts > 0`, broadcast
   `create_claimed_account`; otherwise, if they have enough liquid HIVE,
   broadcast `account_create` with the current chain fee.
5. Import active/posting/memo keys to Hive Keychain (owner key is not imported).

Strengths: client-side key generation, public chain fee lookup, queue-based
signing through the existing login methods.

Gaps:

- No new-user path: a visitor without an account cannot use it.
- No way to hand the account to the new user without also handing over a file
  containing the master password and private keys.
- No SmartLock import after creation; only Keychain.
- No “claim an account token” action on the page (it lives separately in
  `src/components/rc.vue`).
- No RC or HP delegation, so a new account may be usable but has no stake/HP.
- No success polling or confirmation after the queued broadcast.
- Dead/unsafe external link to `hiveonboard.com`.
- Copy assumes the reader already has an account (“New accounts can be created
  by any user on the Hive network”) and points new users to a dead service.

### 2.2 Supporting pieces

- `src/components/rc.vue`: shows RC and a “Claim account token” button that
  broadcasts `claim_account`.
- `src/components/userLogin.vue`: Keychain, HiveAuth and SmartLock login.
- `src/components/smartlock/index.js`: imports posting/active/memo keys after
  validating them against the on-chain account. Owner key is not stored.
- `src/pages/create.vue` and `src/layouts/MainLayout.vue`: both link to
  `hiveonboard.com` (unsafe).
- `src/pages/create.vue` is in the static route/prerender/sitemap lists; any new
  `/join` route must be added there too.

---

## 3. How Hive account creation actually works

Hive has no self-service “register” endpoint. An account must be created by an
existing account with active authority, using one of two mechanisms.

### 3.1 `account_create` (pay the chain fee)

- Requires **active** authority from `creator`.
- Fee must equal the witness median `account_creation_fee` exactly after HF20.
  Current value: **3.000 HIVE**.
- The fee is transferred to `HIVE_NULL_ACCOUNT`, i.e. **burned**. The creator
  does not receive it.
- The new account receives an RC adjustment worth the fee
  (`fee * vesting_share_price`), so it starts with roughly “3 HIVE worth” of RC.
- The creator becomes the new account's **recovery account**.
- Keys are supplied by the creator; they can be generated in the browser.

### 3.2 `claim_account` + `create_claimed_account` (account tokens)

- `claim_account` requires **active** authority and converts RC into one
  **Account Creation Token** (`pending_claimed_accounts`). It can be broadcast
  with `fee: "0.000 HIVE"` to use the network subsidy, or with the exact fee to
  buy a token without the subsidy. It is rate-limited by RC and the chain's
  account-subsidy pool.
- `create_claimed_account` consumes one token and creates the account with the
  supplied keys. No HIVE fee is paid; the new account still receives the RC
  adjustment based on the chain fee.
- Tokens are **non-transferable** and do not expire. They are valuable: this is
  how free onboarding services fund accounts.

### 3.3 Related operations

| Operation | Authority | Purpose |
| --- | --- | --- |
| `account_create` | active | Create account, burn 3 HIVE fee |
| `create_claimed_account` | active | Create account from an account token |
| `claim_account` | active | Convert RC into an account token |
| `account_create_with_delegation` | active | Create account and delegate HP in one op; still in the protocol |
| `delegate_rc` (custom_json id `rc`) | posting | Delegate RC so a new account can transact; payload is `["delegate_rc", {from, delegatees, max_rc}]` |
| `delegate_vesting_shares` | active | Delegate HP for stake/visibility |
| `change_recovery_account` | owner | Change recovery account; takes effect after `HIVE_OWNER_AUTH_RECOVERY_PERIOD` (30 days) |

### 3.4 Operational facts

- **The creator is the recovery account.** If Banksia sponsors accounts, Banksia
  can later help recover them (and is a trusted party). Disclose this to both
  sponsor and new user. New users can change it after the 30-day delay.
- **No password reset.** The master password is the seed; losing it means losing
  the account. Owner key should be kept offline; SmartLock/Keychain should hold
  posting/active/memo only.
- **RC is the throughput limit.** The operator account already holds a few
  thousand account tokens, but the RC cost of claiming/creating and the chain
  subsidy cap how fast a free pool can run. Measure before promising volume.
  The official Butter Auth docs quote a practical provider cap of roughly
  **25 free accounts/day**; treat that as a planning number, not a chain
  constant.
- **Account names are permanent** and cannot be reserved without creating the
  account. Availability must be re-checked at claim time.

---

## 4. Provider landscape (verified 2026-11-26)

### 4.1 Working providers currently listed by `signup.hive.io`

| Provider | Cost | Speed | Verification | Key handling | Integration surface | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **Ecency** | Free; optional $2.99 in-app | Instant | Email + reCAPTCHA; crypto-wallet signup also offered | Server-assisted: client sends username/email/referral only; key handoff happens through Ecency's flow | Deep link `https://ecency.com/signup?referral=ausbitbank`; private API requires a captcha token, so not directly embeddable | **Deep link now** |
| **Hivedex.io** | **$0.49** (dynamic) | Instant | None (anonymous) | Client-side keygen; only the four public keys are sent | Public API: `GET /price`, `POST /invoice`, `GET /status/{trackId}`; CORS `*` | **Best paid embed** |
| **HiveDapps** | Free | Delayed | Requires a community member/sponsor with account tokens | Client-side keygen; share link contains username + public keys only | No documented API; web flow at `https://hivedapps.com` | **UX reference / link** |
| **Actifit** | $2 in HIVE | Instant | None | Client-side keygen; posts public keys to `api2.actifit.io/app/signupQuote` / `signupWithKeys`; captcha | Deep link `https://actifit.io/signup`; API is undocumented and app-specific | **Optional niche link** |

#### Ecency — details

- Free signup requires email and Google reCAPTCHA (the official directory notes
  “extra checks for free account”).
- `POST https://ecency.com/private-api/account-create` with
  `{username,email,referral}` returned `{"code":113,"message":"Please complete
  the verification and try again."}` without a captcha token. So the free flow
  cannot be embedded without solving Ecency's captcha/verification.
- The client also offers a **$2.99** purchase flow (`/purchase?...&type=account`)
  that opens as a QR/URL and includes perks.
- Ecency's own “onboard a friend” flow (open source) creates accounts with HIVE
  or an account token, optionally delegates RC, and adds `ecency.app` as a
  posting authority on the new account. **We should not copy the posting
  authority part by default.**
- Referral parameter: `?referral=ausbitbank`. Treat it as attribution; do not
  promise payouts without confirming Ecency's current terms.

#### Hivedex — details (best paid integration)

- `GET https://api2.hivedex.io/price` returns `{price, assets:[{currency,
  networks, amount}]}`. On 2026-11-26 it returned **$0.49** and 20+ assets
  (ETH, USDT, USDC, BNB, DOGE, POL, LTC, SOL, TRX, SHIB, GRAM, XMR, DAI, BCH,
  NOT, DOGS, XRP, …).
- `POST /invoice` body (verified against the Hivedex frontend and PeakD's
  integration):

  ```json
  {
    "username": "alice",
    "owner": "STM...",
    "active": "STM...",
    "posting": "STM...",
    "memo": "STM...",
    "referrer": "ausbitbank",
    "returnUrl": "https://banksia.io/create?paid=1"
  }
  ```

  Returns `{payLink, trackId, orderId}`. `payLink` is an OxaPay checkout URL.
- `GET /status/{trackId}` returns one of `new`, `waiting`, `paying`, `paid`,
  `expired`. Poll it (the Hivedex frontend polls every 5 seconds).
- **Security win:** keys are generated in the browser; only public keys are
  sent. The provider cannot take the account or see the password. The invoice
  page is third-party; open it in a new tab with `noopener noreferrer`.
- `referrer` is optional; PeakD passes its own name. Hivedex's own web signup
  does not pass it.
- CORS is open (`access-control-allow-origin: *`), so this can be embedded
  without a backend.
- Confirm the account on-chain after `paid`; do not trust the status alone.

#### HiveDapps — details (the UX model to copy)

- The live site is a client-rendered Next.js app. `GET /` returns HTTP 404 with
  a Next.js shell, but a real browser renders the signup UI. It works for users
  even though the status code is odd for bots/previews.
- Flow:
  1. New user chooses a name; the app generates a password and keys locally.
  2. The app shows “Download Backup” and asks the user to confirm they saved it.
  3. **“Share Link to Create Account”** produces a link such as
     `https://hivedapps.com?join=<payload>`. The modal states: “It only contains
     your username and public keys — your password and private keys remain
     secure.”
  4. The sponsor opens the link, signs in with a Hive account that has creation
     tokens, reviews the username and public keys, and creates the account.
- This is exactly the flow Banksia should own: **the new user keeps the keys;
  the sponsor only needs public keys and an account token/fee.**
- The site is free/delayed and depends on a community sponsor; it is not an
  instant paid service.

#### Actifit — details

- Price: $2 paid in HIVE.
- Client-side key generation; the page shows the private keys/backup and posts
  public keys to `https://api2.actifit.io/app/signupQuote` and
  `.../signupWithKeys`. It uses a captcha, promo codes and a referrer field.
- Signup can be paused server-side (`signupAvailable` / `swk_paused`), so check
  before linking.
- It is app-specific (Actifit/AFIT rewards) and requires the user to already
  have HIVE, which a brand-new user usually does not. Keep it as an optional
  niche link, not a primary option.

### 4.2 Adjacent and newer options

| Service | What it is | How it works | Why it matters / verdict |
| --- | --- | --- | --- |
| **Butter Auth** (`butrauth.com`) | OAuth 2.0 identity gate for Hive | Google/GitHub/Discord/email → link an existing Hive account or create one. Authorization Code + PKCE, RS256 JWT (1 hour), refresh tokens. New accounts grant the integrator's Hive **service account posting authority**; the integrator broadcasts with its own posting key. Default is **warm-up** (handle, no Hive account) until funded/graduated; instant creation needs an account provider funded with tokens (~25/day cap). Requires a backend for the client secret/token exchange. | Strong mainstream UX and 3Speak already uses it, but it is a major trust/architecture shift (service-account posting authority, warm-up identities, backend). **Evaluate later; not part of the first replacement.** |
| **v4vapp** (`api.v4v.app`) | Lightning ↔ Hive bridge | `GET /v2/v4vapp/account/cost` → current cost; `POST /account/create` with `{accountName, clientId}` → Lightning invoice; pay; `POST /create_complete` with payment hash + master password → account. OpenAPI accepts an optional `masterPassword`; either way v4vapp handles master-password/key material. API 6.6.1; on 2026-11-26 cost was 12 HIVE / ~712 sats / $0.43 with 2 HIVE back. CORS allowlist includes `hive.ausbit.dev`, **not `banksia.io`**. | Great for sats-native users, but the custody/trust ask and CORS dependency make it a **later option**. Do not make it the default. |
| **HiveInvite** (`hiveinvite.com`) | Invite cards / sponsor onboarding | Onboarder applies, generates printable/digital cards with QR + PIN, distributes by hand or Telegram; recipients claim an account; HP delegation on claim; PIN-encrypted backup/restore. Public repo is GPL-3.0 and appears older than the live product (live site advertises gift cards, PINs, Telegram, HP delegation). | Excellent for conferences/communities; **partner or fork** rather than build cards from scratch. Not a general instant provider. |
| **Official microservice** (`openhive-network/hive-account-creator`, `join.hive.io`) | Token-gated account creation microservice | Pre-generates one-time tokens; user redeems a token + username; server generates keys and broadcasts `create_claimed_account` with the operator's active key; SQLite token DB; static UI. Apache-2.0. `join.hive.io` did not complete a TLS handshake from this network on 2026-11-26. | Useful **reference** for voucher issuance, but it generates keys server-side and holds a hot active key. Our native claim link is better for self-custody. |
| **PeakD** (`peakd.com/register`) | Account-creation aggregator | Offers Hivedex, HiveDapps, Splinterlands and delayed creation; stores a `REFERRER` cookie; `?ref=ausbitbank`. Referrer gets a small percentage of post rewards (per PeakD UI). No native creation API. | Good fallback/benchmark, but it is a competing front-end. Link only under “more options” if at all. |
| **Splinterlands** (`splinterlands.com/register?ref=…`) | Game onboarding | Creates a Hive account plus a Splinterlands account ($10 spellbook); app-specific. | Optional game/referral partner, not a general signup option. |
| **3Speak** (`3speak.tv/signup`) | Video app onboarding | Its signup button starts Butter Auth (`/api/manteauth/start` → `butrauth.com/authorize?...&screen_hint=signup`). | Evidence that Butter Auth is in production; not a portal for Banksia. |

### 4.3 Removed, dead, or unsafe providers

The `signup.hive.io` source comments are explicit about several removals. This is
useful institutional memory; we should not re-add these without verification.

| Provider | Current state | Evidence / reason |
| --- | --- | --- |
| **HiveOnboard** | **Dead / unsafe** | `hiveonboard.com` redirects to an unrelated gambling site (`dragonballatino.com`). `@hiveonboard` last posted 2022-10-24; public repo archived 2024. The official directory comment says “Seems to be abandoned”. **Remove our links.** |
| **InLeo** | Removed from directory; do not use | Directory source comment: “signup system might be or reported compromised (Oct 2026) — re-enable once confirmed secure.” |
| **DBuzz** | Removed; dead | Directory comment: “multiple days and we can't get someone to do account recovery”. `join.d.buzz` DNS does not resolve. |
| **BeeAnon** | Down | Directory comment: “beeanon is down for now”. `beeanon.com` redirects to `privex.io`; HTTPS cert does not match. |
| **HiveWallet** | Shut down | Directory comment: “Hivewallet has been officially shut down”. Site is still up but not a supported signup path. |
| **Discover Hive** | Dead / parked | `discoverhive.com` redirects to a HugeDomains parked page (403). |
| **BlockTrades** | Legacy/KYC; not recommended | Commented out of the current directory; requires email + KYC; TLS handshake failed from this network on 2026-11-26, so the flow was not verified. |
| **`join.hive.io`** | Unreachable from here | DNS resolves to 65.108.68.110; TLS handshake fails (`unexpected eof`). The microservice repo is active, but do not depend on the hosted site today. |
| **Infestor / AccountCreate demos** | Reference only | Old self-host tools/demos; several sites now have TLS/cert failures. Useful as code references for `claim_account` batching, not as user-facing providers. |

Also note: **Hive Keychain, HiveAuth, SmartLock, PeakVault, HiveSigner and Aioha
are authentication/signing tools, not account creation portals.** They cannot
create the first account for someone who does not have one.

---

## 5. Integration options

### Option A — Curated provider page + deep links (do now)

Replace the dead links with a `/join` page that lists verified providers and
sends users to them with referral parameters.

- **Effort:** 1–2 days.
- **Backend:** none.
- **Custody:** none (user completes signup on the provider).
- **Providers:** Ecency (free), Hivedex (paid, with live price), HiveDapps
  (free/delayed), Actifit (niche, $2 HIVE), plus a “more options” link to
  `signup.hive.io`.
- **Pros:** immediate, low risk, removes the unsafe link, gives new users a path.
- **Cons:** the user leaves Banksia; we do not control the UX; provider links
  can rot (HiveOnboard is the cautionary tale). Add `lastVerified` metadata and
  a small status check.

### Option B — Native claim link (recommended flagship)

Reuse the existing key generation and queue machinery, but change *who* holds
the keys and *when* the account is created.

**New-user side (no account, no login):**

1. Choose a username; check availability on-chain.
2. Generate password + owner/active/posting/memo keys locally.
3. Show/download the backup; require “I saved these keys”.
4. Encode a claim payload with **public keys only**:

   ```json
   {
     "v": 1,
     "u": "alice",
     "o": "STM...",
     "a": "STM...",
     "p": "STM...",
     "m": "STM...",
     "n": "<random nonce>",
     "t": 1795690000
   }
   ```

   Put it in the URL **fragment** (`https://banksia.io/create#claim=...`), not
   the query string, so it is not sent to servers or logged. Show a short key
   fingerprint so both sides can verify the same keys.
5. Copy the link/QR and send it to a sponsor.
6. Keep a “waiting for the account” screen that polls `getAccounts(username)`.
   When the account appears, check that the on-chain keys match the payload,
   then offer “Import to SmartLock” (posting/active/memo) and “Add to Keychain”.

**Sponsor side (existing user):**

1. Open the claim link; decode and validate the payload; re-check the username.
2. Show the public keys and the warning: “You will spend one account token or
   3 HIVE. You become the recovery account. The new user controls the private
   keys.”
3. Sign in with the existing Keychain/HiveAuth/SmartLock login.
4. Choose “Create with account token” (if `pending_claimed_accounts > 0`) or
   “Create for 3 HIVE” (if liquid HIVE is sufficient). Optionally bundle
   `delegate_rc` (posting) and/or `delegate_vesting_shares` (active).
5. Broadcast, poll until the account exists, and show a success link.

- **Effort:** 3–5 days.
- **Backend:** none.
- **Custody:** none. Private keys never leave the new user's browser; the link
  contains public keys only.
- **Pros:** safe, self-sovereign, no operating cost beyond the sponsor's
  token/fee, works asynchronously, and directly replaces the old “creator holds
  the key file” handoff.
- **Cons:** needs a sponsor; username squatting race; the sponsor becomes the
  recovery account; the new user must keep the backup.
- **Mitigations:** unguessable nonce, URL fragment, key fingerprint, re-check
  availability, warn about recovery, offer a “change recovery account” helper
  later.

### Option C — Embed Hivedex paid flow (recommended paid option)

- **Effort:** 3–5 days.
- **Backend:** none.
- **Custody:** none (public keys only).
- **Flow:** reuse the same key-generation UI; `POST /invoice` with username +
  public keys + `referrer: "ausbitbank"` + `returnUrl`; open `payLink`; poll
  `/status/{trackId}`; on `paid`, verify the account on-chain, then show the
  keys/backup and SmartLock import.
- **Pros:** instant, anonymous, accepts external crypto, cheap ($0.49), no hot
  wallet or accounting on our side, CORS open.
- **Cons:** third-party dependency; payment page leaves the site; support/refund
  path is Hivedex's; price/status can change. Cache `/price` briefly and show a
  clear “provided by Hivedex” label.
- **Do not** ask Hivedex to hold private keys; the API only needs public keys.

### Option D — Own voucher pool (free invites at scale)

A small backend that issues one-time voucher codes and creates accounts from
public keys.

- **Effort:** 1–3 weeks.
- **Backend:** yes (Cloudflare Worker + D1/KV or a small VPS service).
- **Custody:** the operator holds a dedicated onboarding account's active key
  (never a personal/main account) and spends account tokens.
- **Flow:** existing user requests/generates a voucher (or operator issues a
  batch); new user redeems it with a chosen username + public keys; the service
  broadcasts `create_claimed_account`; optionally delegates RC/HP; rate limits,
  expiry, one-time redemption, audit log, Turnstile.
- **Pros:** truly free/instant for the user; controllable branding; can be
  seeded with the operator's existing account tokens.
- **Cons:** hot-key custody; abuse/support; recovery-account responsibility; RC
  throughput limits; operational monitoring. Only build if free-account demand
  justifies it.
- **Alternative:** partner with HiveInvite for physical/PIN cards instead of
  building the issuance/fulfilment layer.

### Option E — v4vapp Lightning (later)

- **Effort:** 3–5 days + operator coordination.
- **Backend:** none for the API, but v4vapp must add `banksia.io` to its CORS
  allowlist (currently only `hive.ausbit.dev` works).
- **Custody/trust:** v4vapp handles the master password/key material; either we
  send a password to it or it generates and returns one. This conflicts with our
  “no private key to a server” model. Disclose clearly or ask v4vapp for a
  public-keys-only variant.
- **Use case:** Lightning-native users with no HIVE. Current cost ~712 sats
  (about $0.43), with a small HIVE/sats back amount.
- **Verdict:** good differentiator, but not the default; keep behind an
  “experimental” flag until the custody story is acceptable.

### Option F — Butter Auth OAuth (later, experimental)

- **Effort:** 2–4 weeks (backend, service account, OAuth/session handling).
- **Backend:** required (client secret + token exchange + refresh tokens).
- **Custody/trust:** new accounts grant the integrator's Hive service account
  posting authority; the integrator broadcasts with its own posting key. Users
  can revoke on-chain. Funds are untouched.
- **UX:** “Sign up with Google/GitHub/Discord/email” is the lowest-friction path
  for mainstream users. But default **warm-up** users have a handle and no Hive
  account, so the app must handle `username: null, incubation: true`.
- **Funding:** instant accounts need an account provider funded with tokens;
  ~25/day practical cap; our operator could run a provider, but then we are back
  to spending tokens and being the recovery account.
- **Verdict:** strong later experiment, not part of the initial replacement. If
  we do it, use a dedicated service account with minimal HP and an operation
  allowlist, and do not add posting authority to accounts we do not need to act
  for.

---

## 6. Recommendation

### 6.1 Do now (P0)

1. **Remove the `hiveonboard.com` links** from `src/pages/create.vue` and
   `src/layouts/MainLayout.vue`. Replace with `/create` / `/join` or the curated
   `signup.hive.io` link.
2. **Rewrite the `/create` intro** to distinguish:
   - “I already have a Hive account → create an account for someone.”
   - “I'm new → create keys and share a claim link, or use a verified provider.”
3. **Add a `/join` page** with the four verified providers:
   - Ecency — free, email/verification.
   - Hivedex — from $0.49, instant/anonymous (live price from API).
   - HiveDapps — free, delayed, needs a community sponsor.
   - Actifit — $2 in HIVE, fitness niche.
   - “More options” → `https://signup.hive.io` with a “verify before use” note.
4. **Add provider metadata** (`status`, `lastVerified`, `cost`, `verification`,
   `integration`) so stale links are visible and testable.

### 6.2 Do next (P1)

5. **Build the native claim-link flow** (Option B). This is the main
   replacement for the old `/create` handoff and the best fit for Banksia's
   self-custody model.
6. **Add SmartLock import** after account creation (posting/active/memo), and a
   success poll that verifies the on-chain keys match the claim payload.
7. **Add “Claim account token”** directly on `/create` when the logged-in user
   has RC but no tokens, and show the token/HIVE affordability clearly.
8. **Add optional RC/HP delegation**:
   - `delegate_rc` via custom_json id `rc` (posting authority) so the new
     account can transact.
   - `delegate_vesting_shares` (active) for a small HP delegation if desired.
   - Display the cost/benefit; do not delegate by default without consent.
9. **Embed Hivedex** (Option C) as the paid instant option. Reuse the same
   keygen/backup UI; only public keys leave the browser.

### 6.3 Do later (P2/P3)

10. **Voucher pool** (Option D) only if free-account demand is real; seed with
    the operator's existing account tokens and cap/rate-limit aggressively. Or
    partner with **HiveInvite** for events.
11. **v4vapp Lightning** (Option E) after the custody/CORS questions are
    resolved; keep it experimental.
12. **Butter Auth OAuth** (Option F) only after a product/security decision
    about service-account posting authority and warm-up identities.

### 6.4 Do not

- Do not link to HiveOnboard, InLeo, DBuzz, BeeAnon, HiveWallet, Discover Hive,
  or BlockTrades for this flow.
- Do not send private keys or master passwords to any third party in a Banksia
  flow.
- Do not add Banksia as a posting authority on new accounts by default.
- Do not run a public free faucet without rate limits, abuse controls, support
  capacity and a recovery policy.
- Do not trust a provider's “paid” status without confirming the account and
  keys on-chain.

---

## 7. Proposed UX

### 7.1 `/join` (new visitor)

```
Join Hive
  [I'm new]
    Free — Ecency             email + verification      Open
    Free with a sponsor —     create keys, share link    Continue
    Pay with crypto — Hivedex from $0.49, instant        Open
    Pay with HIVE — Actifit   $2, fitness app            Open
    More providers            signup.hive.io             Compare
  [I already have a Hive account]
    Create an account for someone  → /create
```

Recommended badges: **Hivedex** for “instant, anonymous, paid” and **Ecency**
for “free, verified”. Explain that free options require verification and paid
options are instant/anonymous. Keep the price live.

### 7.2 New user with a sponsor (native claim link)

```
/join → Create keys
  username → keys generated locally → download backup → I saved them
  share claim link / QR
  waiting for @alice…  (poll)
  account created → verify keys → Import to SmartLock / Add to Keychain
```

### 7.3 Existing user creating for someone

```
/create
  [Create now]  choose username → generate keys → create with token or HIVE
  [Share link]  choose username → generate keys → copy claim link
  optional: delegate RC / HP
  success: link to profile, reminder to hand over the key backup securely
```

### 7.4 Sponsor opening a claim link

```
/create#claim=...
  @alice wants an account
  public keys + fingerprint
  warning: you pay 1 token or 3 HIVE; you become the recovery account
  sign in → Create with token / Create for 3 HIVE
  success → tell @alice to check their page
```

### 7.5 Copy rules

- “Hive has no password reset. Save your keys; nobody can recover them for you.”
- “Banksia never sees your private keys. The claim link contains only your
  public keys.”
- “Creating an account burns 3 HIVE or uses one account token; the sponsor
  pays.”
- “The account creator becomes the recovery account. You can change it later.”
- “Your Hive username is permanent.”

---

## 8. Security and operations checklist

### Key handling

- Generate keys only in the browser (`crypto.getRandomValues`); never log them.
- Put claim payloads in the URL **fragment**, not query strings.
- Validate public keys and account name before displaying/submitting.
- Show a short key fingerprint so the new user and sponsor can compare.
- Verify the on-chain `owner`/`active`/`posting`/`memo` keys match the claim
  payload before declaring success.
- SmartLock/Keychain import: posting/active/memo only; owner stays offline.
- No Banksia posting authority on new accounts by default.
- Disclose the recovery-account relationship; offer a “change recovery account”
  helper later.

### Payments and providers

- Cache Hivedex `/price` for a few minutes; never hardcode $0.49.
- Open payment links in a new tab with `rel="noopener noreferrer"`.
- Poll status with a bounded interval; handle `expired`, `paid` but no account,
  and provider downtime.
- On-chain confirmation is the source of truth, not the provider.
- Route refunds/support to the provider; state this in the UI.
- Monitor provider links/APIs and record `lastVerified` dates.

### Abuse and support

- Free voucher pool: one-time codes, expiry, per-IP/per-account limits,
  Turnstile/CAPTCHA, manual approval for bulk batches, audit log.
- Paid flows: payment is the rate limit, but still watch for card fraud/refunds
  if a provider accepts cards.
- Recovery policy: decide who answers “I lost my keys” and what the recovery
  account will do. Do not advertise recovery you cannot provide.
- If Banksia sponsors accounts, publish a short policy: what we pay for, what we
  do not, how recovery works, and how to report abuse.

### Platform

- Add `/join` to `src/router/routes.js`, `scripts/lib/prerender-meta.mjs`,
  `public/sitemap.xml`, and any static route lists.
- CSP already allows `https:` for `connect-src`; if we add iframes, update
  `frame-src`. Prefer top-level links/new tabs over iframes.
- Use the existing queue/signing path for Keychain/HiveAuth/SmartLock; do not
  introduce a second signing stack.
- Add unit tests for claim payload encode/decode, key validation, fee math,
  status reducers and provider registry; mock Hive API and provider APIs.
- Add E2E coverage for the claim-link flow with mocked broadcasts; never use a
  real payment in CI.

---

## 9. Decision matrix

| Option | Effort | Backend | Custody | Abuse risk | UX | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Curated `/join` + deep links | S (1–2 d) | No | None | Low | Good | **Do now** |
| Native claim link | M (3–5 d) | No | None | Low (sponsor pays) | Excellent for gifting | **Do next** |
| Hivedex embed | M (3–5 d) | No | None (public keys) | Low (paid) | Excellent paid | **Do next** |
| Voucher pool | L (1–3 wk) | Yes | Operator active key | Medium/high | Free/instant | **Later if needed** |
| v4vapp Lightning | M (3–5 d) | No (CORS allowlist) | Third party sees password | Low | Good for sats | **Later / experimental** |
| Butter Auth OAuth | L (2–4 wk) | Yes | Service-account posting authority | Low/medium | Mainstream | **Experimental** |
| HiveInvite partnership | S | Maybe | Sponsor tokens | Low | Great for events | **Optional** |
| Official microservice | M | Yes | Operator active key + server keys | Medium | Token events | **Reference only** |

---

## 10. Open questions

1. **Primary audience:** existing users gifting accounts, new users self-signing
   up, or both? The answer changes the priority between the claim link and the
   provider page.
2. **Free-account budget:** is the operator willing to spend account tokens and
   act as recovery account for a capped free pool? If not, rely on Ecency/
   HiveDapps and paid providers.
3. **Backend appetite:** are we willing to add a small backend (Cloudflare
   Worker/VPS) for vouchers or Butter Auth, or should the site stay static?
4. **Custody stance:** is “no private key to a server” absolute? If yes, skip
   v4vapp and favour Hivedex/native claims.
5. **OAuth:** is “Sign in with Google” a product goal, or is Hive-native
   (Keychain/HiveAuth/SmartLock) the identity model?
6. **Legal/KYC:** do we want to sell accounts directly (payments, refunds,
   accounting) or route all payments to providers?
7. **Partnerships:** are referral arrangements with Ecency/Hivedex/PeakD/
   Splinterlands acceptable, and what disclosure is required?

---

## 11. Sources and verification log

All checks were run on **2026-11-26** from this environment. “Live” means the
page/API responded and the relevant flow was inspected; it is not a guarantee
that the service will remain available.

| Source | What was checked | Result |
| --- | --- | --- |
| `https://signup.hive.io/` | Live provider cards; source repo/comments | Four visible: Ecency, Hivedex, HiveDapps, Actifit. Repo `openhive-network/signup-hive-io` pushed 2026-11-26; comments document removals. |
| `https://github.com/openhive-network/signup-hive-io` | `index.html` comments | InLeo “reported compromised (Oct 2026)”; DBuzz recovery issue; BeeAnon down; HiveOnboard abandoned; HiveWallet shut down; BlockTrades/Discover Hive commented out. |
| `https://hive.io/join/` | Current official join page | Lists Ecency, Hivedex, Actifit. |
| `https://ecency.com/signup?referral=ausbitbank` | Page + open-source client | Live (Cloudflare challenge for this IP). Client posts `{username,email,referral}`; API returned code 113 without verification. |
| `https://hivedex.io/signup` + `https://api2.hivedex.io` | Price, invoice, status, CORS | `price` $0.49; invoice returns `payLink/trackId/orderId`; status `new|waiting|paying|paid|expired`; CORS `*`. |
| `https://hivedapps.com` | Browser render + share link | Live signup UI; keygen locally; share link states “only username and public keys”; sponsor with tokens completes creation. HTTP 404 shell for non-JS clients. |
| `https://actifit.io/signup` + `api2.actifit.io` | Page + client code | $2 in HIVE; client-side keys; `signupQuote`/`signupWithKeys`; captcha; can be paused. |
| `https://butrauth.com/docs`, `/start` | OAuth docs | OAuth2 + PKCE, RS256, Google/GitHub/Discord/email; service-account posting authority; warm-up default; instant needs funded provider (~25/day); backend required. |
| `https://api.v4v.app/v2/v4vapp/account/cost`, `/openapi.json`, `/v1` | API | 6.6.1; 12 HIVE / ~712 sats / $0.43, 2 HIVE back; `create`/`create_complete`; optional masterPassword; CORS does not allow `banksia.io`. |
| `https://hiveinvite.com` + GitHub `pharesim/hiveinvite` | Live product + repo | Gift cards/PIN/Telegram/HP delegation/self-host; GPL-3.0; live site appears newer than repo. |
| `https://github.com/openhive-network/hive-account-creator` | README/server | Token-gated; server-generated keys; operator active key; Apache-2.0; `join.hive.io` TLS failed here. |
| `https://peakd.com/register` | Source bundle | Hivedex/HiveDapps/Splinterlands/delayed; `?ref=`; Hivedex invoice fields. |
| `https://3speak.tv/signup` | Signup API | Starts Butter Auth (`butrauth.com/authorize?...screen_hint=signup`). |
| `https://hiveonboard.com` | Redirect | Now redirects to `dragonballatino.com` (unrelated gambling site). |
| `https://github.com/christianfuerst/hiveonboard` | Repo metadata | Archived 2024; React/Firebase/creator-API design. |
| Chain queries (`api.hive.blog`) | Chain state | `account_creation_fee` 3.000 HIVE; `@hiveonboard` last post 2022; `@ecency`/`@peakd`/`@actifit` token counts; `@ausbitbank` ~2.3k tokens. |
| Hive source (`openhive-network/hive`) | Protocol | Fee burned to null; RC adjustment from fee; recovery account = creator; `delegate_rc` is custom_json id `rc`; `account_create_with_delegation` exists. |
| `https://developers.hive.io/tutorials-recipes/account-creation-process.html` | Docs | `claim_account`/`create_claimed_account` vs `account_create`; 3 HIVE fee. |
| Other checks | Status | `join.d.buzz` DNS fails; `discoverhive.com` parked; `beeanon.com` cert mismatch/redirect; `hivewallet.app` up but officially shut down; `blocktrades.us` TLS failure; `hiveaccounts.emrebeyler.me` TLS failure. |

---

## 12. One-line answer

**Do not replace `/create` with a custodial signup service. Make `/create` a
zero-custody claim-link tool for existing users, add a curated `/join` page for
new users, embed Hivedex for instant paid signup, and keep v4vapp/Butter Auth
as later experiments.** The first commit should be removing the
`hiveonboard.com` links.
