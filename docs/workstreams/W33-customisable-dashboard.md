# W33 — Customisable home dashboard

Date: 2026-11-19
Status: complete (phase 1)

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

## Remaining — phase 1 complete

All six phase-1 items are done. Follow-ups, none blocking:

1. The market widget's Configure dialog uses a suggested-coin multi-select;
   the in-card tune dialog still offers full CoinGecko search. Sharing that
   picker would be a polish pass, not a correctness fix.
2. Comments on widget posts remain out of scope (agreed with the owner).
3. Customised layouts always use the packed 12-column view; the built-in
   default keeps the two-column page shell. Revisit if a user asks for a
   sidebar in a custom layout.
4. Latent `HomeWitnessCard` bug from the notes below still wants a realistic
   global-props test.
5. `governance.js` exports `voteOverlap`, not `voteIntersection`, for anyone
   reusing the witness-health maths.

### Wallet, configure dialog, setup prompt, packed view (done 2026-11-19)

- `components/dashboard/WidgetWallet.vue` — portfolio total and 24h change,
  HIVE/HBD/HP/savings rows, claimable rewards (same `buildPortfolio` maths as
  the wallet page), guest/loading/error states, wallet link. The grid now
  renders `wallet`; every phase-1 widget type has a component.
- `services/dashboardEditing.js` — `settingsFieldsFor` / `isConfigurableWidget`
  / `sanitiseWidgetSettings` describe the Configure dialog per widget type
  (numbers clamped, toggles cast, `@`/`#` stripped, feed source whitelisted,
  coin ids deduped and capped, currency whitelisted). `tests/unit/dashboardEditing.spec.js`
  +5 tests.
- `components/dashboard/WidgetSettingsDialog.vue` — generic Configure dialog
  driven by those fields. The grid forwards `configure`; `Index.vue` applies
  the result to the draft through `updateWidgetSettings`, so Configure/Cancel/
  Save all follow the existing draft semantics.
- `components/dashboard/DashboardSetupPrompt.vue` — one-time "Make this
  dashboard yours" prompt with the logged-in starter layout and Not now.
  Applying the starter layout persists `customised: true` and marks the prompt
  dismissed; Not now only stores the dismissal.
- `stores/hive/dashboard.js` — `setupPromptVisible` is now resolved in the
  initial state as well as on login. A restored session never calls
  `loadDashboard`, so the prompt previously never appeared after a reload.
- `DashboardGrid` — `packed` view mode for customised layouts: one 12-column
  grid with the same row packing as edit mode, collapsing below 800px. The
  built-in default still renders through the original main/sidebar shell.
- The shell's Configure/Change width items are wired again (they emitted but
  nothing listened): the grid forwards `configure` and `width`, and
  `meta.configurable === false` hides Configure for Network stats.
- `e2e/dashboard.spec.js` (9 tests): default layout + Customise button,
  add/save persistence, cancel, reset, keyboard reorder, pointer drag reorder,
  Configure dialog round-trip, starter-layout prompt, prompt dismissal.
- Verified: 635 unit tests, ESLint clean, production build, dashboard e2e 9/9,
  `e2e/core.spec.js` 5/5.

## Earlier remaining list (superseded)

1. Prop-parameterise the five cards (done in `69ababf`).
2. Configure dialog (done above).
3. New widgets (done: wallet, my-witness, witness-health, network stats,
   notifications).
4. View mode for customised layouts (done: packed grid).
5. One-time setup prompt (done).
6. e2e coverage for edit mode (done).


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
