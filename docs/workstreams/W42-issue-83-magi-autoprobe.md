# W42 — Issue #83 Magi node auto-probe

Date: 2026-11-21
Status: implemented and deployed

## Scope

Issue **#83** reported that opening `/magi` and clicking **Magi nodes** left the
Magi table as an empty skeleton showing `0 / 0 — Not checked yet`, even after
20+ seconds. Pressing the refresh icon then filled it immediately. The Magi
witnesses panel also showed "No Magi witnesses were returned" on the same
first load.

## Root cause

The table skeleton is driven by `currentState.loading`, so the initial check had
started but never resolved. A probe can outlive its own fetch timeout (a
stalled CORS preflight or a throttled/frozen background tab), and `checkNetwork`
waited on `Promise.all` with no outer deadline. Because the refresh button used
`:loading="currentState.loading"`, Quasar disabled the button for the whole
stuck check, so the visible refresh control could not be used to recover.
While the Magi check was unresolved, the witness panel received `node = null`
and rendered its "no witnesses" empty message instead of a loading state.

## Changes

- `services/network.js` adds `withDeadline(promise, deadlineMs, fallback)`,
  a settle-anyway wrapper that resolves the fallback when a promise has not
  settled in time and ignores a late result.
- `/nodes` uses an 8 second outer probe deadline per URL, so a stalled request
  becomes an `Unreachable / Timed out` row instead of an endless skeleton.
- `checkNetwork(id, { force })` now carries a per-network generation id. The
  refresh button and the empty-state **Probe nodes** button pass
  `{ force: true }`, which supersedes an in-flight check and ignores its late
  results.
- The refresh control is a separate `q-spinner` beside a always-enabled
  refresh button, so a stuck check can always be retried.
- The healthy-nodes hint reads **Checking nodes…** during the first check
  instead of **Not checked yet**.
- `MagiNetworkPanel` receives `checking` and distinguishes three states:
  probing (skeleton), no node available (empty message) and no witnesses at
  that height (the original message).
- `tests/unit/network.spec.js` covers `withDeadline`: pass-through, never
  settling, rejection and a late result after the deadline.

No retry timer changes: the existing 30 second `autoCheck` now works as the
watchdog no longer leaves `loading` stuck.

## Verification

- `bun run lint` — clean.
- `bun run test` — 81 files, 768 tests passed.
- `bun run build` — succeeded.
- Local Playwright against the built SPA:
  - all three Magi GraphQL requests stalled → table resolves at the 8 second
    deadline with `0 / 3` and three `Timed out` rows; the witness panel shows
    "No Magi node is available to read witnesses from." instead of the
    misleading no-witnesses message.
  - first check stalled, then refresh pressed → the forced run supersedes the
    old one and the table fills (`2 / 3`, `Checked …`).
  - normal first load still probes all three endpoints automatically and
    renders the witness table.
- Production spot-check before the change confirmed the same page auto-probes
  when every endpoint answers, matching the issue's "refresh fills it" state.
- `./scripts/deploy.sh` — deployed to `hurgenburgen:/var/www/hive.ausbit.dev`.
  - Backup: `~/hive-backups/hive.ausbit.dev-20261121T055050Z.tar.gz`
  - Live smoke on `https://hive.ausbit.dev/nodes?network=magi`: shows
    **Checking nodes…** immediately, then `2 / 3` with witness rows without a
    manual refresh.
  - Live stall test (all three GraphQL requests paused): resolves at 8 seconds
    to `0 / 3` with three **Timed out** rows; the panel shows "No Magi node is
    available to read witnesses from."
