# Cloudflare metadata Worker

`metadata-worker.mjs` fills post and account link previews from the Hive chain
at the edge. The SPA origin can only derive a title from the URL, so shared
links showed the permlink slug and the app icon before this Worker.

The Worker:

- handles `GET` HTML requests and `POST /csp-report` (or `/csp-report/*`);
- matches `/@account`, `/@account/permlink`, `/@account/lightning`, `/lightning`,
  `/appearance`, `/themes`, `/settings/skin` and `/settings/moderation`;
- serves the prerendered `lightning.html`, `appearance.html`, `themes.html`,
  `settings/skin.html` or `settings/moderation.html` shell with a real 200;
- calls `bridge.get_post` or `bridge.get_profile` on `api.hive.blog` for
  account and post routes;
- rewrites the title, description, canonical, Open Graph, Twitter and JSON-LD
  tags, plus the static crawler `<h1>`/summary;
- accepts CSP violation reports, caps the body at 8 KB and logs one compact
  JSON line per report;
- serves account blogs on `*.banksia.io/*`: it resolves the host to a Hive
  account, rewrites the root/About/Contact/post metadata, serves `/rss.xml`,
  marks unclaimed previews `noindex`, and passes reserved hosts such as
  `files.banksia.io` through untouched;
- caches successful HTML for five minutes;
- returns the untouched origin response on any failure.

## Deploy

The repository root contains `wrangler.jsonc`, so a deploy is one command:

```bash
npx wrangler@4 deploy
```

The Worker is renamed to `banksia-metadata`. After the new routes are verified,
delete the old `hive-metadata` Worker in the Cloudflare dashboard so its legacy
routes cannot shadow the new one.

The Worker is named `banksia-metadata` and is bound to `banksia.io/@*`, the
theme/settings routes and their subpaths. The legacy `hive.ausbit.dev` routes are
kept so old shared links still get the same previews. It handles only `GET` requests that accept HTML; account subpages
(`/wallet`, `/followers`, `/downvotes`, `/pos`, …) are left to the origin SSI
shell.

Verify with a non-JS request:

```bash
curl -sS -D - -o /tmp/post.html \
  -A 'Mozilla/5.0 (compatible; Discordbot/2.0)' \
  -H 'Accept: text/html' \
  'https://banksia.io/@gtg/exchange-node-in-four-lines-hive-1-28-8'
```

A successful lookup returns `x-hive-meta: hit`, the real post title and the
cover image through the images.hive.blog proxy. `miss` means the chain lookup
failed and the origin metadata was served unchanged.

X/Twitter's card crawler sends `Accept: */*`, so the Worker also treats known
preview user agents as HTML clients. Verify that path separately:

```bash
curl -sS -D - -o /dev/null \
  -A 'Twitterbot/1.0' \
  -H 'Accept: */*' \
  'https://banksia.io/@gtg/exchange-node-in-four-lines-hive-1-28-8'
```

It should return `x-hive-meta: hit`. If it returns `miss` or no header, X will
fall back to the generic permlink title and avatar.

`scripts/deploy.sh` does not deploy this Worker. It is independent of a SPA
release and should be updated only when the metadata rules change.

## Blog hosts (`*.banksia.io`)

The Worker serves blog HTML from the apex `https://banksia.io/index.html`
shell and proxies assets and non-HTML paths to the same apex origin. The SPA
router uses the browser URL, so the shell does not need to be the requested
path. This keeps Cloudflare's **strict** SSL mode and the existing `banksia.io`
certificate: **no wildcard origin certificate and no `*.banksia.io` nginx block
are required for the free blog path.** The shell is stripped of the ~39 KB
inline dashboard snapshot before it is returned.

The `/settings/blog` and `/blogs` pages are also served at the edge from the
app shell, so they work before the origin vhost has explicit locations for
them.

### DNS

A proxied wildcard `A` record for `*` pointing at the origin is required. It is
already created (`* → 185.130.44.77`). The Wrangler OAuth token cannot edit
DNS, so use a token with `Zone:Read` + `DNS:Edit` for future changes:

```bash
CLOUDFLARE_API_TOKEN=... ORIGIN_IP=185.130.44.77 \
  bun run cf:blog-dns --dry-run
CLOUDFLARE_API_TOKEN=... ORIGIN_IP=185.130.44.77 \
  bun run cf:blog-dns
```

`ORIGIN_IP` is the nginx origin address:

```bash
ssh hurgenburgen 'curl -s -4 https://ifconfig.me'
```

### Optional: direct-origin and custom domains

A `*.banksia.io` origin certificate (Cloudflare Origin CA or a certbot DNS-01
challenge) and the optional `*.banksia.io` nginx block are only needed when a
request bypasses the Worker or a future custom domain terminates on this
origin. The free blog path never sends a blog host to the origin.

### Verify

```bash
curl -sS -D - -o /dev/null \
  -A 'Twitterbot/1.0' -H 'Accept: */*' \
  'https://alice.banksia.io/a-post'
```

An unclaimed account returns `x-hive-meta: blog`, a shell with `noindex` and no
canonical. A claimed blog returns a canonical `https://alice.banksia.io/a-post`
URL and the real post image. `https://alice.banksia.io/rss.xml` returns the
account feed, `sitemap.xml` lists the blog pages and latest posts, and
`robots.txt` disallows an unclaimed preview. Reserved labels (`www`, `api`,
`files`, `mail`, …) never resolve to a blog.

### Directory and OG fallbacks

- `banksia.io/blogs/directory` is the opt-in directory. The client calls
  `GET /api/blogs`, which lists account names from the `BLOGS` KV namespace
  (`d1d727cfe08b4b98b019d51972437847`, binding in `wrangler.jsonc`), then
  re-verifies each account.
- `POST /api/blogs/register` (body `{ "account": "name" }`) fetches the
  account, requires `claimed && directory` in `posting_json_metadata`, then
  writes or deletes the KV entry. Visiting a blog also refreshes its entry.
- A directory entry stores only the account name; no keys, posts or profile
  data are copied.
- Blogs without a cover use one of three themed 1200×630 cards in
  `public/statics/og-blog-*.png` and emit `og:image:width/height/type`.
- `e2e/blog.spec.js` covers `/blogs`, the directory and a blog host with axe at
  desktop and mobile widths.

## Traffic and WAF rules

Edge traffic controls (AI crawlers, scraper challenges, exploit probes) are
planned in [`RULES.md`](RULES.md). The analysis behind them, including the
real-IP nginx logging that made per-IP behaviour visible, is in
[`docs/analytics-review.md`](../../docs/analytics-review.md).
