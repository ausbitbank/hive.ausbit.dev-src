# W46 — Lightning CORS-live hardening (v4vapp Phase 1)

Date: 2026-11-21
Status: complete — built and unit/E2E verified
Issue: [#87](https://github.com/ausbitbank/hive.ausbit.dev-src/issues/87)

## Scope

The v4vapp production origin is now on the bridge's CORS allowlist. This
workstream makes that a tested invariant instead of an assumption, separates a
genuine browser/CORS failure from an outage or an offline tab, and stops the UI
from presenting stale defaults as live configuration.

Deliberately out of scope: keepsats sessions, POS, zaps, explorer/tax work and
any change to the signing queue.

## Verification (live, 2026-11-21, API 6.6.1)

`GET /v1` with `Origin: https://hive.ausbit.dev` returns `200`,
`access-control-allow-origin: https://hive.ausbit.dev`,
`access-control-allow-credentials: true` and `vary: Origin`. `OPTIONS`
preflights on `/v1/new_invoice_hive`, `/v1/check_invoice`,
`/v2/v4vapp/keepsats` and `/auth/validate/` allow `POST`, `Authorization` and
`Content-Type`. `401` and `422` responses carry the header too. Unlisted origins
— including `https://staging.hive.ausbit.dev` and Playwright's
`http://127.0.0.1:4173` — get no header; there is no wildcard reflection.

A real Chromium page on `https://hive.ausbit.dev/lightning` completed `fetch`
GETs, a preflighted `POST /v1/check_invoice`, and a preflighted authorised
`GET /v2/v4vapp/keepsats` that returned a readable `401`.

The old `localhost:8080` fallback is no longer needed for production. Allowed
dev origins observed: `localhost:3000`, `localhost:5173`, `localhost:8080`,
`localhost:9000` and `127.0.0.1:8080`.

## Changes

| File | Change |
| --- | --- |
| `src/services/v4vapp.js` | `BRIDGE_STATES` (`unknown/available/degraded/offline/timeout/blocked/unauthorized`); state carries `checkedAt`; offline detection; caller aborts no longer mark the bridge failed; 401/403 are `unauthorized`; cached `probeBridge()` / `getBridgeProbe()`; `isBridgeUnavailable()` for the address fallback and `isBridgeBlocked()` for genuine browser blocks |
| `src/services/lightning.js` | Minimum invoice uses the larger of `minimum_invoice_payment_sats` and `min_max.min.sats` (live drift: `1` vs `50`); comments no longer imply the QR depends on CORS |
| `src/components/lightning/LightningReceiveDialog.vue` | Live fixed-fee note; failure copy per state (offline / busy / timeout / blocked); address fallback only for unavailable states; status polling tolerates two transient failures and offers Retry |
| `src/components/lightning/LightningPayDialog.vue` | Estimated-quote notice per state; only a real block mentions the browser or an intermediary |
| `src/components/lightning/LightningInvoiceCard.vue` | Neutral "could not be checked just now" copy instead of blaming the browser |
| `src/pages/lightning.vue` | Fee/limit card reads the live config and labels defaults as defaults |
| `src/components/lightning/LightningWalletPanel.vue` | Same live fee note in the wallet card |
| `src/pages/health.vue` | Advisory "Lightning bridge" section: state, API version, LND/onward state, fee, invoice range, quote age; refresh is manual and it never affects overall health or alerts |
| `scripts/v4vapp-contract-check.mjs` | Read-only contract check: CORS on GET and POST preflight, keepsats `Authorization` preflight, `/v1` config bounds, quotes, LNURL address, POST invoice status. 30 assertions, no invoices, no auth |
| `.github/workflows/v4vapp-contract.yml` | Daily 06:17 UTC + `workflow_dispatch`; not in the PR gate |
| `e2e/lightning.spec.js` | Functional receive/queue path (runs in the fast Obscura suite) |
| `e2e/lightning-states.spec.js` | Chromium-only blocked, offline, rate-limited and axe checks |
| `e2e/a11y.spec.js` | Added `/lightning` and `/health` |
| `e2e/helpers.js` | `runAxe()` accepts disabled rules |
| `playwright.obscura.config.js` | `lightning-states` is Chromium-only |
| `package.json` | `bun run v4vapp:contract` |

## Decisions

- CORS is resolved; no Worker proxy and no new allowlist requests. Preview and
  Playwright origins stay mocked.
- Keepsats is acceptable to the audience but not encouraged: any balance UI
  must be opt-in, default off and visually secondary.
- The health row is advisory. It must never page on a third party or make the
  Hive health banner red.

## Authorities and security

- No new keys, no auth, no tokens. The contract check and the health probe only
  read public endpoints.
- `credentials: 'omit'` stays. The refresh cookie remains unused because it is
  third-party from this origin.
- Status polling stays visibility-aware and stops at expiry. Outbound payments
  are still not auto-broadcast.
- Mismatched/unavailable states never claim settlement.

## Verification

- `bun run lint` — clean.
- `bun run test` — 82 files, 786 tests passed.
- `bun run build` — succeeded.
- `bun run perf:check` — passed.
- `bunx playwright test e2e/lightning.spec.js e2e/lightning-states.spec.js`
  — 5 passed (receive+queue; CORS-block fallback; offline copy; rate-limit
  copy; axe at 1440/390).
- Fast Obscura suite (`CI=1`, lightning spec) — passed. The full fast suite was
  43 passed, 1 skipped and 6 unrelated failures in live-data/timeout specs
  (`connections`, two `dashboard`, three `infinite-scroll`); W36 saw the same
  class of failure before this workstream.
- `bunx playwright test e2e/a11y.spec.js -g "axe clean: /(lightning|health)$"`
  — 2 passed.
- `node scripts/v4vapp-contract-check.mjs` — 30 checks, 0 failures against the
  live API.

## Known limitations

- axe-core mis-reads the background of Quasar buttons inside a teleported
  `q-dialog`, reporting a false `color-contrast` failure for the amber
  `Create invoice` button. The dialog check disables that one rule and keeps
  every other WCAG A/AA rule; the same button pattern is contrast-checked on
  the page. Revisit if axe or Quasar changes the stacking markup.
- `check_invoice` returns `state: CANCELED, expired: true` for an unknown
  `r_hash`, so it cannot prove "never paid". The UI still relies on the Hive
  wallet for final confirmation.
- `/auth/validate` and `/v2/v4vapp/keepsats` are undocumented and absent from
  `openapi.json`; only their CORS/preflight behaviour is covered by the check.
- The contract check runs on a schedule, so a lapsed allowlist is visible
  within a day rather than immediately.
- Obscura cannot emulate offline mode or abort a request promptly, so the
  blocked/offline state specs and axe checks live in
  `e2e/lightning-states.spec.js` and run in Chromium only. The fast suite keeps
  the functional receive/queue path.
- Opening a lazily loaded dialog for the first time while offline fails inside
  the app-wide async-component error boundary before any bridge state exists.
  The offline test loads the dialog chunk while online first. This is existing
  async-component behaviour, not specific to Lightning.

## Next

Phase 2 is the keepsats read-only spike. First answer, with a throwaway account:
does `/auth/validate` accept `scope=hive:posting`? If not, do balances on chain
with `#balance_request` and skip the API session entirely. If it does, the
session is only a better way to read balance/history — no writes and no token
storage.
