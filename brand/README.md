# Brand

## Chosen: Banksia

> **Rooted in Hive.**

The app is now **Banksia** at **https://banksia.io**. The mark is a banksia flower
spike built from honeycomb cells, in Hive red, inside a comb cell. The legacy
`hive.ausbit.dev` host continues to serve the same build and canonicalises to
`banksia.io`.

| Item | Where |
| --- | --- |
| One-page brand sheet | [`banksia/preview.png`](banksia/preview.png) |
| Full brand notes | [`banksia/README.md`](banksia/README.md) |
| Marks, icons, favicon, lockups | [`banksia/`](banksia/) |
| Listing title, tagline, keywords and 282-word pitch | [`listing.md`](listing.md) |
| App icons | `public/statics/` and `public/statics/icons/` |

## Palette

| Token | Hex | Use |
| --- | --- | --- |
| Charcoal | `#0D1114` | Primary background (Hive Dark) |
| Hive red | `#E31337` | Spike, primary actions, active states |
| Light red | `#FF6B7A` | Cell highlight, soft accents |
| Warm white | `#F6F1E7` | Hex outline, headline on dark |
| Deep maroon | `#5A0F1B` | Woody cone, quiet grounding detail |
| Paper | `#FAF6EF` | Light-mode background |
| Surface | `#151C21` | App icon background, cards |
| Muted | `#90A4AE` | Secondary text, captions |

## Type

- Wordmark: Inter Display Bold, tracked −2%, supplied as outlines.
- UI: Inter Regular / Medium with tabular numerals.

## Other explored directions

- [`jarrah/`](jarrah/) — parked. A quick pivot concept; not the chosen name.
- [`comb/`](comb/) — rejected. `hivecomb.net` is an active Hive discovery and
  publishing frontend.

## App integration checklist

1. Keep `banksia.io` canonical in `src/config/brand.js`, page metadata, Open Graph,
   JSON-LD, feed, sitemap and the Cloudflare metadata worker.
2. Keep `hive.ausbit.dev` in the nginx `server_name` list and the Cloudflare routes so
   old links resolve; canonical URLs still point at `banksia.io`.
3. New posts write `app: banksia.io`; readers still recognise `hive.ausbit.dev` posts.
4. New themes write the `banksia.io` namespace and schema; readers accept the legacy
   `hive.ausbit.dev` values.
5. Regenerate icons and the OG image if the mark changes.
6. Update the hive.io/eco and hiveprojects.io listings with [`listing.md`](listing.md).
