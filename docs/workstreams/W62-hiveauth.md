# W62 — HiveAuth (HAS) signing option

Status: implemented on top of `2b51eee` (2026-11-22). Initial real-device testing
on 2026-11-23 passed login, voting, commenting, keepsats and rejection; image
uploads were switched to the image host checksum endpoint and HiveAuth was
re-enabled in normal queue auto-send.

## What changed

- New lazy-loaded client in `src/services/hiveauth/`:
  - `crypto.js` — CryptoJS/OpenSSL AES envelope (`Salted__`, AES-256-CBC,
    `EVP_BytesToKey(MD5)`), implemented with `@noble/hashes` + Web Crypto.
  - `client.js` — `auth_req`, `sign_req`, `challenge_req` over
    `wss://hive-auth.arcange.eu/`, with one logical request at a time, explicit
    cancellation/timeout errors, and `attach_req` reconnection when a mobile
    browser suspends the tab while the wallet is open.
  - `session.js` — tab-scoped relay token + AES key in `sessionStorage`, with an
    in-memory fallback when storage is unavailable.
  - `operations.js` — strips `_edit` and splits `comment_options` into a second
    operation so the exact chain operations reach the PKSA.
- `src/components/userLogin.vue` — third login option with QR (`uqr`), mobile
  deep link, copy link, countdown, cancel/retry, provider row and session restore
  on reload.
- `src/components/queue.vue` — HiveAuth broadcasts flow through the normal
  queue. Auto-send and "send all" process one action at a time and wait for each
  phone approval.
- `src/pages/compose.vue` — HiveAuth image uploads sign the image host's compact
  checksum challenge and upload to `/cs/<account>/<signature>`.
- `src/services/v4vappAuth.js` — keepsats auth signs through `challenge_req`.
- `src/components/lightning/KeepsatsPanel.vue` and signing-related copy now
  include HiveAuth.
- `README.md` and `docs/SECURITY.md` document the key/relay model.

## Protocol notes

- Relay: `wss://hive-auth.arcange.eu/`. The docs' `has.hiveauth.com` example
  currently fails TLS hostname verification; do not use it.
- Relay advertises protocol `0.8` (`version 0.8.10`, 60-second request window).
  The client sends the token when present and tolerates a token-less v1 `auth_ack`.
- Auth payload: `has://auth_req/` + base64(JSON `{account, uuid, key, host}`).
- AES envelope compatibility was verified against `crypto-js@4.2.0` in both
  directions, including unicode, before replacing it with the Web Crypto adapter.
- `challenge_req` is used for image uploads and v4v.app. Keychain Mobile returns
  `{challenge: signature, pubkey}` encrypted with the session key.
- The HAS relay closes WebSocket messages around 250 KB (code 1009). The full
  image never fits, so HiveAuth uses the image host checksum endpoint: sign
  `sha256("ImageSigningChallenge" + sha256(file))` via a 47-byte Buffer challenge,
  then `POST /cs/<account>/<signature>`. Verified live: the `/cs/` route exists
  and validates signatures.

## Verification performed

- `bun run lint` — clean.
- `bun run test` (initial implementation, 2026-11-22) — 934 tests pass
  (107 files).
- `bun run build` — clean; HiveAuth is a 13.82 KB / 5.09 KB gzip lazy chunk.
- Live relay probe: `authenticate('ausbitbank')` connected, received
  `auth_wait` with a 60-second expiry and a valid `has://` URI; the request was
  cancelled before approval.
- `e2e/hiveauth.spec.js` passes in both Obscura (mocked relay → QR visible) and
  Chromium (QR visible → cancel closes the dialog). The cancel click is
  Chromium-only because Obscura's layout engine does not position the dialog
  controls reliably.
- Unit coverage: CryptoJS fixture decrypt, round-trip, malformed/wrong-key
  errors, session save/restore/expiry, operation normalization, mocked
  WebSocket auth/sign/challenge, rejection, timeout, relay close, reconnect +
  `attach_req` after a dropped socket, mismatched uuid, missing session.
- 2026-11-23 follow-up: image-host checksum tests and HiveAuth tests pass (41
  focused tests); build succeeds. The full suite is currently blocked by two
  unrelated in-progress theme/icon tests in the working tree.

## Not done / follow-ups

- Real-device matrix: desktop QR scan, mobile deep link (including backgrounding
  the browser while the wallet is open), vote/comment/transfer, image upload,
  v4v.app keepsats, reject/timeout, reload/expiry, and queue auto-send with
  multiple approvals. The client-side resume work is W72; only the physical
  matrix remains open.
- Keychain Mobile only surfaces a pending HiveAuth request when the app is
  foregrounded/reopened; push notification behaviour belongs to the wallet, not
  the site.
- Login challenge signature verification is not enforced client-side. The
  `auth_ack` is authenticated by the shared key; add local `Signature` recovery
  if we want explicit proof-of-key beyond HAS registration.
- Reconnection and reload resume are covered by unit and browser tests; a real
  mobile background cycle remains to be observed on hardware.
- HiveAuth sessions are per tab. A "remember this device" option would need its
  own threat review because the token/AES key would move to `localStorage`.
- Real-device testing should include HiveAuth Mobile as a secondary PKSA.
