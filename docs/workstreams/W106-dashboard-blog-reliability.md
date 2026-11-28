# W106 — Dashboard and blog tenant reliability

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A dashboard/blog audit found race conditions on account change and unmount, a
blog tenant read that could 404 a valid contributor post on a cold load, a
dashboard scope that wrote a signed-in user's layout into the guest key, several
widgets that reported success or zero when their data was missing, and a social
card that measured text with the wrong font.

## Blog tenant

1. **Direct contributor/community posts wait for tenant settings.** `load()`
   now exposes one shared in-flight promise and `loadPost()` awaits it when
   settings are not loaded yet. Previously the post page could fetch content
   before `fetchAccount()` resolved, judge a valid contributor post against
   empty author/community lists, and show “not found”.
2. **Pinned posts resolve contributors and keep the post filter.** A pinned
   permlink is tried against the owner and every configured author, and only
   accepted when `isBlogPost()` passes, so a contributor pin appears while a
   comment, Vault container or product is not injected as hero content.
3. **Social cards measure with the font they draw.** The title is measured with
   `fonts.title` and the description with `fonts.body`; long titles now wrap
   instead of being clipped, and descriptions no longer truncate against 88px
   metrics.

## Dashboard scope and editor

4. **A signed-in account previews the guest layout but saves to its own key.**
   When no account document exists, `resolveDashboard()` keeps `source: 'guest'`
   for display but reports the account scope (and `customised: false`) so the
   first save creates `hive:dashboard:v1:<account>` instead of overwriting the
   shared guest document.
5. **An identity switch closes the editor.** `loadDashboard()` clears
   `editing`, and `Index.vue` cancels the draft when the signed-in username
   changes, so Save cannot write one account's draft into another scope.
6. **Unmount invalidates account reads.** The account-widget mixin bumps its
   request token in `beforeUnmount`, so a late response cannot call
   `applyAccountData()` and start Hive-Engine/Magi/extra reads on a dead widget.
7. **Explicit refresh bypasses the short-lived cache.** The mixin and
   composable thread a `force` flag to the account, global-properties and price
   reads; refresh/retry buttons and the vitals poll use it, so “Updated 0s ago”
   no longer sits on a stale snapshot.

## Widget state honesty

8. **Witness health no longer claims success when its list failed.** The widget
   tracks loading/error, suppresses “All voted witnesses healthy” until the
   ranked list loaded and the vote slate is non-empty, and offers a retry that
   re-fetches the witness list with `force`.
9. **Governance watch is account-bound.** A request token and post-await account
   comparison stop a slow previous-account response from rendering its
   `votedIds`, weight or expiry under the new account.
10. **The account watchlist ignores superseded edits.** A request token stops an
    older watchlist read from replacing the new rows or clearing the new
    spinner.
11. **The operations widget keeps its last good list.** A transient poll error
    shows a stale banner above the existing rows rather than replacing them with
    an error state, and a poll interval below the 5-second floor is labelled
    “Manual refresh”.
12. **The wallet shows “—” when prices or forex are missing.** A failed price
    feed no longer renders a `$0.00` portfolio, and a failed forex rate renders
    USD with a `$` symbol plus a notice instead of mislabelling the number `A$`.
13. **Polling skips ticks while a slow async callback is in flight.** Synchronous
    callbacks keep their existing cadence.

## Helper hardening

14. **Widget account names are normalised.** `resolveWidgetAccount()` strips
    `@` and lowercases, matching Hive's case-sensitive `get_accounts`.
15. **A failed lazy signer import is retryable.** `imageSigning` clears the
    memoised promise on rejection, so one chunk failure no longer breaks uploads
    for the rest of the session.
16. **Account-safety names use the canonical validator.** The unused local regex
    accepted `ab` and `9lives`; `isValidHiveAccountName()` requires a leading
    letter, 3–16 characters and 3+ character dot segments.

## Components

| Area | Files |
| --- | --- |
| Blog | `src/stores/blog.js`, `src/services/blogSocialCard.js` |
| Dashboard scope/edit | `src/services/dashboardPrefs.js`, `src/stores/hive/dashboard.js`, `src/pages/Index.vue` |
| Account widgets | `src/components/dashboard/accountWidgetMixin.js`, `src/composables/useAccountWidget.js`, `WidgetAccountVitals`, `WidgetAccountWatchlist`, `WidgetWallet`, `WidgetWitnessHealth`, `WidgetGovernanceWatch`, `WidgetOperations`, `WidgetDelegationSnapshot`, `WidgetFollowerGrowth`, `WidgetMyWitness`, `WidgetNotifications` |
| Helpers | `src/services/imageSigning.js`, `src/services/polling.js`, `src/services/accountSafety.js` |
| Tests | `tests/unit/blog-store.spec.js`, `tests/unit/blog-social-card.spec.js`, `tests/unit/dashboardPrefs.spec.js`, `tests/unit/dashboardStore.spec.js`, `tests/unit/accountWidgetMixin.spec.js`, `tests/unit/use-account-widget.spec.js`, `tests/unit/polling.spec.js`, `tests/unit/accountSafety.spec.js` |

## Authority and privacy

- No signing or authority change. All fixes are reads, local layout storage or
  display state.
- The dashboard-scope fix removes a cross-account layout leak: account edits no
  longer overwrite the guest document or reach the next account through it.
- Contributor posts still have to pass the blog's configured authors/community
  or already be in the feed; the new wait only stops a false negative.
- Pinned-post resolution stays within the owner and configured authors.

## Verification

- `bun run lint` — clean.
- `bun run test` — **241 files / 2,328 tests** passing.
- `bun run build` — succeeded.
- `bunx playwright test e2e/search.spec.js e2e/dashboard.spec.js` — **37/37**
  passing.
- Full Chromium suite — **209 checks**, all passing after one
  custom-dashboard-template mount timeout passed on the exact isolated rerun.
  The browse Table locator fix is recorded in W105.
- `bun run perf:check` — budgets passed.
- Targeted unit suites for the blog store, dashboard prefs/store, account widget
  mixin/composable, polling, social card and account safety pass.

## Remaining

- Entering or cancelling Customise still mounts two different `DashboardGrid`
  trees, so widgets refetch on both transitions. A single keyed grid is the
  follow-up; it was left out of this slice to avoid destabilising drag state.
- Off-screen widgets stay mounted after the viewport observer first sees them,
  so live pollers keep running below the fold. A reversible intersection
  observer is the follow-up.
- The wallet forex rate is fixed per page load; there is no periodic forex
  refresh.
