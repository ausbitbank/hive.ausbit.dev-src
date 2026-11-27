# W84 — Account blogs on `*.banksia.io`

Date: 2026-11-27
Status: deployed; claim flow verified by the operator on 2026-11-27

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
- A public `/blogs` landing page with a username preview, the three theme
  cards, the free/paid story and a claim call to action.
- A client-side 1200×630 social-card generator in `/settings/blog`. It draws
  the current title, description, account and theme on a canvas, uploads the
  PNG through the existing `images.hive.blog` posting-key flow, and stores the
  URL in `blog.ogImage`.
- An opt-in public directory at `/blogs/directory`. A KV index stores only
  account names; every read and write is re-verified against the on-chain
  `claimed` and `directory` flags.
- Deterministic 1200×630 themed OG fallback cards for blogs without a cover.
- Playwright axe coverage for `/blogs`, `/blogs/directory` and a blog host.
- Three built-in reading themes (Paper, Studio, Terminal) plus "match my
  profile skin". An author accent is accepted as a hex colour only.
- Multi-author/team blogs: an owner plus up to 20 contributors, and/or a Hive
  community feed.
- Edge metadata and RSS for blog hosts: title, description, Open Graph,
  Twitter cards, JSON-LD, canonical URLs, `/rss.xml`, `/sitemap.xml` and
  `/robots.txt`.
- Unclaimed blogs render a public preview with a claim call to action, a
  `noindex` robots tag and no canonical.
- Dotted Hive names are encoded as one DNS label (`hive.fund` →
  `hive--fund.banksia.io`) because a wildcard certificate only covers one level.

Not in this workstream: payments/entitlements, premium themes and custom
domains.

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
| Landing page | `src/pages/blogs.vue` |
| Directory page | `src/pages/blogsDirectory.vue` |
| OG fallbacks | `public/statics/og-blog-paper.png`, `og-blog-studio.png`, `og-blog-terminal.png` |
| E2E/axe | `e2e/blog.spec.js` |
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
      "directory": true,
      "ogImage": "https://images.hive.blog/...social-card.png",
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
- The directory stores only opted-in account names in Cloudflare KV. Every
  write and every directory read re-verifies `claimed && directory` against the
  on-chain metadata; opting out deletes the KV entry. No keys or post content
  are stored.
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
- The directory API is `GET /api/blogs` (KV account names) and
  `POST /api/blogs/register` (re-verifies the on-chain flags, then writes or
  deletes the KV entry). Visiting a blog also refreshes its entry through
  `waitUntil`. The directory page re-verifies each account before rendering.
- When a blog has no cover, the root/About/Contact metadata and posts without
  their own image use a themed 1200×630 OG card and emit
  `og:image:width/height/type`. A generated `blog.ogImage` wins over the
  profile cover, and the profile cover wins over the themed fallback.
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
- `bun run test` — 193 files, 1,674 tests passing. New suites:
  `blog-host`, `blog-settings`, `blog-posts`, `blog-themes`, `blog-feed`,
  `blog-social-card`, `blog-worker`, `blog-directory-worker`,
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
  - the live `/settings/blog?account=ausbitbank` shows the Social card section,
    the themed preview and a disabled Generate button when signed out;
  - the schema rejects a non-https `ogImage`, and the Worker prefers
    `blog.ogImage` over the profile cover and themed fallback (unit-tested);
  - headless Chromium on the live host rendered 20 cards, a 1,634-character
    post body and the About page with no console errors;
  - apex `banksia.io/@…` previews still return `x-hive-meta: hit` and
    `files.banksia.io` still returns `200`.
- A real claim was tested by the operator on 2026-11-27 and works; no code
  change was needed.
- `https://banksia.io/blogs` renders the landing page, the three theme cards
  and the username preview/claim form; the claim action opens
  `/settings/blog?account=<name>`.
- `e2e/blog.spec.js` — 3 checks pass: `/blogs`, a mocked `/blogs/directory`
  and a mocked blog host, with axe at 1440×900 and 390×844.
- Live directory API: `GET /api/blogs` returns
  `{ accounts: [], configured: true }`. Registering the claimed but
  non-opted-in `ausbitbank` returns `409`, proving the on-chain
  `claimed && directory` check. `ausbitbank.banksia.io` serves the claimed blog
  with a blog canonical and no `noindex`, and its profile cover is used as
  `og:image`.
- `/blogs/directory` returns `200` with `x-hive-meta: theme-shell`; the themed
  OG assets return `200`.
- The directory is intentionally empty until an owner opts in: `ausbitbank` is
  claimed but its settings predate the `directory` field, so it must enable the
  toggle and refresh the listing.
- Not run in this workstream: the full Chromium suite (only `e2e/blog.spec.js`
  was run), nginx `-t` for the optional wildcard block, and custom domains.

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
4. **Worker — done.** `banksia-metadata` serves `*.banksia.io/*`,
   `/settings/blog*`, `/blogs*` and `/api/blogs*`.
5. **Directory KV — done.** Namespace `BLOGS`
   (`d1d727cfe08b4b98b019d51972437847`) is bound in `wrangler.jsonc`.
6. **SPA — done.** `./scripts/deploy.sh` released the blog route table, the
   directory and the themed OG assets.
7. **Smoke — done.** A real claim was tested on 2026-11-27 and works; the
   subdomain updates after the queue broadcasts.

## Remaining work

- Premium entitlements and premium themes. Verify entitlement from chain state,
  never from the user-writable blog object.
- Custom domains via Cloudflare for SaaS custom hostnames, with a verification
  UI. Keep custom-domain blogs read-only for signing.
- Canonical policy for the duplicate: the apex
  `banksia.io/@author/permlink` page still canonicalizes to itself, so a
  claimed blog post exists at two URLs. Decide whether the apex post should
  canonicalize to the blog or both should remain indexable.
- Decide whether unclaimed previews stay public or become claim-only after the
  first abuse report.
