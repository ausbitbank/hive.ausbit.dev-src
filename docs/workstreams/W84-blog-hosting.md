# W84 — Account blogs on `*.banksia.io`

Date: 2026-11-27
Status: deployed for public previews; claim flow deployed but not yet exercised with a real key

## Scope

Give every Hive account a clean reading surface at `<account>.banksia.io`
without exposing the explorer, wallet or governance chrome, and let the account
claim and customise it from the apex site.

- A separate blog route table and layout. A blog host never loads the explorer
  navigation, dashboard or account pages.
- Blog settings live on chain in
  `posting_json_metadata["banksia.io"].blog`, next to the profile theme.
  Claiming and editing use the posting key through `account_update2`; there is
  no server-side configuration database and no key custody.
- Free claim and edit page at `/settings/blog` on `banksia.io`, including title,
  description, theme, accent, pinned posts, contributors, community feed and
  payout/comment toggles.
- Three built-in reading themes (Paper, Studio, Terminal) plus "match my
  profile skin". An author accent is accepted as a hex colour only.
- Multi-author/team blogs: an owner plus up to 20 contributors, and/or a Hive
  community feed.
- Edge metadata and RSS for blog hosts: title, description, Open Graph,
  Twitter cards, JSON-LD, canonical URLs and `/rss.xml`.
- Unclaimed blogs render a public preview with a claim call to action, a
  `noindex` robots tag and no canonical.
- Dotted Hive names are encoded as one DNS label (`hive.fund` →
  `hive--fund.banksia.io`) because a wildcard certificate only covers one level.

Not in this workstream: payments/entitlements, premium themes, custom domains,
a public blog directory, sitemap generation, and live wildcard DNS/TLS.

## Routes and components

| Area | Files |
| --- | --- |
| Host resolution and URL helpers | `src/services/blogHost.js`, `src/config/blog.js` |
| On-chain settings and validation | `src/services/blogSettings.js` |
| Reading-surface helpers | `src/services/blogPosts.js` |
| RSS builder (shared with the Worker) | `src/services/blogFeed.js` |
| Built-in blog themes | `src/themes/blogThemes.js` |
| Tenant state | `src/stores/blog.js` |
| Layout | `src/layouts/BlogLayout.vue` |
| Blog pages | `src/pages/blog/BlogHome.vue`, `BlogPost.vue`, `BlogAbout.vue`, `BlogContact.vue`, `BlogNotFound.vue` |
| Card | `src/components/blog/BlogPostCard.vue` |
| Claim/edit page | `src/pages/blogSettings.vue` |
| Route selection | `src/router/blogRoutes.js`, `src/router/index.js`, `src/router/routes.js` |
| Page metadata | `src/utils/pageMeta.js` (`baseUrl`, `siteName`) |
| Explorer integration | `src/pages/account.vue` ("Blog site" quick link) |
| Edge | `deploy/cloudflare/metadata-worker.mjs`, `wrangler.jsonc` |
| Origin | `deploy/nginx/banksia.io.conf` |

Blog host routes: `/`, `/about`, `/contact`, `/<permlink>`, `/@author/<permlink>`
(contributor posts) and `/p/<permlink>` (a fallback when a permlink collides
with a blog route name).

## On-chain model

```json
{
  "profile": { "name": "Alice", "about": "Writer." },
  "banksia.io": {
    "theme": { "schema": "banksia.io/theme@1", "...": "profile skin" },
    "blog": {
      "version": 1,
      "claimed": true,
      "title": "Alice writes",
      "description": "Notes from the garden.",
      "theme": "auto",
      "mode": "auto",
      "accent": "#8a3b12",
      "nav": [],
      "pinned": ["start-here"],
      "authors": ["alice", "bob"],
      "community": "hive-123456",
      "showPayout": false,
      "showComments": true,
      "customDomain": "",
      "updatedAt": "2026-11-27T00:00:00.000Z"
    }
  }
}
```

The validator is strict: unknown keys are errors, raw CSS is impossible, colours
are hex only, navigation is a site-relative path or an `https://` URL, and the
blog object is capped at 4,000 bytes. Every write is a read-merge-write of the
whole metadata object, so the profile, theme and other apps' keys survive.

## Authority and privacy impact

- Claim/edit build `account_update2` with `json_metadata: ''` and the merged
  `posting_json_metadata`, matching the W63 theme-write and W83 metadata rules.
  The legacy field must stay empty or Hive escalates the operation to active
  authority.
- No new key handling, storage or server. The existing Keychain, HiveAuth and
  SmartLock queue signs the operation.
- Blog settings are public by design. The claim page adds no local storage.
- The blog surface is read-only. Votes, comments, tips and payouts deep-link to
  the apex Banksia post, which keeps signing on the origin the user trusts.
  This matters more once custom domains exist.
- The blog host uses the same CSP and HSTS policy; the vhost already sends
  `includeSubDomains`.

## Edge and origin

- `wrangler.jsonc` adds `*.banksia.io/*` and `banksia.io/settings/blog*` to the
  metadata Worker.
- The Worker resolves the host with the same `blogHost.js` module as the SPA,
  reads the account's posting metadata, and rewrites the head for the root,
  About, Contact and post pages. It serves `/rss.xml` from
  `bridge.get_account_posts`.
- **Apex-origin proxy.** For blog HTML the Worker fetches the apex
  `https://banksia.io/index.html` shell and rewrites its head. Assets,
  manifests and other non-HTML paths are proxied to the same apex origin. The
  SPA router uses the browser URL, so the shell does not need to be the
  requested path.
  - This keeps Cloudflare's **strict** SSL mode and the existing `banksia.io`
    certificate. No wildcard origin certificate and no `*.banksia.io` nginx
    block are required for the free blog path.
  - The shell is stripped of the ~39 KB inline dashboard snapshot before it is
    returned.
- RSS reuses `src/services/blogFeed.js`, so the edge and the tests share one
  escaping/ordering implementation. Blog HTML also carries an RSS discovery
  `<link rel="alternate">`.
- `/sitemap.xml` lists the blog root, About, Contact and the latest 20 posts.
  `/robots.txt` disallows unclaimed previews and points claimed blogs at the
  sitemap.
- Unclaimed blogs get `robots: noindex, follow` and no canonical.
- The post header no longer repeats a lead image that is already inside the
  body; the body remains the visual source of truth.
- Reserved labels (`www`, `api`, `files`, `mail`, …) pass through to their own
  hosts. `files.banksia.io` keeps its separate vhost.
- The nginx vhost still documents an optional `*.banksia.io` block,
  `$hive_blog_host` map and `@spa_fallback` guard. Those are for direct-origin
  access and future custom domains; the Worker path never sends a blog host to
  the origin.
- `/settings/blog` is served at the edge from the app shell, so it works before
  the vhost has an explicit location for it.
- Apex behaviour is unchanged: unknown paths still return a real 404.

## Verification

- `bun run lint` — clean, including the theme-token scanner.
- `bun run test` — 190 files, 1,652 tests passing. New suites:
  `blog-host`, `blog-settings`, `blog-posts`, `blog-feed`, `blog-worker`,
  `cloudflare-dns`; `nginx-routes` and `page-meta` extended.
- `bun run build` — succeeded.
- Headless Chromium smoke against a real account (`asgarth.localhost`):
  - home rendered 20 post cards and the unclaimed-preview banner;
  - a post rendered 1,634 characters of body content;
  - `/about` rendered;
  - no console errors or page errors;
  - screenshots: `/tmp/opencode/blog-home.png`, `/tmp/opencode/blog-post.png`.
- Headless Chromium smoke with a simulated claimed blog (intercepted
  `condenser_api.get_accounts` response): Studio theme, "Start here" pinned
  section, no claim banner, canonical at the blog origin, no `noindex`, 20
  archive cards and a working "Load more" control.
- `/settings/blog?account=asgarth` rendered the preview state, claim CTA,
  disabled form and sign-in notice with no console errors.
- Wrangler `deploy --dry-run` bundled the Worker with the shared `src`
  modules.
- Deployed `banksia-metadata` (46.41 KiB / 12.48 KiB gzip) with the
  `*.banksia.io/*` and `/settings/blog*` routes.
- Created the proxied wildcard `A` record `* → 185.130.44.77` with the
  DNS-scoped token; Cloudflare's authoritative nameservers return the edge
  addresses.
- Deployed the new SPA to `/var/www/banksia.io` with `./scripts/deploy.sh`;
  deploy verification passed.
- Live checks:
  - `https://asgarth.banksia.io/` returns `200`, `x-hive-meta: blog`, title
    "Sergio — Hive blog", `noindex` and no canonical (unclaimed);
  - a live post returns the real title, canonical
    `https://asgarth.banksia.io/<permlink>` and the proxied cover image;
  - `/rss.xml` returns the account feed with absolute blog links;
  - `/sitemap.xml` lists the root, About, Contact and the latest 20 posts;
  - `/robots.txt` disallows unclaimed previews; claimed blogs allow crawlers
    and point at the sitemap;
  - the post header cover is suppressed when the body already has images, so
    the lead image appears once;
  - `/settings/blog?account=asgarth` returns `x-hive-meta: theme-shell` and
    renders the settings page;
  - headless Chromium on the live host rendered 20 cards, a 1,634-character
    post body and the About page with no console errors;
  - apex `banksia.io/@…` previews still return `x-hive-meta: hit` and
    `files.banksia.io` still returns `200`.
- Not run in this workstream: a real posting-key claim/update, the full
  Chromium E2E/axe suite, nginx `-t` for the optional wildcard block, and
  custom domains.

## Deployment checklist (operator)

1. **DNS — done.** Proxied wildcard `A` record `* → 185.130.44.77`. The
   Wrangler OAuth token cannot edit DNS; the record was created with the
   `Zone:Read` + `DNS:Edit` token via `ORIGIN_IP=… bun run cf:blog-dns`.
2. **Origin certificate — not required for the Worker path.** Blog HTML and
   assets are fetched from the apex `banksia.io` origin, so strict SSL uses the
   existing apex certificate. A `*.banksia.io` origin certificate is only
   needed for direct-origin access or a future custom-domain bypass.
3. **nginx vhost — not required for the Worker path.** The optional
   `*.banksia.io` block and `@spa_fallback` guard remain for direct-origin
   access and custom domains. Apply them with
   `bash scripts/apply-nginx-vhost-remote.sh hurgenburgen apply` only when that
   path is needed.
4. **Worker — done.** `banksia-metadata` serves `*.banksia.io/*` and
   `/settings/blog*`.
5. **SPA — done.** `./scripts/deploy.sh` released the blog route table.
6. **Smoke — public preview done.** A real claim on a test account still needs
   a Keychain/HiveAuth/SmartLock run to confirm the subdomain updates after the
   queue broadcasts.

## Remaining work

- Premium entitlements (recurring HBD via `recurrent_transfer`, HP delegation,
  or prepaid terms) and premium themes. Verify entitlement from chain state,
  never from the user-writable blog object.
- Custom domains via Cloudflare for SaaS custom hostnames, with a verification
  UI. Keep custom-domain blogs read-only for signing.
- A public, opt-in directory of claimed blogs.
- A per-blog OG image generator, or a deterministic cover fallback.
- Canonical policy for the duplicate: the apex
  `banksia.io/@author/permlink` page still canonicalizes to itself, so a
  claimed blog post exists at two URLs. Decide whether the apex post should
  canonicalize to the blog or both should remain indexable.
- E2E and axe coverage for the blog routes at desktop and mobile widths.
- A live claim/update smoke with Keychain, HiveAuth and SmartLock.
- Decide whether unclaimed previews stay public or become claim-only after the
  first abuse report.
