# W116 — Keychain owner-authority editing

Date: 2026-11-28
Status: implemented and verified locally; owner flow corrected by W122

> **Correction (W122):** the owner flow below assumed Keychain accepted an
> `Owner` role. The current extension's dApp request schema accepts only
> `Posting`/`Active` and signs authority requests with the active key, so that
> request is rejected. W122 makes owner authority read-only and records the
> verified API shape.

## Scope

W112 routed active/posting account-authority edits through the signing queue but
refused owner changes because the queue has no owner-key role. This left owner
authority view-only. This slice adds a narrow Keychain-only owner flow and keeps
every other signer fail-closed.

## Behaviour

1. **Owner add/remove uses Keychain's dedicated owner requests.** When the
   session is Hive Keychain, the owner editor calls
   `requestAddAccountAuthority(..., 'Owner', weight)` or
   `requestRemoveAccountAuthority(..., 'Owner')` and refreshes the account only
   after success.
2. **Other signers are refused with an explanation.** SmartLock does not keep
   owner keys, and the queue cannot express owner authority, so a
   non-Keychain session is told to use a Keychain session or another owner-key
   tool. Nothing is queued or signed.
3. **Owner input is validated.** The target must be a valid Hive account, cannot
   be the account itself, and a new owner weight must be a whole number
   1–65535.
4. **Active/posting changes are unchanged.** They still build a queue-safe
   `account_update` and are reviewed in the signing queue.

## Components

| Area | Files |
| --- | --- |
| Editor | `src/components/accountAuthorities.vue` |
| Tests | `tests/unit/accountAuthorities.spec.js` |

## Authority and privacy

- Owner authority is the strongest key and is only requested through the
  Keychain extension's owner flow with an explicit wallet approval.
- No owner key is stored, queued or kept in memory by Banksia.
- Active/posting changes remain active-authority queue items.

## Verification

- `bun run lint` — clean.
- `bun run test` — owner/authority suite **3/3**.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- Active/posting key edits are delivered in
  [`W117`](W117-authority-key-editing.md); owner key replacement and threshold
  changes still need a dedicated owner-key UI.
- Owner changes cannot be queued for offline review; they are a direct Keychain
  request by design.
