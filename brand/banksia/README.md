# Banksia — brand system

The chosen identity for **banksia.io**. The legacy `hive.ausbit.dev` host continues to
serve the same app and canonicalises to `banksia.io`.

> **Rooted in Hive.**

Banksia is the Australian wildflower genus that feeds the hive: nectar-rich,
fire-resilient, and named for Joseph Banks, the botanist on the *Endeavour*. The mark
keeps that story and uses Hive red, so the app reads as part of the Hive family at a
glance without reusing the Hive logo.

## The mark

A **banksia flower spike inside a comb cell**.

- The hexagon is the hive and the chain's visual grammar.
- The spike is built from honeycomb cells, so the flower and the comb are the same shape.
- The curved style and the woody cone at the base make it read as a banksia rather than a
  generic honey drop.
- It reads as a flower, a hive and a single cell at once.

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

## Files

| File | Use |
| --- | --- |
| `banksia-mark.svg` | Transparent primary mark |
| `banksia-mark-mono.svg` | Single-colour line-art mark |
| `banksia-icon-dark.svg` / `.png` | App icon on charcoal |
| `banksia-icon-light.svg` / `.png` | App icon on paper |
| `banksia-favicon.svg` | 16–64px favicon |
| `banksia-lockup-dark.svg` / `.png` | Horizontal lockup for the site header and README |
| `banksia-lockup-light.svg` / `.png` | Light lockup |
| `banksia-lockup-stacked-dark.svg` | Stacked lockup |
| `banksia-pattern.svg` | Hex pattern for surfaces |
| `preview.png` / `preview.html` | One-page brand sheet |

PNG exports are at 512 and 1024 where it matters; the SVGs are the source of truth.

## Positioning

Banksia is positioned for a `.io` domain and a global Hive audience. Keep
**“Banksia on Hive”** as the search-facing phrase so the app is always read in the Hive
context.

## Usage

- Hive red is the brand colour: use it for the spike, primary actions and active states.
- Light red is the cell highlight; deep maroon grounds the cone and works for quiet detail.
- Keep the chain's own Hive badge separate from the app mark; this is a Hive-built
  product, not the chain itself.
- Clear space: at least one cell radius on every side.
- Minimum size: 24px for the mark; 16px for the favicon.
- Do not rotate, stretch or recolour the spike.
- Do not put the lockup on a busy photo without a scrim.
- Prefer the dark lockup on Hive Dark; the light lockup on paper and warm surfaces.

## Remaining

1. Optional: add a stacked light lockup if a vertical layout is needed.
2. Submit the hive.io/eco and hiveprojects.io listings with `../listing.md`.
3. Complete the DNS, certificate, nginx and Cloudflare Worker cutover in the main
   README.
