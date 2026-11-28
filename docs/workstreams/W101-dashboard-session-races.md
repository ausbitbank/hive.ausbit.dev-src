# W101 — Dashboard and signing-session race hardening

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A second audit round covered dashboard widgets, HiveAuth/SmartLock sessions and
the notifications surface. The common failure was state from one account or one
request landing after the user switched context. These fixes make every async
writer verify that it still owns the current account/request, and close two
signing-session footguns.

## Dashboard widgets

- `accountWidgetMixin` now uses a request token, clears the displayed account
  record as soon as `targetAccount` changes, and ignores a superseded response
  (including its loading/error writes). The duplicate `signedInUser` watcher was
  removed, so a sign-in no longer reloads every explicit-account widget twice.
- `WidgetOperations` invalidates its request before the empty-account guard, so
  a sign-out cannot let the previous account's history render afterwards.
- `WidgetKeepsats` mirrors the mounted no-session branch when the target
  changes, clears the loading skeleton, and ignores a superseded balance read.
- `WidgetWallet` clears Hive-Engine/Magi holdings before the new loads and drops
  late responses, preventing mixed-account totals.
- `WidgetHiveEngineWatchlist` clears balances on account change and uses a reload
  token so an older account's rows cannot overwrite the new account's.
- `WidgetNotifications` loads its feed from `applyAccountData`, clears on switch,
  tracks errors and guards late feed responses.
- `accountVitals` now uses the canonical `downvotePowerPercent()` maths instead
  of a denominator that was 100× too small.

## HiveAuth and SmartLock

- **Session key is memory-only.** `saveSession()` no longer writes the signing
  AES key to `sessionStorage`; a reload cannot silently resume signing without
  a fresh wallet approval. Token-bearing sessions without an expiry are rejected,
  and logout clears every HiveAuth session in the tab.
- **Bounded deadlines.** Relay-provided request expiries are clamped to five
  minutes, and `attach_ack`/duplicate `*_wait` messages must match the current
  UUID.
- **Expiry is a real logout.** The login menu schedules a timer from the session
  expiry and clears `loggedInUser`, `loginType`, notifications and storage when
  it fires. An interrupted resume that no longer exists now closes with a clear
  warning instead of a permanent “Connecting…” dialog.
- **SmartLock memo fail-closed.** `#memo` on a direct transfer is encrypted or
  the broadcast is rejected. `#memo` on operations that cannot encrypt (for
  example `recurrent_transfer`) is rejected instead of being published as
  plaintext.
- **Signing boundary timeout.** `getPosting()` asks `isUnlocked()` before
  returning a key, so a throttled tab cannot sign past the idle timeout just
  because the 60-second sweeper has not run.
- **Import cleanup.** SmartLock import clears the password and all three WIF
  fields in `finally`, including on failure.

## Notifications surface

- Notification page/unread reads capture the account and ignore a response that
  arrives after an account switch.
- Paging failures keep the loaded rows and show a footer retry instead of
  replacing the whole inbox; first-page failures still use the full error state.
- The queued mark-read button tracks the actual queue item and re-enables when it
  fails, is removed or is sent.

## Components

| Area | Files |
| --- | --- |
| Account widget mixin | `src/components/dashboard/accountWidgetMixin.js` |
| Dashboard widgets | `src/components/dashboard/WidgetOperations.vue`, `WidgetKeepsats.vue`, `WidgetWallet.vue`, `WidgetHiveEngineWatchlist.vue`, `WidgetNotifications.vue` |
| Account vitals | `src/services/accountVitals.js` |
| HiveAuth | `src/services/hiveauth/session.js`, `src/services/hiveauth/client.js` |
| SmartLock | `src/components/smartlock/store.js`, `src/components/smartlock/api.js`, `src/components/userLogin.vue` |
| Notifications | `src/components/notifications.vue` |
| Tests | `tests/unit/account-widget-mixin.spec.js`, `tests/unit/accountVitals.spec.js`, `tests/unit/hiveauth-session.spec.js`, `tests/unit/hiveauth-client.spec.js`, `tests/unit/smartlock-session.spec.js` |

## Authority and privacy

- No new authority; active actions still require explicit wallet approval.
- Stored HiveAuth signing material is reduced: the AES key is memory-only and
  token-bearing sessions must expire.
- Late reads can no longer display another account's balances, inbox or
  operations under the signed-in account.

## Verification

- `bun run lint` — clean.
- `bun run test` — **234 files / 2,275 tests** passing.
- `bun run build` — succeeded.
- Targeted Playwright for search, dashboard, core login and action flows.

## Remaining

- HiveAuth reload resumption now requires a fresh wallet approval by design.
- A signed active transaction can still be accepted with a lost response; the
  queue keeps active retries manual and documented in W98.
- `getMemo`/`getActive` still require the SmartLock password on each use; the
  posting-key boundary is the one that stays in memory.
