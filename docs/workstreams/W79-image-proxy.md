# W79 — User-selectable image proxy

Date: 2026-11-26 (records work merged in #96 on 2026-11-25)
Status: implemented, deployed and live-smoked (Settings → Images on
2026-11-26); unit/E2E verified.

Contract: issue #96.

## Why

Post body images were always rewritten through `i.ecency.com` by the render
helper's default proxy base, so an Ecency block or outage broke every body
image. Cards and galleries used `images.hive.blog`, which meant readers had no
consistent choice and no way to bypass either host.

## Scope

A device-wide image proxy preference in **Settings → Images**:

- **Hive image host** (`images.hive.blog`, default).
- **Ecency** (previous behaviour, keeps AVIF/WebP sources).
- **Direct from the source** (decodes the `/p/` hash).

The preference applies to rendered post and comment bodies, card and cover
images, and short-form galleries. Changing it re-renders open bodies
immediately. Uploads, avatars and server-side Open Graph images are unchanged.

Because `images.hive.blog` cannot produce AVIF and refuses query-string sources,
those cases fall back to the `img` element or the original URL rather than
producing a broken URL.

## Components

- `src/services/imageProxy.js` — normalisation, host selection and URL builders.
- `src/boot/imageProxy.js` — applies the stored preference at startup.
- `src/components/render.vue`, `src/components/shortForm/ShortFormMedia.vue`,
  `src/utils/postPreview.js` — render and preview paths.
- `src/components/settings.vue` and the Hive store — preference UI and
  persistence.

## Verification

- `tests/unit/image-proxy.spec.js` — mode normalisation, host selection and URL
  construction.
- `tests/unit/render-image-proxy.spec.js` — rendered body behaviour.
- `tests/unit/post-preview.spec.js` — preview/card behaviour.
- `bun run lint` and the full unit suite pass.
- Live smoke on 2026-11-26: production Settings → Images renders the preference
  and the appearance/themes/skin/moderation routes load without console errors.

## Notes

The preference is local to the device and does not change the author's
metadata or any on-chain data. A host outage still degrades images; the direct
mode is the escape hatch and is clearly labelled as slower/unoptimised.
