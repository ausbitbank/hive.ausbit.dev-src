# W122 — Owner authority signing blocker

Date: 2026-11-28
Status: implemented and verified locally

## Scope

The roadmap asked for owner key replacement and owner threshold editing. W116
had already added a Keychain-only owner account-authority flow by passing
`role: 'Owner'` to `requestAddAccountAuthority` / `requestRemoveAccountAuthority`.
Before extending that to keys and thresholds, this slice verified the actual
Keychain dApp API. It does not support owner signing, so the owner editor now
fails closed and says so instead of sending a request Keychain rejects.

## Verified API shape

Checked against `hive-keychain/hive-keychain-extension` at `master`
(2026-11-28):

- `src/content-scripts/hive/web-interface/input-validation.ts` validates the
  request `method` for broadcast/signTx with
  `Joi.string().valid('Posting', 'Active', 'posting', 'active')`. `Owner` is
  rejected.
- The authority-request schema accepts only `Posting`/`Active`, and
  `addAccountAuthority`, `removeAccountAuthority`, `addKeyAuthority` and
  `removeKeyAuthority` validate `method: 'Active'` specifically.
- `public/hive_keychain.js` hard-codes `method: 'Active'` on those four
  helpers, and `src/utils/requests.utils.ts` returns the active WIF for every
  authority request type.
- The published documentation lists the key role as
  “`Posting`, `Active` or `Memo`”.

There is therefore no dApp request that signs an `account_update` with owner
authority, and no request that exposes an owner WIF. Keychain's own
recovery/Change Keys tool operates outside the dApp API.

## Behaviour

1. **Owner authority is read-only in the account editor.** Owner rows have no
   add/remove controls, and editing mode shows a note explaining the Keychain
   limitation and pointing at an owner-key tool.
2. **Programmatic owner edits fail closed.** `queueAuthorityChange('owner', …)`
   never calls Keychain, never queues an operation and shows a negative
   notification. This holds for Keychain, SmartLock and HiveAuth sessions.
3. **Active/posting edits are unchanged.** Account and public-key changes still
   queue an active-authority `account_update` with the existing before/after
   review in the signing queue.
4. **No owner key is requested or stored.** The component no longer imports
   Keychain, so no owner request path remains.

## Components

| Area | Files |
| --- | --- |
| Editor and owner note | `src/components/accountAuthorities.vue` |
| Queue-safety builder (unchanged) | `src/services/authority.js` |
| Coverage | `tests/unit/accountAuthorities.spec.js`, `tests/unit/authority.spec.js` |

## Correction to W116

W116's claim that Keychain can add/remove owner **account** authorities is
incorrect for the current extension: the `Owner` role is rejected by the dApp
request schema. That flow was never live-smoked. W122 supersedes it with the
read-only owner UI; the W116 record keeps the original scope with a correction
note.

## Authority and privacy

- Removing the request path is stricter than before: no owner signing is
  attempted at all.
- Active/posting changes remain active-authority queue items.
- No new network reads and no key custody.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite green (see `docs/ROADMAP.md` for the count).
- Authority/editor unit suites — 22/22.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in this isolated worktree.

## Remaining

- Owner key replacement and owner threshold editing stay blocked until a wallet
  exposes owner signing to dApps. Banksia must not ask for an owner WIF or add a
  server-side signing path.
- A future “export owner `account_update` for an external owner-key tool” flow
  is possible, but it needs a reviewed paste/copy design and is not part of this
  slice.
