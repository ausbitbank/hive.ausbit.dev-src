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
- caches successful HTML for five minutes;
- returns the untouched origin response on any failure.

## Deploy

The repository root contains `wrangler.jsonc`, so a deploy is one command:

```bash
npx wrangler@4 deploy
```

The Worker is bound to `hive.ausbit.dev/@*`, the theme/settings routes and their
subpaths. It handles only `GET` requests that accept HTML; account subpages
(`/wallet`, `/followers`, `/downvotes`, `/pos`, …) are left to the origin SSI
shell.

Verify with a non-JS request:

```bash
curl -sS -D - -o /tmp/post.html \
  -A 'Mozilla/5.0 (compatible; Discordbot/2.0)' \
  -H 'Accept: text/html' \
  'https://hive.ausbit.dev/@gtg/exchange-node-in-four-lines-hive-1-28-8'
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
  'https://hive.ausbit.dev/@gtg/exchange-node-in-four-lines-hive-1-28-8'
```

It should return `x-hive-meta: hit`. If it returns `miss` or no header, X will
fall back to the generic permlink title and avatar.

`scripts/deploy.sh` does not deploy this Worker. It is independent of a SPA
release and should be updated only when the metadata rules change.

## Traffic and WAF rules

Edge traffic controls (AI crawlers, scraper challenges, exploit probes) are
planned in [`RULES.md`](RULES.md). The analysis behind them, including the
real-IP nginx logging that made per-IP behaviour visible, is in
[`docs/analytics-review.md`](../../docs/analytics-review.md).
