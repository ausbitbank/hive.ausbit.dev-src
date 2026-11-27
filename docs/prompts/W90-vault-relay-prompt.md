# W90 — Banksia Vault relay: build prompt for a new repository

> Copy this document into a fresh agent session. The relay is a **new GitHub
> repository**; the main Banksia app remains a complete self-sovereign product
> without it. The relay is optional.

## Mission

Build a secure, fast, easy-to-self-host relay for **Banksia Vault**
(`banksia.vault@1`). The relay watches verified HBD subscription payments for one
creator blog and publishes signed grant bulletins while the creator is offline.
It must never hold the creator's Hive posting/active keys or funds.

Deliver:

1. A new repository named `banksia-vault-relay` (or an operator-approved name)
   with a Node.js/TypeScript service, SQLite state, CLI, Docker image and admin
   health/status surface.
2. A relay protocol extension (`banksia.vault.relay@1`) covering the delegation
   certificate, relay-authored bulletins and reader verification rules.
3. A companion integration document/PR for the main Banksia app so readers and
   creators can use delegated bulletins. The main app must keep working exactly
   as today without a relay.

## Read first (in the main Banksia repo)

- `docs/integrations/vault-protocol.md` — the normative v1 spec, schemas,
  crypto, test vectors and audit checklist.
- `docs/research/members-only-content.md` §4.5, §5.5, §5.12, §8, §9.
- `docs/SECURITY.md` — key model, CSP and blog-host rules.
- `src/services/vaultCrypto.js`, `vaultGrant.js`, `vaultPayload.js`,
  `vaultBulletin.js`, `vaultPayments.js`, `vaultUnlock.js`, `vaultSigning.js`.
- `src/pages/blogVault.vue` — current self-sovereign issuance and auto-issue.

## Locked decisions

- **Self-hosted relay first.** A hosted Banksia relay is a later, opt-in trust
  layer; do not build a hosted service in this workstream.
- **Dedicated Hive relay account.** The relay posts comments from its own Hive
  account with its own **posting** key. It does not need a P-256 delegated
  signing key for the MVP. The certificate names the relay account and posting
  public key.
- **No creator keys.** The relay never receives the creator's posting or active
  key, and never moves funds.
- **Content-key custody is the trust boundary.** The creator exports an
  encrypted relay bundle containing the keyring and ring key. A compromised
  relay can decrypt/leak content and issue free grants, but cannot post as the
  creator or move funds.
- **Optional.** The main app's self-sovereign dashboard/auto-issue path remains
  the default. Without a relay, readers see the normal paywall and the creator
  issues manually.
- **No new crypto dependencies.** Use Node's WebCrypto for AES-256-GCM, P-256
  ECDH, HKDF-SHA256, PBKDF2 and SHA-256. Use the existing Hive transaction
  library for posting-key signatures.
- **No server-side creator account.** One relay process serves one blog by
  default; multi-blog support may be a later extension, but the state model must
  not make it a breaking change.
- **Idempotent and fail-closed.** Replayed txids never create a second grant; an
  invalid/expired/revoked certificate stops issuance before any chain write.

## Suggested implementation

- Node 22 or 24 LTS, TypeScript, ESM.
- Minimal HTTP surface: Fastify or a small Node HTTP server. `GET /health`,
  `GET /status`, `GET /metrics` (Prometheus text), optional protected admin UI.
- SQLite for durable state. Prefer a dependency that builds cleanly in Docker;
  pin it, justify it, and keep it behind a small repository layer.
- Hive reads/writes through one pinned Hive client library. Use a configurable
  node list with timeout, failover and TLS.
- One process, one SQLite file, no Redis/Postgres. Docker image runs as a
  non-root user with a read-only root filesystem and a mounted data volume.
- A `doctor` command and `--dry-run` are mandatory.

## Relay protocol extension (`banksia.vault.relay@1`)

Add this to the relay repo as `docs/PROTOCOL-RELAY.md` and propose it for the
main protocol doc.

### Certificate in blog metadata

`posting_json_metadata["banksia.io"].blog.vault.relay`:

```json
{
  "v": 1,
  "id": "banksia.vault.delegate",
  "blog": "alice",
  "delegate_account": "alice-relay",
  "delegate": "STM...",
  "scope": ["grant", "bulletin"],
  "notBefore": "2026-11-28T00:00:00Z",
  "notAfter": "2027-02-28T00:00:00Z",
  "nonce": "128-bit-random",
  "sig": "<creator posting signature>"
}
```

- `delegate` is the relay account's posting public key.
- `sig` covers
  `banksia.vault.delegation.v1|canonicalJson(certificate without sig)`.
- A new `blog.vault` write without `relay` revokes it.
- Short validity (default 90 days) is recommended.

### Relay bulletin

The bulletin remains `banksia_vault_bulletin` with:

```json
{
  "v": 1,
  "blog": "alice",
  "period": "2026-11",
  "seq": 3,
  "issued": "2026-11-28T12:00:00Z",
  "keyring": { "alg": "A256GCM", "iv": "...", "ct": "..." },
  "entries": [ /* normal entries */ ],
  "parts": [],
  "claims": [],
  "signer": "alice-relay",
  "delegation": {
    "certHash": "sha256:<hex of canonical certificate without sig>",
    "delegate_account": "alice-relay",
    "delegate": "STM..."
  },
  "sig": "<relay posting signature over banksia.vault.bulletin.v1|canonicalJson(without sig)>"
}
```

- The comment author is `delegate_account`, parented under the creator's
  container.
- `signer` equals `delegate_account`.
- The reader fetches the current `blog.vault.relay` certificate, verifies its
  creator-posting signature and `blog`/`scope`/time window, requires
  `certHash` to match, and verifies the bulletin with `delegate`.
- The relay cannot update `blog.vault.bulletin` (creator metadata). Readers MUST
  fall back to container replies and choose the newest valid delegated bulletin
  when the pointer is stale or self-signed.
- Multi-part bulletins use the v1 manifest/parts format; the relay is the author
  of both manifest and parts.
- The relay MUST stop and refuse to sign if the current certificate is absent,
  expired, has the wrong blog/scope/key, or the relay account authority no
  longer matches `delegate`.

### Relay vault bundle

Define an encrypted, portable bundle (relay-specific type, not the creator's
localStorage envelope):

```json
{
  "v": 1,
  "type": "banksia.vault.relay@1",
  "blog": "alice",
  "relay_account": "alice-relay",
  "alg": "PBKDF2-SHA256-A256GCM",
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 310000, "salt": "base64url" },
  "iv": "base64url",
  "ct": "base64url"
}
```

Plaintext: `{ keyring, ringKid, ringKey, period, createdAt }`. AAD:
`banksia.vault.relay@1|alice|alice-relay`.

## Relay algorithm

Per blog:

1. Load config and decrypt the relay bundle into memory.
2. Check the current certificate from `blog.vault.relay`:
   `blog`, `delegate_account`, `delegate`, `scope`, `notBefore`, `notAfter`,
   hash and creator posting signature. Stop if invalid.
3. Read the product post and derive amount/recipient/recurrence. Never trust
   `blog.vault.price`.
4. Poll filtered account history:
   `transfer` (2), `recurrent_transfer` (49), `fill_recurrent_transfer` (83),
   `failed_recurrent_transfer` (84), paginated with `from = oldestIndex - 1`.
   Wait for the configured confirmations/irreversible block before granting.
5. Verify payments with the v1 rules: recipient, HBD amount, product, reader
   key, `sub`, one-time 40-day window, `remaining_executions`, txid uniqueness.
6. Persist `{txid, blog, reader_key, sub, period, seq, state}` **before** the
   chain write; use a unique txid constraint.
7. Group pending readers, build grant entries, seal the keyring once, sign the
   manifest, publish the manifest and parts, then mark the txids granted.
8. Reconcile on startup: re-read history, retry queued/uncertain bulletins,
   never double-grant. A local transaction/outbox is acceptable; an on-chain
   comment that was broadcast but not confirmed must be retried idempotently.
9. Check the blog certificate every 60 seconds; revocation stops new grants
   immediately.
10. Expose health/status: last block, last payment, last bulletin, pending,
    errors, relay account RC, certificate expiry.

## Setup UX

Target: a non-technical creator can hand a relay operator one file, and the
operator can start a container.

Provide:

- `relay init` interactive wizard:
  - blog account, product ref, container permlink,
  - relay Hive account + posting WIF (or read from a secret file),
  - relay bundle import + passphrase,
  - Hive node, poll interval, confirmations,
  - admin token (generated if omitted).
- `relay doctor` checks:
  - Hive connectivity and chain id,
  - relay account exists, posting key matches, RC sufficient,
  - creator certificate valid and not expired,
  - relay bundle decrypts and matches blog/account/period,
  - product post active and authored by the blog,
  - container exists and is reachable,
  - dry-run a sample bulletin build; no broadcast.
- `relay run` starts the service. `relay status` prints JSON.
- `docker compose up -d` with a mounted `./data` volume and secret env/file.
- README quickstart under 10 minutes, including a testnet-style dry run and a
  small live smoke.

## Security requirements

- No creator posting/active key, no platform balance, no custody of funds.
- Relay posting key and vault passphrase only from env or a `0600` secret file;
  never log, never commit, never send to telemetry.
- Encrypt the relay bundle at rest. Plaintext only in memory after unlock; zero
  it where practical on shutdown.
- Verify the creator certificate before every issuance, not only at startup.
- Never issue a grant for a payment whose product/amount/recipient/memo does not
  match the chain product; never accept values from a URL/request.
- Txid uniqueness and period/reader uniqueness in SQLite; no replay.
- Wait for Hive irreversibility (default 20 confirmations, configurable) before
  granting; expose the setting.
- Admin surface binds to `127.0.0.1` by default, requires a bearer token, sends
  strict security headers, has no wildcard CORS and no write endpoints unless
  explicitly enabled.
- HTTP client: timeouts, bounded response size, node allowlist, TLS only.
- Logs: structured, redact WIF/passphrase/reader private material; no plaintext
  content.
- Docker: non-root, read-only root FS, no privileged caps, pinned base image,
  healthcheck, SBOM, dependency audit in CI.
- Certificate revocation and key rotation runbooks.
- Threat model and residual risks in `docs/SECURITY.md`.
- The relay MUST NOT be required for readers; a missing/expired relay falls back
  to the paywall/self-signed bulletin.

## Performance and scaling

- SQLite WAL, indexes on `txid`, `(blog, reader_key)`, `(period, seq)`,
  `state`, `created_at`.
- Incremental cursor; filtered history; cache the product/certificate with a
  short TTL; avoid re-fetching the vault on every tick.
- Batch one bulletin per cycle, bounded by part size; reuse v1 multi-part
  bulletins for >300 entries.
- Bounded concurrency; backoff on Hive errors/RC exhaustion; never busy-loop.
- Target: 10,000 active subscribers per blog with parts, and a normal payment
  granted within one poll/confirmation window.

## Tests and acceptance

Unit:

- v1 crypto vectors, payment verification, certificate signature/expiry/scope,
  relay bulletin signature, idempotency/replay, multi-part hashes, revocation,
  config validation, secret redaction.

Integration:

- Mocked Hive RPC: payment -> bulletin manifest/parts -> reader verification.
- Duplicate txid, wrong amount/recipient/product, expired cert, wrong relay key,
  stale pointer, relay restart after a crash between DB commit and broadcast.
- Dry-run emits no broadcasts.

Operational:

- `docker compose up` health check, `relay doctor` green, admin auth, graceful
  shutdown, metrics.
- A live smoke on a small test blog with operator approval: subscribe, grant,
  reader unlock, cancel, relay offline fallback.

Main app acceptance (companion change):

- Self-signed v1 path unchanged and all existing tests green.
- Delegated bulletin verifies only with a valid creator certificate.
- A revoked/expired certificate hides the relay path and leaves the paywall.
- Reader fallback finds relay bulletins under the container when the pointer is
  stale.
- Dashboard can generate a certificate, export a relay bundle, show relay status
  and revoke.
- The main app still works with no relay configured.

## Deliverables

- New repo with source, tests, Dockerfile/compose, CI, README, LICENSE, security
  policy, `docs/PROTOCOL-RELAY.md`, `docs/OPERATIONS.md`, `docs/SECURITY.md`.
- Companion `docs/INTEGRATION.md` describing the exact main-app changes.
- A main-app PR (separate repo) for delegated-bulletin reading and dashboard
  relay setup; do not deploy it without the operator.
- Release `v0.1.0` image and checksums.

## Guardrails

- Do not modify the main Banksia app from the relay repo except through the
  documented companion PR.
- Do not add a hosted relay, payment custody, platform balance, relay hot wallet
  or creator active key.
- Do not use memo-key encryption or a new crypto library.
- Do not make the relay mandatory for the v1 product.
- Do not commit secrets, generated vaults, SQLite data or .env files.
- Run targeted tests while developing; run the full repo gate, Docker smoke and
  live smoke before release.
- Report: repo URL, commits, test counts, image digest, setup time, dry-run
  output, live-smoke result, known limitations and residual risks.

## First actions

1. Create/inspect the new repo; write a short plan and check the locked
   decisions.
2. Add the relay protocol extension and certificate fields to the companion
   integration doc.
3. Implement crypto/payment verification and test vectors first.
4. Add SQLite/outbox and a mocked-Hive integration test.
5. Add CLI/Docker/admin/security scaffolding.
6. Add the main-app reader/dashboard companion PR.
7. Run local, Docker and live smoke; publish `v0.1.0` with the operator's
   approval.
