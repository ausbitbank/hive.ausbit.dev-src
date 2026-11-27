# W94 — Vault pending-grant badge

Date: 2026-11-28
Status: implemented and verified locally

## Scope

Give a Vault creator a visible, read-only signal when subscribers are waiting
for a grant. The badge lives on the account menu's **Vault dashboard** link, so
it is available from any Banksia page without opening the dashboard.

Shipped:

- A new read-only detector, `src/services/vaultPending.js`, that counts active
  subscribers whose current bulletin grant is missing or expires within 24
  hours.
- The account menu loads the detector lazily on first open. The reader crypto
  and chain stack is never part of the initial shell.
- The Vault dashboard link shows an orange count badge. The badge carries
  `aria-label` and `title` text (“3 subscribers need a grant”), not a bare
  number.
- Any read failure resolves to zero. A badge must never break the account menu
  or imply work that does not exist.
- Results are cached per account for 60 seconds, so reopening the menu does not
  hammer Hive. The export `clearPendingGrantCache(account)` is available to
  callers that grant a bulletin.
- The Vault dashboard auto-issue timer now polls less often while the tab is
  hidden (2× the foreground interval) and restarts with the current interval
  when visibility changes. The copy explains that background tabs may still be
  throttled.

Not in this workstream: issuing grants, changing bulletin or crypto formats,
relay/delegated signing, or any active-key action. The detector signs nothing
and only reads public chain data plus the public bulletin.

## Components

| Area | Files |
| --- | --- |
| Detector and cache | `src/services/vaultPending.js` |
| Account menu badge and lazy load | `src/components/userLogin.vue` |
| Visibility-aware auto-issue | `src/pages/blogVault.vue` |
| Tests | `tests/unit/vault-pending.spec.js` |
| Budget note | `docs/performance/budgets.json` |

## How the count is derived

1. Read the account and its `banksia.io.blog` Vault settings.
2. Resolve the membership product and derive the plan; stop if the product is
   missing, inactive, or owned by a different account.
3. Walk the last 90 days of the blog's public history through the existing
   Vault history filter.
4. Build subscriber rows with the existing `subscriberRows` helper.
5. Resolve, verify and load the current bulletin. Stop on any failure or
   tampering.
6. For each active row, compare the reader-key thumbprint with the bulletin
   entries. A row is pending when its entry is missing, invalid, or expires
   within 24 hours.
7. Rows whose reader key cannot be thumbprinted are skipped, not counted.

## Authority and privacy

- No new authority and no signing. The detector is read-only.
- Reads are public account, post and history data.
- No analytics, tracking or server-side database.
- The badge is derived locally; no notification leaves the browser.

## Verification

- `bun run lint` — clean (theme token check included).
- `bunx vitest run tests/unit/vault-pending.spec.js` — **11 passed**, covering
  empty names, unconfigured Vault, missing product/ref, invalid ownership,
  no rows, unresolved/unverified/broken bulletins, missing and soon-to-expire
  grants, inactive and unthumbprintable readers, the 60-second cache, `force`,
  name normalisation and read failures.
- `bun run test` — **222 files / 2,131 tests** passing in the worktree.
- `bun run build` — succeeded.
- Targeted Playwright `e2e/badges.spec.js`, `e2e/polish.spec.js` and
  `e2e/themes.spec.js` — **8/8 passed**; the four failures listed in the
  pre-W89 roadmap snapshot do not reproduce on this tree.

## Remaining

- The badge is a prompt, not a queue: the creator still opens the dashboard,
  unlocks the vault and issues the bulletin.
- Auto-issue remains best-effort while the dashboard tab stays open; browsers
  may throttle hidden tabs. The relay/delegated flow (W90 reserved) is the
  durable answer for an offline creator.
- The pending window is fixed at 24 hours. A per-plan grace preference is
  future work.
