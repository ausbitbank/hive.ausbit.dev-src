# W89 — Banksia Vault: end-to-end build prompt

> Paste this document into a fresh OpenCode session as the task brief. It is
> self-contained, but the canonical research and rationale live in
> [`docs/research/members-only-content.md`](../research/members-only-content.md).
> Read that first; this prompt is the build contract.

---

## 0. Mission

Build **Banksia Vault**: members-only content for Banksia blogs, end to end,
using subagents.

The product: a blog owner can mark a section (or a whole post) as members-only,
set a monthly HBD price, and let readers subscribe with a native Hive recurrent
transfer. The reader unlocks the content in the browser with a key they hold.
Banksia never custodies funds or plaintext.

### Locked decisions

| Decision | Choice |
| --- | --- |
| MVP scope | **Single tier, text only** |
| Automation | **Self-sovereign beta** (creator dashboard issues grants; no relay at launch) |
| Archive | **Full archive by default** via a keyring |
| Business model | **0% platform fee**; paid themes, custom domains, managed relay and support later |
| Currency | **HBD only**; default 5 HBD/month, creator-editable |
| Content modes | **Locked section** and **whole post** |
| Payment discovery | **Hive Open Market product** post plus hidden grant container |
| Encryption | **AES-256-GCM + P-256 ECDH + HKDF-SHA256** via WebCrypto; **no memo-key encryption** |
| Custody | **None**: no server-side signer, no platform balance, no plaintext on a Banksia server |
| Blog hosts | **Read-only**; signing stays on `banksia.io`; custom domains read-only |

### Definition of done (one sentence)

A creator can enable Vault, publish a premium post; a reader can pay with a
recurrent HBD transfer, receive a creator-signed grant, unlock the content
inline, lose access at expiry or cancellation, and restore access — with unit
tests, E2E, axe, docs, a live smoke, and a clean full gate.

### W88 collision protocol (read this before editing anything)

The repository may contain in-progress **W88 shop refinements**. They are the
operator's work, not yours.

1. Run `git status` and `git diff -- <file>` before touching a file that W88
   owns (`src/pages/blog/BlogShop.vue`, `src/pages/cart.vue`,
   `src/pages/checkout.vue`, `src/services/blogShop.js`, `src/services/shopCart.js`,
   `src/stores/cart.js`, `src/services/hiveMarket.js`,
   `src/services/blogProductPath.js`, `src/services/productDraft.js`).
2. Do not revert, overwrite, or "clean up" W88 changes.
3. Prefer **new files** over editing W88 files:
   - `src/services/vaultProduct.js` for the membership product, instead of
     editing `blogShop.js`.
   - `src/pages/subscribe.vue` for the Vault subscribe flow, instead of editing
     `pay.vue`, if `pay.vue` is dirty or the shop flow is in flux.
4. If a shared file is dirty and a change is unavoidable, stop and ask the
   operator; the orchestrator applies the minimal patch after W88 is stable.
5. The Vault feature must not depend on W88's cart/checkout. It can deep-link
   from the shop later.

---

## 1. Read first (in this order)

1. `docs/research/members-only-content.md` — the full research, protocol,
   competition, risks and rationale. Treat it as the source of truth; this
   prompt is the build contract.
2. `docs/ROADMAP.md` — standards and the current workstream state.
3. `docs/workstreams/W84-blog-hosting.md`, `W85-blog-customisation.md`,
   `W86-blog-owner-control.md`, `W87-blog-portfolio-shop.md` — the blog surface
   and the HOM/payment patterns you must extend.
4. `docs/SECURITY.md` — the key model, CSP, blog-host read-only rule, and the
   SmartLock threat model.
5. `README.md` — stack, commands, deploy, test suites.
6. Code: `src/services/blogSettings.js`, `blogHost.js`, `blogPosts.js`,
   `blogShop.js`, `publish.js`, `drafts.js`, `hiveTx.js`, `chainData.js`,
   `queue.js`, `accountMetadata.js`, `hiveOperations.js`.
7. UI: `src/pages/blog/BlogPost.vue`, `src/pages/post.vue`,
   `src/pages/compose.vue`, `src/pages/pay.vue`, `src/pages/blogSettings.vue`,
   `src/pages/blog/BlogShop.vue`, `src/components/render.vue`.
8. State: `src/stores/blog.js`, `src/components/smartlock/store.js`,
   `src/components/smartlock/utils.js`.
9. Edge/deploy: `deploy/cloudflare/metadata-worker.mjs`, `wrangler.jsonc`,
   `deploy/nginx/banksia.io.conf`.
10. Tests: `e2e/blog.spec.js`, `e2e/helpers.js`, `tests/unit/blog-*.spec.js`.

Do not use `/knowledge-load` inside subagents; read files directly. Do not
re-read finished workstream records for their own sake; only the ones above.

---

## 2. Scope

### In scope

- Creator Vault settings in `/settings/blog`:
  - enable/disable, price (HBD), recurrence, executions, archive window,
    watermark toggle, product permlink, container permlink.
  - generate/import/export the vault (keyring + ring key), encrypted at rest
    with a passphrase.
- Composer:
  - "Members only" toggle and a lock-from-here marker.
  - public/premium split preview; "preview as reader".
  - encrypt on publish; payload size check; inline or companion-comment payload.
  - publish the `comment` with `json_metadata.banksia_vault`.
- Blog and apex reading:
  - paywall card for locked sections and whole posts.
  - inline unlock after a valid grant; watermark.
  - expiry, wrong-key, tampered-payload, bulletin-unavailable, relay-offline
    states.
  - SEO paywall JSON-LD, RSS/OG teaser, no cloaking.
- Subscribe:
  - reader keypair generated in the browser (P-256, non-extractable where
    possible; passphrase-wrapped export for anonymous readers).
  - subscribe dialog; `recurrent_transfer` (12 × 730 h) or one-time `transfer`.
  - memo = HOM product + `banksia.reader_key` + random `sub`.
  - creator dashboard: subscribers, payments, grants, bulletins, re-issue,
    revoke, cancel link, revenue CSV.
  - reader `/subscriptions`: active plans, next payment, cancel, restore,
    reader keys/devices.
- Grant issuance:
  - verify payment from account history (transfer and fill_recurrent_transfer).
  - seal keyring blob once per bulletin with `K_ring`; wrap `K_ring` per reader.
  - sign the bulletin with the creator's posting key; publish as a comment under
    the hidden container.
  - deterministic bulletin permlink `vault-<period>-<seq>`.
- Protocol:
  - `docs/integrations/vault-protocol.md` with schemas and test vectors.
  - `banksia.vault@1` versioning.
- Docs:
  - `docs/workstreams/W89-premium-memberships.md` with scope, authorities,
    verification and notes.
  - `docs/SECURITY.md` updated with the vault key model and threat table.
  - `docs/ROADMAP.md` updated (W89 done, next W90).

### Out of scope (do not build)

- Relay (self-hosted or hosted), delegation certificates, Lit/threshold,
  x402, Cashu, Lightning/fiat checkout, Hive-Engine/Magi, encrypted media,
  multi-tier, trials, gifts/claim codes, annual/lifetime, metered paywall,
  Substack import, PQ hybrid, passkeys.
- Any server-side key custody, plaintext storage, or platform balance.
- Memo-key encryption for content.
- Custom-domain signing; custom domains keep the read-only rule.
- A cart/checkout rewrite; reuse the existing `/pay` flow and extend it.
- A new crypto dependency; use WebCrypto. If a dependency is genuinely
  unavoidable, stop and ask.

---

## 3. Protocol contract (implement exactly)

The full schemas and rationale are in the research doc. This section is the
build-critical subset.

### 3.1 Key hierarchy

| Key | Type | Lifetime | Purpose |
| --- | --- | --- | --- |
| **Content key** `K_kid` | AES-256-GCM 256-bit | One period | Encrypts post payloads |
| **Keyring** | JSON `{kid: K_kid}` | Grows with archive | Lets a reader decrypt past and current posts |
| **Ring key** `K_ring` | AES-256-GCM 256-bit | One period, rotated monthly | Encrypts the keyring blob |
| **Reader key** | P-256 ECDH | Long-lived per device/origin | Receives wrapped `K_ring` |
| **Vault passphrase** | User secret | Long-lived | Encrypts the creator vault at rest |

- Never derive these from the Hive posting/active/memo keys.
- The creator signs bulletins with the **posting** key; the posting key is never
  used as an encryption key.
- The reader key is not a Hive account key; it is a separate P-256 key.

### 3.2 Blog metadata

`posting_json_metadata["banksia.io"].blog.vault`:

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

Rules:

- Small (~500 bytes). The blog object shares a 12 KB budget with CSS and blocks.
- Strict validation: unknown fields rejected; price as `"X.XXX HBD"`; no private
  material; delegate/relay fields only if the schema supports them later.
- **Never** store entitlement or grants here.
- `price` is a display hint only; the HOM product post is the payment source.

### 3.3 Post metadata

`json_metadata.banksia_vault`:

```json
{
  "banksia_vault": {
    "v": 1,
    "mode": "section",
    "alg": "A256GCM",
    "kid": "2026-11",
    "iv": "base64url",
    "ct": "base64url",
    "hash": "sha256:...",
    "bytes": 18432,
    "tier": "member",
    "price": "5.000 HBD",
    "product": "alice/membership",
    "container": "banksia-vault",
    "paywall": {
      "title": "Members-only",
      "body": "This section is for members.",
      "benefits": ["New essays every week", "Full archive", "Monthly Q&A"]
    }
  }
}
```

Rules:

- `mode: "section"` → the public body contains `<!--banksia:vault-->`; the app
  detects it in the **raw body before rendering**, splits it, and inserts the
  decrypted payload there.
- `mode: "post"` → the public body is the teaser; the decrypted payload replaces
  or follows it.
- `ct` is base64url ciphertext. Keep inline ciphertext ≤ ~40 KB (≈30 KB plaintext
  after base64 overhead); above that, use `{ "parts": ["vault-payload-1", ...] }`
  in companion comments.
- `hash` is SHA-256 of the plaintext; verify after decrypt.
- `kid` selects `K_kid` from the keyring.
- `tier`, `price`, `product`, `container` are display/interop hints.
- `banksia_vault` is a managed metadata key in `publish.js`; preserve it on edit
  unless the payload is re-encrypted.

### 3.4 Payment memo

Standard HOM memo plus a namespace:

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

- Well under 2,048 bytes.
- The reader public key is public; the private key never leaves the reader.
- Recurrent transfer: `to: alice`, `amount: "5.000 HBD"`, `recurrence: 730`,
  `executions: 12`, `extensions: []`, memo above.
- One-time: `transfer` with the same memo.
- Cancel: `recurrent_transfer` with `amount: "0.000 HBD"` for the matching plan.
  **Test the exact HF28 matching rule on testnet before shipping the cancel
  button**; HF28 allows multiple transfers to the same recipient.

### 3.5 Bulletin comment

A comment under the hidden container, authored by the creator (or, later, a
relay). Deterministic permlink: `vault-<period>-<seq>`.

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
        "epk": "base64url",
        "iv": "base64url",
        "ct": "base64url",
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

Rules:

- `keyring` is the encrypted keyring blob, encrypted once with `K_ring`.
- `ct` in an entry is the wrapped `K_ring` (~200 bytes), not the keyring.
- `rkt` = first 16 hex chars of SHA-256(canonical reader public key).
- `sig` covers canonical JSON of the bulletin without `sig`, including the
  keyring blob hash and every entry.
- New subscriber → new `seq` with the full entry list (idempotent, simple).
- More than ~150–300 entries or >~60 KB → split into parts
  (`vault-2026-11-3-1`, `-2`) and list parts in the manifest.

### 3.6 Reader key registry

`custom_json`, id `banksia.vault.reader_key`, signed with the reader's posting
key. Post-MVP unless multi-device is required for the beta; include the schema
and the store hook now so it is not a breaking change later.

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

### 3.7 Crypto contract

Implement with WebCrypto only:

- **Key generation:** P-256 ECDH. Public key = uncompressed point
  (`0x04 || x || y`), base64url. Private key non-extractable where possible;
  passphrase-wrapped export for anonymous readers.
- **Thumbprint:** first 16 hex chars of `SHA-256(canonical public key bytes)`.
- **ECDH + HKDF:** derive a 256-bit KEK:
  - `salt = epk || readerPublicKey || "banksia.vault.wrap.v1"`
  - `info = canonical grant header (blog, rkt, period, tier, expires)`
- **Wrap:** AES-256-GCM encrypt `K_ring`; AAD = the same header.
- **Keyring seal:** AES-256-GCM encrypt the keyring JSON with `K_ring`; AAD =
  `banksia.vault.keyring.v1|blog|period`.
- **Payload:** AES-256-GCM encrypt the plaintext with `K_kid`; AAD =
  `banksia.vault.content.v1|blog|permlink|kid|mode`.
- **Canonical JSON:** sorted keys, no whitespace, UTF-8, no floats.
- **Domain separation:** every signed/hashed context has a distinct prefix.
- **IV:** 12 random bytes per encryption; never reuse with the same key.
- **Hash:** SHA-256 of the plaintext, base64url or `sha256:` hex.
- **Tamper:** AES-GCM tag failure and hash mismatch must throw a typed error;
  the UI shows a safe error, never partial plaintext.
- **Base64url:** no padding; helpers in `vaultCrypto.js`.

Suggested module API (the orchestrator may refine, but keep it stable for
parallel agents):

```js
// vaultCrypto.js
export async function generateReaderKeyPair({ extractable = false })
export async function importReaderPublicKey(rawOrJwk)
export async function exportReaderPublicKey(key)
export async function readerKeyThumbprint(publicKey)
export async function sealKeyring(keyring, ringKey, context)
export async function openKeyring(sealed, ringKey, context)
export async function wrapRingKey(ringKey, readerPublicKey, header)
export async function unwrapRingKey(entry, readerPrivateKey, header)
export async function encryptPayload(plaintext, contentKey, header)
export async function decryptPayload(payload, contentKey, header)
export async function randomKey()
export async function sha256Base64Url(value)
```

```js
// vaultGrant.js
export function canonicalJson(value)
export function buildGrantHeader(entry, context)
export async function signGrant(grant, signerAdapter)
export async function verifyGrant(grant, verifierAdapter)
export async function verifyDelegation(cert, creatorPostingKeys, verifierAdapter)
export function isGrantValid(grant, { blog, period, rkt, now })
export function parseBulletin(jsonMetadata)
```

The signer/verifier adapter keeps unit tests pure. Wire the Hive adapter with
`hive-tx` (`utils.signMessage` / `PublicKey.verify`) or the existing
`signBufferData` plus posting public keys. The adapter is injectable; tests use
a deterministic test key.

### 3.8 Authority matrix

| Action | Signer | Authority |
| --- | --- | --- |
| Enable/disable/settings/product/container | Creator | **Posting** (`account_update2` with `json_metadata: ""`) |
| Publish premium post / bulletin | Creator | **Posting** (`comment`) |
| Subscribe / cancel | Reader | **Active** (`recurrent_transfer` / `transfer`) |
| Register reader key | Reader | **Posting** (`custom_json`) |
| Read/unlock | Nobody | **None** |
| Re-issue grant | Creator | **Posting** |

The creator never needs an active key to receive money. The reader only needs an
active key to pay.

---

## 4. UX contract

### 4.1 Creator

- `/settings/blog` → Vault section:
  - enable; price; recurrence; executions; archive; watermark.
  - "Generate vault" → passphrase; show the recovery/export step.
  - "Publish membership product" → queues a `comment` with HOM metadata.
  - "Publish grant container" → queues a hidden `comment`.
  - "Copy product link"; "Open dashboard".
- Composer:
  - "Members only" toggle.
  - "Lock from here" inserts `<!--banksia:vault-->`.
  - Preview shows public/premium split and a lock badge.
  - "Preview as reader" decrypts locally with the creator key.
  - Size meter: plaintext bytes, ciphertext estimate, inline/companion advice.
  - Warning if the premium section contains images (URLs are still public).
  - On publish: encrypt, set metadata, keep the teaser + marker, queue one
    `comment`.
- Dashboard `/settings/blog/vault`:
  - overview: members, MRR, new/canceled, renewals due, failed payments,
    grant latency.
  - subscribers table: account, plan, next payment, grant status, last bulletin,
    actions (re-issue, revoke, copy cancel link).
  - bulletins: current period/seq, entries, size, publish/update.
  - keys: current ring key (masked), keyring, rotate, export, import.
  - content: premium posts, kid, size, re-encrypt/migrate.
  - revenue CSV.
  - settings.
- Reader `/subscriptions`:
  - active plans, next payment, amount, cancel.
  - payment history.
  - reader keys/devices; export recovery code.
  - restore access.

### 4.2 Reader

- Paywall card:
  - title, value proposition, price + USD estimate, benefits.
  - primary "Subscribe"; secondary "Already a member? Restore access".
  - "Cancel anytime"; "Powered by Hive".
- Subscribe dialog:
  - plan, amount, recurrence, recipient (`@account` derived from chain), total
    number of payments, "what happens next", terms checkbox.
  - approve → "Payment sent. Unlocking…" with poll/retry.
- Unlock:
  - inline, no reload; "Member" badge; watermark `Licensed to @reader · period`.
  - `aria-live="polite"` announcement; focus stays usable.
- States:
  - no key → paywall.
  - payment sent, no grant → "Payment received — unlocking…" (2-minute poll,
    retry, cancel link).
  - expired → "Your membership ended on …" + renew.
  - bulletin unavailable → "Could not verify your membership" + retry; no
    cached plaintext.
  - invalid signature → "This grant could not be verified" + report.
  - tampered payload → "This content could not be unlocked" + report.
  - offline → clear retry; no stale plaintext.

### 4.3 SEO and accessibility

- JSON-LD: `isAccessibleForFree: false` and `hasPart` `WebPageElement` with
  `cssSelector: ".banksia-locked"`.
- Same teaser for crawlers and logged-out readers; no cloaking.
- RSS/OG include the teaser only.
- One page-level `h1`; paywall is a semantic region with a heading and real
  buttons.
- Axe at 1440×900 and 390×844.
- Reduced motion; no horizontal overflow at 390px.

---

## 5. File ownership and module boundaries

Assign **exclusive** files to agents. The orchestrator owns shared-file edits.

| Agent | Exclusive files | Deliverable |
| --- | --- | --- |
| **A. Protocol core** | `src/services/vaultCrypto.js`, `src/services/vaultGrant.js`, `src/services/vaultPayload.js`, `tests/unit/vault-crypto.spec.js`, `tests/unit/vault-grant.spec.js`, `tests/unit/vault-payload.spec.js`, draft `docs/integrations/vault-protocol.md` | Pure crypto/grant/payload modules + test vectors |
| **B. Settings + payments** | `src/services/vaultSettings.js`, `src/services/blogSettings.js`, `src/config/blog.js`, `src/services/vaultProduct.js`, `src/services/vaultPayments.js`, `tests/unit/vault-settings.spec.js`, `tests/unit/vault-payments.spec.js` | Blog schema, product build/parse, memo build/parse, payment verification, subscriber derivation |
| **C. Composer + publish** | `src/pages/compose.vue`, `src/services/publish.js`, `src/services/drafts.js`, `tests/unit/vault-publish.spec.js` | Premium toggle/marker, encryption on publish, metadata, size checks |
| **D. Reader + paywall** | `src/components/blog/VaultPaywall.vue`, `VaultLockedSection.vue`, `VaultSubscribeDialog.vue`, `src/stores/vault.js`, `src/pages/blog/BlogPost.vue`, `src/pages/post.vue`, `src/services/blogPosts.js`, `tests/unit/vault-render.spec.js` | Paywall, unlock, watermark, SEO, filter product/container from archive |
| **E. Subscribe + dashboard** | `src/pages/pay.vue` (or new `src/pages/subscribe.vue` if dirty), `src/pages/blogVault.vue`, `src/pages/subscriptions.vue`, `src/services/vaultBulletin.js`, `src/router/routes.js`, `tests/unit/vault-bulletin.spec.js`, `tests/unit/vault-subscribe.spec.js` | Subscribe/cancel flow, bulletin publish, dashboard, reader manager |
| **F. Tests + a11y** | `e2e/vault.spec.js`, `tests/unit/vault-integration.spec.js`, `e2e/fixtures.js` (only if needed) | E2E, axe, fixtures, error states, coverage review |
| **G. Security + docs** | `docs/SECURITY.md`, `docs/workstreams/W89-premium-memberships.md`, `docs/ROADMAP.md`, final `docs/integrations/vault-protocol.md` | Threat model, key model, workstream record, protocol doc, roadmap |

The orchestrator owns integration of any file two agents need to touch. In this
plan the likely shared files are `src/router/routes.js` (E adds routes; D may
add a blog route) and `src/services/blogPosts.js` (D filters products/containers;
B may add a product helper). Assign each to one owner and have the other request
the change; do not let both edit it concurrently.

Rules:

- Agents do not commit, push, or run the full suite. They run their targeted
  tests and report.
- Agents do not edit files outside their ownership. If a shared-file change is
  needed, report it to the orchestrator.
- No new dependency without approval.
- The orchestrator reviews every agent diff; do not trust self-reports.

---

## 6. Orchestration plan

### Phase 0 — baseline (orchestrator)

1. `git status` and inspect the tree. The repository may contain in-progress W88
   shop changes; **do not revert or overwrite them**. If they overlap, stop and
   ask the operator.
2. Create a feature branch (`w89-vault`) from the current HEAD.
3. Run the baseline: `bun run lint`, `bun run test`. Record counts.
4. Confirm `bun run build` works before changes (or note the existing failure).

### Phase 1 — protocol + data (parallel)

Launch **A (protocol core)** and **B (settings + payments)** together. They
share the contract above; B can code against A's exported API without waiting.

When both report:

1. Review diffs.
2. Run targeted tests:
   `bunx vitest run tests/unit/vault-crypto.spec.js tests/unit/vault-grant.spec.js tests/unit/vault-payload.spec.js tests/unit/vault-settings.spec.js tests/unit/vault-payments.spec.js`.
3. Fix interface mismatches in the orchestrator.
4. Commit `feat(vault): protocol core and on-chain settings`.

### Phase 2 — compose + read + subscribe (parallel where possible)

- Launch **C (composer)** and **D (reader)** together, using A/B.
- Launch **E (subscribe/dashboard)** after B is stable (it consumes
  `vaultPayments` and `blogSettings`).
- C and D can run in parallel because their file sets do not overlap.
- E touches `pay.vue` (or `subscribe.vue`), routes and new pages; keep it
  separate from C/D.

When each reports:

1. Review diffs.
2. Run targeted tests for that slice.
3. Integrate shared-file changes one at a time.
4. Commit per slice:
   - `feat(vault): composer and encrypted publish`
   - `feat(vault): blog paywall and reader unlock`
   - `feat(vault): subscribe flow and creator dashboard`

### Phase 3 — verification (parallel)

Launch **F (E2E/a11y)** and **G (security/docs)** after C/D/E are integrated.

F:

- Build E2E fixtures that mock Hive reads and the payment history.
- Cover: creator enable/publish; logged-out paywall; simulated payment → grant →
  unlock; reload persists; expiry locks; cancel stops next period; restore with a
  second key; error states.
- Axe at 1440×900 and 390×844.
- Check no plaintext in the DOM when locked.

G:

- Review the implementation against the threat model and key model.
- Update `docs/SECURITY.md` with the vault key hierarchy, storage, signing,
  no-plaintext rule, and the blog-host read-only rule.
- Write `docs/workstreams/W89-premium-memberships.md`.
- Finalize `docs/integrations/vault-protocol.md`.
- Update `docs/ROADMAP.md` (W89 done, next W90).

### Phase 4 — full gate and ship (orchestrator)

Before launching any subagent: use `agent: general` for A–G; `agent: explore`
only for read-only reconnaissance. Do not use the rp1 build agents for this
feature.

1. `bun run lint`
2. `bun run test`
3. `bun run build`
4. `bun run test:e2e` (fast Obscura)
5. `bun run test:e2e:full` (Chromium release gate)
6. `bun run perf:check`
7. Axe at 1440×900 and 390×844 for `/blogs`, a blog post, the paywall, the
   subscribe dialog, `/subscriptions`, `/settings/blog/vault`.
8. Live smoke on a test account:
   - enable Vault; publish a product and container;
   - publish a premium post;
   - subscribe with a small amount (testnet or live, operator approval);
   - confirm the grant and unlock;
   - reload; confirm persistence;
   - cancel; confirm next-period lock;
   - restore; confirm re-issue.
9. Deploy with `./scripts/deploy.sh`; verify with
   `bun run verify:deploy`; record the backup path.
10. Commit and push only after the operator approves. Report:
    - unit/E2E counts;
    - build/deploy status and backup path;
    - axe results;
    - any known limitations.

### Dependency graph

```text
A (crypto/payload) ─┬─> C (composer) ─┐
                    └─> D (reader)  ─┼─> F (E2E/a11y) ─> orchestrator gate
B (settings/pay) ───┬─> E (subscribe)┘
                    └─> G (docs/security)
```

If a subagent is blocked, the orchestrator resolves the interface or reassigns
the slice; do not let an agent wander into another agent's files.

---

## 7. Subagent briefs

Copy these into `subagent` calls. Each brief is self-contained; include the
ownership and acceptance criteria.

### A — Protocol core

```text
You are the protocol-core engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.2–5.6 especially)
- docs/prompts/W89-vault-build-prompt.md
- src/services/hiveTx.js, src/services/blogSettings.js, src/services/publish.js

Own ONLY these files:
- src/services/vaultCrypto.js
- src/services/vaultGrant.js
- src/services/vaultPayload.js
- tests/unit/vault-crypto.spec.js
- tests/unit/vault-grant.spec.js
- tests/unit/vault-payload.spec.js
- draft docs/integrations/vault-protocol.md (G finalizes)

Deliver:
1. WebCrypto-only P-256 ECDH, HKDF-SHA256, AES-256-GCM helpers per §3.7.
2. Keyring seal/open, ring-key wrap/unwrap, payload encrypt/decrypt, thumbprint,
   canonical JSON, sha256, base64url, typed errors.
3. Grant/bulletin parsing and validation; signer/verifier adapters so tests are
   pure.
4. Payload marker split/join and size/chunk helpers for section and whole-post
   modes.
5. Test vectors: fixed P-256 keys, fixed AES/HKDF vectors, tamper/wrong-key/
   wrong-AAD cases, grant sign/verify, expiry, canonical JSON stability.
6. Draft protocol doc with schemas and test vectors.

Do not:
- touch UI, blogSettings, publish, pay, or routes;
- add dependencies;
- use memo-key encryption;
- run the full suite, commit, or push.

Report: files changed, targeted test command/result, open questions, risks.
```

### B — Settings + payments

```text
You are the settings-and-payments engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.3, §5.4, §5.13)
- docs/prompts/W89-vault-build-prompt.md
- src/services/blogSettings.js, src/config/blog.js, src/services/blogShop.js
  (read-only reference; do not edit it if W88 is dirty),
  src/services/accountMetadata.js, src/services/hiveOperations.js,
  src/services/chainData.js, src/pages/pay.vue

Own ONLY these files:
- src/services/vaultSettings.js
- src/services/blogSettings.js
- src/config/blog.js
- src/services/vaultProduct.js
- src/services/vaultPayments.js
- tests/unit/vault-settings.spec.js
- tests/unit/vault-payments.spec.js

Deliver:
1. Strict `blog.vault` schema (default, normalize, read, size check); add `vault`
   to BLOG_KEYS; keep the 12 KB blog cap; no private material.
2. `vaultProduct.js`: HOM product metadata builder/parser for the membership
   product. Reuse the existing parser as a reference, but do not edit
   `blogShop.js` while W88 is in progress.
3. Payment memo build/parse: product + banksia.reader_key/sub/gift_for.
4. Recurrent transfer and cancel builders; one-time transfer builder.
5. Payment verification for `transfer` and `fill_recurrent_transfer`; amount,
   currency, recipient, memo, tx uniqueness, plan expiry; subscriber derivation.
6. Tests with fixtures for valid/invalid memos, wrong amount, wrong recipient,
   duplicate tx, failed recurrent transfer, cancel.

Do not:
- touch UI, composer, publish, or routes;
- add dependencies;
- use active keys for posting actions;
- run the full suite, commit, or push.

Report: files changed, targeted test command/result, open questions, risks.
```

### C — Composer + publish

```text
You are the composer engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.3, §5.4, §6.1)
- docs/prompts/W89-vault-build-prompt.md
- src/pages/compose.vue, src/services/publish.js, src/services/drafts.js,
  src/services/queue.js, A's vaultCrypto/vaultPayload APIs

Own ONLY these files:
- src/pages/compose.vue
- src/services/publish.js
- src/services/drafts.js
- tests/unit/vault-publish.spec.js

Deliver:
1. "Members only" toggle and "Lock from here" marker in the composer.
2. Draft fields: premium, premiumMode, public/premium split; local plaintext
   warning on export.
3. On publish: split body, encrypt premium payload with K_kid, build
   `banksia_vault` metadata, keep teaser + marker, queue one `comment`.
4. Preserve `banksia_vault` on edit; re-encrypt when premium content changes.
5. Size checks: 65,535 body, inline ciphertext ≤ ~40 KB, companion-comment path
   above that; clear errors.
6. Preview as reader (local decrypt) and a media-URL warning.
7. Tests for split/encrypt/publish metadata/edit/size.

Do not:
- touch the paywall reader, pay page, dashboard, or routes;
- add dependencies;
- use active keys for publishing;
- run the full suite, commit, or push.

Report: files changed, targeted test command/result, open questions, risks.
```

### D — Reader + paywall

```text
You are the reader/paywall engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.6, §5.8–5.11, §6.2, §6.10)
- docs/prompts/W89-vault-build-prompt.md
- src/pages/blog/BlogPost.vue, src/pages/post.vue, src/components/render.vue,
  src/stores/blog.js, src/services/blogPosts.js, src/components/smartlock/*,
  A's vaultCrypto/vaultGrant/vaultPayload APIs, B's vaultSettings

Own ONLY these files:
- src/components/blog/VaultPaywall.vue
- src/components/blog/VaultLockedSection.vue
- src/components/blog/VaultSubscribeDialog.vue
- src/stores/vault.js
- src/pages/blog/BlogPost.vue
- src/pages/post.vue
- src/services/blogPosts.js
- tests/unit/vault-render.spec.js

Deliver:
1. Reader key lifecycle: generate, import/export, store encrypted/non-extractable,
   per-origin; clear errors.
2. Paywall and inline unlock for section and whole-post modes.
3. Bulletin fetch/verify/unwrap/keyring decrypt; expiry/tamper/wrong-key/offline
   states.
4. Watermark; `aria-live`; semantic region; no plaintext in the DOM when locked.
5. SEO JSON-LD `isAccessibleForFree`/`hasPart`; RSS/OG teaser; no cloaking.
6. Filter the membership product and container out of the blog archive.
7. Sanitize decrypted HTML via Render/DOMPurify; no raw v-html.
8. Tests for locked/unlocked, expiry, tamper, wrong key, SEO metadata.

Do not:
- touch the composer, pay page, dashboard, or routes;
- add dependencies;
- store plaintext/keys in localStorage, the service worker, logs or analytics;
- run the full suite, commit, or push.

Report: files changed, targeted test command/result, open questions, risks.
```

### E — Subscribe + dashboard

```text
You are the subscribe/dashboard engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.4, §5.5, §5.13, §6.1–6.5)
- docs/prompts/W89-vault-build-prompt.md
- src/pages/pay.vue (read-only reference if dirty), src/services/blogShop.js
  (read-only reference if W88 is dirty), src/services/chainData.js,
  src/services/queue.js, B's vaultPayments/vaultSettings, A's vaultGrant

Own ONLY these files:
- src/pages/pay.vue (only if not dirty; otherwise create `src/pages/subscribe.vue`)
- src/pages/subscribe.vue (fallback if pay.vue is dirty or W88 is in flux)
- src/pages/blogVault.vue
- src/pages/subscriptions.vue
- src/services/vaultBulletin.js
- src/router/routes.js
- tests/unit/vault-bulletin.spec.js
- tests/unit/vault-subscribe.spec.js

Deliver:
1. Extend `/pay` (or the new `/subscribe`) for the membership product: show
   @creator, amount, recurrence, 12 payments, cancel-anytime; queue
   recurrent_transfer or transfer with the reader key memo. Never trust URL
   price/recipient. If `pay.vue` is dirty from W88, leave it alone and build the
   new page.
2. Creator dashboard: overview, subscribers, payments, grants, bulletins,
   keys, content, revenue CSV, settings links.
3. Grant issuance: verify payments, seal keyring, wrap K_ring, sign bulletin,
   publish comment under the container; deterministic permlink; idempotent
   seq.
4. Reader `/subscriptions`: active plans, next payment, cancel, payment history,
   keys/devices, restore.
5. Cancel builder; re-issue; restore; error states.
6. Tests for memo, recurrent/cancel, bulletin build/parse, grant issuance,
   restore.

Do not:
- touch the composer, blog post rendering, or crypto modules;
- add dependencies;
- custody funds or keys;
- run the full suite, commit, or push.

Report: files changed, targeted test command/result, open questions, risks.
```

### F — Tests + a11y

```text
You are the test/a11y engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.11, §9.5)
- docs/prompts/W89-vault-build-prompt.md
- e2e/blog.spec.js, e2e/helpers.js, e2e/fixtures.js
- the implemented Vault modules

Own ONLY these files:
- e2e/vault.spec.js
- tests/unit/vault-integration.spec.js
- e2e/fixtures.js (only if needed)

Deliver:
1. E2E fixtures for a claimed blog, premium post, product, container, bulletin,
   payment history, and a reader key.
2. Scenarios: enable/publish; logged-out paywall; payment → grant → unlock;
   reload persists; expiry locks; cancel stops next period; restore with a
   second key; error states (no bulletin, bad signature, tampered payload,
   offline).
3. Assert no plaintext in the DOM or network when locked.
4. Axe at 1440×900 and 390×844 for blog post, paywall, subscribe dialog,
   dashboard, subscriptions.
5. Cross-cutting unit tests for entitlement, canonical JSON, and size limits.

Do not:
- change product code; report bugs to the orchestrator;
- add dependencies;
- run the full suite, commit, or push.

Report: files changed, commands/results, bugs found, coverage gaps.
```

### G — Security + docs

```text
You are the security/docs engineer for W89 Banksia Vault.

Read first:
- docs/research/members-only-content.md (§5.11–5.13, §8, §9.7)
- docs/SECURITY.md, docs/ROADMAP.md
- the implemented Vault modules and diffs

Own ONLY these files:
- docs/SECURITY.md
- docs/workstreams/W89-premium-memberships.md
- docs/ROADMAP.md
- docs/integrations/vault-protocol.md (finalize A's draft)

Deliver:
1. Security review: key hierarchy, storage, signing, CSP, no plaintext/keys in
   logs/storage/service worker, blog-host read-only, custom-domain rule,
   phishing/recipient derivation, replay, media leak, revocation limits.
2. `docs/SECURITY.md` Vault section and threat table.
3. `docs/workstreams/W89-premium-memberships.md` with scope, components,
   authorities, verification, counts, deploy notes and remaining work.
4. Final protocol doc with schemas, test vectors, versioning and interop notes.
5. Roadmap update (W89 done, next W90).

Do not:
- change product code; report issues to the orchestrator;
- add dependencies;
- run the full suite, commit, or push.

Report: files changed, review findings, open risks, doc locations.
```

---

## 8. Verification and acceptance

### Commands

```bash
bun run lint
bun run test
bun run build
bun run test:e2e
bun run test:e2e:full
bun run perf:check
```

### Required checks

- Unit: crypto round-trip, tamper/wrong key/wrong AAD, keyring seal/open,
  ring-key wrap/unwrap, grant sign/verify, delegation verify, expiry,
  canonical JSON, memo build/parse, payment verification, payload size/chunking,
  entitlement, rendering, no plaintext in the DOM.
- E2E: enable/publish, paywall, payment → grant → unlock, reload, expiry, cancel,
  restore, error states.
- Axe: 1440×900 and 390×844.
- Performance: Vault chunk lazy-loaded; initial bundle budget unchanged.
- Security: no plaintext/keys in localStorage (except encrypted), service
  worker, logs, analytics; DOMPurify on decrypted HTML; CSP unchanged or
  stricter.
- Authority: posting vs active exactly as §3.8; `account_update2` keeps
  `json_metadata: ""`.
- Limits: 12 KB blog object, 65,535 body, 8 KB custom_json, ~65 KB comment,
  65,536 transaction.
- No regressions in existing blog/shop/pay tests.

### Definition of done

- All commands green.
- Axe green at both widths.
- Live smoke complete (enable, publish, pay, unlock, reload, cancel, expire,
  restore).
- Deploy + `bun run verify:deploy` green; backup path recorded.
- `docs/workstreams/W89-premium-memberships.md` written.
- `docs/integrations/vault-protocol.md` published.
- `docs/SECURITY.md` updated.
- `docs/ROADMAP.md` updated.
- Unit/E2E counts and deploy status reported.
- Commit and push only after operator approval; clean tree.

---

## 9. Pitfalls and constraints

1. **Do not use memo-key encryption.** The memo is limited to 2,048 bytes and
   uses unauthenticated AES-CBC. Use the Vault key hierarchy.
2. **Do not put entitlement in blog metadata.** The blog object advertises the
   plan; the signed grant is the capability.
3. **Do not trust `blog.vault.price`.** Fetch the HOM product post and derive the
   amount, recipient and recurrence; the `/pay` page already follows this rule.
4. **Do not render decrypted HTML raw.** Use `Render` / DOMPurify; no `v-html`.
5. **Do not cache plaintext.** No service worker, `localStorage` plaintext,
   analytics, or logs. Keys encrypted/non-extractable only.
6. **Do not store keys on custom domains.** Custom domains stay read-only;
   premium content reads on the apex.
7. **Do not add server custody or a platform balance.** Payments go direct.
8. **Do not use active keys for posting actions.** The authority matrix is law.
9. **Do not drop `banksia_vault` on edit.** Other frontends may strip it; warn
   and repair.
10. **Do not forget the product/container filter.** The blog archive must not
    show the membership product or the hidden container.
11. **Do not assume the HF28 cancel matching rule.** Test it on testnet.
12. **Do not promise encrypted media.** Text-only MVP; premium image URLs leak.
13. **Do not ignore the self-sovereign gap.** A reader can pay while the creator
    is offline; the subscribe dialog must set expectations and offer cancel.
14. **Do not revert the in-progress W88 shop work.** Inspect git status first.

---

## 10. First actions (checklist)

- [ ] Read the research doc and the files in §1.
- [ ] `git status`; protect any in-progress W88 changes.
- [ ] Create `w89-vault` branch/worktree.
- [ ] Run baseline lint/test; record counts.
- [ ] Launch A and B in parallel with the briefs in §7.
- [ ] Review/integrate A+B; run targeted tests; commit.
- [ ] Launch C, D, E; review/integrate; run targeted tests; commit per slice.
- [ ] Launch F and G; integrate; run the full gate.
- [ ] Live smoke; deploy; verify; docs; commit/push after approval.
- [ ] Report counts, deploy status, backup path, known limitations.

---

## Appendix — exact schemas and commands

### Blog vault

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

### Post vault

```json
{
  "banksia_vault": {
    "v": 1,
    "mode": "section",
    "alg": "A256GCM",
    "kid": "2026-11",
    "iv": "base64url",
    "ct": "base64url",
    "hash": "sha256:...",
    "bytes": 18432,
    "tier": "member",
    "price": "5.000 HBD",
    "product": "alice/membership",
    "container": "banksia-vault",
    "paywall": {
      "title": "Members-only",
      "body": "This section is for members.",
      "benefits": ["New essays every week", "Full archive", "Monthly Q&A"]
    }
  }
}
```

### Memo

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

### Bulletin

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
        "epk": "base64url",
        "iv": "base64url",
        "ct": "base64url",
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

### Useful commands

```bash
bun run dev
bun run lint
bun run test
bun run test:coverage
bun run build
bun run test:e2e
bun run test:e2e:full
bun run perf:check
bun run verify:deploy
./scripts/deploy.sh
```

### Useful test fixture shapes

```js
// account with a claimed blog and a posting key
const ACCOUNT = {
  name: 'alice',
  posting: { key_auths: [['STM...', 1]], account_auths: [], weight_threshold: 1 },
  posting_json_metadata: JSON.stringify({
    profile: { name: 'Alice' },
    'banksia.io': { blog: { version: 1, claimed: true, title: 'Alice writes', vault: { /* ... */ } } }
  })
}

// payment history rows
const FILL = ['fill_recurrent_transfer', {
  from: 'bob', to: 'alice', amount: '5.000 HBD',
  memo: '{"product":"alice/membership","quantity":1,"banksia":{...}}',
  remaining_executions: 11
}]

const TRANSFER = ['transfer', {
  from: 'bob', to: 'alice', amount: '5.000 HBD',
  memo: '{"product":"alice/membership","quantity":1,"banksia":{...}}'
}]
```

---

*End of W89 build prompt.*
