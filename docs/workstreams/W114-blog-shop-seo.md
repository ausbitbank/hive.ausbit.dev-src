# W114 — Blog canonical, feed and shop-order hardening

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A blog/shop/SEO audit found unclaimed previews and disallowed contributor posts
still advertising article canonicals, Vault/product plumbing in RSS and sitemap,
reserved/dotted permlinks shadowed by the asset check, and shop history rows that
trusted the memo author instead of the payment recipient.

## Worker and canonical policy

1. **Unclaimed posts are noindex.** `postMetadata()` accepts `noindex`, the blog
   post route passes `!claimed`, and the existing head rewriter removes the
   canonical and emits `robots: noindex, follow`.
2. **Unclaimed blogs do not publish feeds or sitemaps.** `/rss.xml`, `/rss` and
   `/sitemap.xml` return 404 for an unclaimed preview instead of advertising
   article URLs.
3. **Contributor/product policy matches the SPA.** The Worker rejects comments,
   Vault containers, products, and posts whose author is neither the owner, a
   curated `settings.authors` entry, nor the configured community before it
   emits Article metadata.
4. **Reserved and dotted permlinks use `/p/`.** `rss`, `csp-report` and any
   permlink containing a dot fall back to `/p/<permlink>`; the Worker exempts
   `/p/`, `/@/` and `/shop/` from the asset-extension check so those pages still
   render metadata.

## Feeds and pages

5. **Feeds hide Vault plumbing and products.** `blogFeedPosts()` filters
   `banksia_vault_container` and `content_type: "product"` before RSS/sitemap
   generation. The SPA archive already used `isBlogPost()`.
6. **About/Contact metadata follows the async blog load.** Both pages watch the
   blog title, claimed flag and settings, so a claimed blog is not left
   `noindex` with a stale title after hydration.

## Shop orders

7. **The payment recipient must be the product author.** History rows are only
   classified as a purchase/sale when the memo's product author equals the
   transfer recipient; a crafted memo cannot create a fake sale for another
   author's product. Recurrent subscriptions use the same rule.

## Settings

8. **Validation errors clear on submit.** The missing newline in
   `blogSettings.submit()` was an ASI bug that skipped `this.errors = []`.

## Components

| Area | Files |
| --- | --- |
| Worker | `deploy/cloudflare/metadata-worker.mjs` |
| Host/canonical | `src/services/blogHost.js` |
| Feeds | `src/services/blogFeed.js` |
| Blog pages | `src/pages/blog/BlogAbout.vue`, `src/pages/blog/BlogContact.vue` |
| Settings/orders | `src/pages/blogSettings.vue`, `src/services/shopOrders.js` |
| Tests | `tests/unit/blog-worker.spec.js`, `blog-host.spec.js`, `blog-feed.spec.js`, `shop-orders.spec.js` |

## Authority and privacy

- No signing change.
- Unclaimed previews and disallowed contributor URLs no longer expose an
  indexable article canonical or feed entry.
- Vault container and product plumbing stays out of public feeds.
- Shop order attribution now fails closed on a mismatched seller.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- `GET /api/blogs` still returns KV entries without re-verifying the on-chain
  `directory` flag; the directory page re-verifies client-side, and entries are
  pruned when the blog host is visited or registration is refreshed.
- `BlogPost.vue` not-found metadata still belongs to the concurrent Vault
  session's file and was not edited here.
- About/Contact watchers update client metadata after hydration; the Worker is
  still the first paint for crawlers.
