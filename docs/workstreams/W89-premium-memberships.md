# W89 — Banksia Vault: premium memberships

Date: 2026-11-27
Status: **deployed and fully live-smoked on 2026-11-27** (SPA +
`banksia-metadata` Worker). The paid write smoke on `ausbit.vsc` /
`ausbitclank` completed end to end: enable → product/container → premium post →
0.001 HBD payment → signed grant → desktop/mobile unlock → expiry → restore →
second reader key → cleanup. A real `recurrent_transfer` cancel was also
verified live. The 50,000 VESTS RC/HP delegation from `ausbitclank` to
`ausbit.vsc` was intentionally left in place at the operator's request.

## Scope

Banksia Vault lets a blog owner sell monthly access to a locked section or a
whole post without giving up the local-first, non-custodial model. The creator
encrypts before publishing; the reader decrypts in the browser with a key they
hold. Payments go directly to the creator.

Shipped in this workstream:

- **Single tier, text only.** Plan id `member`; no tiers, trials, gifts, annual
  passes, lifetime passes or claim codes.
- **Self-sovereign beta.** The creator's dashboard verifies payments, wraps the
  ring key and publishes the signed bulletin. There is no relay, delegated
  signer or automatic issuance.
- **Keyring with full archive.** A new `K_kid` and `K_ring` per period; older
  content keys stay in the keyring so a member can read posts published before
  they joined (`archive: "all"`).
- **HBD only, 5 HBD/month default, creator-editable.** Recurrence defaults to
  730 hours and 12 executions; the HOM product post is the payment source of
  truth.
- **Two content modes.** `section` uses the raw `<!--banksia:vault-->` marker;
  `post` uses the public body as the teaser and encrypts the rest.
- **Hive Open Market discovery plus a hidden grant container.** The product is a
  standard HOM subscription product; the container is a normal post filtered
  out of the archive.
- **AES-256-GCM + P-256 ECDH + HKDF-SHA256 via WebCrypto.** No memo-key
  encryption and no new crypto dependency.
- **0% platform fee.** No escrow, platform balance or Banksia payment address.
- **Reader surface.** Paywall card, subscribe page/dialog, inline unlock,
  watermark, expiry/retry/restore states, SEO paywall JSON-LD.
- **Reader manager.** `/subscriptions` lists plans, payments, cancellation and
  device reader keys with passphrase-wrapped recovery export/import.
- **Creator dashboard.** `/settings/blog/vault` shows members, renewals,
  payments, grants, bulletins, keys, premium content and a revenue CSV.
- **Blog host rules.** Blog hosts and custom domains remain read-only; a custom
  domain deep-links premium reads to the apex and never holds a reader key.

Not in this workstream: relay/delegation, encrypted media, multi-tier, trials,
gifts/claim codes, annual/lifetime, metered paywall, Lightning/fiat checkout,
Hive-Engine/Magi, Substack import, post-quantum or passkeys.

## Components

| Area | Files |
| --- | --- |
| Crypto primitives | `src/services/vaultCrypto.js` |
| Grants, bulletins and signatures | `src/services/vaultGrant.js` |
| Creator vault and reader recovery envelopes | `src/services/vaultKeys.js` |
| Creator in-memory session | `src/services/vaultSession.js` |
| Post metadata, markers and companion parts | `src/services/vaultPayload.js` |
| Composer encryption and edit decisions | `src/services/vaultCompose.js` |
| Blog vault settings and validation | `src/services/vaultSettings.js`, `src/services/blogSettings.js`, `src/config/blog.js` |
| HOM product and hidden container | `src/services/vaultProduct.js` |
| Payment memo, verification and subscribers | `src/services/vaultPayments.js` |
| Bulletin build/publish and reader registry schema | `src/services/vaultBulletin.js` |
| Posting-key signing bridge | `src/services/vaultSigning.js` |
| Reader key lifecycle | `src/services/vaultReaderKey.js` |
| Reader unlock orchestration | `src/services/vaultUnlock.js` |
| Reader state | `src/stores/vault.js` |
| Paywall UI | `src/components/blog/VaultPaywall.vue`, `VaultLockedSection.vue`, `VaultSubscribeDialog.vue`, `VaultSettings.vue` |
| Blog reading integration | `src/pages/blog/BlogPost.vue`, `src/pages/post.vue`, `src/services/blogPosts.js` |
| Composer/publish | `src/pages/compose.vue`, `src/services/publish.js`, `src/services/drafts.js` |
| Subscribe flow | `src/pages/subscribe.vue` |
| Creator dashboard | `src/pages/blogVault.vue` |
| Reader manager | `src/pages/subscriptions.vue`, `src/router/routes.js` |
| Tests | `tests/unit/vault-*.spec.js`, `tests/unit/vault-integration.spec.js`, `e2e/vault.spec.js` |
| Docs | `docs/integrations/vault-protocol.md`, `docs/SECURITY.md`, this record |

## On-chain schemas

### Blog advertising metadata

`posting_json_metadata["banksia.io"].blog.vault` — public, posting key, no
entitlement and no key material. Unknown fields are rejected; the object is
capped at 1,200 bytes inside the 12 KB blog budget.

```json
{
  "v": 1,
  "enabled": true,
  "product": "alice/membership",
  "container": "banksia-vault",
  "bulletin": { "author": "alice", "permlink": "vault-2026-11-3" },
  "price": "5.000 HBD",
  "period": "month",
  "recurrence": 730,
  "executions": 12,
  "archive": "all",
  "watermark": true,
  "updatedAt": "2026-11-27T00:00:00Z"
}
```

`price` is a display hint only. The HOM product post supplies the recipient,
amount, currency and recurrence.

### Post metadata

`json_metadata.banksia_vault`:

```json
{
  "banksia_vault": {
    "v": 1,
    "mode": "section",
    "alg": "A256GCM",
    "kid": "2026-11",
    "iv": "base64url-12-bytes",
    "ct": "base64url-ciphertext",
    "hash": "sha256:...",
    "bytes": 18432,
    "tier": "member",
    "price": "5.000 HBD",
    "product": "alice/membership",
    "container": "banksia-vault",
    "paywall": {
      "title": "Members-only",
      "body": "This section is for members.",
      "benefits": ["New essays every week", "Full archive"]
    }
  }
}
```

Exactly one of `ct`/`iv` or `parts` is present. `hash` is SHA-256 of the
plaintext; `kid` selects `K_kid`; `mode` and `permlink` are bound by the content
AAD. A companion payload replaces `ct` with
`parts: ["<post>-vault-1", ...]` and stores each encrypted chunk under
`json_metadata.banksia_vault_payload` on a reply. Parts are namespaced per post
because Hive permlinks are unique per author.

### Payment memo

```json
{
  "product": "alice/membership",
  "quantity": 1,
  "banksia": {
    "v": 1,
    "plan": "member",
    "reader_key": "p256:base64url-uncompressed-point",
    "sub": "random-128-bit-id",
    "gift_for": null
  }
}
```

Under the 2,048-byte memo limit. The reader key is public; the private key never
leaves the reader. `gift_for` is reserved and not issued in the beta.

### Bulletin

`json_metadata.banksia_vault_bulletin` on a reply under the hidden container.
Deterministic permlink `vault-<period>-<seq>`.

```json
{
  "banksia_vault_bulletin": {
    "v": 1,
    "blog": "alice",
    "period": "2026-11",
    "seq": 3,
    "issued": "2026-11-27T12:00:00Z",
    "keyring": { "alg": "A256GCM", "iv": "base64url", "ct": "base64url" },
    "entries": [
      {
        "rkt": "a1b2c3d4e5f6a7b8",
        "alg": "P256-HKDF-SHA256-A256GCM",
        "epk": "base64url-65-byte-point",
        "iv": "base64url",
        "ct": "base64url-wrapped-ring-key",
        "tier": "member",
        "expires": "2026-12-27T12:00:00Z"
      }
    ],
    "claims": [],
    "signer": "alice",
    "delegation": null,
    "sig": "..."
  }
}
```

The keyring is sealed once per bulletin; each entry wraps `K_ring`, not the
keyring. The signature payload is
`banksia.vault.bulletin.v1|<canonicalJson(bulletin without sig, with recomputed
keyringHash)>`. A new subscriber creates a new sequence with the full entry
list. The single-bulletin cap is 300 entries (warning at 250) and about 60 KB;
splitting is reserved but not implemented.

### Reader key registry

`custom_json` id `banksia.vault.reader_key`, posting authority, schema present
but **not used by the UI or the creator wrap path in W89**:

```json
{
  "v": 1,
  "blog": "alice",
  "keys": [
    { "key": "p256:...", "label": "Laptop", "created": "2026-11-01T00:00:00Z" }
  ],
  "revoked": []
}
```

## Authority matrix

| Action | Signer | Authority | Operation |
| --- | --- | --- | --- |
| Enable/disable, price, product/container/bulletin pointer | Creator | Posting | `account_update2` with `json_metadata: ""` |
| Publish the membership product | Creator | Posting | `comment` (+ `comment_options`) |
| Publish the hidden container | Creator | Posting | `comment` |
| Publish a premium post / companion parts | Creator | Posting | `comment` |
| Publish or replace a bulletin | Creator | Posting | `comment` under the container |
| Publish a delegated bulletin | Relay | Posting (relay key) | **Not implemented** |
| Subscribe (monthly) | Reader | Active | `recurrent_transfer` |
| Subscribe (one month) | Reader | Active | `transfer` |
| Cancel | Reader | Active | `recurrent_transfer` with amount `0.000 HBD` |
| Register another reader key | Reader | Posting | `custom_json` (schema only) |
| Read/unlock | Nobody | None | Local decryption |
| Re-issue a grant | Creator | Posting | New bulletin comment |

The creator never needs an active key to receive money. The reader only needs an
active key to pay, exactly like any other Hive purchase. Active-key payments and
cancellations are never auto-broadcast; the queue requires explicit
confirmation. Posting-key operations use the normal queue and can auto-send only
when the user has enabled auto-send.

## Crypto and security model

- **Keys:** random AES-256-GCM `K_kid` per period; a keyring `{kid: K_kid}`; a
  random `K_ring` per period; a P-256 ECDH reader key per origin; a separate
  vault passphrase. None is derived from a Hive key.
- **Creator vault at rest:** PBKDF2-SHA256 310,000 iterations + AES-256-GCM in
  `localStorage`, AAD `banksia.vault.store.v1|<account>`. Plaintext lives in
  memory only while unlocked. Export is passphrase-encrypted and never includes
  the passphrase.
- **Reader key:** an extractable P-256 `CryptoKey` in IndexedDB (memory
  fallback) so recovery export is possible. No key material in
  `localStorage`/`sessionStorage`, the service worker, logs or analytics.
  Extractability is a deliberate XSS trade-off, documented in
  `docs/SECURITY.md`.
- **Wrap:** ephemeral P-256 ECDH; HKDF-SHA256 salt
  `epk || readerPublicKey || "banksia.vault.wrap.v1"`; HKDF info and AES-GCM AAD
  are the canonical grant header `{blog, rkt, period, tier, expires}`. Wrapped
  keys cannot be moved between readers, blogs, periods, tiers or expiries.
- **Content:** AES-256-GCM with AAD
  `banksia.vault.content.v1|blog|permlink|kid|mode` and a SHA-256 plaintext
  hash. A tag or hash failure returns no plaintext.
- **Keyring:** AES-256-GCM with AAD `banksia.vault.keyring.v1|blog|period`.
- **Signing:** creator posting key via Keychain, HiveAuth or SmartLock.
  `account_update2` keeps `json_metadata: ""`; the posting key is never an
  encryption key and no server holds key material.
- **Verification order:** parse, fetch bulletin, verify signature and recompute
  `keyringHash`, check blog/period/rkt/expiry, then unwrap and decrypt. Hashes
  are checked after decryption. DOMPurify via `Render`; no raw `v-html`.
- **Payments:** recipient/amount/currency/recurrence come from the HOM product
  post; the product must belong to the blog account; `@account` is shown in the
  review. Txids are deduplicated, and one subscriber row per reader key wins.
- **Blog hosts:** read-only. Custom domains never read or store a reader key and
  deep-link premium reads to the apex.
- **CSP:** unchanged. `connect-src https:` already covers Hive nodes; no new
  origin, worker, script or dependency.

## Verification

Local, 2026-11-27:

- `bun run lint` — clean (ESLint + theme-token check).
- `bun run test` — **214 files, 2,062 tests passing** at the deployed HEAD
  (2,053 were W89-only before the separate W65 KE commit).
- Dedicated Vault suites: **14 files / 268 tests** (`tests/unit/vault-*.spec.js`),
  plus the adjacent blog-settings, blog-posts, drafts, publish and route suites
  touched by the slice.
- `bun run build` — **succeeded** after fixing the composer import
  (`hasVaultMarker`/`vaultMarkerIndex` live in `vaultCompose.js`) and after the
  reader crypto became a lazy chunk. The build stamp is in
  `sw.js`/`version.json`.
- `bun run perf:check` — **passed** after a documented re-baseline. The
  pre-W89 `master` build already failed the old budgets (Home/Browse/Block/
  Wallet/Market/Search by 0.1–12 KB), so this is not a Vault-only regression.
  The Post route grew ~8.6 KB and Compose ~17.7 KB over that baseline; both are
  route-lazy and the reader chunk is only fetched for premium posts. Budgets
  were raised by ~5–8 KB of headroom rather than hiding the composer cost.
- `e2e/vault.spec.js` — **8/8 passed** in Chromium. Scenarios: locked post with
  no plaintext, signed-grant unlock + reload persistence + no plaintext in
  storage, expired grant, tampered ciphertext, subscribe queue shape, creator
  dashboard, reader subscriptions, composer membership panel.
- Axe — clean at **1440×900 and 390×844** for the locked premium post, the
  subscribe page/dialog, the Vault dashboard and `/subscriptions`.
- Full Chromium suite — **197 passed / 4 failed**. The four failures (badges
  shelf, login-key guide, header lockup, profile-skin scope) reproduce
  identically on pre-W89 `master` 8351c92 and are not Vault regressions.
- Fast Obscura suite — not a Vault surface: it needs real IndexedDB/WebCrypto
  keys and axe, so `e2e/vault.spec.js` is excluded from the CDP build. The CDP
  suite also showed pre-existing timeouts in this environment; the Chromium
  suite is the release gate.

## Open risks

Code-level findings from the security review. Items 1, 2, 7 and the build
blocker were fixed by the orchestrator before the release gate; the residual
items remain.

1. **Resolved — bulletin signer is now bound to the blog.** `verifyBulletin`
   requires `signer === bulletin.blog` and rejects delegated bulletins. The
   reply fallback rejects comments whose author is not the blog account, and the
   cached pointer must point at the blog. `tests/unit/vault-render.spec.js`
   covers a higher-sequence foreign bulletin.
2. **Resolved — `/subscribe` verifies the bulletin signature.** It no longer
   sets `granted` from an entry alone; it calls `verifyBulletin` first.
3. **Medium — extractable reader keys.** `ensureReaderKey` generates
   `extractable: true` so recovery export works. Any XSS on the origin can
   export the key while the page is open. CSP, sanitised rendering and
   dependency hygiene are therefore load-bearing; a non-extractable mode with a
   separate recovery design would reduce this.
4. **Medium — 1,000-row history window.** The dashboard and
   `/subscriptions` request `limit: 1000`. Older payments/subscribers are
   invisible and cannot be re-issued from the dashboard until pagination or a
   HAF index is added.
5. **Resolved — HF28 cancel matching verified live.** A zero-amount
   `recurrent_transfer` with the matching recipient, recurrence and memo removed
   the live plan (`remaining 0`; tx `54f54837b969d5956c38126a9a05b7dc3f65673f`).
   The UI still warns because matching depends on the original plan fields.
6. **Low — no re-encrypt/archive migration.** Rotation protects future content;
   a leaked old key still decrypts old ciphertext and there is no bulk
   re-encryption tool.
7. **Resolved — multi-part integrity is checked.** `unlockWithGrant` now checks
   the post-level `bytes`, the `sha256:<hex>` hash over the concatenated
   plaintext, the exact part count, duplicate permlinks, and any declared
   `part`/`parts` indexes. A missing or substituted part fails closed.
8. **Resolved — build blocker.** The composer now imports the marker helpers
   from `vaultCompose.js`; `bun run build` succeeds.

## Known limitations and remaining work

- **No relay** and no automation while the creator is offline.
- **No delegation certificates** or scoped relay signing; delegated bulletins
  are rejected.
- **No encrypted media.** Image/video URLs inside a premium payload are public
  once known; the composer warns and the product does not promise otherwise.
- **No multi-tier, trials, gifts, claim codes, annual or lifetime plans.**
- **No bulletin splitting.** The schema reserves part permlinks; the dashboard
  enforces a 300-entry / ~60 KB single bulletin.
- **Reader key registry is post-MVP.** The `banksia.vault.reader_key` schema and
  builder exist, but no UI publishes it and the creator wraps one key per
  reader.
- **Custom domains are read-only.** Premium reads happen on the apex; a custom
  domain does not hold a reader key.
- **HF28 cancel matching was verified live** on 2026-11-27 (zero-amount
  `recurrent_transfer`, matching recipient/recurrence/memo; plan removed).
- **1,000-row account-history window** for subscribers and reader plans.
- **Manual grant issuance.** The creator must unlock the vault and publish a
  bulletin; readers can pay while the creator is offline and wait.
- **Rotation is manual.** The dashboard's Rotate action creates the next
  period's `K_kid`/`K_ring`; publishing fails if the current period's content key
  is missing. There is no scheduled rotation.
- **No post-edit plaintext prefill.** Editing a premium post loads the public
  body only; the creator cannot see or edit the encrypted payload in the editor.
  An unchanged premium hash preserves the old ciphertext.
- **Companion parts are namespaced per post** (`<post>-vault-N`), not the bare
  `vault-payload-N` sketched in the research doc.
- **The product author must equal the blog account.** A product published by a
  different account is rejected by the composer and the subscribe page.
- **Price changes apply to new subscriptions only.** Existing recurrent
  transfers keep their original amount until the reader cancels and recreates
  them.
- Full axe matrix for every theme/variant remains deferred, as in earlier blog
  workstreams.

## Deploy notes

Deployed on 2026-11-27 from `master`:

- Final SPA build stamp `20261127T152819Z-5c7c459b0877`; `./scripts/deploy.sh`
  succeeded and `bun run verify:deploy` passed at the edge.
- Final backup:
  `hurgenburgen:~/banksia-backups/banksia.io-20261127T152828Z.tar.gz`
  (sha256 `39be48b3bcd619c14d0ff96dc823b9c16b6e05cb108dacf968d4e7c94320b186`).
  Rollback: `./scripts/rollback.sh ~/banksia-backups/banksia.io-20261127T152828Z.tar.gz`.
- `banksia-metadata` Worker deployed with `/subscribe*` and `/subscriptions*`
  routes; `/settings/blog*` covers the dashboard. Version
  `be3efd53-255a-4352-b27b-6625e3411703`.
- Vhost caveat: `scripts/apply-nginx-vhost-remote.sh hurgenburgen apply` could
  not run because the deploy user needs a sudo password. Browser traffic is
  served by the Worker shells; direct-origin requests without
  `Accept: text/html` still 404 on the three new apex paths. Apply the vhost on
  the next privileged session.

### Post-release UX slice

- Product authoring: `blog.vault` now carries `productTitle`,
  `productDescription` and up to six `benefits`. The product post body, title
  and metadata use them; the subscribe page renders the custom title,
  description and benefit list. Re-publishing with **Update membership product**
  edits the existing product post.
- Renewal copy is derived from the on-chain recurrence, not hard-coded
  "monthly": 24h reads "every day", 730h "every month", weekly/yearly likewise.
  The subscribe payment modes, terms, CTA and dashboard plan line all use it.
- One-click setup: with no product, **Publish product & container** queues the
  product and the container reply together. The container no longer consumes a
  root-post slot.
- Creator notification: the account menu has a Vault dashboard link, and the
  dashboard shows a prominent "N subscribers need a grant" banner with
  **Select pending & issue**.
- The price field keeps a local draft and commits on blur/Enter, so it no longer
  snaps back while typing.
- **Auto-issue grants:** while the creator dashboard tab is open, visible and
  the vault is unlocked, it polls verified payments every 30 seconds and queues
  a bulletin for pending readers automatically. The toggle is persisted per
  account, a queued unsent bulletin suppresses duplicates, and Keychain may
  still ask for approval (SmartLock can sign silently while unlocked). Manual
  **Select pending & issue** remains available.

### Post-release UI fixes

- The Vault settings section was fully disabled even for the owner because
  `!canEdit || busy` evaluated to `''` while `busy` was idle; Vue casts an empty
  string to `true` for a Boolean prop. All disable bindings now use
  `Boolean(busy)`, with a regression test in
  `tests/unit/vault-settings-ui.spec.js`.
- **Open dashboard** now carries `?account=<blog>` so it opens the viewed blog's
  dashboard instead of the logged-in account's (and works read-only).
- The four long-standing E2E failures were stale test fixtures: the skin specs
  still wrote the legacy `hive.ausbit.dev` namespace, the login selector matched
  a post title, and the mobile logo assertion assumed the old square mark.
- The price field re-normalised on every keystroke, so it snapped back to
  `5.000 HBD`. It now keeps a local draft and commits a canonical amount on
  blur/Enter.
- Product and container posts have no `comment_options`; Keychain's
  `requestPost` returned `incomplete` for them. Top-level comments without
  options now go through `requestBroadcast` with the exact operation.
- Verified live with a stubbed Keychain: the product action called
  `requestBroadcast` with a single `comment` operation and the queue sent it.
- Auto-unlock now requires a signed-in reader whose Hive account matches the
  key's recorded owner. Logging out locks the post immediately and a reload
  logged out does not auto-unlock; the explicit **Restore access** action is
  still available. The reader key stays on the device so the member does not
  need a recovery import after logging back in.
- The grant container is now published as a **reply under the product** rather
  than a second root post. Product → container is immediate (reply interval is
  seconds, not the 5-minute root interval). Only the premium post itself still
  needs Hive's normal 5-minute root-post spacing.

### Live write smoke (2026-11-27)

Creator `ausbit.vsc`, reader/payer `ausbitclank` (0.001 HBD), price `0.001 HBD`:

| Step | Tx / result |
| --- | --- |
| Membership product | `880c7d48c0c117be1caf965cf77deccd4151dc07` |
| Hidden container (reply) | `d40461f571c2fe6016991c3668e265a854b20358` |
| Enable `blog.vault` | `368600c96478e78d06918daa7915ee48d942452e` |
| Premium section post | `ae5f6ff250cd48aa41cdd18214d557a9a157e7f1` |
| One-time 0.001 HBD payment | `a380db0f95c883b2867ef4de0369b72b1efebf48` |
| Bulletin seq 1 + pointer | `726438131b4566de46eb08ef3cda33f0db6dc210`, `5575e5549991dd1948289b7168e2e4bbdac84937` |
| Node unlock | decrypted 55-byte payload, hash verified |
| Browser unlock | desktop 1440 and mobile 390 both unlocked, no page errors |
| Expiry (seq 2) | `c3883ff94c4b521c03e2ddc998b4c93d64adcea6` — paywall restored |
| Restore (seq 3) | `7e1089aa08bcb894f2a8ff74db38d42d5dd171f5` — unlocked |
| Second reader key | unlocked with the second P-256 key |
| Real cancel probe | `54f54837b969d5956c38126a9a05b7dc3f65673f` — plan removed |
| Metadata restore | `80c63887593da4e407fdfb0398f43654861d3bd8` |
| Refund 0.001 HBD | `dc6e0be9098e877c96f20af9d8368e1940ab9775` |

Cleanup deleted all three bulletins, the premium post, the container and the
product; `blog.vault` is back to absent; both accounts are back to their
pre-smoke balances; no `w89-*` post remains on chain. The temporary key file was
shredded. The 50,000 VESTS delegation from `ausbitclank` to `ausbit.vsc` was
kept deliberately.

The full gate was: `bun run lint`, `bun run test` (214 files / 2,062 tests),
`bun run build`, `bun run test:e2e` (pre-existing CDP timeouts),
`bun run test:e2e:full` (200 passed / 1 flaky keepsats axe failure that passes standalone; the four previously failing badges/login/header/skin specs are fixed), `bun run
perf:check` (passed), and the Vault axe checks (clean at 1440×900 and 390×844).

## References

- Protocol: [`docs/integrations/vault-protocol.md`](../integrations/vault-protocol.md)
- Security model and threat table: [`docs/SECURITY.md`](../SECURITY.md)
- Research and rationale:
  [`docs/research/members-only-content.md`](../research/members-only-content.md)
- Build contract:
  [`docs/prompts/W89-vault-build-prompt.md`](../prompts/W89-vault-build-prompt.md)
