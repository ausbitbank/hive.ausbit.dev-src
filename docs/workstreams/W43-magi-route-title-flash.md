# W43 — `/magi` 404 title flash

Date: 2026-11-21
Status: fixed and installed on the host

## Symptom

Opening `https://hive.ausbit.dev/magi` directly showed **Page not found (404)
— hive.ausbit.dev** in the tab title until Vue mounted and set the real Magi
title.

## Root cause

This was an nginx routing gap, not Cloudflare and not the SPA router.

- Cloudflare's metadata Worker is routed only to `hive.ausbit.dev/@*` (and its
  lightning paths). `/magi` never reaches it.
- The origin's `location /` uses `try_files $uri $uri/ =404`, so `/magi` only
  works if a dedicated location maps it to the prerendered `magi.html`.
- `deploy/nginx/hive.ausbit.dev.conf` has a **Prerendered static pages**
  regex for exactly that, but the production file on `hurgenburgen` was stale:
  it was missing both `magi` and `lightning`. `/magi` therefore fell through
  to `error_page 404 =404 @spa404`, which returns the 404 shell (with its 404
  title) at HTTP 404 while the SPA still boots over it.
- `scripts/prerender.mjs` has always generated `magi.html`; only the nginx
  allowlist was missing it. The same check found `/lightning` returning 404 for
  the same reason (and the account `/<account>/lightning` subpage missing from
  the dynamic metadata regex).

## Changes

- `deploy/nginx/hive.ausbit.dev.conf`: added `magi` and `lightning` to the
  prerendered static pages location, and `lightning` to the account subpage
  metadata regex (this matches the already-updated repo copy; the host file
  needed reinstalling).
- `scripts/lib/prerender-meta.mjs`: moved the prerender route list into
  `PRERENDER_ROUTES` so tests and the prerender script share one source.
- `scripts/prerender.mjs`: imports `PRERENDER_ROUTES`.
- `tests/unit/nginx-routes.spec.js`: asserts every prerendered route except
  `/` and `/404` has an nginx location that serves its own `.html` shell. This
  fails for `/magi` without the regex change.

## Verification

- `bun run test -- tests/unit/nginx-routes.spec.js
  tests/unit/prerender-meta.spec.js` — 7 tests passed.
- Removing `|magi` from the config makes the new test fail with
  `missing: ['/magi']`, so it guards the regression.
- Production status check before the fix:
  - `/magi` → 404, title "Page not found (404) — hive.ausbit.dev"
  - `/lightning` → 404
  - every other prerendered route → 200
- `command diff -u` against `/etc/nginx/sites-available/hive.ausbit.dev` on
  `hurgenburgen` confirmed the host file is the stale copy.

## Install on the host

The `ausbitbank` SSH account has no passwordless sudo, so the config was not
installed by the agent. The maintained install command is:

```bash
scp deploy/nginx/hive.ausbit.dev.conf hurgenburgen:/tmp/hive.ausbit.dev.conf
ssh -t hurgenburgen 'sudo cp -a /etc/nginx/sites-available/hive.ausbit.dev \
  /etc/nginx/sites-available/hive.ausbit.dev.bak-$(date -u +%Y%m%dT%H%M%SZ) && \
  sudo install -m 644 /tmp/hive.ausbit.dev.conf /etc/nginx/sites-available/hive.ausbit.dev && \
  sudo nginx -t && sudo systemctl reload nginx'
```

Installed on 2026-11-21. The host backup is
`/etc/nginx/sites-available/hive.ausbit.dev.bak-20261121T060229Z`; `nginx -t`
passed and the service reloaded.

Live verification after the reload:

| URL | Status | Title |
| --- | --- | --- |
| `/magi` | 200 | Magi contracts — inspect state, outputs and simulation |
| `/lightning` | 200 | Lightning — receive sats as Hive or pay Lightning invoices |
| `/@ausbitbank/lightning` | 200 | @ausbitbank Lightning — hive.ausbit.dev |
| `/magi/` | 301 | trailing-slash policy |

No SPA rebuild was needed; both `magi.html` and `lightning.html` were already
on the host from the W42 deploy.
