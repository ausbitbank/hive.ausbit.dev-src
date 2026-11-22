# W67 — Atmosphere and visual language

Date: 2026-11-23
Status: implemented locally

## Scope

Turn the author's cover into a safe atmosphere layer, expose the banner collage
in the Studio and add the missing visual-language controls plus optional
light/dark token variants.

## Atmosphere

- `profile.atmosphere: { source, treatment, intensity }` with
  `source: none | cover | collage`, `treatment: none | duotone | gradient |
  grain | halftone` and `intensity: subtle | medium | strong`.
- The cover comes from the author's own profile `cover_image`; collage reuses
  `profile.banner.images` (maximum three). Both are restricted to HTTPS on
  known image hosts and resized through `images.hive.blog`.
- `src/components/theme/Atmosphere.vue` renders an app-owned, decorative image
  layer with `pointer-events: none`, CSS filters only, and a scrim whose
  opacity never drops below the readability floor. Missing or broken images
  fall back to the existing pattern/background.
- Calm mode and reduced motion remove drift; the static atmosphere remains.
- The Studio exposes source, treatment, intensity, a picker limited to the
  author's cover, recent uploads and recent posts, and a small/portrait cover
  warning.

## Visual controls

Strict enums on `profile.visual`:

| Control | Values |
| --- | --- |
| `link` | `underline`, `glow`, `highlighter`, `bracket` |
| `button` | `solid`, `outline`, `pill`, `square`, `ticket` |
| `chip` | `pill`, `square`, `stamp`, `ticket` |
| `divider` | `hairline`, `dots`, `wave`, `hex` |
| `image` | `none`, `rounded`, `polaroid`, `stamp`, `duotone` |
| `gradient` | `none`, `to-right`, `to-bottom`, `diagonal`, `radial` |

Geometry, spacing, positioning and layout remain app-owned. The Studio shows
the same enums and the live preview updates immediately.

## Light/dark variants

`variants.light.tokens` and `variants.dark.tokens` are optional full palettes.
The viewer's mode chooses a variant when present; otherwise the base palette is
used exactly as before. Every variant is size-checked and contrast-checked
independently at publish time. The Studio has a Dark / Light / Both selector,
a generated opposite variant for “Both”, a per-variant palette editor and
separate contrast meters.

## Verification

- `bun run lint` — clean.
- `bun run test` — 136 files, 1,168 tests passing at the final W67b gate,
  including variant resolution, independent variant contrast, atmosphere/visual
  enums and safe image hosts.
- `bun run build` — succeeded.
- Chromium E2E — 4/4 in `themes.spec.js` and `badges.spec.js`, covering
  atmosphere, visual attributes, shelf, badges and no badge request on a post
  page.
- Axe at 1440px and 390px — green, including `/appearance`, `/themes` and the
  Skin Studio.
