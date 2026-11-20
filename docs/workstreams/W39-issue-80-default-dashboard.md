# W39 — Issue #80 default dashboard

Date: 2026-11-20
Status: implemented and deployed

## Scope

Issue **#80** asked for the built-in dashboard to use a new arrangement, adding
the HiveDevs community feed, for users who have never customised their home
page.

## Changes

- `DEFAULT_LAYOUT` in `services/dashboardLayout.js` now renders:
  - a first row of thirds: **Live block**, **Coin prices**, **Top witnesses**
    (witnesses shows 10);
  - half-width **trending** and **@ausbitbank** post feeds in card view;
  - a full-width **HiveDevs** (`hive-139531`) community feed that refreshes
    every five minutes.
- The built-in layout now renders through the same packed 12-column grid as a
  saved layout, so the three-thirds row and half-width post feeds keep their
  intended arrangement. The old main/sidebar shell and its `pair` mode are
  removed.
- `resolveDashboard()` treats a stored document with `customised: false` as the
  current built-in default when its widgets match the current or previous
  release's default. Anyone who never arranged the dashboard, or pressed
  **Reset to default** before this change, sees the new layout. Named layout
  snapshots saved beside an untouched document are preserved, and a
  settings-only customisation stored with a stale `customised: false` flag is
  kept (and treated as customised).
- `isDefaultLayout()` now also compares widget settings, so changing only a
  widget's configuration counts as a customisation.

## Verification

- `bun run lint` — clean.
- `bun run test` — 79 files, 751 tests passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/dashboard.spec.js` — 16 passed.
- `./scripts/deploy.sh` — deployed to `hurgenburgen:/var/www/hive.ausbit.dev`.
  - Backup: `~/hive-backups/hive.ausbit.dev-20261120T070447Z.tar.gz`
  - Live smoke: `https://hive.ausbit.dev/` returns 200 and the deployed
    `assets/index-WXtxrGAW.js` contains the `hive-139531` community default.
