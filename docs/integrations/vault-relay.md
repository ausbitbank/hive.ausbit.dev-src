# Banksia Vault relay companion (`banksia.vault.relay@1`)

Status: **companion integration for the optional W90 relay.** The base
`banksia.vault@1` protocol and self-sovereign issuer path are unchanged.

The relay is a dedicated Hive account that watches verified HBD payments for one
creator blog and publishes delegated grant bulletins while the creator is
offline. It never receives the creator's posting/active key and never moves
funds. A missing, expired or revoked relay leaves the normal paywall and manual
creator issuance working.

## Certificate

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
  "nonce": "128-bit-random-base64url",
  "sig": "<creator posting signature>"
}
```

`sig` covers
`banksia.vault.delegation.v1|canonicalJson(certificate without sig)`. Writing
`blog.vault` without `relay` revokes it.

## Delegated bulletin

The bulletin remains `banksia_vault_bulletin`, is authored by the relay account
under the creator's container, and adds:

```json
{
  "signer": "alice-relay",
  "delegation": {
    "certHash": "sha256:<hex of canonical certificate without sig>",
    "delegate_account": "alice-relay",
    "delegate": "STM..."
  },
  "sig": "<relay posting signature>"
}
```

Readers must fetch the current certificate, verify the creator posting
signature, blog, scope, relay account/key and time window, require `certHash` to
match, then verify the bulletin with exactly `delegate`. The relay cannot update
`blog.vault.bulletin`; readers fall back to container replies and choose the
newest **valid** delegated bulletin when the creator pointer is stale.

## Reader changes

`src/services/vaultUnlock.js` keeps the strict self-sovereign defaults. The app
opts in:

- `resolveBulletin({ allowRelay: true })` accepts a relay-authored reply only
  when `signer === comment author` and a `delegation` object is present, then
  verifies candidates newest-first.
- `verifyBulletin({ allowDelegation: true })` validates the creator certificate
  and the relay signature. Absent/expired/revoked/wrong-scope/wrong-key
  certificates fail closed and leave the paywall.
- All expiry, unwrap, keyring and payload checks are unchanged.

## Dashboard changes

`src/pages/blogVault.vue` adds a Relay card:

- create/re-issue a 90-day certificate from the relay account's on-chain posting
  key (the creator never types a private key);
- show certificate state, expiry, relay account/key and latest delegated
  bulletin;
- export the encrypted `banksia.vault.relay@1` bundle with
  `{ keyring, ringKid, ringKey, period, createdAt }`, PBKDF2-SHA256 310k +
  AES-256-GCM, AAD `banksia.vault.relay@1|<blog>|<relay_account>`;
- revoke by rewriting `blog.vault` without `relay`.

The bundle passphrase is never included or stored.

## Rollout

This companion change is additive and must be deployed only with operator
approval. The relay itself lives in `banksia-vault-relay`, and the self-hosted
relay is optional.
