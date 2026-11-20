# W40 — Issue #81 notifications widget header

Date: 2026-11-20
Status: implemented

## Scope

Issue **#81** reported that the Notifications dashboard widget had no header,
so the card did not say whose notifications were being shown.

## Changes

- `WidgetNotifications` now renders the standard dashboard card header:
  - eyebrow: **Notifications**
  - title: **@username** (the configured account, or the signed-in user)
- The header uses the account resolved by `accountWidgetMixin`, so it appears
  immediately and follows a widget account change.
- Added an e2e check that the header names `@ausbitbank` in both editor and
  saved view modes.

## Verification

- `bun run lint` — clean.
- `bun run test -- tests/unit/dashboardWidgets.spec.js tests/unit/dashboardGrid.spec.js`
  — 22 tests passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/dashboard.spec.js` — 17 passed.
