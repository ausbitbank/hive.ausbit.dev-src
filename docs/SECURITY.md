# Security notes

This document is the reference for defensive HTTP headers and for the client-side
key model. Nothing here needs a build step; apply the headers at the reverse
proxy (nginx) and/or at Cloudflare. Replace `hive.ausbit.dev` if the canonical
host changes.

## Response headers

The production header policy is applied by the nginx origin. The canonical
virtual-host file lives at `deploy/nginx/hive.ausbit.dev.conf`; install it as
`/etc/nginx/sites-available/hive.ausbit.dev` and keep the certbot-managed SSL
lines intact. `always` makes sure the headers are also sent on error responses.

### nginx

```nginx
# Deny framing in both the legacy and CSP forms.
add_header X-Frame-Options "DENY" always;
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' https: blob:; connect-src 'self' https: wss: https://cloudflareinsights.com; manifest-src 'self'; worker-src 'self' blob:; frame-src https://www.youtube.com https://youtube.com https://player.vimeo.com https://3speak.tv https://odysee.com https://rumble.com https://www.bitchute.com https://d.tube https://ipfs.io https://gateway.ipfs.io; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

Notes:

- `script-src 'unsafe-inline'` is currently required because Quasar/Vite inject
  a small bootstrap script. If the build ever emits CSP nonces/hashes, tighten
  this to `script-src 'self'` plus the nonce.
- `style-src 'unsafe-inline'` is required by Vue/Quasar inline styles and by the
  animated background.
- `img-src https:` is intentionally broad: avatars and post images come from
  many Hive image hosts (`images.hive.blog`, `files.peakd.com`, Hive-Engine
  token icons, IPFS gateways, ...).
- `connect-src https:` covers the Hive API nodes, Hive-Engine RPC fallbacks and
  price APIs. Narrow it to the specific hosts if they are stable.
- `frame-src` mirrors the embed allowlist in `src/components/render.vue` and
  `src/utils/safeHtml.js`.
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
nginx unreachable. `deploy/nginx/hive.ausbit.dev.conf` already follows this.

## Cloudflare Rocket Loader

**Disable Rocket Loader** (Speed → Optimization → Rocket Loader: Off) for this
site. Rocket Loader rewrites `<script>` tags, defers/reorders execution and can
break Vite ES-module bootstrapping and the order in which Quasar and the app
bundle initialise. It also conflicts with a strict `script-src` policy because it
injects its own script. If a performance feature is needed, use Brotli, HTTP/3
and asset caching instead.

## SmartLock key model

- Imported posting/active/memo keys are encrypted in the browser with SJCL
  (AES-CCM, PBKDF2 key derivation, 100,000 iterations for new imports) and
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
- Because the ciphertext is in `localStorage`, any XSS on the origin can read the
  encrypted blobs and attempt an offline password attack. This makes the header
  policy above (especially CSP) part of the key-storage threat model, not just
  general hardening.

## General rules for contributors

- Never pass chain metadata (profiles, community descriptions, token metadata)
  straight into `v-html` or `href`. Use `sanitizeRichHtml()` from
  `src/utils/safeHtml.js` and `safeExternalUrl()`/`safeHrefAttrs()` from
  `src/utils/safeUrl.js`.
- Every external link that opens a new tab must use
  `target="_blank" rel="noopener noreferrer"`.
- Do not add third-party scripts without updating the CSP and reviewing the
  supply-chain impact.
