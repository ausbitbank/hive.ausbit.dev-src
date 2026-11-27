# Banksia Vault protocol (`banksia.vault@1`)

**Status: final for the W89 self-sovereign beta (2026-11-27).** The protocol is
implemented and unit-tested in this repository. Relay/delegation, encrypted
media, multi-tier and claim codes are reserved but not implemented; see §15.

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
| Publish the membership product | Creator | **Posting** | `comment` (+ `comment_options`) |
| Publish the hidden grant container | Creator | **Posting** | `comment` |
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
| `kid` | `YYYY-MM`; selects `K_kid` from the keyring |
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
(§9.4). Readers MUST decrypt every listed part, verify every part hash, order by
`part`, concatenate, and verify the post-level `hash` and `bytes`. The beta's
post-level check is hex-only; see §9.5 and the W89 record.

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
  plan. The exact HF28 matching rule must be confirmed on testnet before the
  cancel UI is treated as shipped; the beta warns in the confirmation dialog.
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
- `period` matches `/^\d{4}-\d{2}$/` (format; see open questions).
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
   `banksia.vault.grant.v1|<canonicalJson(cert without sig)>`.

A new blog-metadata write without `relay` revokes the delegation.

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

```json
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

The grant header has exactly six keys: `blog`, `rkt`, `period`, `tier`,
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
`docs/SECURITY.md`.

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
is never rendered. The W89 beta verifies per-part hashes and the post-level hash
only when it is the hex form, and does not yet check `bytes`; see the W89 record.

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
bulletin: banksia.vault.bulletin.v1|canonicalJson(bulletin with keyringHash, no sig)
grant:    banksia.vault.grant.v1|canonicalJson(grant, no sig)
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

1. Parse `json_metadata.banksia_vault`; reject unknown `v`/`alg`.
2. Load the reader key for this blog/origin.
3. Fetch the newest bulletin for `blog` + `period` (pointer first, then replies
   matching `vault-<period>-<seq>`).
4. Verify the bulletin signature (creator posting key, or relay key plus a
   valid certificate).
5. Check `blog`, `period`, `rkt`, `expires` against the reader and the current
   time. Expiry is checked **before** decrypting.
6. Find the entry whose `rkt` matches the reader key thumbprint; unwrap
   `K_ring`.
7. Open the keyring; select `K_kid` for the post's `kid`.
8. Decrypt the payload (or parts), verify the hash, sanitise the HTML with
   DOMPurify via the normal renderer.
9. Never cache plaintext or keys in localStorage, the service worker, analytics
   or logs. Keep them in memory only.

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

### 13.5 Structural vectors

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

## 15. Open questions and known deviations

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
4. **Month range.** `period` is validated as `YYYY-MM` by format only; `2026-13`
   currently passes. Tighten to months `01`–`12` in a future revision.
5. **Cancel matching.** The exact HF28 matching rule for
   `recurrent_transfer` with amount `0` has not been verified on testnet in this
   repository. The reader cancel button ships with an explicit warning; treat
   the cancellation as unverified until the testnet run is recorded.
6. **Signer binding in the reader.** The normative rule is `signer === blog`
   unless a valid delegation certificate names another signer. The implementation
   enforces that rule, rejects non-null `delegation`, and the reply fallback only
   accepts comments authored by the blog account. A third party cannot publish a
   signed, higher-sequence bulletin to shadow the creator's grants.
7. **Bulletin splitting.** Part permlinks and the manifest shape
   (`vault-<period>-<seq>-<part>`) are reserved, but the MVP assumes a single
   bulletin per sequence. Finalise the manifest schema before shipping a
   multi-part bulletin.
8. **Media.** Text-only. URLs inside encrypted payloads remain public; do not
   promise encrypted media in v1.
9. **Delegation payload prefix.** Delegation certificates reuse
   `banksia.vault.grant.v1` because no dedicated prefix exists. A future revision
   may add `banksia.vault.delegation.v1`.
10. **History window.** Grant issuance and the reader manager read at most the
    most recent 1,000 account-history rows. Older payments and subscribers are
    not discovered; paginate or use a HAF index before scaling past that window.
