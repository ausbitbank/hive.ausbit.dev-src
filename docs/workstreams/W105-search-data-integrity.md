# W105 — Search state, settings migration and export safety

Date: 2026-11-28
Status: implemented and verified locally

## Scope

An audit of search/notification state and low-coverage helpers found several
ways for a previous query, account or tab to repaint the current surface. It also
found a legacy-settings migration that could destroy a returning user's settings
before they signed in, and CSV exports that let spreadsheet formula injection
through.

## Search and notifications

1. **A cleared search invalidates its in-flight read.** `submit()` mints the
   request token before navigating, and `hydrateFromRoute()`/`clearSearch()`
   bump it when the query becomes empty. A slow result can no longer restore
   topic analytics, facets or recommended authors for a query that is no longer
   on screen.
2. **Account results have one merge point.** The name-prefix search and the
   exact-account read now resolve together and merge once. Previously each
   assigned `result.accounts.items`, so a short or unusual name could appear or
   vanish depending on which RPC settled first.
3. **Re-submitting compares resolved routes.** `buildUrl()` uses
   `URLSearchParams` form-encoding while vue-router uses `encodeURI`, so a
   query containing a comma, apostrophe, slash, colon or `=` produced a
   permanently different string, the push resolved as a duplicate navigation,
   and pressing Enter or Retry did nothing. The comparison now uses
   `$router.resolve().fullPath`.
4. **Saved searches use submitted state and fresh storage.** Save/label/URL come
   from `submittedQuery`, not the live input, so an unfinished edit cannot be
   saved. Add, remove and import re-read `localStorage` before merging, and a
   `storage` listener refreshes the list, so two tabs can no longer overwrite
   each other's saves.
5. **`Esc` is implemented.** The input and result container clear the active row
   or the query, matching the shortcut advertised in the help panel.
6. **The search status is a persistent live region.** The `aria-live` node is
   mounted before its content, so the first result announcement is spoken.
7. **Notifications use plain list semantics.** The popup no longer claims
   `role="menu"` without a roving-focus model; Quasar's clickable items expose
   their own button role and keyboard activation.

## Settings and account surfaces

8. **A guest/boot read cannot consume legacy settings.** `readStoredSettings()`
   only adopts the unscoped `settings` key for a named account. Before this, the
   image-proxy boot read ran as `guest`, copied the legacy beneficiaries, vote
   weight and node choices into `settings:guest`, and deleted the source before
   the owner signed in.
9. **The claim fingerprint is bound to the displayed payload.** A second claim
   link arriving while SHA-256 is computing can no longer overwrite the first
   fingerprint.
10. **Account page timers are owned.** The auto-refresh timer and the filtered
    history retry handle are stored and cleared on unmount and before a new
    retry, instead of firing against an unmounted account page.

## CSV export safety

11. **Shared formula neutralisation.** `src/utils/csv.js` prefixes a cell whose
    first character is `=`, `+`, `-`, `@`, tab or carriage return with an
    apostrophe before quoting. Quoting alone does not stop Excel or Sheets from
    evaluating `"=1+1"`. Wallet activity, the browse table and the Vault payments
    export all use it; a transfer memo reference can no longer become a formula.

## Components

| Area | Files |
| --- | --- |
| Search | `src/pages/search.vue`, `src/services/searchReads.js` |
| Notifications | `src/components/notifications.vue` |
| Settings | `src/services/userSettings.js`, `src/stores/hive/state.js` (reader) |
| Claims/account page | `src/pages/claimAccount.vue`, `src/pages/account.vue` |
| CSV | `src/utils/csv.js`, `src/services/walletExport.js`, `src/components/browseTable.vue`, `src/pages/blogVault.vue` |
| Tests | `tests/unit/search-reads.spec.js`, `tests/unit/hive-settings-scope.spec.js`, `tests/unit/csv.spec.js`, `tests/unit/wallet-export.spec.js`, `e2e/search.spec.js`, `e2e/browse.spec.js` |

## Authority and privacy

- No signing or authority change. All edits are reads, local storage or export.
- The settings fix removes a cross-account data-loss path: a guest read can no
  longer claim another identity's beneficiaries or node choices.
- Saved searches stay local and keep the existing same-origin URL validation.
- CSV neutralisation changes exported text only; no network or storage format
  changed.

## Verification

- `bun run lint` — clean.
- `bun run test` — **241 files / 2,328 tests** passing.
- `bun run build` — succeeded.
- `bunx playwright test e2e/search.spec.js e2e/dashboard.spec.js` — **37/37**
  passing.
- Full Chromium suite — **207/207** after changing the browse Table toggle
  locator to `exact: true` (a live post titled “Vegetables” was matching the
  substring).
- `bun run perf:check` — budgets passed.

## Remaining

- Search still reads one tag feed and the first proposals page per fresh query;
  the shared cache removes duplicate reads within a run.
- Saved searches remain last-writer-wins across two tabs for the *same* URL;
  the merge now preserves both lists but does not choose between conflicting
  labels.
- Vault payments CSV still exports the most recent 1,000 account-history rows.
