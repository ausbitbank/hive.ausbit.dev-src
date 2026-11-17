# W1 — Security hardening

Status: complete (pending coordinator integration/verification).

## What changed

### SmartLock key handling

- `src/components/smartlock/store.js`
  - Removed `lscache` entirely, together with `LOCKER_CACHE_KEY` and
    `UNLOCK_POLICY_INTERVAL`.
  - `getPosting()` now reads only the module-level in-memory `unlocked` map.
  - `unlock()` no longer persists anything. The `keepUnlocked` argument is kept
    (renamed `_keepUnlocked`) for call-site compatibility and ignored.
  - `lock()` only clears the in-memory key; no cache removal.
  - Encrypted-at-rest format (`encryptKey`/`decryptKey`, SJCL + base58 in
    `ausbitdev_peaklock_v2`) is unchanged.
  - Dropped the now-unused `base58` import from the store.
  - Added `purgeLegacyUnlockedKeyCache()`: scans `localStorage` inside a
    try/catch and removes leftovers from older builds under
    `ausbitdev_peaklock_cache_v2_*` and `lscache-ausbitdev_peaklock_cache_v2_*`.
    Returns the number of entries removed (0 on failure or non-browser
    contexts). This closes the gap where old plaintext unlocked keys could
    still be recovered by an XSS.
- `src/components/smartlock/utils.js`
  - New encryptions use `sjcl.encrypt(password, key, { iter: 100000 })`.
    Existing ciphertext embeds its own KDF params and still decrypts.
- `src/components/smartlock/index.js`
  - `MIN_PASSWORD_LENGTH` is now 8 and applies to **new imports only**
    (`importAccount`).
  - `unlockAccount` accepts any non-empty password so existing accounts with
    shorter passwords keep working.
  - Calls `purgeLegacyUnlockedKeyCache()` once at module load (browser-safe;
    the helper itself returns 0 rather than throwing in jsdom/private-mode
    contexts).
- `src/components/userLogin.vue`
  - Unlock prompt calls `unlockAccount(user, data, false)`.
  - Dialog copy explains unlocked keys are memory-only and the password is
    needed again after reload.
  - Import password field now validates at least 8 characters.

### Hive-Engine client

- `src/services/hiveEngine.js`
  - Removed `sscjs` and the transport shim.
  - Implements `getHiveEngine().find(contract, table, query, limit, offset, indexes)`
    returning a Promise of the result array via JSON-RPC POST to `<node>/contracts`.
  - Preserved: `settings.heApiNode` lookup with `DEFAULT_HIVE_ENGINE_NODE`,
    ~2 concurrent request throttle, fallback hosts
    (`api.hive-engine.com/rpc`, `herpc.dtools.dev`, `api.primersion.com`,
    `enginerpc.com`), throws on HTTP/network failure.
  - Added a 15s per-attempt `AbortController` timeout and rejects JSON-RPC
    `error` payloads. Returns `[]` when a successful response has no array
    result.
  - No new dependency. Wallet/token call sites still only use `.find(...)`.

### HTML sanitization

- New `src/utils/safeHtml.js` exporting `sanitizeRichHtml(html)`:
  DOMPurify with an iframe host allowlist equivalent to
  `src/components/render.vue` (youtube, vimeo, 3speak, odysee, rumble,
  bitchute, d.tube, ipfs gateways) and an explicit iframe attribute allowlist.
- `src/components/communityHeader.vue` now wraps `renderPostBody()` output for
  `communityDescription` and `communityRules` in `sanitizeRichHtml()` before
  `v-html`.

### Safe external URLs

- New `src/utils/safeUrl.js`:
  - `safeExternalUrl(value, { allowMailto = false })` allows only `http:` /
    `https:` by default (plus `mailto:` when opted in). Rejects protocol-relative,
    `javascript:`, `data:`, `vbscript:`, control-character and malformed values.
  - `safeHrefAttrs(value, options)` returns hardened anchor attributes or `{}`.
- Applied to metadata-driven links:
  - `src/components/accountHeader.vue` — `profile.website`
  - `src/components/communityHeader.vue` — `profile.website`
  - `src/components/userCard.vue` — `profile.website`
  - `src/pages/token.vue` — `ti.metadata.url`
  - Unsafe values render as plain text (no `href`), not as links.

### `target="_blank"` hardening

Added/upgraded `rel="noopener noreferrer"` on every anchor in `src/**/*.vue`
with `target="_blank"` (or `target="blank"`):

- `src/layouts/MainLayout.vue`, `src/pages/token.vue`, `src/pages/hbd.vue`
- `src/components/userServices.vue` (8 links), `src/components/internalMarket.vue`
- `src/components/coingecko.vue`, `src/components/coingeckoCarousel.vue`
- `src/components/proposal.vue` (3 links)
- `src/components/userCard.vue` (handled with safe URL work)

### Docs

- Added `docs/SECURITY.md` with nginx/Cloudflare header recommendations (CSP,
  HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame-ancestors), SmartLock
  threat-model notes, and the Cloudflare Rocket Loader recommendation.
- `index.html`, `package.json` and `bun.lock` were left untouched.

## Checks run

- `rg -n 'lscache|sscjs' src` → no matches.
- `rg -n 'target="(_blank|blank)"' src --glob '*.vue'` → all anchors have
  `rel="noopener noreferrer"` (the one multi-line anchor in `MainLayout.vue`
  carries it on the following line).
- `bunx eslint <all changed files>` → clean.
- `bun run lint` (`eslint .`) → passes with no errors or warnings.
- Manual `purgeLegacyUnlockedKeyCache()` check: removed 2 legacy keys
  (`ausbitdev_peaklock_cache_v2_*` and `lscache-ausbitdev_peaklock_cache_v2_*`),
  left the encrypted locker and unrelated keys, returned 0 on a second run and 0
  with no `localStorage`.
- Did not run `bun run build` or `bun install` (per workstream rules).

## Open issues / coordinator actions

- Remove `lscache` and `sscjs` from `package.json` dependencies (and update
  `bun.lock`). No `src` code imports either package now.
- `sscjs` pulled in `axios@0.21.4`; `axios@^1.7.7` is still a direct dependency
  (used elsewhere), so do not remove `axios` blindly.
- Consider removing the stale `sscjs` mention in `README.md` and the
  `lscache`/`sscjs` references in `docs/MODERNIZATION.md` / `yarn-error.log`
  when the coordinator tidies docs.
- W6 tests should target `getHiveEngine().find()` (fetch mock) and the new
  `safeUrl`/`safeHtml` helpers; the old `sscjs`-shaped client no longer exists.
- Users who previously used "keep unlocked" will now be asked for their password
  after reload by design. Legacy plaintext `ausbitdev_peaklock_cache_v2_*`
  entries are purged once on SmartLock module load; if a user has not loaded the
  app since the purge shipped, the entries remain until the next visit.
- CSP in `docs/SECURITY.md` still needs `'unsafe-inline'` for script/style until
  the build emits nonces/hashes. Do not enable HSTS preload until every
  subdomain is HTTPS-only.
