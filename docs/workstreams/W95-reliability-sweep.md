# W95 — Reliability sweep: cache, filters, polling and page states

Date: 2026-11-28
Status: implemented and verified locally

## Scope

A read-only audit of non-Vault services and pages found eight concrete
reliability defects. This workstream fixes the ones that are deterministic and
verifiable without live signing: stale post reads after a write, an
append-only account-history filter, a crash on an unknown filter name, an empty
filtered history page that never stops spinning, blank tip/token pages, three
unthrottled account-creation pollers, and three legacy pages without a page-level
`h1`. No Vault crypto, bulletin, grant or relay code changed.

## Fixes

1. **Post cache invalidation (medium).** `invalidatePostCache()` cleared
   `posts:` feed rows but not `post:content:` hydrated posts. A vote, comment,
   delete, account update or custom JSON could leave a stale product/post body
   for the cache TTL. It now clears both prefixes.
2. **Account history filter is rebuilt, not appended (medium).** Applying
   `vote` and then `transfer` unioned the bitmask while the badge said
   “transfer”, and clearing the filter left the old bitmask active. The marker
   now resolves the URL filter from scratch on every run; unknown or blank names
   are dropped. `resolveOperationFilter()` is the tested helper.
3. **Unknown filter names no longer throw (medium).** `makeBitMaskFilter()`
   passed `undefined` to `BigInt()` for a typo such as `votes`, producing a
   `RangeError` and an unhandled rejection. It now ignores non-integers and
   out-of-range values instead of throwing.
4. **Empty filtered history page (medium).** Both filtered reads now guard an
   empty response instead of reading `res[0][0]`; the spinner stops and the
   activity card shows “No operations match this filter.” Apply/Clear no longer
   call the marker before the route has changed, which previously re-applied the
   old filter.
5. **Tip page states (medium).** `/@account/tip` now normalises the route
   account, always renders a page, and shows loading, not-found and loaded
   states. A misspelled or mixed-case account no longer yields a blank page.
6. **Token page reads (medium).** Removed the duplicated `immediate` route
   watchers and the full-init `username` watcher. The page loads once on mount
   and only refreshes account-scoped reads when the profile arrives. A failed
   price provider now leaves the USD column at zero instead of producing an
   unhandled rejection.
7. **Visibility-aware account-creation polling (low).** Hivedex signup, claim
   links and batch creation now use `pollWhileVisible()` with an in-flight
   guard. Hidden tabs make no requests, ticks cannot overlap, and the attempt
   caps still stop the poller.
8. **Page-level headings (low).** Added one `h1` to `/token/:token`,
   `/@account/wallet` and `/@account/downvotes` so the page title is announced
   and axe's heading rules have a root.
9. **Deterministic performance gate (low).** `perf:check` now blocks on the
   deterministic bundle-size, CSS and app-transfer budgets while reporting LCP
   and CLS overruns as advisory notes. Live nodes and remote images can no
   longer turn a slow API response into a bundle regression.

## Components

| Area | Files |
| --- | --- |
| Cache invalidation | `src/services/chainData.js` |
| Operation filter helper | `src/services/hiveOperations.js` |
| Account activity | `src/pages/account.vue` |
| Tip states | `src/pages/tip.vue` |
| Token page | `src/pages/token.vue` |
| Wallet / downvotes headings | `src/pages/wallet.vue`, `src/pages/downvotes.vue` |
| Account-creation pollers | `src/pages/hivedexSignup.vue`, `src/pages/claimAccount.vue`, `src/pages/batchCreate.vue` |
| Performance gate | `scripts/perf-budgets.mjs`, `scripts/perf-baseline.mjs` |
| Tests | `tests/unit/cache-invalidation.spec.js`, `tests/unit/hive-operations.spec.js`, `tests/unit/perf-budgets.spec.js`, `e2e/browse.spec.js`, `e2e/a11y.spec.js`, `e2e/moderation.spec.js` |

## Authority and privacy

- No new authority and no signing changes.
- The cache fix only removes local cached reads earlier.
- The pollers make fewer requests, never more, and never while the tab is
  hidden.
- No analytics, server call or storage key was added.

## Verification

- `bun run lint` — clean.
- `bun run test` — **228 files / 2,217 tests** passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed with the new policy; LCP/CLS remain advisory.
- `bunx vitest run tests/unit/perf-budgets.spec.js` — **5 passed**.
- Targeted Playwright: **4/4 passed** — axe clean on `/@ausbitbank/downvotes`,
  `/@ausbitbank/wallet` and `/@ausbitbank/tip` at 1440×900 and 390×844, plus
  the downvotes evidence flow.
- Full Chromium suite on the W95 build: **206 passed** (15.0m). An earlier
  run showed two failures caused by a concurrent Playwright run sharing
  `test-results`; both passed on an isolated rerun. Do not run two Playwright
  suites against the same worktree.

## Remaining

- The account activity page still uses the legacy condenser history call and its
  own paging arithmetic; a future rewrite should share the `accountHistory`
  collector used by Vault.
- `token.vue` still performs its Hive-Engine reads per mount; a route-level cache
  would reduce repeat navigation cost.
- The full Chromium suite remains the release gate for these page states.
