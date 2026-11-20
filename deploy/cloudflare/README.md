# Cloudflare metadata Worker

`metadata-worker.mjs` fills post and account link previews from the Hive chain
at the edge. The SPA origin can only derive a title from the URL, so shared
links showed the permlink slug and the app icon before this Worker.

The Worker:

- only touches `GET` requests that accept `text/html`;
- matches `/@account` and `/@account/permlink`;
- calls `bridge.get_post` or `bridge.get_profile` on `api.hive.blog`;
- rewrites the title, description, canonical, Open Graph, Twitter and JSON-LD
  tags, plus the static crawler `<h1>`/summary;
- caches successful HTML for five minutes;
- returns the untouched origin response on any failure.

## Deploy

The repository root contains `wrangler.jsonc`, so a deploy is one command:

```bash
npx wrangler deploy
```

The Worker is bound to `hive.ausbit.dev/@*`. It handles only `GET` requests that
accept HTML and match `/@account` or `/@account/permlink`; account subpages
(`/wallet`, `/followers`, …) are left to the origin SSI shell.

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

`scripts/deploy.sh` does not deploy this Worker. It is independent of a SPA
release and should be updated only when the metadata rules change.
