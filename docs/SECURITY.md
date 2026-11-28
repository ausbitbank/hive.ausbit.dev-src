# Security notes

This document is the reference for defensive HTTP headers and for the client-side
key model. Nothing here needs a build step; apply the headers at the reverse
proxy (nginx) and/or at Cloudflare. Replace `banksia.io` if the canonical
domain changes.

## Response headers

The production header policy is applied by the nginx origin. The canonical
virtual-host file lives at `deploy/nginx/banksia.io.conf`; install it as
`/etc/nginx/sites-available/banksia.io` and keep the certbot-managed SSL
lines intact. `always` makes sure the headers are also sent on error responses.

### nginx

```nginx
# Deny framing in both the legacy and CSP forms.
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://s3.tradingview.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' https: blob:; connect-src 'self' https: wss: https://cloudflareinsights.com https://*.tradingview.com; manifest-src 'self'; worker-src 'self' blob:; frame-src https://youtube.com https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be https://player.vimeo.com https://vimeo.com https://3speak.tv https://www.3speak.tv https://play.3speak.tv https://odysee.com https://rumble.com https://www.bitchute.com https://d.tube https://ipfs.io https://gateway.ipfs.io https://open.spotify.com https://w.soundcloud.com https://platform.twitter.com https://player.twitch.tv https://s.tradingview.com https://www.tradingview.com; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests; report-uri /csp-report; report-to csp-endpoint" always;
add_header Report-To '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://banksia.io/csp-report"}]}' always;
add_header Reporting-Endpoints 'csp-endpoint="https://banksia.io/csp-report"' always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

Notes:

- `script-src-attr 'none'` is the load-bearing line: it blocks inline event
  handlers (`onerror=`, `onclick=`) and `javascript:` navigations. `script-src`
  still tolerates inline `<script>` elements because Cloudflare injects a
  per-request bot-detection snippet; the pre-paint theme bootstrap lives in
  `/statics/boot-theme.js`. Once Cloudflare's inline injection is disabled,
  drop `'unsafe-inline'` from `script-src` to make the policy fully strict.
- Violations are posted to `/csp-report` on the `banksia-metadata` Worker. It caps
  bodies at 8 KB and logs one compact JSON line per report; read them with
  `npx wrangler@4 tail banksia-metadata`. `Report-To` and `Reporting-Endpoints` are
  both sent for browser coverage, with `report-uri` kept for older Safari.
- The vhost sets `server_tokens off;` and denies dotfiles (except
  `/.well-known`).
- `style-src 'unsafe-inline'` is required by Vue/Quasar inline styles and by the
  animated background.
- `img-src https:` is intentionally broad: avatars and post images come from
  many Hive image hosts (`images.hive.blog`, `files.peakd.com`, Hive-Engine
  token icons, IPFS gateways, ...).
- `connect-src https:` covers the Hive API nodes, Hive-Engine RPC fallbacks and
  price APIs. Narrow it to the specific hosts if they are stable.
- `frame-src` mirrors the embed allowlist in `src/components/render.vue` and
  `src/utils/embedHosts.js`.
- The origin currently sends HSTS with `preload`. Only keep it once every
  `ausbit.dev` subdomain is HTTPS-only; otherwise drop `preload` there first.
- `worker-src 'self' blob:` is required by the production service worker and
  any blob-backed workers; `manifest-src` covers `/manifest.webmanifest`.
- If nginx sits behind Cloudflare, do not duplicate headers that Cloudflare
  already sets; either let nginx own them (Cloudflare "Transform Rules" off) or
  configure them in Cloudflare and skip the nginx `add_header` lines. Duplicate
  headers are ignored by browsers but make debugging harder.

### Cloudflare

- **SSL/TLS → Edge Certificates**: enable Always Use HTTPS, Automatic HTTPS
  Rewrites, and HSTS (max-age 12 months, include subdomains; preload only when
  ready).
- **SSL/TLS → Edge Certificates**: set Minimum TLS Version to 1.2.
- **Rules → Transform Rules → Modify Response Header**: add the same CSP,
  `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` values
  if Cloudflare terminates the connection and nginx headers are not preserved.
- **Caching → Configuration**: keep HTML uncached or with a short TTL so new
  deployments are picked up. Hashed JS/CSS assets can be cached for a long time.
- **Blog hosts**: add a proxied `*.banksia.io` DNS record. Universal SSL covers
  first-level subdomains at the edge. Blog HTML/assets are proxied to the apex
  `banksia.io` origin, so the origin keeps its existing certificate in strict
  mode; a `*.banksia.io` origin certificate is only needed for direct-origin or
  custom-domain use.

## Blog hosts (`*.banksia.io`)

- First-level subdomains are served by the same build and the same header
  policy. HSTS already uses `includeSubDomains`, so a blog host cannot fall back
  to HTTP.
- The Worker proxies blog HTML and assets to the apex `banksia.io` origin. This
  keeps Cloudflare's strict SSL mode and the existing apex certificate; a
  per-blog origin certificate is not required for the free blog path.
- A blog host is a **read-only** surface. It renders posts and deep-links
  voting, comments and tips to the apex Banksia post. It does not expose the
  signing queue, wallet, SmartLock or HiveAuth UI. This is deliberate: a future
  custom domain is controlled by the blog owner, and users must not sign on an
  origin the site does not control.
- The metadata Worker validates the host label against the Hive account-name
  shape and a reserved service list (`www`, `api`, `files`, `mail`, …).
  `files.banksia.io` keeps its own vhost and is never a blog.
- Blog settings are public on-chain metadata written with the posting key
  through `account_update2`; no server stores them and no key leaves the
  browser.
- The opt-in directory stores only account names in Cloudflare KV. Registration
  and every directory read re-verify the on-chain `claimed && directory` flags.
  Opting out deletes the entry. The directory page also re-verifies before
  rendering, so a stale KV entry cannot reveal a blog that has opted out.
- A generated social card is uploaded through the existing images.hive.blog
  posting-key challenge. Only the returned https URL is stored in blog
  metadata; no image bytes or keys are sent to a Banksia server.
- The blog owner can add custom CSS. It is applied only on the blog origin,
  injected through a `<style>` element's `textContent`, and sanitised to remove
  `@import`, `data:` URLs, `javascript:`, `expression()`, `behavior` and
  `-moz-binding`. There is no custom JavaScript. The blog remains read-only, so
  signing and key handling stay on `banksia.io`. Custom CSS can restyle or hide
  blog UI (including the footer), which is an accepted owner-control trade-off
  covered by the normal abuse-reporting path.
- The `/pay`, `/cart` and `/checkout` surfaces derive the seller, amount and
  purchase memo from a freshly fetched Hive Open Market product post. URL and
  local-storage values only select `author/permlink` and quantity; a crafted
  link or a tampered cart cannot change the price, seller or memo. Checkout
  queues one active-key `transfer` (or `recurrent_transfer` for a subscription)
  per line for explicit wallet review and never auto-broadcasts. The
  open-market MVP has no escrow or buyer protection, and every payment surface
  says so.
- `/orders` reads purchases, sales and active subscriptions from public Hive
  account history. Cancelling a subscription queues the matching
  `recurrent_transfer` with amount 0 for the same `from`/`to`, the plan's
  non-zero `pair_id` extension when one is available, and `executions: 2`; it
  is reviewed in the wallet like any other active-key operation. No order, cart
  or subscription data is copied to a Banksia server, and the blog host still
  never holds keys or broadcasts.
- Product titles, descriptions, tags and seller names are rendered as text.
  Product/Offer JSON-LD uses the honest Hive ticker for `priceCurrency`; HBD is
  not ISO 4217 and is not mislabelled as USD.
- Unclaimed blogs are `noindex` and carry a visible claim notice. Claiming is a
  normal posting-key metadata write, not an authority change.

## Banksia Vault key model

Banksia Vault is the members-only content feature (W89): a creator encrypts a
section or a whole post, and a reader decrypts it in the browser after a
creator-signed grant. The chain stores ciphertext, the sealed keyring and
wrapped ring keys. Banksia operates no decryption service and holds no
plaintext, Hive key or platform balance.

### Key hierarchy

| Key | Type | Lifetime | Storage | Purpose |
| --- | --- | --- | --- | --- |
| Content key `K_kid` | AES-256-GCM, 32 bytes | One `YYYY-MM` period | Inside the passphrase-encrypted creator vault; after sealing, only inside the reader's decrypted keyring | Encrypt post payloads |
| Keyring | JSON `{kid: K_kid}` | Grows with the archive | Creator vault; sealed once per bulletin with `K_ring` | Let a member read current and past posts |
| Ring key `K_ring` | AES-256-GCM, 32 bytes | One period; rotated manually in the beta | Creator vault; wrapped per reader | Seal the keyring blob |
| Reader key | P-256 ECDH | Per device/origin | Reader browser (IndexedDB `CryptoKey`, memory fallback); public half on chain in the payment memo | Receive a wrapped `K_ring` |
| Vault passphrase | User secret | Long-lived | Creator's password manager / memory | Encrypt the creator vault at rest |
| Grant signing key | Hive posting key (secp256k1) | Account lifetime | Existing Keychain/HiveAuth/SmartLock signer | Authenticate bulletins |

Rules:

- None of these keys is derived from a Hive posting, active or memo key. A
  content-key compromise cannot move funds or change account authority; a Hive
  key compromise cannot retroactively decrypt the archive.
- The posting key signs bulletins only. It is never used as an encryption key
  and never leaves the local signer. The creator never needs an active key to
  publish or to receive money.
- Reader keys are separate P-256 keys. They are not Hive account keys and do not
  authenticate anything on chain. A reader may pay from any Hive account.
- Every period has a fresh `K_kid` and `K_ring`. Older keyring entries are kept
  so the archive remains readable.

### Storage and plaintext rules

- **Creator vault at rest:** the only vault use of `localStorage` is the
  encrypted envelope under `banksia_vault_creator_<account>`. It is encrypted
  with PBKDF2-SHA256 (310,000 iterations, 16-byte salt) and AES-256-GCM
  (12-byte IV), with AAD `banksia.vault.store.v1|<account>`. Copying the envelope
  to another account fails closed. The plaintext vault lives in a module-level
  session object only while the creator has unlocked it; a reload or explicit
  lock clears it. The passphrase is not retained.
- **Reader private key:** stored as a `CryptoKey` in IndexedDB
  (`banksia-vault` / `reader-keys`), with a module-level memory fallback when
  IndexedDB is unavailable. It is **generated extractable** so the reader can
  export a passphrase-wrapped recovery file. There is no plaintext key,
  passphrase or private JWK in `localStorage`, `sessionStorage`, the service
  worker, logs or analytics. The recovery file is as sensitive as the private
  key and is protected only by the reader's passphrase (PBKDF2 310k +
  AES-256-GCM).
- **Plaintext content:** decrypted text lives in the Pinia store / component
  memory for the life of the page. It is dropped on `lockPost`, `lockAll`,
  route change and unmount. It is never written to storage, the service worker,
  analytics or logs. The service worker caches only the app shell and static
  assets; chain reads have their own cache and no decrypted response is a
  cacheable request.
- **XSS residual risk:** because the reader key must be exportable, any script
  executing on the Banksia origin can export the private key and decrypt content
  for that reader. A non-extractable key would remove the recovery path for
  anonymous readers, so the beta chooses recovery. This makes the CSP and the
  sanitised-rendering rules part of the Vault threat model. The creator vault,
  by contrast, is never exportable without the passphrase and remains exposed to
  an offline password attack if the encrypted envelope is stolen.
- No new storage keys are introduced for entitlement. `blog.vault` is public
  advertising metadata and never grants access.

### Signing and authority

- Bulletins are signed through the existing `signVaultPayload` bridge using the
  creator's **posting** authority: Keychain `requestSignBuffer` with
  `keyType: "Posting"`, HiveAuth `signChallenge` with `keyType: "posting"`, or
  SmartLock's in-memory posting key. No active key is requested for any Vault
  action, and no Banksia server signs or holds a key.
- Settings, the membership product, the hidden container, premium posts,
  bulletins and the bulletin pointer use `account_update2`/`comment` with the
  posting key. `account_update2` always sends `json_metadata: ""`; Hive would
  escalate the operation to active authority if the legacy field were echoed
  back.
- Every queue item is checked against the chain-required role and the signed-in
  owner before insertion and again before signing. A mismatch fails closed
  instead of prompting for the wrong key. Active-key actions are skipped by
  auto-send, and Send all only resets failed posting actions for retry.
- Subscription, one-time payment and cancellation queue an active-key
  `recurrent_transfer` / `transfer` exactly like a Hive Open Market purchase.
  Active-key actions are never auto-broadcast; the queue requires explicit
  confirmation and the reader reviews the operation in the wallet. Posting-key
  bulletins use the normal queue and can auto-send only when the user has
  enabled auto-send.
- Payments go directly to the creator. There is no escrow, platform balance,
  fee address or refund custody. 0% platform fee at launch.

### Grant verification

Reader-side order is fixed:

1. Parse `json_metadata.banksia_vault`; reject unknown `v`/`alg` and malformed
   ciphertext/`parts`.
2. Load the reader key for this blog and origin. A visitor without a key sees
   the paywall; the unlock path never generates a key.
3. Fetch the newest bulletin (blog pointer first, then replies matching
   `vault-<period>-<seq>`), cached in memory for five minutes.
4. Verify the bulletin signature (canonical JSON, posting key) and recompute the
   `keyringHash` from the received keyring. An inbound `keyringHash` is never
   trusted. The self-signed signer must equal the blog account. The base path
   rejects a delegated bulletin; a caller that opts into delegation accepts one
   only when the creator's posted relay certificate verifies and the delegation
   matches its delegate account, delegate key and certificate hash.
5. Check `blog`, `period`, `rkt` and `expires` **before** any decryption.
6. Find the entry whose `rkt` matches the reader's thumbprint, unwrap `K_ring`
   with P-256 ECDH + HKDF-SHA256 + AES-GCM, open the sealed keyring, select
   `K_kid`.
7. Decrypt the payload (or companions) with AES-256-GCM and the bound AAD;
   verify the SHA-256 plaintext hash.
8. Render only through `Render`/DOMPurify. No raw `v-html` is used for decrypted
   content.

Creator-side grant issuance verifies the payment against the HOM product post
before wrapping: recipient is the blog account, amount and currency match the
product, the memo is a valid Banksia memo, the product reference matches, the
txid has not already been used, and the payment is not future-dated or outside
the one-time window. The dashboard derives one subscriber row per reader key and
payer account from the newest valid payment and skips the creator's own payments.
Reader keys are scoped per blog and Hive account so a second account on the same
browser cannot inherit the first account's grant.

**Signer binding.** `verifyBulletin` requires the self-signed `signer` to equal
`bulletin.blog` and rejects a non-null `delegation` unless delegation is
enabled. The delegated path verifies the creator's relay certificate, the
delegate account and key, the certificate hash and the signature before trusting
the bulletin. The reply fallback only accepts comments authored by the blog
account, so a third party cannot shadow the creator's bulletin with a higher
sequence.

### Content binding

- Content AAD: `banksia.vault.content.v1|blog|permlink|kid|mode`. The AAD and the
  `sha256:<hex>` plaintext hash make a ciphertext unusable on another post,
  period or mode, and detect a wrong key or a tampered/corrupted payload.
- Keyring AAD: `banksia.vault.keyring.v1|blog|period`.
- Ring-key wrap: ECDH between an ephemeral P-256 key and the reader key; HKDF
  salt `epk || readerPublicKey || "banksia.vault.wrap.v1"`; HKDF info and
  AES-GCM AAD are the canonical grant header `{blog, rkt, period, tier,
  expires}`. A wrapped key cannot be moved to another reader, blog, period,
  tier or expiry.
- AES-GCM tag failure and plaintext hash mismatch throw typed errors. No partial
  plaintext is returned or rendered; a multi-part payload either reconstructs
  completely or stays locked.
- Companion parts are encrypted with the same `K_kid` and the same content AAD,
  are namespaced `<post-permlink>-vault-N`, and are fetched as
  `json_metadata.banksia_vault_payload` replies. A missing or malformed part
  keeps the post locked.

### Blog hosts, custom domains and phishing

- Blog hosts (`*.banksia.io`) and custom domains stay read-only. They never
  load the signing queue, wallet or key UI. Blog hosts and custom domains do not
  read or store a reader key: `requiresApex()` makes the paywall deep-link
  premium reads to the apex. The same rule applies to `hive.ausbit.dev`.
- The subscribe flow derives the recipient, amount, currency, recurrence and
  product from a freshly fetched HOM product post. Query parameters select only
  `blog` and `product`, and the product must belong to the blog account. Neither
  `blog.vault.price` nor a URL price is used to build a payment. The review
  screen shows `@account`, the amount, the recurrence and the total.
- A crafted blog/subscribe link cannot redirect the payment to another account:
  the product author is the recipient and must equal the requested blog.

### Revocation and limits

- Revocation is **forward-only**. Rotating `K_ring`/`K_kid` and omitting a
  reader from the next bulletin protects future content. Old ciphertext remains
  decryptable by anyone who already holds the old key; there is no instant
  revocation of past posts and no on-chain delete.
- The beta has no re-encrypt/migrate tool. A serious leak requires a manual
  archive re-encryption (post-MVP).
- Text only. An image/video URL inside a premium payload is hidden until
  decryption but is public once known; the composer warns and the product does
  not promise encrypted media.
- Multi-device has two paths. A signed-in reader can register a new device's
  public key in `posting_json_metadata["banksia.io"].reader.devices`; the creator
  wraps the ring key to every registered key for the active subscription, so no
  private key moves and no second payment is needed. The creator reads active
  subscriber accounts in bulk with `get_accounts`. The fallback is the
  passphrase-wrapped recovery file (the file names its blog; log in as the
  account recorded in the file) or subscribing again so the creator can issue a
  grant for the new device key.
- **Self-sovereign gap:** the creator must be online to issue a grant. A reader
  can pay while the creator is offline and will wait; the subscribe dialog says
  so, the page polls for two minutes, and cancellation is available. The base
  W89 flow has no relay or automatic issuance; the optional W90 relay companion
  in [`integrations/vault-relay.md`](integrations/vault-relay.md) adds
  certificate-gated delegated signing, but it is not required for the base
  paywall.
- Grant issuance and the reader manager page backwards through account history
  in 1,000-row pages up to 10 pages over a rolling window; the payment collector
  caps at the most recent 3,000 rows. Older subscribers are not discovered until
  an index is added.
- Cancellation queues a zero-amount `recurrent_transfer` with the matching
  recipient, recurrence, memo and the plan's non-zero `pair_id` extension when
  one is available. This was verified live on 2026-11-27: the plan was removed
  (`remaining 0`, tx `54f54837…`). HF28 matches on `(from, to, pair_id)`; a
  mismatched memo or recurrence will not cancel a plan, and access continues to
  the grant expiry.

### CSP and network

The Vault feature adds no origin, host, script, worker or dependency. CSP is
unchanged: `connect-src https:` already covers Hive API nodes, and
`worker-src 'self' blob:` already covers the existing service worker. WebCrypto
is a platform API, and the existing `@noble/hashes`/`hive-tx` packages provide
signature recovery; no new crypto library is used. `img-src https:` already
covers avatar and post images, but it is not a confidentiality boundary for
premium media.

### Threat table

| Threat | Impact | Mitigation | Residual risk |
| --- | --- | --- | --- |
| Reader shares the key or plaintext | Content leak for that reader | Monthly rotation, watermark `Licensed to @reader · period`, revoke by omission from the next bulletin, re-encrypt for a serious leak | Cannot prevent screenshots or a determined subscriber; old ciphertext stays readable |
| Reader key stolen by XSS or malware | Content leak for that reader and blog | CSP, DOMPurify, no raw `v-html`, extractable key kept in IndexedDB/memory only, forget/rotate on the device | Extractable for recovery, so same-origin script can export it while the page is open. CSP is the main control |
| Creator vault stolen | Full archive leak | PBKDF2-SHA256 310k + AES-256-GCM, account-bound AAD, passphrase not stored, encrypted export only | Offline passphrase guessing; weak passphrases are the weak point |
| Forged grant | Free access or a lockout | Posting-key signature, canonical JSON, keyring hash, AAD-bound wrap, expiry check; `signer === blog` enforced and delegated bulletins rejected | Delegation is post-MVP |
| Replayed payment | Duplicate grant | Recipient/amount/memo/product checks, txid uniqueness, one subscriber row per reader key and payer account, newest-payment wins | No persistent replay ledger beyond the 1,000-row history scan |
| Tampered ciphertext or keyring | Wrong plaintext or a crash | AES-GCM tag, SHA-256 plaintext hash, keyring AAD, no partial plaintext | None known; failure is a locked state |
| Wrong key or wrong period | No decrypt | `kid` selection, `rkt` match, typed `VAULT_TAG`/`VAULT_BAD_KEY` errors | User must use the subscribing device or restore |
| Malicious API node | Fake metadata, bulletin or payment history | Verify the bulletin signature locally, re-fetch the product post for money, multi-node read fallback, chain consensus for history | A node can withhold data or serve stale data; the reader fails closed |
| Phishing blog or crafted link | Payment to the wrong account | Recipient/amount derived from the HOM product post; product must belong to the blog; `@account` shown in review and dialog | A look-alike domain remains a user-education problem |
| Content injection in decrypted HTML | XSS | `Render` + DOMPurify, sanitised URLs, no raw `v-html`, CSP `script-src-attr 'none'` | Trusted-renderer or sanitiser bugs |
| Service worker or cache leak | Plaintext after logout | No plaintext in storage; service worker caches shell/assets only; memory dropped on lock/unmount | Browser memory/DOM inspection by a local attacker |
| Analytics or log leak | Privacy | Vault modules do not log or emit analytics; no plaintext/keys in error copy | Host-level telemetry outside the app |
| Billing / auto-renewal complaint | Legal and reputational | Product post and dialog disclose amount, 12 payments, cancel path and that access ends with the grant; queue is reviewed | Jurisdiction-specific consumer rules are the creator's responsibility |
| HBD depeg | Revenue loss | Price in HBD, product post is the source of truth, USD estimate is display-only | HBD peg risk |
| Huge payload or spam bulletins | Chain limits or spam | 30 KB inline / 90 KB companion transport, 300-entry bulletin cap, RC cost, creator-only signing | Comment/transaction limits and RC exhaustion |
| Illegal premium content | Abuse | Report path, blog disablement, creator responsibility; ciphertext remains on chain | Encryption limits moderation; Banksia cannot delete chain data |


## nginx / nginx2root (CVE-2026-123007 and friends)

The origin runs Debian's nginx 1.22.1 package. Keep every vhost TLS
`listen` directive free of `http2` and never add `http2 on;`, `listen ... quic`,
`http3 on;`, a request-derived `proxy_pass`/`resolver`, or a mail proxy block:

```nginx
listen 443 ssl;   # good
# listen 443 ssl http2;   <- do not add: enables the CVE-2026-123007 path
```

Cloudflare terminates client HTTP/2/HTTP/3, so browsers still get it; the origin
leg only speaks HTTP/1.1, which keeps the HTTP/2 and HTTP/3 code paths in
nginx unreachable. `deploy/nginx/banksia.io.conf` already follows this.

## Cloudflare Rocket Loader

**Disable Rocket Loader** (Speed → Optimization → Rocket Loader: Off) for this
site. Rocket Loader rewrites `<script>` tags, defers/reorders execution and can
break Vite ES-module bootstrapping and the order in which Quasar and the app
bundle initialise. It also conflicts with a strict `script-src` policy because it
injects its own script. If a performance feature is needed, use Brotli, HTTP/3
and asset caching instead.

## SmartLock key model

- Imported posting/active/memo keys are encrypted in the browser with SJCL
  (AES-CCM, PBKDF2 key derivation, 310,000 iterations for new imports) and
  stored as base58 ciphertext in `localStorage` under
  `ausbitdev_peaklock_v2`. Existing ciphertext records keep their original KDF
  parameters and still decrypt.
- New imports require a password of at least 8 characters. Existing accounts
  with shorter passwords can still be unlocked; the unlock path accepts any
  non-empty password.
- Unlocked keys live **in memory only**. `getPosting()` reads the in-memory map;
  there is no `lscache`/localStorage cache of unlocked keys. Reloading the page
  or calling `lock()`/logout clears the key and requires the password again.
- Keys are only used in the browser to sign the transactions the user queues.
  No private key is ever sent to a server operated by this site.
- Lightning address display and receive invoices require no key. Paying a
  Lightning invoice queues a normal Hive transfer to `@v4vapp` for active-key
  review; the queue marks it manual-only and never auto-broadcasts it. No key
  material or SmartLock payload is sent to v4v.app.
- Because the ciphertext is in `localStorage`, any XSS on the origin can read the
  encrypted blobs and attempt an offline password attack. This makes the header
  policy above (especially CSP) part of the key-storage threat model, not just
  general hardening.

## HiveAuth key model

- HiveAuth is an out-of-band signer. The site opens a WebSocket to
  `wss://hive-auth.arcange.eu/`, shows a `has://auth_req/...` QR/deep link, and
  the user approves in a mobile wallet (PKSA). Private keys stay in the wallet
  and are never sent to this origin or to the HAS relay.
- The app holds a per-session relay token and an AES key shared with the PKSA.
  They are stored in `sessionStorage` under `hiveauth:session:<account>` (or an
  in-memory fallback when storage is unavailable), never in `localStorage`.
  They can request signatures but cannot sign without the phone; logout and
  session expiry clear them.
- One pending request record per tab is stored in `sessionStorage` under
  `hiveauth:pending` as `{account, uuid, kind, expire, key}`. It lets a reload
  or a woken tab attach to the same relay request. Only a pending login keeps
  the temporary auth key; signing and challenge records store no key. The
  record is cleared on completion, cancellation, timeout or `attach_nack`, and
  `clearAllSessions()` removes it.
- Every broadcast is approved in the wallet. Auto-send and "send all" process one
  HiveAuth action at a time and wait for the phone approval; if the phone is not
  available the request times out instead of sending silently. PKSA-side
  whitelisting may reduce prompts, but the site does not rely on it.
- Image uploads use the image host's `/cs/<account>/<signature>` checksum
  endpoint for HiveAuth. The signed challenge is
  `sha256("ImageSigningChallenge" + sha256(file))`, not the file itself, because
  the HAS relay closes messages around 250 KB.
- The relay sees the account name, app metadata, request timing, the encrypted
  payloads and (in protocol 0.8) the session token on signing requests. It does
  not see keys, plaintext operations or the shared AES key (the key is delivered
  to the PKSA through the QR/deep link). It cannot sign without the PKSA; the
  site does not enable or rely on PKSA-side whitelisting.
- The app name in `APP_META` is self-asserted by the protocol, not bound to the
  web origin. Users must check the operation details in the wallet before
  approving. This is a protocol limitation, not a site-specific one.
- `connect-src` already allows `wss:`; if the policy is narrowed later, add
  `wss://hive-auth.arcange.eu` explicitly. QR images use a `data:` URI, which
  `img-src` already allows.

## Profile skin safety

A profile skin is untrusted account metadata that changes the visual surface a
visitor sees. It is not allowed to load unconditionally.

- The safety decision is bound to the **account that owns the metadata**, not
  the self-declared `theme.author` field. A theme that credits a different
  account is shown with a warning and never inherits that account's standing.
- A custom skin does not apply when the viewer has the author on their Hive
  mute list (`follow` with `what: ["ignore"]`) or when the author's displayed
  reputation is below zero. A raw reputation of `0` displays as `25` and is
  not negative.
- The rule **fails closed**: if the viewer's mute list, the author's
  reputation, or a subscribed mute list cannot be resolved, the built-in theme
  stays in place. A follow beats a subscribed mute list by default; it does not
  lift a negative-reputation block unless the viewer explicitly turns on
  "Trust followed reputation". It never lifts a direct mute. The viewer can
  show a specific skin anyway; that override is local and reversible.
- Guests have no mute list, so only reputation and community signals apply.
  The signed-in viewer's list is read once per session with
  `bridge.get_follow_list` and cached in memory plus a bounded sessionStorage
  snapshot (10 minutes). The live node rejects a `limit` argument and returns
  the whole list, so the cache is bounded by entry count and never read per
  card.
- The check reuses the post's `author_reputation` or the cached account record;
  it does not add a chain request to every post page.
- The Skin Studio preview is an authoring surface and requires an explicit
  "Preview anyway" when the owner is blocked. The theme wall omits a blocked
  author's palette and asks for confirmation before adopting it as a site
  palette. Neither path publishes anything.
- This is a local viewer policy, not a site-wide ban list. No list is shared
  with other users, no account is punished, and no chain state is changed.

Implementation: `src/services/moderationPolicy.js` (pure gate),
`src/services/moderationData.js` (cached reads),
`src/services/moderationSettings.js` (local per-account settings),
`src/stores/moderation.js` (viewer snapshot) and
`src/components/theme/ProfileSkin.vue` (rendering and overrides).

## General rules for contributors

- Never pass chain metadata (profiles, community descriptions, token metadata)
  straight into `v-html` or `href`. Use `sanitizeRichHtml()` from
  `src/utils/safeRichHtml.js` and `safeExternalUrl()`/`safeHrefAttrs()` from
  `src/utils/safeUrl.js`.
- Every external link that opens a new tab must use
  `target="_blank" rel="noopener noreferrer"`.
- Do not add third-party scripts without updating the CSP and reviewing the
  supply-chain impact.
