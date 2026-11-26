# W81 — Banksia rebrand and banksia.io cutover

Status: implemented; host cutover and full release gate pending.

## Scope

Rename the product from `hive.ausbit.dev` to **Banksia** at `banksia.io`, keep the
original subdomain fully functional as a legacy host, and make sure existing posts,
drafts, themes and saved searches keep working after the rename.

## What changed

- Added `src/config/brand.js` as the single source of truth for the name, canonical
  URL, legacy host, app id, theme namespace/schema and repository links.
- Updated `index.html`, the manifest, offline shell, feed, sitemap, robots file,
  page metadata, JSON-LD, Open Graph and the Cloudflare metadata Worker to use
  `banksia.io` and the Banksia name.
- Added the Banksia mark, lockups, app icons, favicons, Open Graph card and the
  one-page brand sheet under `brand/banksia/`; copied the runtime assets into
  `public/statics/`.
- Replaced the header/boot mark with a simplified red Banksia spike that reads at
  22–28px; the full mark is used for app icons and the brand sheet.
- Updated the nginx vhost to `deploy/nginx/banksia.io.conf` with
  `banksia.io`, `www.banksia.io` and `hive.ausbit.dev` in the same server block.
  `www` redirects to the apex; the legacy host is served without a redirect.
- Updated the deploy/rollback/verify scripts and the Cloudflare Worker routes for
  the new domain, while keeping the legacy routes.
- New content writes `app: banksia.io`; readers still recognise
  `hive.ausbit.dev` posts and drafts.
- New themes write the `banksia.io` namespace and `banksia.io/theme@1` schema;
  readers accept the legacy namespace/schema and migrate on the next write.
- Updated current docs and the hive.io listing copy; historical workstream records
  were left untouched.

## Authorities

Metadata-only change. No new posting or active authority paths. The existing
posting/active queue semantics are unchanged.

## Verification

- `bun run lint` — clean.
- `bun run test` — 1,524 tests across 177 files passed.
- `bun run build` — succeeded; `index.html`, manifest, feed, sitemap, OG image and
  icons verified in `dist/spa`.
- Fast Obscura E2E: `e2e/pos.spec.js` — 2 passed, 1 Chromium-only check skipped.
- Full Chromium suite and the complete Obscura suite were not run in this session.
  Theme-wall/theme-share E2E fixtures still need a pass on the release host.

## Host cutover

See the **banksia.io cutover** section in `README.md`. The short version:

1. Point `banksia.io`/`www` at Cloudflare and add the zone.
2. Install `deploy/nginx/banksia.io.conf`, enable it and remove the old symlink.
3. Run certbot for `banksia.io`, `www.banksia.io` and `hive.ausbit.dev`.
4. Run `./scripts/deploy.sh`; the first run seeds `/var/www/banksia.io` from the
   old docroot.
5. Deploy the `banksia-metadata` Worker and remove the old `hive-metadata` Worker.
6. Verify both hosts; canonical/OG/JSON-LD must always point at `banksia.io`.
7. Ask v4v.app to add `https://banksia.io` to its CORS allowlist and register the
   `banksia` app name. The legacy origin remains allowlisted meanwhile.

## Notes

- The legacy host is intentionally not redirected. It serves the same build and
  canonicalises to `banksia.io`, so old links keep working while search engines
  consolidate on the new domain.
- The service-worker cache name is now `banksia-shell-*`; the worker deletes the
  old cache on activation.
- `www.banksia.io` is an alias that redirects to the apex.
- The old `/var/www/hive.ausbit.dev` directory is only used as the seed for the
  first deploy; the new docroot is `/var/www/banksia.io`.
