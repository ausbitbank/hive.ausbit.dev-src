# W108 — Dashboard edit lifecycle and off-screen pollers

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W106 left two dashboard lifecycle follow-ups: entering or cancelling Customise
destroyed and remounted two different grids (refetching every widget), and a live
widget kept polling after it scrolled away because the viewport observer latched
“visible” forever. This slice fixes both without changing any layout data.

## Fixes

1. **One grid for view and edit.** `Index.vue` renders a single `DashboardGrid`
   with `widgets`/`masonry` switched from the saved layout to the draft while
   editing, plus `:editing` and `:packed`. The grid already watched `widgets`,
   `editing` and `packed`; its cells keep their keys, so Customise/Cancel no
   longer tear down every widget body. Save/Cancel still copy and discard the
   draft exactly as before.
2. **Live widgets recycle off-screen.** `DashboardWidgetViewport` gains a
   `recycle` prop. With `recycle: false` (deferred, non-polling widgets) it keeps
   the existing latch: once seen, the body stays mounted. With `recycle: true`
   it follows `isIntersecting` both ways and keeps the observer connected, so the
   body unmounts when the card leaves the expanded root margin and mounts again
   on return.
3. **The registry now matches the behaviour.** `operations` and `priceAlert`
   poll on a timer but were missing `live: true`; `block`, `network`, `vitals`,
   `operations` and `priceAlert` are now recycled. Deferred, non-live widgets
   still mount once and stay mounted.
4. **Edit mode still mounts everything.** `viewportEnabledFor()` returns false
   while editing, so the draft is fully visible and every card can be dragged,
   resized or configured.

## Components

| Area | Files |
| --- | --- |
| Page | `src/pages/Index.vue` |
| Grid/viewport | `src/components/dashboard/DashboardGrid.vue`, `src/components/dashboard/DashboardWidgetViewport.vue` |
| Registry | `src/services/dashboardLayout.js` |
| Tests | `tests/unit/dashboardWidgetViewport.spec.js`, `tests/unit/dashboardLayout.spec.js` |

## Authority and privacy

- No signing, authority, storage or network shape change.
- Recycling stops pollers for cards that are genuinely off-screen; returning to
  the card reads the same cached data or refreshes normally.
- The single grid keeps the existing local-first draft semantics; nothing is
  saved until the user presses Save.

## Verification

- `bun run lint` — clean.
- `bun run test` — dashboard layout, prefs and viewport suites pass.
- `bun run build` — succeeded.
- `bunx playwright test e2e/dashboard.spec.js` — **32/32** passing, including
  templates, masonry, named layouts and the signed-in widget set.

## Remaining

- The recycled widget body unmounts and remounts on long scrolls, so local
  component state (an open dropdown, a filter draft inside a widget) is lost.
  That is the intended trade-off for stopping pollers; widgets with meaningful
  local state could opt out of `live`.
- The viewport still uses a fixed `240px` root margin; a per-widget margin is
  not exposed in the settings UI.
