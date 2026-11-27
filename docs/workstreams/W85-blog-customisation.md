# W85 — Blog customisation parity and expansion

Date: 2026-11-27
Status: complete — implemented, tested and deployed

## Scope

Make the existing appearance system work on account blogs, then add the
editorial controls a Hive blog actually needs. The author's on-chain settings
remain the source of truth; the reader gets accessibility and mode controls
that do not overwrite the author's design.

Shipped:

- **Reader mode**: Auto / Light / Dark in the blog header, stored locally per
  blog origin. The author's `mode` setting is the default; a reader override
  wins. Built-in themes now carry the opposite-mode variant so switching does
  not turn the blog into a different theme.
- **Site accessibility preferences**: the blog now honours the appearance
  store's high-contrast setting, reduced-motion/calm preference, and shape
  tokens (`radius`, `border`, `shadow`). The viewer's site theme itself does
  **not** override the author's blog theme; that would erase the design.
- **Archive layouts**: grid cards, list rows, or a magazine layout with the
  first post as a feature.
- **Page width**: narrow (720px), comfortable (1080px) or wide (1320px).
- **Typography**: match the theme, or force serif, sans or monospace.
- **Hero**: profile cover or minimal (no cover).
- **Card metadata**: show/hide tags and reading time.
- **Custom navigation**: the `nav` field that already existed in the schema is
  now rendered in the blog header (up to 6 links).
- **Two more themes**: Journal (quiet, narrow, serif) and Gallery (image-first,
  dark). Five themes total: Paper, Studio, Terminal, Journal, Gallery.
- **Settings UI**: theme, default mode, layout, width, typography, hero,
  navigation links, tags and reading-time toggles.

Not in this workstream: a visual drag-and-drop builder, custom CSS, side
navigation, portfolio pages, products/shop pages, or per-post layout overrides.

## Research notes

Competitive patterns that informed the scope:

| Product | Relevant controls |
| --- | --- |
| **PeakD Blog** | Free and premium themes, top/side navigation, list/grid views, content width, light/dark mode, accent colours, topic bar, pinned posts, portfolio, RSS, localization. |
| **Ecency self-hosted** | Nine style templates (Medium, Minimal, Magazine, Developer, Modern Gradient, Journal, Reader, Gallery, Terminal), light/dark/system, accent, font presets, site metadata, search/sidebar, feed filters. |
| **Snapie MyOwnPage** | Visual builder and ten templates (blog, portfolio, musician, photographer, link-in-bio, business, CV, restaurant, vlogger, community), Hive components, subdomain. |

The high-value, low-risk subset for Banksia was: reader light/dark, archive
layout, content width, typography, hero choice, custom nav, tags/reading time,
and more editorial themes. A visual builder, custom CSS, portfolio and shop are
deliberately out of scope until the free blog proves demand.

## Existing customisation audit

| Existing feature | Blog behaviour before | Now |
| --- | --- | --- |
| Appearance high contrast | Ignored | Passed to `tokensFor` |
| Appearance reduced motion / calm | Ignored | `data-blog-motion="reduced"` disables transitions/animations |
| Theme shape tokens | Defined but not applied | `shapeVarsFor` added to the blog style |
| Theme variants | Present in the schema, unused | Light/dark variants resolved by the reader mode |
| Blog `mode` setting | Stored but unused | Author default; reader can override |
| Blog `nav` setting | Stored but unused | Rendered in the header |
| Site theme (`themeId`) | N/A | Intentionally does not override the author's blog theme |
| Profile skin | Used only when `theme: auto` | Still the `auto` choice; reader mode only works when the skin provides variants |

## Files

| Area | Files |
| --- | --- |
| Themes and variants | `src/themes/blogThemes.js` |
| Viewer mode, width, layout, typography, motion | `src/stores/blog.js` |
| Header reader mode and custom nav | `src/layouts/BlogLayout.vue` |
| Archive layouts, hero, card options | `src/pages/blog/BlogHome.vue`, `src/pages/blog/BlogPost.vue`, `src/components/blog/BlogPostCard.vue` |
| Settings UI | `src/pages/blogSettings.vue` |
| Schema | `src/services/blogSettings.js` |
| Social cards | `src/services/blogSocialCard.js`, `public/statics/og-blog-journal.png`, `og-blog-gallery.png` |
| E2E/axe | `e2e/blog.spec.js` |

## Authority and privacy

- All new settings are normal `posting_json_metadata` fields written with the
  posting key through the existing `account_update2` path.
- Reader mode is a local preference in `localStorage`; it is not published and
  does not touch the chain.
- High contrast and reduced motion come from the existing local appearance
  store. No new network calls or APIs.
- The two new theme OG assets are static files; no image rendering happens on
  the server.

## Verification

- `bun run lint` — clean.
- `bun run test` — 193 files, 1,677 tests passing. `blog-settings`,
  `blog-themes`, `blog-social-card` and the worker suites were extended.
- `bun run build` — succeeded.
- `e2e/blog.spec.js` — 5 checks pass with axe at 1440×1100 and 390×844:
  landing, settings, directory, default blog host, and a customised blog host
  (magazine layout, narrow width, minimal hero, custom nav, no tags/reading
  time, author dark mode, reader light override).
- `validateTheme` covers contrast for every token set and every light/dark
  variant of the five themes.
- Deployed with `./scripts/deploy.sh`; deploy verification passed.

## Remaining

- Side navigation and a per-post layout override.
- Portfolio/gallery pages and a shop/products page.
- Localization of interface strings; posts remain in their own language.
- A full axe pass for every theme and both variants (the current E2E covers the
  Paper layout and the dark/light switch; `validateTheme` covers token contrast
  for all variants).
