# Banksia Vault protocol (`banksia.vault@1`)

**Status: final v1 specification, 2026-11-28.** The protocol is implemented,
unit-tested, browser-tested and live-smoked in this repository. Relay/delegation,
encrypted media, multi-tier and claim codes are reserved but not implemented; see
§15. A security-audit checklist is in §17 and a frontend implementation
checklist is in §18.

This document specifies the wire format and cryptographic constructions for
Banksia Vault, the members-only content protocol for Banksia blogs. It is the
interop contract for any Hive frontend that wants to read a Banksia paywall, and
the reference for the Banksia implementation in:

- `src/services/vaultCrypto.js`
- `src/services/vaultGrant.js`
- `src/services/vaultPayload.js`
- `src/services/vaultKeys.js`

The design rationale, threat model and product decisions live in
[`docs/research/members-only-content.md`](../research/members-only-content.md).
This file is the build contract: exact schemas, byte layouts, AAD strings, limits
and test vectors.

---

## 0. Conformance

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are
normative. A conforming implementation falls into one or more classes:

| Class | Must be able to |
| --- | --- |
| **Reader** | Detect `banksia_vault`, fetch and verify the bulletin, unwrap the ring key, verify/decrypt the payload, and render only the teaser when locked. |
| **Issuer** | Verify a payment, seal the keyring, wrap `K_ring` to each reader, sign the bulletin and publish it under the container. |
| **Writer** | Encrypt a section or whole post, write the public teaser and the `banksia_vault` metadata, and preserve Vault metadata on edit. |
| **Product host** | Publish/parse the HOM membership product and derive payment terms from it. |

A reader that cannot verify a signature, AAD binding or expiry MUST fail closed:
show the paywall or a generic error, never partial plaintext. Unknown optional
fields MAY be ignored; unknown `v`, `alg`, `mode` or signature prefixes MUST be
rejected. The protocol is deliberately small enough that a reader needs only
Hive RPC reads and WebCrypto.

---

## 0.1 Explain like I'm 5

Imagine you write a secret diary and want friends to read it for 5 HBD a month,
without hiring a security guard or building a clubhouse.

1. **The locked box.** You put the members-only text in a strong digital safe
   (AES-256-GCM) and leave a free teaser outside. Everyone can see the teaser and
   the locked box; only key holders can open it.
2. **The keychain.** Each month you make a fresh content key for that month's
   posts. You keep the monthly keys together in a keyring, and seal that keyring
   with a separate monthly ring key.
3. **The ticket.** A reader's browser makes a personal padlock-and-key pair
   (P-256). They pay you in HBD and put their **open padlock** (public key) in the
   payment memo.
4. **Handing over the key.** You verify the payment, seal the keyring once, and
   make a copy of the ring key that only opens with that reader's padlock. You
   publish the sealed keyring plus all the wrapped ring keys in a **bulletin**,
   signed with your Hive posting key.
5. **Reading the diary.** The reader's browser verifies your signature, uses
   their private key to open their copy of the ring key, decrypts the keyring,
   picks the content key for the post, and decrypts the text locally.

There is no Banksia server in the middle and no platform balance. The chain
stores the locked box, the wrapped keys and your signature. The trade-off is
that someone must issue the bulletin: in v1 that is your open dashboard (or an
auto-issuing tab), with a relay reserved for later. It is not DRM: a subscriber
can screenshot or re-share text, and media URLs are not encrypted.

---

## 1. Scope

Vault has three jobs:

1. **Confidentiality.** Encrypt a premium section, or a whole post, before it is
   published. The plaintext never reaches a Banksia server.
2. **Entitlement.** Deliver the period key to a reader only through a
   creator-signed grant, derived from a verified on-chain payment.
3. **Portability.** Let a reader unlock without a Banksia account, and let any
   Hive frontend implement the same checks.

Payments are ordinary HBD `transfer` / `recurrent_transfer` operations. The
payment memo, the public post, the bulletin comment and the encrypted metadata
are the entire protocol. There is no Banksia server in the read path.

**Non-goals for v1:** encrypted media, multi-tier entitlements, trials, gifts,
claim codes, annual passes, metered paywalls, relay-hosted decryption, and any
server-side key custody.

---

## 2. Versioning and compatibility

- Protocol identifier: `banksia.vault@1`.
- Every on-chain object that carries a version uses `"v": 1`: blog `vault`,
  post `banksia_vault`, the payment memo's `banksia` object, the bulletin,
  the reader registry and the delegation certificate.
- Readers MUST ignore unknown **sibling** fields they do not need, but MUST
  reject an object whose `v` is not `1`. Unknown fields never grant access.
- `alg` values are exact, case-sensitive strings:
  - `A256GCM` — AES-256-GCM for payloads and the sealed keyring.
  - `P256-HKDF-SHA256-A256GCM` — the complete P-256 ECDH + HKDF-SHA256 +
    AES-256-GCM ring-key wrap. `A256GCM` is accepted on unwrap for leniency;
    new writers use the full construction name.
  - The creator/recovery envelope uses `PBKDF2-SHA256-A256GCM`.
  A reader MUST reject an unknown algorithm rather than guessing.
- Additive, backwards-compatible changes keep `v: 1`. Examples: a new optional
  display hint, a new optional bulletin field a reader may ignore, or a new
  `alg` that old readers reject while continuing to read old objects.
- A change that alters the meaning of a signed field, the AAD/HKDF input, the
  canonical-JSON rules, or the signature payload takes a new `v` **and** a new
  identifier (`banksia.vault@2`). Mixed-version readers must fail closed on the
  object they cannot verify.
- Writers MUST preserve `banksia_vault` and `banksia_vault_product` metadata
  they do not own when editing a post, unless the premium payload is
  deliberately re-encrypted or Vault is deliberately switched off.
- Unknown keys are rejected by the Banksia validators for creator-owned objects
  (`blog.vault`) so a newer client cannot silently lose configuration on the
  next write. Read paths are more lenient as described above.

---

## 3. Roles and authority matrix

| Action | Signer | Authority | Operation |
| --- | --- | --- | --- |
| Enable/disable Vault, price, product/container pointers | Creator | **Posting** | `account_update2` with `posting_json_metadata` and `json_metadata: ""` |
| Publish the membership product | Creator | **Posting** | `comment` (no `comment_options` required) |
| Publish the hidden grant container | Creator | **Posting** | `comment` as a reply under the product |
| Publish a premium post | Creator | **Posting** | `comment` with `json_metadata.banksia_vault` |
| Publish or replace a bulletin (self-sovereign) | Creator | **Posting** | `comment` under the container |
| Publish a bulletin (relay) | Relay account | **Posting** (relay's own key) | `comment` + delegation certificate — **reserved, not implemented** |
| Subscribe (recurring) | Reader | **Active** | `recurrent_transfer` |
| Subscribe (one month / gift) | Reader | **Active** | `transfer` |
| Cancel | Reader | **Active** | `recurrent_transfer` with amount `0.000 HBD` for the matching plan |
| Register another reader key | Reader | **Posting** | `custom_json` `banksia.vault.reader_key` |
| Read / unlock | Nobody | **None** | Local decryption |
| Re-issue a grant | Creator / relay | **Posting** | New bulletin comment |

The creator never needs an active key to receive money. The relay never needs
the creator's key or any funds. The reader only needs an active key to pay.

The v1 beta's **auto-issue** is a client behaviour, not a new on-chain operation:
while the creator dashboard is open, visible and the vault is unlocked, it polls
payments and publishes the same posting-key-signed bulletin a manual click would.
A future relay performs the same bulletin publication from its own account with a
delegation certificate; it does not change the reader's verification rules.

---

## 4. Key hierarchy

| Key | Type | Lifetime | Where it lives | Purpose |
| --- | --- | --- | --- | --- |
| **Content key** `K_kid` | AES-256-GCM, 32 raw bytes | One period (`YYYY-MM`) | Inside the keyring; creator vault | Encrypt post payloads for that `kid` |
| **Keyring** | JSON `{ "<kid>": "<base64url K_kid>" }` | Grows with the archive | Creator vault; sealed per bulletin | Lets a reader decrypt current and past posts |
| **Ring key** `K_ring` | AES-256-GCM, 32 raw bytes | One period, rotated monthly | Creator vault; wrapped per reader | Seals the keyring blob |
| **Reader key** | P-256 ECDH | Long-lived per device/origin | Reader browser | Receives a wrapped `K_ring` |
| **Vault passphrase** | User secret | Long-lived | Password manager | Encrypts the creator vault at rest |
| **Grant signing key** | Hive posting key (secp256k1) or delegated relay key | Long-lived / scoped | Creator / relay signer | Authenticates bulletins and grants |

Rules:

- Vault keys are **never** derived from Hive posting, active or memo keys.
- The creator's posting key signs; it is never used as an encryption key.
- The reader key is not a Hive account key. A reader may pay from any Hive
  account, including a custodial wallet, as long as the memo carries their
  public key.
- Every period has a fresh `K_kid` and a fresh `K_ring`. Old keyring entries are
  retained so members can read the archive.
- A reader key is per origin/device and may be recorded against the Hive account
  that created it. The Banksia beta auto-unlocks only when a signed-in reader
  matches that account; otherwise the reader must use the explicit Restore
  action. This is a local privacy policy, not an on-chain entitlement check.
- The creator's product copy (`productTitle`, `productDescription`, `benefits`)
  is public advertising metadata. It never contains keys or entitlement.

---

## 5. Canonical JSON

All signed and hashed objects use canonical JSON:

1. Object keys are sorted lexicographically by **UTF-16 code units**
   (`Object.keys(value).sort()`).
2. No insignificant whitespace.
3. `JSON.stringify`-compatible string escaping (quotes, backslashes, control
   characters; UTF-8 output).
4. Arrays preserve order; object key order is irrelevant.
5. Numbers MUST be finite integers. Floats, `NaN`, `Infinity`, `undefined`,
   functions, symbols, `BigInt`, non-plain objects and cyclic structures are
   rejected.
6. `null`, booleans, strings, arrays and plain objects only.

Examples:

```js
canonicalJson({ b: 1, a: { d: 'x', c: [true, null, 'é'] }, n: -2 })
// {"a":{"c":[true,null,"é"],"d":"x"},"b":1,"n":-2}

canonicalJson({ z: 1, a: 2 }) === canonicalJson({ a: 2, z: 1 }) // true
```

The canonical form is the exact UTF-8 byte sequence used for hashing, HKDF
`info`, AES-GCM AAD and signature payloads.

---

## 6. Encoding primitives

### 6.1 Base64url

- RFC 4648 §5 alphabet: `A-Z a-z 0-9 - _`.
- **No padding** on output. Decoders MAY accept padded input.
- A malformed string (wrong alphabet, impossible length) is an error; it must not
  be silently truncated.

### 6.2 Reader public key

Canonical form: `p256:` + base64url of the 65-byte uncompressed point
`0x04 || x(32) || y(32)`.

Importers MUST accept `p256:<b64>`, bare base64url, raw bytes, an EC P-256 JWK,
or a `CryptoKey`. Import is the on-curve validation: an off-curve point fails.

### 6.3 IVs and salts

- AES-GCM IV: exactly **12 random bytes**, fresh for every encryption.
- PBKDF2 salt: **16 random bytes** per envelope.
- AES-GCM tag: 128 bits, appended to the ciphertext by WebCrypto.

### 6.4 Hashes

- `sha256Bytes(value)`: SHA-256 over UTF-8 bytes (or raw bytes).
- `sha256Hex(value)`: lowercase hex.
- `sha256Base64Url(value)`: base64url, no padding.
- Plaintext hash field: `sha256:<64 lowercase hex>`. Readers MUST also accept a
  base64url-encoded 32-byte digest for interoperability.

---

## 7. On-chain structures

### 7.1 Blog metadata — `posting_json_metadata["banksia.io"].blog.vault`

Small, public, written with the posting key. It advertises the plan; it never
grants access and never contains keys.

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
  "productTitle": "Notes from the garden",
  "productDescription": "Weekly essays, field notes and the full archive.",
  "benefits": ["Weekly essays", "Full archive"],
  "updatedAt": "2026-11-27T00:00:00Z"
}
```

- Shares the 12 KB blog-object budget with CSS and blocks; the encoded vault
  object is capped at 1,200 bytes and should stay around 500.
- `price` is a **display hint only**. The HOM product post is the payment source
  of truth; never charge from this field.
- `product` is `author/permlink`; `container` is a permlink on the creator's
  account.
- `bulletin` is a pointer (`{author, permlink}`) because comment permlinks are
  scoped to their author.
- `productTitle` is ≤ 80 plain-text characters, `productDescription` ≤ 600
  plain-text characters (newlines allowed, no HTML), and `benefits` is an array
  of at most six unique plain-text strings of ≤ 80 characters. They are copy for
  the product/subscribe page, not entitlement.
- `price` is display copy; the product post's `price` and
  `subscription_recurrence` are normative for payment.
- No entitlement, grant, reader key or private material may appear here.

### 7.2 Post metadata — `json_metadata.banksia_vault`

```json
{
  "banksia_vault": {
    "v": 1,
    "mode": "section",
    "alg": "A256GCM",
    "kid": "2026-11",
    "iv": "base64url-12-bytes",
    "ct": "base64url-ciphertext",
    "hash": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
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

| Field | Rule |
| --- | --- |
| `v` | exactly `1` |
| `mode` | `section` or `post` |
| `alg` | exactly `A256GCM` |
| `kid` | `YYYY-MM` with month `01`–`12`; selects `K_kid` from the keyring |
| `iv` | required with `ct`; base64url of 12 bytes |
| `ct` | base64url ciphertext (including the 16-byte tag) |
| `parts` | array of companion-comment permlinks; mutually exclusive with `ct` |
| `hash` | `sha256:<hex>` (base64url digest also accepted) of the plaintext |
| `bytes` | plaintext UTF-8 byte length, non-negative integer |
| `tier` | display hint, default `member` |
| `price`, `product`, `container` | display/interop hints |
| `paywall` | `title ≤ 80`, `body ≤ 240`, `benefits ≤ 6 × 80` characters |

`mode: "section"`: the raw post body contains `<!--banksia:vault-->` where the
decrypted payload is inserted. Detect the marker in the **raw body before
rendering**; other frontends can ignore it.

`mode: "post"`: the public body is the teaser and the decrypted payload replaces
or follows it.

Explicit marker: `<!--banksia:vault-->` (ASCII, no attributes).

For a companion-comment payload, `parts` lists permlinks on the **post author's**
account. Part `N` is named `<post-permlink>-vault-N` (for example
`field-notes-vault-1`). The post permlink prefix namespaces the parts per post,
because a Hive permlink is unique per author and a bare `vault-payload-1` would
collide across posts. Each companion is a reply to the premium post and carries:

```json
{
  "banksia_vault_payload": {
    "alg": "A256GCM",
    "iv": "base64url-12-bytes",
    "ct": "base64url-ciphertext",
    "bytes": 28000,
    "hash": "sha256:...",
    "part": 1,
    "parts": 2
  }
}
```

Every part uses the same `K_kid` and the **same** content AAD as the whole post
(§9.4). Readers MUST decrypt every listed part, verify every part hash, reject
duplicate/out-of-range part indices, concatenate in canonical `part` order, and
verify the post-level `hash` (hex or base64url) and `bytes`. Implementations MUST
fail closed on a missing or extra part; partial plaintext is never rendered.

Metadata size is measured as the UTF-8 byte length of the JSON object.

### 7.3 Payment memo

Standard HOM memo plus a namespaced extension:

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

- Well under the 2,048-byte memo limit.
- `reader_key` is public. The private key never leaves the reader.
- Recurring: `to: alice`, `amount: "5.000 HBD"`, `recurrence: 730`,
  `executions: 12`.
- One-time: a normal `transfer` with the same memo.
- Cancel: `recurrent_transfer` with `amount: "0.000 HBD"` for the matching
  plan. Verified live on 2026-11-27 with the matching recipient, recurrence and
  memo (plan removed, tx `54f54837…`). The beta still warns in the confirmation
  dialog because a mismatched memo will not cancel.
- The recipient, amount and recurrence are derived from the on-chain product and
  blog account, never from URL parameters.
- `gift_for` is part of the v1 memo schema but gift issuance is not implemented
  in the beta; the creator dashboard excludes gift payments from subscriber
  rows.
- Grant issuance MUST reject a transaction id that has already been used for a
  grant (`duplicate`). The beta scans the creator's account history, keeps a
  `Set` of txids and builds one subscriber row per reader key from the newest
  payment; it has no separate server-side replay ledger.
- One-time `transfer` payments must be within the 40-day acceptance window, and
  a `fill_recurrent_transfer` must carry a non-negative
  `remaining_executions`.
- Amounts are Hive asset strings matching `^\d+\.\d{3} (HBD|HIVE)$`; v1 accepts
  **HBD only** and compares the exact canonical label, never a float.
- `recurrence` is 24–8,760 hours and `executions` is 2–120. Hive additionally
  caps a recurrent transfer's total lifetime; writers SHOULD keep
  `recurrence * executions` within 730 days.
- Grants are time-bound capabilities: readers MUST honor `expires` and MUST NOT
  use a payment timestamp as a substitute. Issuers SHOULD set a recurring
  grant's expiry to `payment_time + recurrence hours + 24 hours grace`, and a
  one-time transfer to `payment_time + 31 days`, so a slightly late renewal does
  not lock a member out. The exact `expires` is signed and visible in the
  bulletin; readers do not recompute it.

### 7.4 Bulletin comment — `json_metadata.banksia_vault_bulletin`

A comment under the hidden container. Deterministic permlink:
`vault-<period>-<seq>` or `vault-<period>-<seq>-<part>`.

```json
{
  "banksia_vault_bulletin": {
    "v": 1,
    "blog": "alice",
    "period": "2026-11",
    "seq": 3,
    "issued": "2026-11-27T12:00:00Z",
    "keyring": {
      "alg": "A256GCM",
      "iv": "base64url-12-bytes",
      "ct": "base64url-ciphertext"
    },
    "entries": [
      {
        "rkt": "a1b2c3d4e5f6a7b8",
        "alg": "P256-HKDF-SHA256-A256GCM",
        "epk": "base64url-65-byte-point",
        "iv": "base64url-12-bytes",
        "ct": "base64url-wrapped-ring-key",
        "tier": "member",
        "expires": "2026-12-27T12:00:00Z"
      }
    ],
    "claims": [],
    "signer": "alice",
    "delegation": null,
    "sig": "hex-signature"
  }
}
```

Validation:

- `v === 1`.
- `blog` is a valid Hive account name.
- `period` matches `/^\d{4}-(?:0[1-9]|1[0-2])$/`.
- `seq` is an integer `>= 1`.
- `keyring` is an object with `iv` and `ct` strings; `alg` defaults to `A256GCM`.
- `entries` is an array. Malformed entries are dropped; `rkt` is 16 lowercase hex
  characters in the canonical form.
- `claims` defaults to `[]`.
- `signer` is the creator account or the relay's `p256:` public key.
- `delegation` is the delegation certificate hash/object when the signer is a
  relay, otherwise `null`.
- **Signer binding.** For a self-signed bulletin, `signer` MUST equal `blog`
  (case-insensitively) and the signature MUST verify against that account's
  posting authority. A bulletin whose `signer` is a different Hive account is
  valid only with a delegation certificate that verifies against the blog's
  posting keys and names the signer. The v1 beta rejects delegated bulletins
  (`delegation !== null`) and must not accept an arbitrary third-party signer;
  see §15.6.

`keyring.ct` is the sealed keyring blob, stored **once per bulletin**, not once
per reader. `entries[].ct` is the wrapped `K_ring` (≈200 bytes), not the keyring.

Signature payload (UTF-8):

```text
banksia.vault.bulletin.v1|<canonicalJson(bulletinPayloadObject)>
```

`bulletinPayloadObject` is the bulletin **without `sig`**, with
`keyringHash = "sha256:" + hex(SHA-256(canonicalJson(keyring)))` inserted when a
keyring is present. `entries` are included verbatim. Verifiers MUST recompute
`keyringHash` from the received keyring and MUST ignore any inbound
`keyringHash`; an attacker-controlled hash is never trusted. Because the
keyring and entries are covered directly, swapping either invalidates the
signature.

A new subscriber creates a new `seq` with the full entry list (idempotent, easy
to audit). Above roughly 150–300 entries or ~60 KB, split the bulletin into
parts and publish `vault-<period>-<seq>-1`, `-2`, …. Bulletin splitting is
reserved but **not implemented** in v1; the dashboard hard-caps a single
bulletin at 300 entries and warns above 250.

### 7.5 Reader key registry — `custom_json` id `banksia.vault.reader_key`

Optional, post-MVP. Signed by the reader's posting key.

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

The creator's dashboard reads the latest registry and wraps to every active key.
Standard `custom_json` limits apply (8,192 bytes).

### 7.6 Delegation certificate

Published in `blog.vault.relay` and referenced by relay bulletins. Signed with
the creator's posting key.

```json
{
  "v": 1,
  "id": "banksia.vault.delegate",
  "blog": "alice",
  "delegate": "p256:...",
  "scope": ["grant", "bulletin"],
  "notBefore": "2026-11-27T00:00:00Z",
  "notAfter": "2027-05-27T00:00:00Z",
  "nonce": "random",
  "sig": "posting-key-signature"
}
```

Verification:

1. `v === 1` and `scope` includes `grant`.
2. Current time is within `notBefore`/`notAfter`.
3. Signature verifies against one of the creator's posting keys.
4. Signature payload:
   `banksia.vault.delegation.v1|<canonicalJson(cert without sig)>`.

A new blog-metadata write without `relay` revokes the delegation.

### 7.7 Membership product post — HOM + Banksia extension

The product is a normal top-level Hive post with Hive Open Market metadata, so
the existing shop and `/pay` flow can discover it. The product post is the
**only** source of truth for amount, recipient, currency and recurrence.

```json
{
  "content_type": "product",
  "version": 0.1,
  "currency": "HIVE:HBD",
  "price": 5,
  "subscription": 1,
  "subscription_recurrence": 730,
  "status": 1,
  "tags": ["membership", "vault"],
  "banksia_vault_product": {
    "v": 1,
    "plan": "member",
    "container": "banksia-vault",
    "archive": "all",
    "title": "Notes from the garden",
    "description": "Weekly essays, field notes and the full archive.",
    "benefits": ["Weekly essays", "Full archive"],
    "executions": 12
  }
}
```

- `price` is an HBD number with the product's currency; `currency` MUST be
  `HIVE:HBD`.
- `subscription` MUST be truthy and `subscription_recurrence` MUST be an integer
  ≥ 24 hours. v1 uses 730 hours for a monthly plan; daily/test plans use 24.
- `status`: `1` active, `2` inactive, `3` out of stock. Only `1` is purchasable.
- `banksia_vault_product` is optional for ordinary HOM products tagged
  `membership` or `vault`; readers then default `plan=member`,
  `container=banksia-vault`, `archive=all`, `executions=12`.
- The post title and body are human copy. Banksia writes the
  `productTitle`/`productDescription`/`benefits` into the body as Markdown and
  the extension; other frontends SHOULD render the post title/body and MAY use
  the extension for structured display.
- The hidden container is a reply under the product. Its `json_metadata` is:

```json
{ "app": "banksia.io", "format": "markdown", "tags": ["membership"],
  "banksia_vault_container": true }
```

It is excluded from archives/feeds/search by the flag. Being a reply, it does
not consume Hive's five-minute root-post slot. Bulletin comments are replies
under the container.

---

## 8. Off-chain envelopes

### 8.1 Creator vault store

Stored under `localStorage["banksia_vault_creator_<account>"]`, encrypted only.

```json
{
  "v": 1,
  "account": "alice",
  "alg": "PBKDF2-SHA256-A256GCM",
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 310000,
    "salt": "base64url-16-bytes"
  },
  "iv": "base64url-12-bytes",
  "ct": "base64url-ciphertext"
}
```

Plaintext:

```json
{
  "v": 1,
  "account": "alice",
  "createdAt": "2026-11-15T10:00:00.000Z",
  "kid": "2026-11",
  "keyring": { "2026-11": "base64url-32-byte-content-key" },
  "ringKey": "base64url-32-byte-ring-key",
  "ringKid": "2026-11"
}
```

- KDF: PBKDF2-SHA256, 310,000 iterations, 256-bit AES-GCM key.
- AAD: `banksia.vault.store.v1|<account>`.
- The `account` field is part of the envelope because it is needed to recompute
  the AAD at decrypt time. Copying a vault to another account fails closed.
- `ringKid` identifies the period whose ring key is in `ringKey`.
- Wrong passphrase and tag failure both surface as `VAULT_BAD_PASSPHRASE`.

### 8.2 Creator export

```text
{ "type": "banksia.vault.creator@1", "vault": { /* 8.1 envelope */ } }
```

The passphrase is never included. Import accepts the object or its JSON text.

### 8.3 Reader recovery

```json
{
  "v": 1,
  "type": "banksia.vault.recovery@1",
  "alg": "PBKDF2-SHA256-A256GCM",
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 310000, "salt": "base64url" },
  "iv": "base64url",
  "ct": "base64url"
}
```

Plaintext: `{ account, blog, privateJwk, publicKeyB64 }`.

- AAD: `banksia.vault.recovery.v1` (constant; the account is inside the
  ciphertext, so it cannot be used as AAD without a circular dependency).
- The file is as sensitive as the reader private key. Import re-derives the
  keypair; it does not need a Hive account.

---

## 9. Cryptographic constructions

All operations use `globalThis.crypto.subtle` (P-256 ECDH, HKDF-SHA256,
AES-256-GCM, PBKDF2-SHA256, SHA-256). No other library is required.

### 9.1 Reader keys and thumbprint

```text
keypair         = ECDH P-256
publicKeyB64    = "p256:" || base64url(0x04 || x || y)
rkt             = lowercase_hex(SHA-256(0x04 || x || y))[0..16]
```

`rkt` is 16 hex characters (64 bits). It is a stable, non-secret identifier for
a reader key inside a bulletin. It is not anonymity: the payment memo carries the
same public key beside the payer account.

### 9.2 Ring key wrap

Given the raw ring key `K_ring` (32 bytes), a reader public key, and the grant
header `H = { blog, rkt, period, tier, expires }`:

```text
eph             = ephemeral P-256 keypair
epk             = raw uncompressed public point (65 bytes)
shared          = ECDH(eph.private, reader.public)
salt            = epk || reader.public.raw || UTF8("banksia.vault.wrap.v1")
info            = UTF8(canonicalJson(H))
KEK             = HKDF-SHA256(shared, salt, info) -> 256-bit AES-GCM key
iv              = random 12 bytes
AAD             = UTF8(canonicalJson(H))
ct              = AES-256-GCM(KEK, iv, AAD, K_ring)
entry           = { alg: "P256-HKDF-SHA256-A256GCM", epk, iv, ct,
                    tier, expires }
```

The grant header has exactly five keys: `blog`, `rkt`, `period`, `tier`,
`expires`. The same object is both the HKDF `info` and the AES-GCM AAD, so a
reader cannot move a wrapped key to another blog, period, tier or expiry.

**Unwrap** reverses the ECDH: the reader private key is combined with `epk`. The
salt still needs the reader's **own** public key, which the reader knows. For a
non-extractable private key the caller MUST pass the public key (or a
`{ privateKey, publicKey }` pair); the implementation cannot export it from a
non-extractable key. The Banksia API accepts the public key as an optional fourth
argument to `unwrapRingKey`.

**Extractable keys.** The W89 reader stores an **extractable** P-256 private
`CryptoKey` in IndexedDB so the reader can export a passphrase-wrapped recovery
file. The key is therefore readable by any script running on the same origin
while the page is open. The recovery export is the deliberate trade-off; see
`docs/SECURITY.md`. A reader implementation MAY use non-extractable keys if it
provides a different recovery path; it MUST then pass the public key alongside
the private key at unwrap time.

### 9.3 Keyring seal

```text
plaintext = UTF8(canonicalJson(keyring))
AAD       = UTF8("banksia.vault.keyring.v1|" || blog || "|" || period)
iv        = random 12 bytes
blob      = AES-256-GCM(K_ring, iv, AAD, plaintext)
sealed    = { alg: "A256GCM", iv, ct }
```

The keyring is `{ "<kid>": "<base64url 32-byte key>" }`. It is sealed once per
bulletin. The plaintext must decode to a JSON object.

### 9.4 Payload encryption

```text
AAD       = UTF8("banksia.vault.content.v1|" || blog || "|" || permlink || "|" || kid || "|" || mode)
plaintext = UTF8(content)
iv        = random 12 bytes
ct        = AES-256-GCM(K_kid, iv, AAD, plaintext)
payload   = { alg: "A256GCM", iv, ct, bytes, hash }
bytes     = UTF-8 byte length of plaintext
hash      = "sha256:" || hex(SHA-256(plaintext))
```

Decryption MUST:

1. Check `alg` if present (`A256GCM`).
2. Recompute the AAD from the same header fields.
3. Verify the AES-GCM tag (fail closed, no partial plaintext).
4. Decode UTF-8 strictly.
5. Recompute SHA-256 and compare with `hash`; mismatch is `VAULT_HASH`.

### 9.5 Multi-part companion payloads

For payloads above the inline budget, split the plaintext on **UTF-8 code-point
boundaries** (never inside a multi-byte sequence or a surrogate pair) and encrypt
each part with the same `K_kid` and the **same base content AAD**. Each part adds:

```json
{ "alg": "A256GCM", "iv": "...", "ct": "...", "bytes": 1234,
  "hash": "sha256:...", "part": 1, "parts": 3 }
```

The post metadata replaces `ct`/`iv` with `parts: ["<post>-vault-1", ...]` (see
§7.2). Each companion comment is a reply to the post and carries the part object
under `json_metadata.banksia_vault_payload`; the comment body is empty. Readers
MUST decrypt each part, verify each part hash, reject duplicate or out-of-range
`part` values, concatenate in `part` order, and verify the post-level `bytes` and
`hash` (both `sha256:<hex>` and base64url forms) against the complete plaintext.
A missing, malformed or duplicate part keeps the reader locked; partial plaintext
is never rendered. The reader verifies every part hash, the exact part count and
order, and the post-level `bytes` and SHA-256 (hex or base64url) over the
concatenated plaintext.

The composer selects companion transport above 30,000 plaintext bytes and
chunks at 28,000 bytes of plaintext per part (well below the 40,000-character
inline budget and the 65,535-byte comment body).

### 9.6 Signatures

The grant/bulletin signer is a Hive posting key (or a delegated relay key). The
Banksia implementation keeps signing behind an adapter:

```js
{ sign: async (text) => signatureString }
{ verify: async (text, signature, publicKey?) => boolean }
```

Signature payloads:

```text
bulletin:   banksia.vault.bulletin.v1|canonicalJson(bulletin with keyringHash, no sig)
grant:      banksia.vault.grant.v1|canonicalJson(grant, no sig)
delegation: banksia.vault.delegation.v1|canonicalJson(cert, no sig)
```

`signGrant` auto-detects a bulletin by the presence of `keyring` or `entries`;
otherwise it uses the grant prefix. Verification always recomputes the payload.

Hive signing follows `signBufferData` / Keychain `requestSignBuffer`: SHA-256 of
the UTF-8 payload, then a recoverable secp256k1 signature. The existing Banksia
bridge (`src/services/vaultSigning.js`) performs this step and recovers the
posting public key for verification.

---

## 10. Limits and size policy

| Limit | Value | Notes |
| --- | --- | --- |
| Hive comment body | 65,535 bytes | `MAX_BODY_BYTES` |
| Inline ciphertext | 40,000 base64url chars | `INLINE_CIPHERTEXT_MAX` |
| Inline plaintext | 30,000 bytes | `MAX_PLAINTEXT_INLINE` |
| Companion-comment plaintext | 90,000 bytes | `chooseVaultTransport` |
| Chunk size | 30,000 bytes default (`chunkVaultPayload`); composer uses 28,000 | UTF-8 code-point boundaries |
| Ciphertext estimate | `4 * ceil(bytes / 3)` | base64url overhead |
| AES-GCM IV | 12 bytes | fresh per encryption |
| AES-GCM tag | 16 bytes | appended to `ct` |
| PBKDF2 salt | 16 bytes | per envelope |
| PBKDF2 iterations | 310,000 | SHA-256 |
| Blog vault object | 1,200 bytes | `VAULT_MAX_BYTES`, inside the 12 KB blog budget |
| Memo | < 2,048 bytes | Hive limit |
| `custom_json` | 8,192 bytes | Hive limit |
| Paywall title / body | 80 / 240 chars | display only |
| Paywall benefits | ≤ 6, each ≤ 80 chars | display only |
| Product title / description | 80 / 600 chars | plain text, no HTML |
| Product benefits | ≤ 6, each ≤ 80 chars | plain text, no HTML |
| Bulletin entries | 300 hard cap, 250 warning | `BULLETIN_MAX_ENTRIES`; split is reserved |
| Bulletin comment | ~60,000 bytes | `BULLETIN_MAX_BYTES` |

`estimateCiphertextLength(30000)` is exactly `40000`; 30,001 plaintext bytes
therefore choose the companion-comment transport.

---

## 11. Error codes and UI-safe messages

`VaultCryptoError` carries a stable `code` and a safe message. UI code should map
the code to a friendly state and must never display partial plaintext.

| Code | Meaning | Typical UI |
| --- | --- | --- |
| `VAULT_BAD_INPUT` | Malformed object, missing field, bad base64url, invalid mode/timestamp | "Could not read this content" |
| `VAULT_BAD_KEY` | Missing/off-curve reader key, wrong key length, non-extractable export | "Your reader key is not usable" |
| `VAULT_TAG` | AES-GCM authentication failed (wrong key, wrong AAD, tampered ciphertext) | "This content could not be unlocked" |
| `VAULT_HASH` | Decrypted plaintext does not match `hash` | "This content could not be unlocked" |
| `VAULT_BAD_PASSPHRASE` | Vault/recovery envelope tag failed (wrong passphrase or corruption) | "Wrong passphrase" |
| `VAULT_UNAVAILABLE` | WebCrypto is unavailable | "This browser cannot unlock Vault" |

`parseBulletin`, `parseVaultMetadata`, `verifyGrant`, `verifyDelegation` and
`isGrantValid` return `null`/`false` instead of throwing for untrusted input.

The reader-facing state codes and the exact copy in
`src/services/vaultUnlock.js` are:

| State | Copy |
| --- | --- |
| `no-key` | Subscribe to read the rest of this post. |
| `payment-pending` / `no-entry` | Payment received — unlocking… |
| `expired` | Your membership ended. Renew to keep reading. |
| `bulletin` | Could not verify your membership. Try again. |
| `offline` | You appear to be offline. Reconnect and try again. |
| `signature` | This grant could not be verified. |
| `tampered` | This content could not be unlocked. |
| `wrong-key` | This reader key cannot unlock this post. Use the device you subscribed with, or restore access. |
| `unsupported` | This browser cannot unlock Vault. |
| `no-plan` | The membership plan could not be loaded. Try again later. |
| `unlocked` | Members-only content unlocked. |
| `locked` (default) | This content is for members. |

No state copy includes a key, ciphertext, plaintext, stack trace, reader
account or server detail beyond what the reader already knows.

---

## 12. Read/unlock verification order

1. Parse `json_metadata.banksia_vault`; reject unknown `v`/`alg` or a malformed
   `kid`/mode/hash/ciphertext.
2. Load the reader key for this blog/origin. A reader MAY auto-unlock only when
   the visitor is signed in as the key's recorded owner; otherwise require an
   explicit Restore action.
3. Fetch the newest bulletin for `blog` + `period` (pointer first, then replies
   authored by the blog account and matching `vault-<period>-<seq>`).
4. Verify the bulletin signature (creator posting key). For v1, `signer` MUST
   equal `blog` and `delegation` MUST be null; a future relay needs a verified
   certificate.
5. Check `blog`, `period`, `rkt`, `expires` against the reader and the current
   time. Expiry is checked **before** decrypting.
6. Find the entry whose `rkt` matches the reader key thumbprint; unwrap
   `K_ring`.
7. Open the keyring; select `K_kid` for the post's `kid`.
8. Decrypt the payload (or parts), verify every part hash/order, the post-level
   `bytes` and hash, sanitise the HTML with DOMPurify via the normal renderer.
9. Never cache plaintext or keys in localStorage, the service worker, analytics
   or logs. Keep them in memory only. Clear decrypted state on logout/account
   change.

Failure states: no reader key → paywall; payment sent but no grant → poll for
about two minutes; expired → renew; missing bulletin → "could not verify";
invalid signature → "could not be verified"; tag/hash failure → "could not be
unlocked".

---

## 13. Test vectors

These values are asserted by the unit tests in `tests/unit/vault-*.spec.js`.

### 13.1 Canonical JSON

Input:

```js
{ b: 1, a: { d: 'x', c: [true, null, 'é'] }, n: -2 }
```

Output:

```text
{"a":{"c":[true,null,"é"],"d":"x"},"b":1,"n":-2}
```

Rejected: `1.5`, `NaN`, `Infinity`, `undefined`, functions, `BigInt`, cycles,
`Date`, `Map`.

### 13.2 Base64url

```text
bytes:   00 01 02 fd fe ff
encoded: AAEC_f7_
```

`base64UrlDecode("AAEC_f7_")` returns the same six bytes. `"a"` is rejected
(impossible length).

### 13.3 SHA-256

For the UTF-8 string `abc`:

```text
hex:       ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
base64url: ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0
```

### 13.4 AES-256-GCM content vector

This is the exact primitive the payload encryption uses. Key is 32 zero bytes,
IV is 12 zero bytes, AAD is the content AAD for
`blog=alice permlink=vector kid=2026-11 mode=section`.

```text
key:       0000000000000000000000000000000000000000000000000000000000000000
iv:        000000000000000000000000
aad:       banksia.vault.content.v1|alice|vector|2026-11|section
plaintext: Banksia Vault test vector
hash:      sha256:41304b4ecfa77908c0413fd596cb98b24eed61a161f89b2a02e22e7b5ca62b06
ct:        jMYuVj4JCk5RL7C_ztPpfQEUI7xSxV4bo1h1jzJDzDDTbCYbnjfm69w
```

The `ct` is base64url of the 41-byte ciphertext including the 16-byte tag.

### 13.5 Ring-key wrap vector (fixed keys)

This is the exact HKDF + AES-GCM construction in §9.2. Reader and ephemeral
private scalars are public test values, not secrets. Header:

```text
blog=alice period=2026-11 tier=member expires=2026-12-27T12:00:00Z
rkt=2bad0fd610d99eae
```

```text
readerPriv: 1111111111111111111111111111111111111111111111111111111111111111
readerPub:  BAIX5hfwtkQ5KCePlpmeaaI6TywVK99tbN9m5bgCgtTtGUp968uXcS0t2jyoWqh2Wlb0X8dYWZZS8ol8ZTBuV5Q
ephPriv:    2222222222222222222222222222222222222222222222222222222222222222
epk:        BNZak5d8qj0bCBhS_1ennkZfFmBXcwS66tUF3TpIWJzzUBheiVNy32Ih6joTdVfkc_3bZ1XwW9UHw8Uz_OnJEoU
ringKey:    ERERERERERERERERERERERERERERERERERERERERERE (base64url of 32 x 0x11)
iv:         IiIiIiIiIiIiIiIi (base64url of 12 x 0x22)
info:       canonicalJson({blog,rkt,period,tier,expires})
KEK:        2175bf9ca8940c759ee0cf80ad1631ca22897501276279b81eae451b4e3b8db7
ct:         pMbQ1XkUi-FH4VccdS4Wbvr2aIwtSbU6lFwid0o2SNdmCXyafhPQqxFFT7ySCxbD
```

The salt is `epk || readerPub || UTF8("banksia.vault.wrap.v1")`; the AAD and
HKDF `info` are the canonical header. A conforming unwrap with `readerPriv`,
`epk` and the same header returns `ringKey`.

### 13.6 Keyring seal vector

```text
ringKey: ERERERERERERERERERERERERERERERERERERERERERE
keyring: {"2026-11":"MzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzM"}
AAD:     banksia.vault.keyring.v1|alice|2026-11
iv:      RERERERERERERERE (12 x 0x44)
ct:      t2d6XngOCQbYsqW_ZZA6ltWwgUH1d3KtmimsGXGxZ6ZXGYcSGGOMUf6OlZSgWkFcr6Og9s7Ot8SN_lhcrzWAZpRdmJN_s8Y7Ow
```

### 13.7 Bulletin signature payload vector

```text
keyringHash: sha256:a8c77bbae3ed01d00382382b299c11a535f7af1b7b7df67ea069dd7aa7405717
payload:     banksia.vault.bulletin.v1|{"blog":"alice","claims":[],"delegation":null,"entries":[{"alg":"P256-HKDF-SHA256-A256GCM","ct":"example","epk":"example","expires":"2026-12-27T12:00:00Z","iv":"AAECAwQFBgcICQoL","rkt":"a1b2c3d4e5f6a7b8","tier":"member"}],"issued":"2026-11-27T12:00:00Z","keyring":{"alg":"A256GCM","ct":"example","iv":"AAECAwQFBgcICQoL"},"keyringHash":"sha256:a8c77bbae3ed01d00382382b299c11a535f7af1b7b7df67ea069dd7aa7405717","period":"2026-11","seq":3,"signer":"alice","v":1}
```

The full canonical text is reproducible from the object in §7.4. Signatures are
non-deterministic for ECDSA; verify by recovering the posting key, not by
comparing signature bytes.

### 13.8 Structural vectors

Reader thumbprint (property asserted, not a fixed key): 16 lowercase hex
characters, identical for `CryptoKey` and `p256:` string inputs, different for a
different key.

Wrapped ring key (`wrapRingKey`): `alg === "P256-HKDF-SHA256-A256GCM"`, `epk`
decodes to 65 bytes starting `0x04`, `iv` decodes to 12 bytes. Wrapping uses a
fresh ephemeral key and IV, so the ciphertext is intentionally non-deterministic.

Payload: `bytes = UTF-8 length`, `hash = sha256:<hex>`, `iv` = 12 bytes. The same
plaintext encrypted twice has different `iv` and `ct`. A one-bit flip in `ct`,
the wrong key, or a changed blog/permlink/kid/mode all raise `VAULT_TAG`.

Keyring: seal/open with `blog=alice period=2026-11` round-trips; a tampered `ct`,
wrong ring key or wrong `period` raises `VAULT_TAG`.

Grant header: exactly `blog`, `rkt`, `period`, `tier`, `expires`. Swapping the
keyring or any entry invalidates the bulletin signature.

---

## 14. Interop guidance for other Hive frontends

- **Teaser in the public body.** The post body is a normal Hive post. In
  `section` mode it contains the public teaser plus the raw marker; in `post`
  mode the body is the teaser. Render the teaser normally and never cloak.
- **Marker detection.** Look for the raw `<!--banksia:vault-->` in the body
  before Markdown/HTML rendering. Do not rely on it surviving a renderer, and do
  not display the marker text.
- **Ciphertext location.** Read `json_metadata.banksia_vault` (or
  `json_metadata.banksia_vault_payload` on companion comments). Ignore the
  post body when looking for ciphertext.
- **Filter Vault plumbing.** Exclude `content_type: "product"` posts and posts
  with `banksia_vault_container: true` from archives, feeds, sitemaps and
  search. The product is discoverable in the shop; the container exists only to
  hold bulletin replies.
- **Verify before decrypting.** Fetch the bulletin, verify its signature against
  the blog's posting authority **and require `signer === blog`** (unless a
  delegation certificate is implemented and valid), recompute `keyringHash`,
  check `blog`, `period`, `rkt` and `expires`, and only then unwrap. Signature
  and expiry checks happen before any AES-GCM work.
- **Never trust metadata for money.** `banksia_vault.price`, `tier`, `product`
  and `container` are display/interop hints. The HOM product post is the only
  source of truth for recipient, amount, currency and recurrence. The recipient
  is the product's author; show it as `@account` in the payment review.
- **Preserve unknown metadata.** Do not strip `banksia_vault`,
  `banksia_vault_product` or `banksia_vault_bulletin` on edit unless you are the
  Vault client deliberately re-encrypting or disabling the feature.
- **Hash validation.** Accept `sha256:<hex>` and base64url digests. Prefer the
  hex form when writing.
- **Base64url.** No padding on output. Decoders should accept padding but reject
  invalid characters.
- **AES-GCM.** The tag is WebCrypto's default 128-bit tag appended to the
  ciphertext. `ct` therefore includes the tag.
- **Reader key storage.** The Banksia beta stores an **extractable** P-256
  private `CryptoKey` in IndexedDB so recovery export is possible. Unwrapping
  requires the reader's public key alongside the private key. Any XSS on the
  origin can export the key while the page is open; see `docs/SECURITY.md`.
- **Cross-origin.** `alice.banksia.io`, `banksia.io` and a custom domain are
  separate origins. Custom-domain blogs stay read-only and deep-link premium
  reads to the apex. Never place the private key in a URL, fragment or referrer.
  A reader key on one origin cannot be seen by another; recovery import is the
  beta's only cross-origin path.
- **Relay.** A relay posts from its own Hive account under the creator's
  container, with a certificate signed by the creator's posting key. It needs
  neither the creator's posting key nor funds. Relay/delegation is **not
  implemented** in the W89 beta; readers reject a bulletin with a non-null
  `delegation`.
- **Product copy and renewal labels.** Render the product post title/body and,
  when present, `banksia_vault_product.title/description/benefits`. Derive
  renewal wording from `subscription_recurrence`; do not label every plan
  "monthly".
- **Container placement.** The container may be a root post or a reply; the
  pointer in `blog.vault.container` is authoritative. Banksia v1 publishes it as
  a reply under the product to avoid the five-minute root-post interval.
- **Auto-issue.** A self-sovereign client may issue while its dashboard is open
  and unlocked. A relay uses the same signed bulletin format and needs its own
  delegation certificate; v1 readers reject delegated bulletins.
- **SEO.** The teaser is public and crawler-visible. Use
  `isAccessibleForFree: false` and a `hasPart` `WebPageElement` with
  `cssSelector: ".banksia-locked"`. Do not include ciphertext or plaintext in
  RSS, OG or JSON-LD.
- **Revocation.** There is no on-chain delete. Rotating `K_ring` and `K_kid`
  forward is the revocation mechanism; old ciphertext remains readable by anyone
  who already has the old key. Omitting a reader from the next bulletin stops
  future keyrings but does not revoke an unexpired grant they already hold.
- **Privacy.** `rkt` is pseudonymous but correlatable with the public key in the
  payment memo. Do not put personal data in memos beyond the Hive account name.
- **Accessibility.** Render the paywall as a real region with a heading, price,
  benefits, a primary Subscribe action and a secondary Restore action. Announce
  unlock with `aria-live="polite"`; keep the locked plaintext out of the DOM.

---

## 15. Known deviations and reserved extensions

1. **`alg` on a wrapped entry.** The implementation writes
   `alg: "P256-HKDF-SHA256-A256GCM"` (`VAULT_WRAP_ALG`) on `wrapRingKey`
   output, matching the on-chain schema. Unwrapping also accepts `A256GCM` for
   leniency. §3.7 of the build prompt described the result as
   `{ alg: "A256GCM", ... }`; the full-construction name is the better wire
   value and is what the research schema uses.
2. **Reader public key at unwrap.** HKDF salt binds the reader public key. A
   non-extractable private key cannot export it, so callers must pass the public
   key (fourth argument) or a `{ privateKey, publicKey }` pair. This is an
   API-shape detail, not a wire-format change.
3. **Creator envelope `account`.** The envelope carries `account` because the
   AAD is account-bound and decryption needs it. Schemas in the build prompt did
   not list it; it is required for the specified AAD to work.
4. **Month range.** `period` and `kid` now require a real month `01`–`12`; an
   invalid month is rejected.
5. **Cancel matching.** A zero-amount `recurrent_transfer` with the matching
   recipient, recurrence and memo removed a live plan on 2026-11-27
   (`remaining 0`, tx `54f54837…`). The reader cancel button still warns that a
   mismatched memo will not cancel the plan.
6. **Signer binding in the reader.** The normative rule is `signer === blog`
   unless a valid delegation certificate names another signer. The implementation
   enforces that rule, rejects non-null `delegation`, and the reply fallback only
   accepts comments authored by the blog account. A third party cannot publish a
   signed, higher-sequence bulletin to shadow the creator's grants.
7. **Account-bound auto-unlock (client policy).** Banksia records the Hive
   account that created a reader key and only auto-unlocks when that account is
   signed in. The wire format does not carry this binding; another frontend MAY
   choose a different local policy, but should avoid exposing a member's content
   after logout on a shared browser.
8. **Auto-issue (client policy).** The self-sovereign dashboard can poll and
   issue while its tab is open. This is not a protocol operation; a relay uses the
   same bulletin format when it exists.
9. **Container placement.** The v1 Banksia client publishes the container as a
   reply under the product to avoid Hive's five-minute root-post interval. The
   protocol only requires `blog.vault.container` to point at the container
   permlink; a root container is also valid.
10. **Bulletin splitting.** Part permlinks and the manifest shape
   (`vault-<period>-<seq>-<part>`) are reserved, but the MVP assumes a single
   bulletin per sequence. Finalise the manifest schema before shipping a
   multi-part bulletin.
11. **Media.** Text-only. URLs inside encrypted payloads remain public; do not
   promise encrypted media in v1.
12. **Delegation payload prefix.** Delegation certificates use the dedicated
   `banksia.vault.delegation.v1` prefix in this specification. The v1 reader
   rejects delegated bulletins before verification, so the path is reserved and
   not a v1 trust surface.
13. **History window.** Grant issuance and the reader manager read at most the
    most recent 1,000 account-history rows. Older payments and subscribers are
    not discovered; paginate or use a HAF index before scaling past that window.

---

## 16. Normative JSON Schemas

These schemas are the machine-readable form of §7. `additionalProperties: false`
applies to creator-owned objects where a newer field must not be silently lost;
readers MAY ignore unknown optional fields on remote objects as described in §2,
but MUST reject an unknown `v` or `alg`.

### 16.1 `blog.vault`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://banksia.io/schemas/vault/blog-vault@1.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["v", "enabled", "product", "container", "price", "recurrence", "executions"],
  "properties": {
    "v": { "const": 1 },
    "enabled": { "type": "boolean" },
    "product": { "type": "string", "pattern": "^(?:[a-z][a-z0-9.-]{2,15}/[a-z0-9][a-z0-9._-]{0,255})?$" },
    "container": { "type": "string", "pattern": "^[a-z0-9][a-z0-9._-]{0,255}$" },
    "bulletin": {
      "type": "object", "additionalProperties": false,
      "required": ["author", "permlink"],
      "properties": {
        "author": { "type": "string", "pattern": "^(?:[a-z][a-z0-9.-]{2,15})?$" },
        "permlink": { "type": "string", "pattern": "^(?:vault-\\d{4}-(?:0[1-9]|1[0-2])-\\d+)?$" }
      }
    },
    "price": { "type": "string", "pattern": "^\\d+\\.\\d{3} HBD$" },
    "period": { "const": "month" },
    "recurrence": { "type": "integer", "minimum": 24, "maximum": 8760 },
    "executions": { "type": "integer", "minimum": 2, "maximum": 120 },
    "archive": { "enum": ["all", "current"] },
    "watermark": { "type": "boolean" },
    "productTitle": { "type": "string", "maxLength": 80 },
    "productDescription": { "type": "string", "maxLength": 600 },
    "benefits": { "type": "array", "maxItems": 6, "items": { "type": "string", "maxLength": 80 } },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "allOf": [
    { "if": { "properties": { "enabled": { "const": true } } },
      "then": { "properties": { "product": { "minLength": 1 } } } }
  ]
}
```

`price` and `period` are display hints; `recurrence`/`executions` are copied into
the product so a creator can publish a daily or weekly plan. The product post
remains normative for payment.

### 16.2 `banksia_vault` post metadata

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://banksia.io/schemas/vault/post-vault@1.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["v", "mode", "alg", "kid", "hash", "bytes", "tier"],
  "properties": {
    "v": { "const": 1 },
    "mode": { "enum": ["section", "post"] },
    "alg": { "const": "A256GCM" },
    "kid": { "type": "string", "pattern": "^\\d{4}-(?:0[1-9]|1[0-2])$" },
    "iv": { "type": "string" },
    "ct": { "type": "string" },
    "parts": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "hash": { "type": "string", "pattern": "^(?:sha256:[0-9a-f]{64}|[A-Za-z0-9_-]{43})$" },
    "bytes": { "type": "integer", "minimum": 0 },
    "tier": { "type": "string", "minLength": 1, "maxLength": 32 },
    "price": { "type": "string", "maxLength": 32 },
    "product": { "type": "string", "pattern": "^[a-z][a-z0-9.-]{2,15}/[a-z0-9][a-z0-9._-]{0,255}$" },
    "container": { "type": "string", "maxLength": 256 },
    "paywall": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "title": { "type": "string", "maxLength": 80 },
        "body": { "type": "string", "maxLength": 240 },
        "benefits": { "type": "array", "maxItems": 6, "items": { "type": "string", "maxLength": 80 } }
      }
    }
  },
  "oneOf": [
    { "required": ["iv", "ct"], "not": { "required": ["parts"] } },
    { "required": ["parts"], "not": { "required": ["iv", "ct"] } }
  ]
}
```

### 16.3 Payment memo

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://banksia.io/schemas/vault/memo@1.json",
  "type": "object",
  "additionalProperties": true,
  "required": ["product", "quantity", "banksia"],
  "properties": {
    "product": { "type": "string", "pattern": "^[a-z][a-z0-9.-]{2,15}/[a-z0-9][a-z0-9._-]{0,255}$" },
    "quantity": { "const": 1 },
    "banksia": {
      "type": "object", "additionalProperties": false,
      "required": ["v", "plan", "reader_key", "sub"],
      "properties": {
        "v": { "const": 1 },
        "plan": { "type": "string", "pattern": "^[a-z][a-z0-9_-]{0,31}$" },
        "reader_key": { "type": "string", "pattern": "^p256:[A-Za-z0-9_-]{87}$" },
        "sub": { "type": "string", "minLength": 16, "maxLength": 64 },
        "gift_for": { "type": ["string", "null"], "pattern": "^[a-z][a-z0-9.-]{2,15}$" }
      }
    }
  }
}
```

### 16.4 Bulletin

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://banksia.io/schemas/vault/bulletin@1.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["v", "blog", "period", "seq", "issued", "keyring", "entries", "signer", "sig"],
  "properties": {
    "v": { "const": 1 },
    "blog": { "type": "string", "pattern": "^[a-z][a-z0-9.-]{2,15}$" },
    "period": { "type": "string", "pattern": "^\\d{4}-(?:0[1-9]|1[0-2])$" },
    "seq": { "type": "integer", "minimum": 1 },
    "issued": { "type": "string", "format": "date-time" },
    "keyring": {
      "type": "object", "additionalProperties": false,
      "required": ["iv", "ct"],
      "properties": {
        "alg": { "const": "A256GCM" },
        "iv": { "type": "string" },
        "ct": { "type": "string" }
      }
    },
    "entries": {
      "type": "array", "maxItems": 300,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["rkt", "alg", "epk", "iv", "ct", "tier", "expires"],
        "properties": {
          "rkt": { "type": "string", "pattern": "^[0-9a-f]{16}$" },
          "alg": { "const": "P256-HKDF-SHA256-A256GCM" },
          "epk": { "type": "string" },
          "iv": { "type": "string" },
          "ct": { "type": "string" },
          "tier": { "type": "string", "maxLength": 32 },
          "expires": { "type": "string", "format": "date-time" }
        }
      }
    },
    "claims": { "type": "array" },
    "signer": {
      "oneOf": [
        { "type": "string", "pattern": "^[a-z][a-z0-9.-]{2,15}$" },
        { "type": "string", "pattern": "^p256:[A-Za-z0-9_-]{87}$" }
      ]
    },
    "delegation": { "type": ["object", "null"] },
    "sig": { "type": "string", "minLength": 1 }
  }
}
```

### 16.5 Membership product extension

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://banksia.io/schemas/vault/product@1.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["v", "plan", "container"],
  "properties": {
    "v": { "const": 1 },
    "plan": { "type": "string", "pattern": "^[a-z][a-z0-9_-]{0,31}$" },
    "container": { "type": "string", "maxLength": 256 },
    "archive": { "enum": ["all", "current"] },
    "title": { "type": "string", "maxLength": 80 },
    "description": { "type": "string", "maxLength": 600 },
    "benefits": { "type": "array", "maxItems": 6, "items": { "type": "string", "maxLength": 80 } },
    "executions": { "type": "integer", "minimum": 2, "maximum": 120 }
  }
}
```

### 16.6 Reader key registry and delegation (reserved)

The registry schema in §7.5 is normative for the reserved `custom_json`
`banksia.vault.reader_key`: `v=1`, `blog`, `keys[{key,label,created}]`, `revoked`.
The delegation schema in §7.6 is reserved for the relay; v1 readers reject a
non-null bulletin `delegation`.

---

## 17. Security audit checklist

An independent audit should be able to reproduce every check below from this
document and the on-chain objects.

### 17.1 Confidentiality and cryptography

- [ ] A fresh 32-byte `K_kid` and `K_ring` exist per period; neither is derived
      from a Hive key.
- [ ] Every AES-GCM encryption uses a fresh 12-byte IV; no IV reuse for a key.
- [ ] Content AAD is exactly
      `banksia.vault.content.v1|blog|permlink|kid|mode`; changing any field fails.
- [ ] Keyring AAD is exactly `banksia.vault.keyring.v1|blog|period`.
- [ ] Wrap salt is `epk || readerPub || "banksia.vault.wrap.v1"`; HKDF info and
      AAD are the canonical six-key grant header.
- [ ] A wrapped key moved to another blog/period/tier/expiry fails to unwrap.
- [ ] A ciphertext moved to another post/kid/mode fails the tag.
- [ ] Plaintext hash and byte length are verified after decrypt; a one-bit flip
      fails closed with no partial output.
- [ ] Multi-part payloads verify every part hash, exact count, order and the
      post-level hash/bytes; missing/duplicate/out-of-range parts fail closed.
- [ ] Canonical JSON sorts keys, rejects floats/non-finite/cycles/non-plain
      objects, and is identical across implementations.
- [ ] Base64url rejects invalid alphabet/length and never truncates.

### 17.2 Entitlement and signatures

- [ ] A bulletin without a valid posting-key signature is rejected.
- [ ] `signer === blog` is enforced for v1; `delegation` non-null is rejected.
- [ ] The reply fallback only accepts a bulletin authored by the blog account;
      a third-party higher-sequence bulletin cannot shadow the creator.
- [ ] `keyringHash` is recomputed from the received keyring; an inbound
      `keyringHash` is ignored.
- [ ] Signature covers keyring hash and every entry; swapping either invalidates.
- [ ] Expiry is checked before any unwrap/decrypt; an expired grant shows the
      paywall.
- [ ] Payment verification checks recipient, HBD amount, memo product, reader
      key, txid uniqueness and time window; wrong/duplicate payments are rejected.
- [ ] One-time transfers use the 40-day window; recurrent fills require
      `remaining_executions >= 0`.
- [ ] Grant issuance rejects a reader key that is not a valid P-256 point and
      omits revoked readers from the next bulletin.

### 17.3 Payments and replay

- [ ] Recipient, amount and recurrence come from the HOM product post authored
      by the blog account, never from `blog.vault.price` or URL parameters.
- [ ] The product status must be active; a different product author is rejected.
- [ ] `recurrent_transfer` and `transfer` memos parse as the v1 memo; unknown
      fields do not change entitlement.
- [ ] Duplicate txids cannot produce a second grant.
- [ ] A zero-amount `recurrent_transfer` with the matching recipient, recurrence
      and memo cancels the plan; a mismatched memo does not.
- [ ] HF28 multiple-transfer matching was verified live (tx `54f54837…`); the UI
      still warns on mismatched fields.

### 17.4 Client, storage and rendering

- [ ] No plaintext or private key in `localStorage` (except the passphrase-
      encrypted creator envelope), `sessionStorage`, IndexedDB in plaintext,
      service worker caches, logs or analytics.
- [ ] The creator vault is PBKDF2-SHA256 310k + AES-GCM with AAD
      `banksia.vault.store.v1|<account>`; copying it to another account fails.
- [ ] Reader private keys are `CryptoKey` objects (extractable only if recovery
      export is offered); auto-unlock requires a matching signed-in account.
- [ ] Decrypted HTML is rendered through `Render`/DOMPurify; no raw `v-html`,
      no unsanitised Markdown URLs.
- [ ] Logout/account switch locks plaintext and a logged-out reload does not
      auto-unlock a stored key.
- [ ] CSP is unchanged or stricter; no new origin, script, worker or dependency.
- [ ] Blog hosts/custom domains are read-only; premium reads happen on the apex
      and no private key is placed in a URL/fragment/referrer.
- [ ] Paywall is a semantic region with heading, price, benefits, Subscribe and
      Restore actions; locked plaintext is absent from the DOM; axe is clean at
      1440×900 and 390×844.
- [ ] RSS/OG/JSON-LD contain the teaser only; `isAccessibleForFree:false` and a
      `hasPart` `WebPageElement` with `.banksia-locked` are present.

### 17.5 Residual risks to state explicitly

- A subscriber can share the decrypted text; watermarking and rotation raise the
  bar but do not prevent screenshots or re-sharing.
- A leaked old key decrypts old ciphertext; v1 has no bulk re-encryption tool.
- An extractable reader key can be exported by XSS on the origin.
- Text-only: image/video URLs inside a premium payload remain public once known.
- Self-sovereign issuing is manual/auto-while-open; a creator offline cannot
  grant, and no relay exists in v1.
- On-chain data is permanent; GDPR erasure cannot delete ciphertext or memos.
- Hive history is read in bounded pages; older payments need pagination/HAF.

---

## 18. Frontend implementation checklist

### 18.1 Read path (minimum reader)

1. `get_accounts([blog])` → `posting_json_metadata` → `banksia.io.blog.vault`.
   If `enabled` is false, render normally.
2. `get_content(author, permlink)` → `json_metadata.banksia_vault`. Validate
   with §16.2.
3. Fetch the bulletin:
   - if `blog.vault.bulletin` is set, `get_content(pointer.author, pointer.permlink)`;
   - otherwise `get_content_replies(blog, container)` and choose the newest
     bulletin whose `blog` and `signer` equal the blog and whose metadata parses.
4. Verify the signature: canonical payload from §7.4, recover the posting key,
   require `signer === blog`, reject `delegation`.
5. Fetch/lookup the reader key, compute `rkt`, match an entry, check
   `expires > now`, unwrap `K_ring`, open the keyring, select `kid`.
6. Decrypt the payload or parts, verify hash/bytes, sanitize, render.
7. Cache only the bulletin and ciphertext in memory/HTTP cache; never plaintext
   or keys in persistent storage.

### 18.2 Write/issuer path

1. Create/passphrase-encrypt the creator vault (`K_kid`, keyring, `K_ring`).
2. Publish the HOM product (`§7.7`) and the hidden container reply.
3. For each verified payment, build the canonical grant header and wrap
   `K_ring`; seal the keyring once; sign and publish the bulletin.
4. Publish/update `blog.vault.bulletin` with the deterministic permlink.
5. Rotate `K_ring`/`K_kid` monthly (or on a leak); old keyring entries stay for
   the archive. Omitting a reader from the next bulletin is the v1 revocation.

### 18.3 RPC and data sources

- `condenser_api.get_accounts` — metadata, posting authority, reputation.
- `condenser_api.get_content` — post, product, bulletin, container.
- `condenser_api.get_content_replies` — container replies / bulletin fallback.
- `condenser_api.get_account_history` — payments; filter `transfer`,
  `fill_recurrent_transfer`, and `recurrent_transfer` cancels.
- `condenser_api.find_recurrent_transfers` — reader plans/cancel verification.
- `bridge.get_account_posts` — blog archive (filter products/containers).
- Use a timeout, retry/failover across nodes, and paginate history; the Banksia
  beta reads at most 1,000 rows per request.

### 18.4 Display rules

- Derive renewal wording from `subscription_recurrence` (`24` = “every day”,
  `730` = “every month”), never hard-code “monthly”.
- Show the product title/description/benefits from the product post/extension.
- Show `@creator` and the amount from the product; label the payment as direct,
  irreversible, no escrow and cancel-anytime.
- Locked content is not in the DOM; unlocked content is announced with
  `aria-live="polite"` and carries a `Licensed to @reader · period` watermark
  when the creator enables it.

### 18.5 Interop test matrix

| Test | Expected |
| --- | --- |
| Public teaser + marker | teaser rendered, marker hidden, no plaintext |
| Valid grant | content unlocks; reload keeps it while signed in |
| Logout + reload | paywall returns; no plaintext |
| Expired grant | paywall + expiry copy |
| Tampered ct/hash/AAD | generic unlock error, no plaintext |
| Foreign bulletin | ignored; creator bulletin still used |
| Wrong price/recipient/memo | payment rejected; no grant |
| Duplicate txid | no second grant |
| Missing/extra part | fail closed |
| Product republished | new price/copy used for new payments; existing plans keep their amount |

---

## 19. Corrections from independent review

An external review of the first final draft raised three spec defects and several
limitations. All three defects are fixed in this revision:

1. **Bulletin `signer` schema.** §7.4 allows a future relay's `p256:` public key,
   but §16.4 only accepted a Hive username. The schema now accepts exactly one of
   a Hive account name or a `p256:` uncompressed point. v1 readers still require
   `signer === blog` and reject delegated bulletins.
2. **Grant-header count.** §9.2 said “exactly six keys” and listed five. The
   header is five keys: `blog`, `rkt`, `period`, `tier`, `expires`.
3. **Delegation prefix.** Delegation certificates now use the dedicated
   `banksia.vault.delegation.v1` prefix instead of reusing the grant prefix. v1
   rejects delegated bulletins before verification, so this path remains
   reserved.

The review's practical limitations are accurate and remain explicit in §17.5:

- the creator must be online or have the dashboard/auto-issue tab open (no relay
  in v1);
- one bulletin is capped at 300 entries (about 300 active readers per period);
- history scans are bounded (1,000 rows in the Banksia beta);
- extractable reader keys are an XSS trade-off for recovery export;
- text-only encryption does not protect image/video URLs;
- losing the creator passphrase and export, or clearing a reader's browser
  without a recovery file, loses access.

The “Explain like I'm 5” section at §0.1 is a deliberately non-normative
on-ramp; the normative requirements remain in §1–§18.
