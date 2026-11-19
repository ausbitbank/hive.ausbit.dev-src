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

```bash
npx wrangler deploy deploy/cloudflare/metadata-worker.mjs \
  --name hive-metadata \
  --route "hive.ausbit.dev/@*"
```

Add a second route if the zone requires it (`hive.ausbit.dev/*`) and let the
Worker return early for non-matching paths.

`scripts/deploy.sh` does not deploy this Worker. It is independent of a SPA
release and should be updated only when the metadata rules change.
