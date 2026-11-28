# W103 — Account-scoped state and cache safety

Date: 2026-11-28
Status: implemented and verified locally

## Scope

An audit of the stores/cache found that several pieces of state were shared
between Hive identities: the action queue, posting settings, notifications and
community subscriptions. It also found cache de-dupe/invalidation edge cases and
one-shot timers that restarted after firing.

## Fixes

1. **Queue is scoped to one owner.** Persisted queue metadata now records the
   signed-in owner (not `queue[0]`). A queue that belongs to the previous account
   is cleared when the identity changes, and the restored key is rejected when
   its owner does not match. This prevents another account's pending active
   actions appearing in the drawer or being auto-applied.
2. **Settings are per account.** Settings now live under `settings:<account>`
   (guest -> `settings:guest`). The legacy unscoped `settings` key is adopted by
   the first account that loads it and then removed, so the next account gets
   defaults instead of inheriting beneficiaries, vote weight or node choices.
   `updateLoggedInUser()` reloads the scoped settings.
3. **Notifications and community subscriptions are scoped.** Notifications,
   unread count, last-read timestamp and community subscriptions are stored under
   `<key>:<account>`, with a one-time legacy migration. The persisted unread
   count is now read back instead of always restoring zero.
4. **Cache invalidation is per key.** An unrelated prefix invalidation no longer
   prevents an in-flight read for another key from populating the cache, and a
   superseded promise's `finally` can no longer delete a newer de-dupe entry
   for the same key.
5. **Boot node probing no longer rolls back settings.** The Layer-2 probe merges
   only the discovered node fields into the settings object re-read after the
   await, so a user save during the probe is preserved.
6. **Follow changes invalidate `following:`.** A `custom_json` with
   `id: 'follow'` now clears the actor's cached following list (the previous
   helper was exported but unused).
7. **One-shot timers stay one-shot.** A non-repeating timer removes its handle
   and clears `isRunning` when it fires; pause/resume only restarts repeating
   timers.
8. **Stale-chunk recovery can prompt again.** Choosing “Later” resets the latch,
   so a later stale chunk still surfaces the reload prompt instead of silently
   doing nothing.
9. **Telemetry is reset on identity change.** In-memory request/cache diagnostics
   no longer carry search text or account names across a login switch.

## Components

| Area | Files |
| --- | --- |
| Queue/settings/session state | `src/stores/hive/state.js`, `src/stores/hive/mutations.js` |
| Scoped settings reader | `src/services/userSettings.js`, `src/boot/imageProxy.js`, `src/services/hiveEngine.js`, `src/services/magi.js` |
| Cache | `src/services/cache.js` |
| Boot/probing | `src/boot/hivejs.js` |
| Cache invalidation | `src/services/cacheInvalidation.js` |
| Timers | `src/mixins/timers.js` |
| Chunk recovery | `src/boot/chunkRecovery.js` |
| Tests | `tests/unit/hive-settings-scope.spec.js`, `tests/unit/store-mutations.spec.js`, `tests/unit/cache.spec.js`, `tests/unit/cache-invalidation.spec.js`, `tests/unit/timers.spec.js`, `tests/unit/hive-store-actions.spec.js` |

## Authority and privacy

- No new authority. The queue change removes a cross-account signing path.
- Settings, notifications and communities no longer leak between accounts.
- Cache invalidation remains local.

## Verification

- `bun run lint` — clean.
- `bun run test` — **238 files / 2,307 tests** passing.
- `bun run build` — succeeded.
- Targeted cache/store/timer suites pass.

## Remaining

- Existing browsers migrate their single legacy settings key to the account that
  first loads after this change; other saved accounts start from defaults.
- Queue migration keeps the owner-based restore rule; mixed legacy queues are
  still discarded rather than split by item.
- Telemetry cache keys can still contain search text; a hashing change is not
  included here.
