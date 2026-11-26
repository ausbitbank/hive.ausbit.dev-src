# W72 — HiveAuth background resume and device hardening

Date: 2026-11-24
Status: deployed 2026-11-24 (client resume, reconnect and mocked tests); the
physical-device matrix and operator smokes remain open.

Roadmap: [`docs/ROADMAP.md`](../ROADMAP.md) W72. Builds on
[`W62-hiveauth.md`](W62-hiveauth.md).

## Scope

A suspended mobile tab may not emit a clean WebSocket close. The previous client
only reacted to `onclose`, so a pending login or signature could wait for a close
that never arrived, or reconnect later than the relay's 60-second window. This
workstream makes the resume path event-driven, remembers the pending request
across a reload, and makes every wait/failure state visible.

No protocol, key-storage or signing-authority change: the relay token and shared
AES key still live in `sessionStorage`, HiveAuth is still manual-only, and no
transaction is auto-retried after an ambiguous `attach_nack`.

## What changed

### Immediate reconnect on wake

`src/services/hiveauth/client.js`

- While a request is pending, listen for `visibilitychange` (only when the page
  becomes visible), `pageshow` and `online`.
- If the socket is not `OPEN`, detach its handlers, close it, reconnect at once
  and send `attach_req`. The existing clean-close backoff (500 ms → 4 s) remains
  the fallback when no wake event fires.
- `attach_ack` clears the reconnect counter and reports a resumed state.
- A wake after the relay deadline finishes with the request's timeout message
  instead of opening a socket that cannot succeed.
- Duplicate messages are ignored once the request is settled; the socket
  handlers are removed synchronously on completion.

### Pending record across reload

`src/services/hiveauth/session.js`

- One record per tab under `hiveauth:pending`:
  `{account, uuid, kind, expire, key}`.
- `kind` is `login`, `sign` or `challenge`.
- Only a `login` stores the temporary auth key, so the `auth_ack` can be
  decrypted after a reload. Signing and challenge records always normalise the
  key to `null`; their session key already lives in the account session.
- Expired records are rejected by `loadPending()`. The login surface may ask for
  one expired copy to explain what happened, then clears it.
- Completion, cancellation, timeout and `attach_nack` all clear the record. A
  `uuid` guard prevents a late request from clearing a newer one.
- `clearAllSessions()` now removes the pending record too.

### Login resume

`src/components/userLogin.vue`

- On mount, inspect the pending record:
  - a valid `login` shows the HiveAuth dialog and calls
    `resumeAuthentication(account)`, which attaches to the same relay request;
  - an expired record explains that the request expired while the page was
    closed;
  - an interrupted `sign` or `challenge` explains that the user must check the
    chain before retrying and clears the record.
- The cancel button aborts a resume as well as a fresh login.
- The dialog replaces the fixed “Request expires in Ns” line with a live status:
  “Waiting for wallet… approve on your phone… expires in Ns”,
  “reconnecting (attempt N)… expires in Ns”, “Wallet connected. Waiting for
  approval…” or “Request expired.”

### Queue visibility and batch warning

`src/components/queue.vue`

- The queue panel shows the live HiveAuth wait/reconnect/expiry line while a
  signature is pending.
- A grouped, ongoing toast mirrors the state even when the queue popup is
  closed.
- Before the first automatic HiveAuth broadcast, a notice says to keep Keychain
  Mobile in the foreground and explains the 60-second, one-at-a-time approval
  window. A persistent hint remains visible whenever auto-send is on.
- A failed resume still marks the queue item failed and pauses auto-send, so it
  cannot retry an ambiguous transaction. The existing reload restore also marks
  an interrupted `broadcasting` item failed.

## Tests

`tests/unit/hiveauth-client.spec.js`

- pageshow reconnect → `attach_req` → `attach_ack` → ack, with a reconnecting
  status carrying attempt 1.
- hidden `visibilitychange` does not reconnect; visible does.
- `online` reconnect → `attach_req`.
- pending login record contains the auth key; reload resume attaches with the
  same uuid, saves the session and clears the record.
- `attach_nack` on resume fails with the check-the-chain message and clears the
  record.
- expiry during reconnect wins over the backoff timer.
- a signing pending record stores no key and clears on response.
- a duplicate `sign_ack` cannot replace the first transaction id.

`tests/unit/hiveauth-session.spec.js`

- pending save/load/clear, uuid-guarded clear, login-key requirement,
  sign/challenge key stripping, expiry and `includeExpired`, and
  `clearAllSessions()` cleanup.

`e2e/hiveauth.spec.js`

- QR request and cancel.
- Reload with a pending login: the page sends `attach_req` for the same uuid and
  shows the explicit `attach_nack` failure.

## Verification

- `bun run lint` — clean; theme-token scan clean.
- `bun run test` — 154 files, 1,360 tests passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/hiveauth.spec.js --project=chromium` — 2 passed.
- `bunx playwright test e2e/a11y.spec.js --project=chromium -g "HiveAuth login dialog"`
  — axe clean at 1440px and 390px, scoped to the dialog so unrelated pre-existing
  account-menu findings do not mask it.
- Targeted Obscura runs of each HiveAuth spec passed individually. The
  two-test file crashed the Obscura harness/browser in one combined run; the
  Chromium file is the release check for this workstream.
- `bun run perf:check` — all budgets pass after a fresh build. The `/market`
  route JS budget moved from 115 KB to 116 KB to cover the small shared-shell
  growth from the pending record and status wiring (measured 115.2 KB). No new
  initial-route dependency was added; the HiveAuth client remains a lazy chunk.
- Full Obscura fast-suite attempts in this environment hit the known unstable
  live-data/harness failures (dashboard, theme, clipboard and community specs)
  and then crashed the Obscura browser, which cascades unrelated 2 ms failures.
  The HiveAuth spec passes in Obscura when run on its own; the Chromium checks
  above are the release gate for this workstream.

## Deployment

Deployed on 2026-11-24 from commit `4465037` with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T071643Z.tar.gz`
  (`sha256 79f8bf59…1fb34`).
- Rollback: `./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261124T071643Z.tar.gz`.
- Production `index.html` SHA-256 `8297df0c…cb797` matches the local build.
- Live Chromium smoke: `/` rendered “Hive at a glance”; the HiveAuth dialog
  showed the QR and “Waiting for wallet… approve on your phone. · expires in
  61s”, Cancel closed it, and there were no page errors.
- Live HTTP: `/`, `/market`, `/compose` and `/settings/moderation` return 200.
  `/@ausbitbank` and `/@ausbitbank/downvotes` still return the known Cloudflare
  challenge (403) to non-browser clients.

## Still open

- Tier 1 physical matrix on Android and iOS: login, vote, comment, transfer,
  image upload, keepsats, reject, timeout, session expiry and a 3-action
  auto-send with 10/30/55-second background cycles.
- Record each manual run with build SHA, device/OS/browser, wallet version,
  network and background duration, plus a screenshot for failures.
- Real HiveAuth image upload through `/cs/` on Android and iOS.
- A real suspended-tab cycle (the new wake path is unit-tested, not yet observed
  on hardware).

Known limits remain: the relay window is 60 seconds and cannot be extended;
Keychain Mobile only surfaces pending requests when foregrounded or reopened;
if the OS kills the page, only a login can finish after reload, and only within
the relay window. An ambiguous `attach_nack` can mean “expired” or “already
processed”, so the user must check the chain before retrying a transaction.
