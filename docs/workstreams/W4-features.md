# W4 — Functionality

Status: complete (pending coordinator integration/verification).

## What changed

### 1. Latest blocks page — `/blocks`

- New `src/pages/blocks.vue` (`name: blocksPage`).
- `src/router/routes.js`: added `{ path: 'blocks', name: 'blocks' }` inside the
  `MainLayout` children, directly after `b/:blockNum` and therefore before the
  `/:catchAll(.*)*` route.
- Behaviour:
  - Calls `getDynamicGlobalPropertiesAsync()` once, then fetches the newest
    `BLOCK_COUNT = 10` blocks with `getBlockAsync(n)` in parallel.
  - Each row shows the block number (linked to `/block/:n`), a relative age
    (`moment.utc(...).fromNow()`), the exact timestamp, the witness (linked to
    `/@witness`), and the transaction count.
  - Initial load shows `q-skeleton` rows. A failed load shows a red banner with
    a **Retry** button; if a later refresh fails the previous rows stay visible
    and the banner explains the failure.
  - `setInterval` refreshes every 8s. **Pause/Resume** stops/starts the
    interval; a short caption and footer show whether auto-refresh is on.
  - `refreshing` guards against overlapping refreshes (slow/hung nodes cannot
    pile up requests), and `beforeUnmount` clears the interval.
  - Manual **Refresh** button triggers an immediate fetch.

### 2. In-app proposal voting — `src/components/proposal.vue`

- Removed the two external HiveSigner `update-proposal-votes` links
  (`returnHiveSignerApprove` / `returnHiveSignerDeny`).
- Added **Vote for proposal** / **Unvote** `q-btn`s that call `voteProposal()`.
  - Not logged in → `q.notify('Login to vote')` and no queue entry.
  - Logged in → queues
    `[user, 'posting', ['update_proposal_votes', { voter, proposal_ids: [Number(p.id)], approve }]]`.
  - `p.voted` is updated optimistically so the row flips immediately and the
    existing "Hide Already Voted" filter in `pages/proposals.vue` keeps working;
    a notification says the vote/unvote was queued.
  - Invalid/non-integer proposal ids are rejected with a notification.
- Kept the PeakD "View proposal in PeakD" link with
  `target="_blank" rel="noopener noreferrer"`. No HiveSigner paths remain.
- `vue/no-mutating-props` is suppressed on the single optimistic `p.voted =`
  line because `pages/proposals.vue` owns and mutates the same objects in place
  (it sets `prop.voted = true` after loading votes). No parent page edit was
  needed or made.

### 3. Queue persistence

- `src/stores/hive/state.js`
  - New `QUEUE_STORAGE_KEY = 'queuedActions'` and `QUEUE_TTL_MS = 24h`.
  - `persistQueue(queue)` writes
    `{ savedAt, owner, items }` to LocalStorage; empty/no queue removes the key.
  - `restoreQueue(currentUsername)` drops missing/corrupt/malformed entries and
    expired entries (older than 24h). `owner` is the first queued item's
    account; a queue saved by a different account is discarded so one account's
    queued operations can never be replayed under another account's login.
  - Store init restores the queue and sets `queueRestored` /
    `restoredQueueCount` so the UI can acknowledge it.
- `src/stores/hive/mutations.js`
  - `addToQueue`, `removeFromQueue`, `clearQueue` persist after mutating.
  - New `acknowledgeQueueRestored()` clears the restored flags.
  - Queue item shape (`[user, keyType, operation]`) and broadcast logic are
    untouched. Only public operation data is persisted — no private keys or
    passwords enter LocalStorage.
- `src/components/queue.vue` mounted: if `queueRestored` is set, shows
  `Restored N queued actions` once (orange, top) and acknowledges it before the
  existing broadcast timer starts. This is the only change in the component.

### 4. Startup API-node selection

- `src/services/hive.js`
  - New `probeHiveNode(url, timeoutMs = 2000)`: `fetch` POST of
    `condenser_api.get_dynamic_global_properties` with an `AbortController`
    timeout. Always resolves with `{ url, ok, latency, head?, error? }`.
  - New `selectHiveNode(configuredUrl)`: probes the configured node first; if
    healthy, returns it unchanged. Otherwise probes `HIVE_API_NODES` in
    parallel and returns the fastest healthy node. If none respond, returns the
    configured URL so startup still proceeds.
  - `setHiveNode` is unchanged and remains the manual settings/nodes-page path.
- `src/boot/hivejs.js` is now `async`: selects the node (worst case ~2s for the
  configured probe + ~2s for the parallel fallbacks = ~4s), then calls
  `setHiveNode` and installs `$hive`.
- Runtime fallback does **not** overwrite `settings.apiNode`, so the user's
  configured choice is preserved; the settings/node page still shows and
  controls the saved preference.

### 5. RC costs — approximation, not live

- Chose the "clearly label as approximations" option rather than a live
  `rc_api` implementation. Hive does not expose a stable per-operation RC price
  (cost depends on the resource pool and exact transaction size), so a live
  formula would be misleading without reimplementing chain-side cost accounting.
- `src/components/rc.vue`: moved the four hard-coded costs into a documented
  `RC_COST_APPROXIMATIONS` constant and added a caption:
  "Protocol approximations based on typical operation sizes; actual costs vary
  with chain state."
- Did not reintroduce `api.ausbit.dev`; no new endpoints were added.

### 6. Account creation fee

- `src/pages/create.vue`:
  - Mounted hook calls
    `this.$hive.api.callAsync('condenser_api.get_chain_properties', [])`.
  - `accountCreationFee` uses `account_creation_fee` when it is an
    `"x.xxx HIVE"` string, also accepts the legacy asset object shape
    (`{ amount, precision }`), and falls back to `'3.000 HIVE'` on missing,
    malformed, or error responses (errors are logged, never thrown).
  - The `account_create` operation now uses the resolved fee instead of the
    hard-coded `'3.000 HIVE'`.
  - The button label, affordability check, and "accounts purchasable" copy use
    `accountCreationFeeAmount` / `accountCreationFee`, so they stay consistent
    with chain properties. Added a safe `liquidHiveBalance` computed so the
    template no longer dereferences a missing account balance.

## Verification

- `bun run lint` → exit 0. Only 3 pre-existing warnings in W2-owned
  `src/components/searchbox.vue` (`'e' is defined but never used`); no errors.
- `bun run test` → 6 files, 44 tests passed after the changes (no test files
  edited).
- Confirmed `blocks` route is inside the `MainLayout` children and before the
  catch-all route.
- `rg` check: no `hivesigner` links remain in `proposal.vue`; no
  `api.ausbit.dev` added in the W4 files.
- Did not run `bun run build`, `bun install`, or any deploy/git write command.

## Open issues / coordinator actions

- **Nav link:** add "Blocks" (or "Latest blocks") to the drawer/internal-tools
  nav in W2-owned `MainLayout.vue` pointing at `{ name: 'blocks' }`. The route
  exists now.
- **Tests:** W6/tests may want coverage for `probeHiveNode`/`selectHiveNode`
  (mock `fetch`) and for `restoreQueue`/`persistQueue` TTL + owner behaviour.
  Existing store mutation tests still pass unchanged.
- **Startup delay:** the boot health check can add up to ~4s on a fully dead
  network. This is the documented trade-off from the plan; if it feels slow,
  a cached "last known good node" key would cut the healthy-path cost to one
  2s probe.
- Queue restoration is intentionally skipped when the saved owner does not
  match the current session user. With `SessionStorage` login persistence this
  covers reloads; a queue saved before a browser restart (session cleared) is
  discarded rather than replayed while logged out.
- Restored queues still use the existing auto-broadcast behaviour (the queue
  component starts on mount). That is unchanged by this workstream, but it
  means a restored action can broadcast immediately after reload if the user is
  logged in and the timer is enabled.
- PeakD proposal links remain external; the plan only required removing the
  HiveSigner vote/unvote paths.

## Coordinator integration follow-up

- Restored queues are now **paused** (`timerEnabled = false`) and the notice
  tells the user to press play. This avoids broadcasting operations restored
  from a previous session without explicit confirmation.
- `selectHiveNode` now probes the configured node and all known nodes in
  parallel, so a fully dead network delays startup by at most one ~2s probe
  instead of configured-then-fallback serial probes.
