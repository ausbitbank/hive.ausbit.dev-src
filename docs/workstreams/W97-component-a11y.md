# W97 — Component accessibility follow-ups

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A component/layout accessibility audit found interactive controls that were
unreachable or unnamed for keyboard and screen-reader users. This workstream
fixes the deterministic cases:

1. **Browse filter switches had no accessible names.** The visible
   `q-item-label` is a sibling, not a label. All six filter toggles now carry an
   `aria-label` matching their visible text.
2. **Pinned-post and delegate avatar links were unnamed.** Both are icon-only
   links. They now expose “View pinned post by @account” and “View @delegatee”.
3. **Amount shortcuts were mouse-only spans.** The “Available: …” balance in
   the transfer and staking dialogs is now a real `button` with an accessible
   name and a visible focus ring. Enter and Space work.
4. **Short-form previews were click-only paragraphs.** The preview is now a
   full-width button with the same text styling and a focus ring; the footer
   controls are unchanged.
5. **“Remember me” nested a checkbox inside a button.** The login menu now uses
   one labelled `q-checkbox`, removing the nested interactive control.
6. **The recently-voted carousel ignored reduced motion and retried forever.**
   Autoplay starts off when the user prefers reduced motion, hover only pauses
   temporarily, a visible play/pause button gives keyboard users control, and
   the gap-retry loop is capped at five attempts, cleared on unmount, and
   skipped while the tab is hidden.
7. **Shorts, trail and witnesses had no page-level heading.** Each now exposes
   exactly one `h1`; the existing section headings stay `h2`.
8. **PWA update dialog used white text on the light primary blue.** Primary
   dialog actions now use the same dark ink token as other brand buttons, and
   the service-worker update test runs axe before confirming the reload.

## Components

| Area | Files |
| --- | --- |
| Browse filters | `src/components/browseContainer.vue` |
| Profile links | `src/components/communityHeader.vue`, `src/components/delegations.vue` |
| Amount shortcuts | `src/components/transferDialog.vue`, `src/components/stakingDialog.vue` |
| Short-form preview | `src/components/shortForm/ShortFormCard.vue` |
| Login menu | `src/components/userLogin.vue` |
| Carousel | `src/components/recentVotedPostsCarousel.vue` |
| PWA dialog | `src/css/app.scss`, `src/boot/pwa.js`, `src/boot/chunkRecovery.js` |
| Tests | `tests/unit/recent-voted-carousel.spec.js`, `e2e/browse.spec.js`, `e2e/a11y.spec.js`, `e2e/pwa.spec.js` |

## Authority and privacy

- No authority, signing or data-flow change.
- The carousel makes fewer reads on repeated errors and none while hidden.
- No new storage key or server call.

## Verification

- `bun run lint` — clean.
- `bun run test` — **232 files / 2,252 tests** passing.
- `bun run build` — succeeded.
- Targeted Playwright: browse filter switch by accessible name; a11y routes at
  1440×900 and 390×844 for the pages that changed; the PWA update dialog is
  axe-clean before the reload is confirmed.

## Remaining

- The carousel still renders a duplicate plain list of its posts below the
  cards; that is visible content, not an accessibility defect, but it should be
  redesigned rather than kept forever.
- A full axe matrix for every theme/variant is still open in the W85/W86
  follow-ups.
- `q-btn`-style text controls elsewhere in legacy pages should be migrated to
  real buttons as they are touched.
