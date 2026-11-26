# W3 — SEO / meta / sitemap

Status: implementation complete (pending coordinator integration and a live
crawler smoke).

Branch: `improve/phase-2`. Only SEO side effects were added; layout, routes and
data loading were left unchanged. `src/router/index.js` was **not** modified:
metadata is owned by each page, so no global guard was needed.

## Files changed

New:

- `src/utils/pageMeta.js` — `setPageMeta`, `setJsonLd`, `stripHtml`, plus
  `SITE_NAME`, `BASE_URL`, `DEFAULT_DESCRIPTION`, `DEFAULT_IMAGE`.
- `public/sitemap.xml` — 15 core static routes, `lastmod` 2026-11-17.

Edited:

- `index.html` — default title/description/canonical and OG/Twitter tags.
  Viewport is still `width=device-width, initial-scale=1` and all favicon links
  are untouched.
- `public/robots.txt` — added the sitemap URL.
- `src/pages/`: `Index`, `account`, `post`, `block`, `tx`, `wallet`,
  `browse`, `proposals`, `witnesses`, `nodes`, `hbd`, `market`, `markets`,
  `create`, `blocks`, `health`, `tax`, `Error404`, `witness`, `hbdstabilizer`,
  `trail`, `token`.

No changes to `package.json`, `bun.lock`, `tests/**`, `vitest.config.js`,
`.github/**` or `src/components/**`.

## Meta strategy

`setPageMeta({ title, description, image, url, type = 'website', jsonLd = null })`
updates the head in place:

| Element | Selector |
|---------|----------|
| page title | `document.title` |
| description | `meta[name="description"]` |
| canonical | `link[rel="canonical"]` |
| Open Graph | `meta[property="og:site_name"]`, `og:type`, `og:title`, `og:description`, `og:image`, `og:url` |
| Twitter | `meta[name="twitter:card"]`, `twitter:title`, `twitter:description`, `twitter:image` |

- Every tag is upserted by selector, so repeated navigation replaces instead of
  appending duplicates. `index.html` seeds the same default tags so the very
  first paint already has OG/Twitter metadata.
- `url` and `image` are resolved with `new URL(value, 'https://hive.ausbit.dev')`.
  Missing/invalid values fall back to `/` and
  `/statics/icons/icon-512x512.png`; relative image paths therefore become
  absolute.
- Descriptions pass through `stripHtml(value, maxLength = 200)`, which uses
  `DOMParser` (with a regex fallback for non-DOM environments), inserts spaces at
  block boundaries (`</p>`, `<br>`, headings, list items, …), collapses
  whitespace, decodes entities and truncates on a word boundary with `…`.
  Post descriptions are built from the first 4k of the body and capped at 160
  chars.
- `setJsonLd(obj)` upserts `script#page-json-ld`; `setPageMeta` always calls it,
  so navigating from a post/account to another page removes stale JSON-LD.
- Missing descriptions fall back to the default site description inside the
  helper, so no primary page can emit an empty `description` or `og:description`.

### Per-page metadata

| Page | Title | Notes |
|------|-------|-------|
| Home `/` | `hive.ausbit.dev — Hive block explorer` | static |
| Account `/@user` | `Display Name (@user) — Hive account` | about/`profile_image`/`cover_image` from `posting_json_metadata`; refreshes via an `account` watcher; `ProfilePage` + `Person` JSON-LD (avatar fallback) |
| Post `/@user/permlink` | post title (fallback `Hive post by @user`) | description from body, `og:type=article`, `json_metadata.image`, `Article` JSON-LD; a loading title is set in `init()` before the API responds |
| Block `/block/N` | `Hive block N` | canonical `/block/N` (so `/b/N` canonicalises) |
| Tx `/tx/:id` | `Hive transaction <id>` | |
| Wallet `/@user/wallet` | `@user's Hive wallet` | canonical always `/@user/wallet` (also for `/@user/transfers`) |
| Browse / trending / created / hot / tag | sort + tag (`Trending Hive posts in #hive`), account sections (`@user's Hive blog`), communities (`hive-123456 — Hive community`) | `$route` watcher keeps it in sync |
| Proposals | `Hive proposals — Decentralized Hive Fund` (detail includes id) | canonical `/proposals` (also for `/dao`) |
| Witnesses / Nodes / HBD / Market / Markets | descriptive titles | |
| Blocks `/blocks` | `Latest Hive blocks` | |
| Create `/create` | `Create a Hive account — keys, fees and onboarding` | |
| Health `/health` | `Hive network health — witnesses, participation and nodes` | |
| Tax `/tax` | `Hive tax export — wallet transaction history` | |
| 404 | `Page not found (404) — hive.ausbit.dev` | |
| Also covered | witness tools, HBD Stabilizer, vote trail, Hive-Engine token | previously only set `document.title`, now full metadata |

## Sitemap / robots

`public/sitemap.xml` contains `/`, `/blocks`, `/browse`, `/trending`,
`/created`, `/hot`, `/witnesses`, `/proposals`, `/hbd`, `/market`, `/markets`,
`/nodes`, `/health`, `/create`, `/tax` with `lastmod` 2026-11-17,
`changefreq` (hourly for blocks/trending/created/hot/market/markets, daily for
the rest, monthly for create/tax) and priorities 1.0 → 0.4.

Account, post, block, tx and token URLs are intentionally omitted: they are
unbounded and are reached through internal links. An XML comment in the file
records that decision.

`public/robots.txt` now ends with
`Sitemap: https://hive.ausbit.dev/sitemap.xml`.

## Checks run

- `bun run lint` (`eslint .`) → **passes, 0 errors, 0 warnings**.
- `public/sitemap.xml` parsed with Python `xml.etree.ElementTree` → valid XML,
  15 `<url>` entries.
- Source inspection of the setter calls for home, account, post, block and nodes
  confirms each supplies a non-empty title/description and that `setPageMeta`
  writes canonical, six OG tags and four Twitter tags.
- A throwaway jsdom harness (in `/tmp/opencode`, not committed) loaded
  `src/utils/pageMeta.js` and navigated post → home → account → block → nodes:
  - exactly one tag for every `og:*`, `twitter:*`, `description` and
    `link[rel=canonical]` selector after every call (no duplicates);
  - relative canonical/image values became
    `https://hive.ausbit.dev/...`;
  - `og:type` changed `article` → `website`;
  - article JSON-LD was replaced/removed correctly;
  - `stripHtml` joined paragraphs with a space, decoded `&nbsp;`, and truncated
    to the requested length.
- `git diff --check` → clean (no whitespace errors).
- Did **not** run `bun run build` or `bun install` (workstream rules).

## Open issues / risks

- **Client-side meta only.** The app is an SPA, so the tags are changed after
  JavaScript runs. Google renders JS, but many social/crawler bots
  (Facebook, LinkedIn, Slack, Discord, iMessage) fetch raw HTML only. They will
  see the defaults from `index.html`, not per-account/post cards. Fixing that
  properly needs SSR/prerendering or an edge/nginx meta-injection rule keyed on
  the URL — a separate, larger change.
- **Dynamic pages need data first.** Account and post titles/descriptions/images
  are exact only after the store/API returns. A loading title is set for posts;
  accounts get a fallback title first. Slow nodes delay the final card.
- **Hive API outages** leave the fallback title/description in place (no empty
  tags), which is acceptable but not page-specific.
- Query strings are excluded from canonicals (correct for pagination/filters);
  `/b/N` → `/block/N`, `/dao` → `/proposals`, `/@user/transfers` →
  `/@user/wallet` are canonicalised. `/browse/:sort` variants keep their own
  path (self-canonical) rather than aliasing `/trending` etc.
- `browseContainer.vue` and `components/nodes.vue` still assign
  `document.title` in their own `mounted` hooks (untouched, component-owned).
  Children mount before the page component, so the page meta wins; a future
  cleanup could remove the component-level titles.
- Sitemap `lastmod` is a fixed date; regenerate it from the build/deploy date if
  the coordinator wants it to stay fresh.
