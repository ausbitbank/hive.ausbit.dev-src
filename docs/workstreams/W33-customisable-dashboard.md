# W33 — Customisable home dashboard

Date: 2026-11-19
Status: in progress

## Goal

Turn the fixed front page into a personal dashboard: a catalogue of widgets the
user arranges and configures, saved per account, with the built-in default
layout reproducing the pre-dashboard page exactly.

Decisions agreed with the project owner:

- Edit mode is entered from a **Customise** button in the page header.
- A known account with no saved layout keeps seeing the **default** layout plus
  a one-time, dismissible setup prompt offering the logged-in starter layout.
- Layout model: **12-column grid** with per-widget width tokens, resizable,
  reordered by drag or by keyboard/menu.
- Phase 1 = shell + the five existing cards made configurable + wallet,
  my-witness, witness-health, network-stats and notifications widgets.
- Comments on widget posts are out of scope for now.
- One order for all breakpoints; the grid collapses to one column below 800px.
- Singleton widgets (live block, network stats) appear once; others can repeat.

## Storage

`src/services/dashboardPrefs.js`:

```
hive:dashboard:v1:default      guest layout
hive:dashboard:v1:@alice       alice's layout
hive:dashboard:v1:@bob         bob's layout
hive:dashboard:v1:setupPromptDismissed:@alice
```

Resolution is account -> guest -> built-in default. Failures (private mode,
quota, corrupt JSON) fall back to the default layout and set
`dashboard.storageFailed`. The pre-dashboard `homeMarketPrefs` key is imported
once into the coin widget's settings and never deleted.

## Done

- `src/services/dashboardLayout.js` — widget registry, width tokens, layout
  normalisation, add/insert/remove/move/nudge/resize, row packing, presets
  (`DEFAULT_LAYOUT`, `LOGGED_IN_STARTER_LAYOUT`).
- `src/services/dashboardPrefs.js` — per-account persistence, resolution,
  legacy import, setup-prompt flag.
- `src/stores/hive/dashboard.js` — store slice and actions.
- `src/composables/useAccountWidget.js` — shared account/globalProps/prices
  loading for account widgets.
- `src/components/dashboard/DashboardWidgetShell.vue` — widget envelope with
  edit-mode menu, drag handle, guest-blocked state.
- `src/components/dashboard/DashboardGrid.vue` — renders the widget list,
  one card per widget, with a `pair` mode for the block/coin row. Wired into
  `pages/Index.vue`; the default page is visually unchanged (verified at
  1440 / 1000 / 760px and via `e2e/core.spec.js`).
- Dashboard store wired into `stores/hive/state.js` and `index.js`.
- Tests: `tests/unit/dashboardLayout.spec.js`,
  `tests/unit/dashboardPrefs.spec.js` (42 passing).

## Attempt log — DashboardGrid (2026-11-19)

The grid is now wired in and reproduces the original page. Findings from the
first (reverted) attempt, kept so they are not repeated:

- Layout plumbing that works: keep `Index.vue`'s `.home-layout`, `.home-main`,
  `.home-top` and `.home-side` containers and render the widget list inside
  them — first two in `.home-top`, remainder in `.home-main`, sidebar widgets
  in `.home-side`. `.home-top` itself must be `display: block`; the grid inside
  it owns the two block/coin columns (`DashboardGrid` `pair` prop).
- The store had never been wired (the "Done" entry above was wrong):
  `stores/hive/dashboard.js` denormalises `state()`, so `dashboardState()`
  is spread into `stores/hive/state.js`, and its actions are imported into
  `stores/hive/index.js`. The file also exports `dashboardState` as default.
- **Do not `v-bind="widget.settings"` onto cards that declare no matching
  props.** `HomeTrendingPosts` has no props, so passing `source`/`tag`/`limit`
  made it throw inside render and render nothing (a comment-only node). This
  was the cause of the "Posts on Hive never leaves loading" bug. Cards are
  currently rendered without settings; wiring settings comes with the
  prop-parameterisation step.
- The shell must not render its own `home-panel__head` above a card that
  already renders one — `DashboardWidgetShell` now has a `hideHeader` prop,
  set by the grid for the five built-in cards.

### Customise bar and drawer (done 2026-11-19)

- `services/dashboardEditing.js` — catalogue grouping (`widgetCatalogue`),
  availability counts, `addWidgetToLayout`, width choices, draft helpers
  (`draftWidgets`, `isDirtyDraft`, `isDefaultDraft`, `draftChanges`);
  `tests/unit/dashboardEditing.spec.js` (14 tests).
- `components/dashboard/DashboardCustomiseBar.vue` — sticky editor bar with a
  live change summary, Reset to default, Cancel, Add widget and Save (disabled
  until the draft differs).
- `components/dashboard/AddWidgetDrawer.vue` — right drawer with search,
  category groups, disabled singletons ("already on this dashboard"), guest
  notes for account widgets, and an add/remaining footer.
- `Index.vue` — edit mode now works on a **draft copy**: Save applies it,
  Cancel discards it, Reset restores the built-in layout. The Customise button
  only starts editing; the bar ends it.
- `applyDashboardWidgets` now defaults `customised` to "differs from the
  default layout", so saving an unchanged default keeps the setup prompt.
- Verified in Chromium: add → summary "1 widget added", save persists
  `customised: true`, cancel leaves storage untouched, reset returns
  `customised: false`; `e2e/core.spec.js` 6/6; 66 dashboard unit tests.

## Remaining

1. Prop-parameterise the five cards (backwards compatible) and pass
   `widget.settings` through again: `HomeWitnessCard` (`limit`, `pinMine`,
   `highlight`), `HomeTrendingPosts` (`source`, `tag`, `limit` — it currently
   has **no props**, so settings must not be passed until these exist),
   `HomeRecentPosts` (default account to the logged-in user),
   `HomeBlockCard`/`HomeMarketCard` (compact; market settings moved to widget
   settings).
2. Configure dialog for widget settings (the shell emits `configure`; the bar
   has no settings UI yet). Width change currently cycles through tokens from
   the card menu.
3. New widgets: `WidgetWallet`, `WidgetMyWitness`, `WidgetWitnessHealth`,
   `WidgetNetworkStats`, `WidgetNotifications` (registry entries exist; the
   grid shows the shell's "available shortly" state for them).
4. View mode for a customised layout: today it keeps the page shell, so a
   layout without sidebar widgets leaves a 340px gap on the right. Decide
   whether customised layouts should use the packed grid instead.
5. The one-time setup prompt for a known account (`setupPromptVisible`) is not
   rendered anywhere yet.
6. e2e coverage for edit mode (drag, keyboard, bar save/cancel/reset).

### Edit mode (done 2026-11-19)

- `services/dashboardGrid.js` — pure drop geometry: `dropTargetFor`,
  `insertIndexFor`, `isDragGesture`, `moveTargetFor`, `groupIntoRows`;
  `tests/unit/dashboardGrid.spec.js` (10 tests).
- `DashboardGrid` `editing` prop — 12-column grid (`packRows` spans), pointer
  drag from the shell's handle with a live insertion marker, keyboard
  reorder (Enter picks up, arrows/Home/End move, Escape cancels), menu nudge,
  remove, and an "End of layout" target.
- `Index.vue` — Customise/Done button in the header; edit mode renders one
  full-list grid, view mode the shell. Moves go through `moveWidget` and
  `applyDashboardWidgets`, so edits persist to `hive:dashboard:v1:default`.
- Verified in Chromium: 12 tracks at 1440px, keyboard move + drag reorder +
  persistence, and the view page unchanged at 1440/1000/760px.

## Notes

- `HomeWitnessCard` has a latent bug: `formatCompactNumber(witnessVotesHp(...))`
  passes a vote-derived HP value through the *HP* helper. Fixture-style tests
  pass coincidentally; a widget test with realistic global props should assert
  the intended formula.
- `governance.js` exports `voteOverlap`, not `voteIntersection` (used by the
  witness-health widget design).
