# W117 — Active/posting key-authority editing

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W112/W116 covered account authorities and a Keychain-only owner flow, but public
key authorities were still view-only. This slice adds key add/remove for the
active and posting permissions through the active signing queue.

## Behaviour

1. **Key edits are queued `account_update` operations.**
   `accountAuthorityKeyUpdate()` adds or removes one public key while preserving
   the other keys, account authorities, weight threshold, memo key and legacy
   metadata.
2. **Keys and weights are validated.** The key must be a Hive `STM…` public key;
   a new key's weight must be a whole number 1–65535. Adding an existing key
   updates its weight instead of duplicating it.
3. **Owner keys stay out of scope.** Owner key changes need owner authority,
   which the queue cannot express. Only active/posting key rows expose remove
   controls and only they offer an “Add key” dialog.
4. **The signing queue reviews the change.** Key edits use active authority,
   work with Keychain/SmartLock/HiveAuth and are never auto-broadcast.

## Components

| Area | Files |
| --- | --- |
| Builder | `src/services/authority.js` |
| Editor | `src/components/accountAuthorities.vue` |
| Tests | `tests/unit/authority.spec.js`, `tests/unit/accountAuthorities.spec.js` |

## Authority and privacy

- Active/posting key changes are active-authority actions, clearly labelled in
  the queue.
- Owner keys remain untouched; no owner key is requested or stored.
- The operation preserves all unrelated authority fields.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite passing; authority/editor suites **23/23**.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- Owner key replacement and threshold changes still need a dedicated owner-key
  UI.
- The UI does not show a full before/after diff inside the editor; the signing
  queue remains the review surface.
