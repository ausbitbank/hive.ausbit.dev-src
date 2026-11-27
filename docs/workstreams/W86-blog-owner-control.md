# W86 — Blog owner control: sections, custom CSS and branding

Date: 2026-11-27
Status: complete — implemented, tested and deployed

## Scope

Make the blog subdomain the one surface where the owner has final control over
presentation. The explorer remains opinionated; the blog does not.

Shipped:

- **Page sections**: hero, pinned posts, archive, about, contact and free text.
  Owners can reorder, hide and remove text sections, and choose a per-section
  layout (grid, list, magazine) for pinned/archive. Text sections carry a title
  and up to 1,200 characters of Markdown.
- **Custom CSS**: up to 8,000 characters, applied only on the blog origin.
  Sanitised to remove `@import`, `data:` URLs, `javascript:`, `expression()`,
  `behavior` and `-moz-binding`; HTTP image URLs are upgraded to HTTPS.
- **Branding**: custom logo/avatar, hero image and favicon URLs.
- **Larger blog object**: the blog budget rises from 4 KB to 12 KB, still inside
  the 16 KB account-metadata cap.
- **Settings UI**: a section builder with up/down/visibility controls, a text
  section editor, custom CSS editor and branding previews.
- **Discoverability**: "Blog settings" is reachable from the account menu, the
  Settings popover, the navigation drawer, the account page and the blog
  footer, so the owner never needs to know or type `/settings/blog`.
- **Backward compatibility**: blogs without `blocks` keep the default
  hero → pinned → archive order.

Not shipped: custom JavaScript, a drag-and-drop visual builder, side
navigation, per-post layout overrides, portfolio/shop pages, or custom domains.

## Research notes

| Product | Owner-control model |
| --- | --- |
| **PeakD Blog** | Curated themes, top/side nav, list/grid, width, light/dark, accent, pinned, portfolio. No arbitrary layout or CSS. |
| **Ecency self-hosted** | Nine templates and a config editor with theme, accent, fonts, search/sidebar, feed filters. Config file, not a page builder. |
| **Snapie MyOwnPage** | Visual builder, ten templates and Hive components. The closest to arbitrary layout control, with a subdomain. |
| **Engrave / dBlog** | Themes and custom domains; less editorial control. |

The Banksia choice was deliberately narrower than a visual builder: a bounded
JSON block list plus custom CSS covers the "my site, my layout" need without
turning the blog into an arbitrary HTML host. Custom JS is explicitly out of
scope because it would turn a read-only subdomain into a signing/phishing
surface.

## Security and privacy

- All settings are normal `posting_json_metadata` written with the posting key.
- The custom CSS is injected through a `<style>` element's `textContent`, so it
  cannot inject HTML or script.
- The sanitiser removes remote stylesheet imports and script-era CSS. Custom
  CSS may still restyle the blog, including hiding UI; the blog remains
  read-only, signing stays on `banksia.io`, and abuse is handled by the normal
  reporting path.
- Custom CSS applies only on the blog origin. The explorer and apex are
  unaffected.
- The author should prefix selectors with `.blog-shell` to beat Vue's scoped
  component selectors without needing `!important`; the settings hint says so.
- Directory and social-card rules from W84/W85 are unchanged.

## Files

| Area | Files |
| --- | --- |
| Block/CSS/URL schema and sanitiser | `src/services/blogSettings.js`, `src/config/blog.js` |
| Block rendering and branding | `src/pages/blog/BlogHome.vue`, `src/layouts/BlogLayout.vue` |
| Store getters | `src/stores/blog.js` |
| Settings builder and CSS editor | `src/pages/blogSettings.vue` |
| Tests | `tests/unit/blog-settings.spec.js`, `e2e/blog.spec.js` |

## Verification

- `bun run lint` — clean.
- `bun run test` — 193 files, 1,681 tests passing. Schema tests cover default
  sections, duplicate fixed sections, unknown types, branding URLs, CSS
  sanitisation and the 12 KB cap.
- `bun run build` — succeeded.
- `e2e/blog.spec.js` — 7 checks pass with axe at 1440×1100 and 390×844,
  including the account-menu discovery path and a blog with no hero, a text
  section, a list archive, custom CSS, a custom logo and a custom favicon.
- `bun run icons:subset` — regenerated after the new `css`/builder icons;
  403 icons, 23 KB.
- Deployed with `./scripts/deploy.sh`; deploy verification passed.

## Remaining

- Custom domains and premium entitlements (W84 follow-ups).
- Side navigation and per-post overrides.
- A full axe matrix for every theme and both variants.
- Custom JavaScript is a non-goal.
