# Security notes

This document is the reference for defensive HTTP headers and for the client-side
key model. Nothing here needs a build step; apply the headers at the reverse
proxy (nginx) and/or at Cloudflare. Replace `banksia.io` if the canonical
domain changes.

## Response headers

The production header policy is applied by the nginx origin. The canonical
virtual-host file lives at `deploy/nginx/banksia.io.conf`; install it as
`/etc/nginx/sites-available/banksia.io` and keep the certbot-managed SSL
lines intact. `always` makes sure the headers are also sent on error responses.

### nginx

```nginx
# Deny framing in both the legacy and CSP forms.
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://s3.tradingview.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' https: blob:; connect-src 'self' https: wss: https://cloudflareinsights.com https://*.tradingview.com; manifest-src 'self'; worker-src 'self' blob:; frame-src https://youtube.com https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be https://player.vimeo.com https://vimeo.com https://3speak.tv https://www.3speak.tv https://play.3speak.tv https://odysee.com https://rumble.com https://www.bitchute.com https://d.tube https://ipfs.io https://gateway.ipfs.io https://open.spotify.com https://w.soundcloud.com https://platform.twitter.com https://player.twitch.tv https://s.tradingview.com https://www.tradingview.com; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests; report-uri /csp-report; report-to csp-endpoint" always;
add_header Report-To '{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://banksia.io/csp-report"}]}' always;
add_header Reporting-Endpoints 'csp-endpoint="https://banksia.io/csp-report"' always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

Notes:

- `script-src-attr 'none'` is the load-bearing line: it blocks inline event
  handlers (`onerror=`, `onclick=`) and `javascript:` navigations. `script-src`
  still tolerates inline `<script>` elements because Cloudflare injects a
  per-request bot-detection snippet; the pre-paint theme bootstrap lives in
  `/statics/boot-theme.js`. Once Cloudflare's inline injection is disabled,
  drop `'unsafe-inline'` from `script-src` to make the policy fully strict.
- Violations are posted to `/csp-report` on the `banksia-metadata` Worker. It caps
  bodies at 8 KB and logs one compact JSON line per report; read them with
  `npx wrangler@4 tail banksia-metadata`. `Report-To` and `Reporting-Endpoints` are
  both sent for browser coverage, with `report-uri` kept for older Safari.
- The vhost sets `server_tokens off;` and denies dotfiles (except
  `/.well-known`).
- `style-src 'unsafe-inline'` is required by Vue/Quasar inline styles and by the
  animated background.
- `img-src https:` is intentionally broad: avatars and post images come from
  many Hive image hosts (`images.hive.blog`, `files.peakd.com`, Hive-Engine
  token icons, IPFS gateways, ...).
- `connect-src https:` covers the Hive API nodes, Hive-Engine RPC fallbacks and
  price APIs. Narrow it to the specific hosts if they are stable.
- `frame-src` mirrors the embed allowlist in `src/components/render.vue` and
  `src/utils/embedHosts.js`.
- The origin currently sends HSTS with `preload`. Only keep it once every
  `ausbit.dev` subdomain is HTTPS-only; otherwise drop `preload` there first.
- `worker-src 'self' blob:` is required by the production service worker and
  any blob-backed workers; `manifest-src` covers `/manifest.webmanifest`.
- If nginx sits behind Cloudflare, do not duplicate headers that Cloudflare
  already sets; either let nginx own them (Cloudflare "Transform Rules" off) or
  configure them in Cloudflare and skip the nginx `add_header` lines. Duplicate
  headers are ignored by browsers but make debugging harder.

### Cloudflare

- **SSL/TLS → Edge Certificates**: enable Always Use HTTPS, Automatic HTTPS
  Rewrites, and HSTS (max-age 12 months, include subdomains; preload only when
  ready).
- **SSL/TLS → Edge Certificates**: set Minimum TLS Version to 1.2.
- **Rules → Transform Rules → Modify Response Header**: add the same CSP,
  `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` values
  if Cloudflare terminates the connection and nginx headers are not preserved.
- **Caching → Configuration**: keep HTML uncached or with a short TTL so new
  deployments are picked up. Hashed JS/CSS assets can be cached for a long time.

## nginx / nginx2root (CVE-2026-123007 and friends)

The origin runs Debian's nginx 1.22.1 package. Keep every vhost TLS
`listen` directive free of `http2` and never add `http2 on;`, `listen ... quic`,
`http3 on;`, a request-derived `proxy_pass`/`resolver`, or a mail proxy block:

```nginx
listen 443 ssl;   # good
# listen 443 ssl http2;   <- do not add: enables the CVE-2026-123007 path
```

Cloudflare terminates client HTTP/2/HTTP/3, so browsers still get it; the origin
leg only speaks HTTP/1.1, which keeps the HTTP/2 and HTTP/3 code paths in
nginx unreachable. `deploy/nginx/banksia.io.conf` already follows this.

## Cloudflare Rocket Loader

**Disable Rocket Loader** (Speed → Optimization → Rocket Loader: Off) for this
site. Rocket Loader rewrites `<script>` tags, defers/reorders execution and can
break Vite ES-module bootstrapping and the order in which Quasar and the app
bundle initialise. It also conflicts with a strict `script-src` policy because it
injects its own script. If a performance feature is needed, use Brotli, HTTP/3
and asset caching instead.

## SmartLock key model

- Imported posting/active/memo keys are encrypted in the browser with SJCL
  (AES-CCM, PBKDF2 key derivation, 310,000 iterations for new imports) and
  stored as base58 ciphertext in `localStorage` under
  `ausbitdev_peaklock_v2`. Existing ciphertext records keep their original KDF
  parameters and still decrypt.
- New imports require a password of at least 8 characters. Existing accounts
  with shorter passwords can still be unlocked; the unlock path accepts any
  non-empty password.
- Unlocked keys live **in memory only**. `getPosting()` reads the in-memory map;
  there is no `lscache`/localStorage cache of unlocked keys. Reloading the page
  or calling `lock()`/logout clears the key and requires the password again.
- Keys are only used in the browser to sign the transactions the user queues.
  No private key is ever sent to a server operated by this site.
- Lightning address display and receive invoices require no key. Paying a
  Lightning invoice queues a normal Hive transfer to `@v4vapp` for active-key
  review; the queue marks it manual-only and never auto-broadcasts it. No key
  material or SmartLock payload is sent to v4v.app.
- Because the ciphertext is in `localStorage`, any XSS on the origin can read the
  encrypted blobs and attempt an offline password attack. This makes the header
  policy above (especially CSP) part of the key-storage threat model, not just
  general hardening.

## HiveAuth key model

- HiveAuth is an out-of-band signer. The site opens a WebSocket to
  `wss://hive-auth.arcange.eu/`, shows a `has://auth_req/...` QR/deep link, and
  the user approves in a mobile wallet (PKSA). Private keys stay in the wallet
  and are never sent to this origin or to the HAS relay.
- The app holds a per-session relay token and an AES key shared with the PKSA.
  They are stored in `sessionStorage` under `hiveauth:session:<account>` (or an
  in-memory fallback when storage is unavailable), never in `localStorage`.
  They can request signatures but cannot sign without the phone; logout and
  session expiry clear them.
- One pending request record per tab is stored in `sessionStorage` under
  `hiveauth:pending` as `{account, uuid, kind, expire, key}`. It lets a reload
  or a woken tab attach to the same relay request. Only a pending login keeps
  the temporary auth key; signing and challenge records store no key. The
  record is cleared on completion, cancellation, timeout or `attach_nack`, and
  `clearAllSessions()` removes it.
- Every broadcast is approved in the wallet. Auto-send and "send all" process one
  HiveAuth action at a time and wait for the phone approval; if the phone is not
  available the request times out instead of sending silently. PKSA-side
  whitelisting may reduce prompts, but the site does not rely on it.
- Image uploads use the image host's `/cs/<account>/<signature>` checksum
  endpoint for HiveAuth. The signed challenge is
  `sha256("ImageSigningChallenge" + sha256(file))`, not the file itself, because
  the HAS relay closes messages around 250 KB.
- The relay sees the account name, app metadata, request timing, the encrypted
  payloads and (in protocol 0.8) the session token on signing requests. It does
  not see keys, plaintext operations or the shared AES key (the key is delivered
  to the PKSA through the QR/deep link). It cannot sign without the PKSA; the
  site does not enable or rely on PKSA-side whitelisting.
- The app name in `APP_META` is self-asserted by the protocol, not bound to the
  web origin. Users must check the operation details in the wallet before
  approving. This is a protocol limitation, not a site-specific one.
- `connect-src` already allows `wss:`; if the policy is narrowed later, add
  `wss://hive-auth.arcange.eu` explicitly. QR images use a `data:` URI, which
  `img-src` already allows.

## Profile skin safety

A profile skin is untrusted account metadata that changes the visual surface a
visitor sees. It is not allowed to load unconditionally.

- The safety decision is bound to the **account that owns the metadata**, not
  the self-declared `theme.author` field. A theme that credits a different
  account is shown with a warning and never inherits that account's standing.
- A custom skin does not apply when the viewer has the author on their Hive
  mute list (`follow` with `what: ["ignore"]`) or when the author's displayed
  reputation is below zero. A raw reputation of `0` displays as `25` and is
  not negative.
- The rule **fails closed**: if the viewer's mute list, the author's
  reputation, or a subscribed mute list cannot be resolved, the built-in theme
  stays in place. A follow beats a subscribed mute list by default; it does not
  lift a negative-reputation block unless the viewer explicitly turns on
  "Trust followed reputation". It never lifts a direct mute. The viewer can
  show a specific skin anyway; that override is local and reversible.
- Guests have no mute list, so only reputation and community signals apply.
  The signed-in viewer's list is read once per session with
  `bridge.get_follow_list` and cached in memory plus a bounded sessionStorage
  snapshot (10 minutes). The live node rejects a `limit` argument and returns
  the whole list, so the cache is bounded by entry count and never read per
  card.
- The check reuses the post's `author_reputation` or the cached account record;
  it does not add a chain request to every post page.
- The Skin Studio preview is an authoring surface and requires an explicit
  "Preview anyway" when the owner is blocked. The theme wall omits a blocked
  author's palette and asks for confirmation before adopting it as a site
  palette. Neither path publishes anything.
- This is a local viewer policy, not a site-wide ban list. No list is shared
  with other users, no account is punished, and no chain state is changed.

Implementation: `src/services/moderationPolicy.js` (pure gate),
`src/services/moderationData.js` (cached reads),
`src/services/moderationSettings.js` (local per-account settings),
`src/stores/moderation.js` (viewer snapshot) and
`src/components/theme/ProfileSkin.vue` (rendering and overrides).

## General rules for contributors

- Never pass chain metadata (profiles, community descriptions, token metadata)
  straight into `v-html` or `href`. Use `sanitizeRichHtml()` from
  `src/utils/safeRichHtml.js` and `safeExternalUrl()`/`safeHrefAttrs()` from
  `src/utils/safeUrl.js`.
- Every external link that opens a new tab must use
  `target="_blank" rel="noopener noreferrer"`.
- Do not add third-party scripts without updating the CSP and reviewing the
  supply-chain impact.
