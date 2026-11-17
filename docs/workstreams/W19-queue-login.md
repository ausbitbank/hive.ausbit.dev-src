# W19 — Queue, login and notifications

Date: 2026-11-18
Status: complete

## Scope

Priority 4: the signing queue, SmartLock session controls, the notification
inbox and the login/onboarding explanation of posting versus active keys.

Review found the queue was a single popup with no per-item state, no send-all,
retry or clear-completed actions, and no explanation of the required key. The
notification popup only fetched unread items, had a disabled “Load more” button,
no filters and no live badge. SmartLock had no lock button or inactivity
timeout, and the login popup mixed both key types without explaining them.

## Signing queue

`src/components/queue.vue` was rebuilt around persisted per-item metadata.

- Status per action: **Queued**, **Sending**, **Sent** and **Failed**, with the
  error message kept on failed items.
- Header counts for queued, failed and sent actions, plus auto-send on/paused.
- Controls: **Send all**, **Clear sent**, **Clear queue** (confirmed), pause or
  resume auto-send, refresh status and per-item broadcast/retry/remove.
- `Send all` resets failed items to queued and processes them; `Clear sent`
  removes only successfully broadcast items.
- A broadcast failure pauses auto-send so the remaining queue is not sent
  accidentally.
- Each row shows the operation label and summary, account, relative time, tx id
  when available, status, and a posting/active key badge.
- `Details` expands the raw operation JSON.
- Restored queues never auto-broadcast. Actions interrupted mid-broadcast by a
  reload are restored as retryable failures.
- Sent actions remain visible until **Clear sent**, so the user can see what was
  broadcast and clear completed work deliberately.

### Key handling

- Posting actions use the posting key; active actions use the active key. The
  queue never upgrades an action to a stronger authority.
- Keychain actions go through the extension’s vote, post or generic broadcast
  request.
- SmartLock posting actions require an unlocked account. If locked, manual send
  prompts for the password; automatic send fails with a clear “unlock and retry”
  message.
- SmartLock active actions never auto-broadcast. Each one requires a password
  confirmation, and the active key is never kept in memory.
- The queue footer states: **Posting key** covers votes, comments and
  notifications; **Active key** covers funds and account authority.

## SmartLock

- Added `src/boot/smartlock.js`: pointer, keyboard and touch activity extend the
  session; a one-minute check and returning to a visible tab lock expired
  sessions and show a notification.
- Default idle timeout is **15 minutes**, configurable in Settings to 5, 15, 30
  or 60 minutes.
- The account menu shows **SmartLock unlocked** or **SmartLock locked**, the
  current timeout, and a **Lock** or **Unlock** action.
- Logout and the lock action remove the posting key from memory immediately.
- The SmartLock import form now labels the posting key as required and the
  active/memo keys as optional, and explains that keys are encrypted locally,
  the posting key lives in memory while unlocked, and the active key prompts for
  the password on each use.

## Login and onboarding copy

`src/components/userLogin.vue` now includes a key guide in the logged-out menu:

- **Posting key** — votes, comments, follows and notification markers; cannot
  move funds.
- **Active key** — transfers, power, savings, market orders and witness or
  authority changes.
- **Keychain** — keeps keys in the browser extension and asks for approval on
  each action.

The account menu also shows the connected login method. “Remember me” copy now
states that only the username is saved and that posting, active and memo keys
are never stored there. Account menu label colours were corrected for contrast.

## Notifications

`src/components/notifications.vue` is now a real inbox:

- Loads the latest 20 notifications on open and **Load more** pages backwards
  with `last_id`, de-duplicating and keeping newest first.
- Filters: All, Votes, Replies, Mentions and Other, plus an **Unread only**
  toggle.
- Unread dots and the toolbar badge use `unread_notifications.lastread` when
  available, with the unread count as a fallback for older responses.
- The badge refreshes on login, on a 60-second timer while the tab is visible,
  on returning to the tab and on manual refresh.
- **Mark read** queues a `notify` `setLastRead` custom JSON with posting
  authority. A successful queue broadcast clears the badge and unread state
  locally without waiting for another API round trip.
- Messages are rendered as plain text; internal URLs are normalised and external
  schemes are rejected. Account avatars use the standard Hive image service.
- Empty, loading, error, filtered and end-of-list states are explicit.

## Storage and services

| File | Responsibility |
| --- | --- |
| `src/services/queue.js` | Operation labels/summaries, key requirements, status metadata, counts, actionable selection and permissions |
| `src/services/notifications.js` | Plain-text messages, actors, safe paths, categories, date parsing, unread ids, filters and page merging |
| `src/stores/hive/state.js` | Queue metadata persistence/restoration, interrupted-broadcast recovery, notification last-read state, SmartLock timeout default |
| `src/stores/hive/mutations.js` | Queue status/tx/retry/clear mutations, notification read state, SmartLock-safe queue restoration |
| `src/components/smartlock/store.js` | In-memory posting key activity timestamps, idle expiry and locking |
| `src/components/smartlock/index.js` | Exposes timeout-aware unlock status and activity/lock helpers |
| `src/boot/smartlock.js` | Browser activity tracking, visibility locking and timeout notifications |

Queue items and their metadata are stored together under the existing
`queuedActions` key, still with the 24-hour expiry and owner check. Notification
last-read time is stored under `notificationsLastRead`.

## Authorities

| Action | Authority |
| --- | --- |
| Broadcast a queued action | The key type stored on the queue item (`posting` or `active`) |
| Mark all notifications read | `posting` |
| SmartLock posting action while locked | Password unlock, then posting |
| SmartLock active action | Password confirmation for that action |
| Keychain action | Extension approval for the stored key type |

No private keys are written to the queue, notification state or persisted
settings.

## Verification

- `bun run lint` — clean.
- `bun run test` — **27 files / 226 tests passing** (27 new tests across queue,
  notification, SmartLock-session, queue-persistence and store mutations).
- `bun run build` — succeeded.
- Headless Chromium, local build:
  - queue from the market page retained an active `limit_order_create` as
    **Failed** with “Hive Keychain extension is not installed.”, kept it
    retryable and paused auto-send;
  - seeded sent/failed/queued items showed counts, **Clear sent** removed only
    the sent row, **Send all** retried the failed row and left the next queued
    row intact when the retry failed;
  - notifications loaded 20 rows, **Load more** increased to 40, the Votes
    filter reduced the visible list to vote notifications, the badge showed
    three unread, and **Mark read** queued a posting `custom_json` with
    `id: "notify"` and `setLastRead`;
  - SmartLock login showed the locked state and the configured 30-minute
    timeout; the account menu, login popup, settings and both notification/queue
    popups had no horizontal overflow at 1440px or 390px;
  - settings became scrollable on 390px so Save remained reachable;
  - console was clean.
- Axe WCAG A/AA: zero violations at 1440px and 390px with the login popup,
  settings, SmartLock account menu, queue and notification inbox open.
- Deployed with `./scripts/deploy.sh`. Backup:
  `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261117T153554Z.tar.gz`
  (`13c8118eddab9a0708256539d64ec4c0b59f274c3060a7b2512777e4d28d5d90`).
- Live smoke on `https://hive.ausbit.dev`: HTTP 200, one `h1`, zero overflow,
  login/key guide, SmartLock account state, settings timeout, queue status
  controls and the notification inbox all rendered; zero axe violations and no
  console errors.

## Notes

- The notification badge is polled every 60 seconds while the tab is visible.
  It is deliberately not polled in the background.
- Mark-all-read is queued rather than broadcast directly, because it is a
  posting-key chain action. The UI shows **Queued** until the queue broadcasts
  it; a successful broadcast then clears unread state locally.
- Queue sent items are retained for review and can be cleared explicitly. They
  still expire with the queue’s 24-hour storage TTL.
- Auto-send pauses on any broadcast failure. This prevents a locked SmartLock or
  unavailable Keychain from repeatedly failing every remaining action.
- SmartLock only ever keeps the posting key in memory. Active-key SmartLock
  actions require the password for each action.
