# W82 — Account creation and claim-link signup

**Status:** static phase implemented (2026-11-26)  
**Depends on:** `docs/account-creation-research.md`, `docs/account-creation-plan.md`

## What changed

### Safety / cleanup

- Removed the dead `hiveonboard.com` links from `src/pages/create.vue` and
  `src/layouts/MainLayout.vue`. The domain now redirects to unrelated content.
- Replaced the drawer's “Hive onboarding” external link with the official
  `signup.hive.io` directory.
- Split the old “Create an account” entry into **Join Hive** (`/join`) and
  **Create for someone** (`/create`) in the drawer and command palette.

### New pages

- **`/join`** (`src/pages/join.vue`)
  - Curated verified providers: Ecency, Hivedex, HiveDapps, Actifit.
  - Hivedex price is fetched live from `api2.hivedex.io/price` with a
    last-known fallback.
  - Links to `/join/keys`, `/create`, `/create/claim`, and the official
    `signup.hive.io` directory.
  - Explains free vs paid, key ownership, who pays and recovery.

- **`/join/keys`** (`src/pages/joinKeys.vue`)
  - Public, no login.
  - Checks username availability, generates a master password and
    owner/active/posting/memo keys locally with the existing `hiveTx` helpers.
  - Shows/downloads/copies the private backup; requires confirmation before
    sharing.
  - Builds a claim link containing **only** username and public keys in the URL
    fragment, plus a short fingerprint.
  - “Check if created” polls the chain.

- **`/create/claim`** (`src/pages/claimAccount.vue`)
  - Decodes a claim link from `#claim=...`; also accepts a pasted link.
  - Shows username, public keys, fingerprint, age and whether the name exists.
  - If logged out, the Sign in button dispatches `banksia:open-login`, which
    opens the existing account popup (`userLogin.vue` now listens for it).
  - If logged in, shows account token/liquid HIVE balances and can queue
    `create_claimed_account` or `account_create`.
  - Can queue `claim_account` when no token is available.
  - Polls the chain after signing, verifies the on-chain keys, and reports
    success or a key mismatch.
  - Warns that the sponsor becomes the recovery account.

- **`/create/batch`** (`src/pages/batchCreate.vue`)
  - Static advanced tool for Ausbitbank/community sponsors.
  - Accepts up to 10 claim links, validates/dedupes them, checks availability.
  - Signs all `create_claimed_account`/`account_create` operations in one
    Keychain `requestBroadcast` approval. No key is stored.
  - Requires Keychain; SmartLock/HiveAuth users use individual claim pages.
  - Reports tx id and polls the chain for completion.

### Existing `/create` page

- Retitled “Create an account for someone”; explains token/HIVE cost, key
  handoff and the safer claim-link route.
- Adds links to key generation, individual claim and batch claim pages.
- Adds SmartLock import (waits for the account to exist, then imports
  posting/active/memo).
- Adds an inline “Claim an account token” action.
- Uses optional chaining for a logged-out account and a clearer sign-in prompt.
- Adds `json_metadata` attribution to created accounts.

### Shared logic

- `src/services/accountClaim.js`
  - Versioned public-key-only payload.
  - Base64url encode/decode, URL fragment/query parsing.
  - Public-key format validation, authority conversion, fingerprint and age.
  - No signing/private-key code.

### Routing / SEO / tests

- Routes: `/join`, `/join/keys`, `/create/claim`, `/create/batch`.
- Prerender list, nginx metadata locations and sitemap updated.
- Claim/batch pages are `noindex`.
- `tests/unit/accountClaim.spec.js` covers round-trip, URL parsing, validation,
  authority conversion, fingerprint and age.
- Material Icons subset regenerated.

## Verification

- `bun run lint` → clean.
- `bun run test` → 178 files / 1534 tests passed.
- `bun run build` → succeeded.
- Browser smoke test:
  - `/join` renders the four providers; no `hiveonboard` links.
  - `/join/keys` checks availability, generates keys and produces a claim link.
  - Opening the claim link shows the public-key summary and sign-in prompt.
  - The header Sign in button opens the existing login popup.
  - `/create` shows the new copy and no initial validation error.
  - `/create/batch` parses links, detects duplicates and shows the review table.

## Security notes

- Claim links contain public keys only. Private keys/passwords never leave the
  new user's browser.
- No active key is stored by the app or any Worker (Worker deferred).
- Batch signing is a direct Keychain approval for the logged-in user; Banksia
  does not hold keys.
- The account creator is the recovery account; UI discloses this.

## Open items

- **Test the batch transaction on Hive testnet** before using it with live
  tokens. Keychain accepts an operations array, but the multi-op
  `create_claimed_account` path has not been signed in this environment.
- Add RC/HP delegation after creation (`delegate_rc` / `delegate_vesting_shares`)
  as an opt-in.
- Embed Hivedex paid signup (next phase in the plan).
- Keyless Worker queue deferred by the operator; static batch page is the
  current substitute.
- Google/GitHub OAuth (Butter Auth) and v4vapp Lightning are later experiments.
- Consider a recovery-account policy page before advertising the free pool.
