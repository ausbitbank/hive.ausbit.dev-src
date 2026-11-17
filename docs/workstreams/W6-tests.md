# W6 — Tests / CI

Status: **implemented, not executed** (dependencies and scripts are applied by
the coordinator; tests have not been run yet).

## Files created

- `vitest.config.js` — Vitest + jsdom config. Vue plugin, aliases mirroring
  `quasar.config.js` (`src`, `assets`, `boot`, `components`, `layouts`, `pages`,
  `stores`), spec glob, and v8 coverage (`text` + `json-summary`).
- `tests/unit/prices.spec.js` — mocks global `fetch` and
  `src/services/hive`:
  - CoinGecko success maps `hive` / `hive_dollar` USD prices;
  - network failure and non-OK HTTP fall back to `getCurrentMedianHistoryPrice`
    (`base / quote`);
  - a second call inside the TTL returns the cached object and does not refetch.
- `tests/unit/store-mutations.spec.js` — mocks Quasar `LocalStorage` /
  `SessionStorage` and invokes store mutations with a fake `this`:
  - `updateSettings` state + LocalStorage persistence;
  - `addToQueue` / `removeFromQueue` / `clearQueue`;
  - `updateFollowCount` strips `account` from the stored counts and does not
    mutate the caller's object;
  - `updateAccountData` indexes by account name.
- `tests/unit/timers.spec.js` — mixin options shape, `created()` bookkeeping,
  `normalizeTimers` for object and array configs, immutability of the caller
  config, callback resolution order. No timers are started.
- `.github/workflows/ci.yml` — push + pull_request, `ubuntu-latest`,
  `actions/checkout`, `oven-sh/setup-bun` (`bun-version: latest`),
  `bun install --frozen-lockfile`, `bun run lint`, `bun run test`,
  `bun run build`; concurrency cancels superseded runs.
- `docs/workstreams/W6-package-additions.md` — exact devDependencies, scripts
  and coordinator notes.

## Not created (intentional)

- No tests for `src/utils/safeUrl.js` or `src/utils/safeHtml.js`; W1 is adding
  those files and the coordinator will add the tests after integration.
- No Playwright config/spec. It cannot be added correctly without editing
  `package.json` and installing `@playwright/test`; see follow-up below.

## Deferred coverage (for the coordinator / later workstreams)

- `src/utils/safeUrl.js`, `src/utils/safeHtml.js` — W1 files, add tests after
  integration (happy path, javascript:/data: rejection, protocol-relative and
  malformed URLs, sanitizer allow-list).
- `src/utils/pageMeta.js` — W3 file; test title/description/canonical/OG/
  Twitter updates against a jsdom document.
- Hive-Engine fetch client — W1 replacement for `sscjs`; test success, JSON-RPC
  error, HTTP error and timeout with a mocked `fetch`.
- Hive store **actions** — need Pinia plus `@hiveio/hive-js` mocks; mutations are
  covered now, so action tests can follow without blocking this batch.

## Package / config changes required from the coordinator

See `docs/workstreams/W6-package-additions.md`. Summary:

- devDependencies: `vitest@^5.1.0`, `@vitest/coverage-v8@^5.1.0`,
  `jsdom@^31.0.1`, `@vitejs/plugin-vue@^6.0.11`, `@vue/test-utils@^2.6.0`.
- scripts: `test`, `test:watch`, `test:coverage`.
- Add `coverage/**` to ESLint ignores and `coverage/` to `.gitignore`.
- Run `bun install` and commit the updated `bun.lock` before CI can use
  `--frozen-lockfile`.

## Assumptions

- Quasar's Vite 8 toolchain is compatible with Vitest 5.1; `vitest` peer range
  explicitly includes Vite 8.
- `getHivePrices` keeps its module-level cache per module instance, so
  `vi.resetModules()` in `beforeEach` gives each prices test a cold cache.
- `updateFollowCount` is intentionally pure with respect to its argument; the
  test pins that behaviour.
- Store mutations are plain functions using `this`, so tests can call them
  without booting Pinia.
- `ubuntu-latest` provides Node 20+, which the Quasar CLI needs even though Bun
  installs and runs the scripts.

## Risks / open issues

- **Tests have not been run.** `bun run test`, `bun run lint` and
  `bun run build` still need verification after dependencies are installed.
- Lint is currently expected to pass because tests import Vitest APIs
  explicitly, but `coverage/` is not in `eslint.config.js` ignores yet.
- CI will fail until the devDependencies, scripts and updated lockfile are
  committed.
- `@vue/test-utils` is declared but unused until component tests are added.
- Prices test asserts the `AbortSignal` passed to `fetch`; if the jsdom/Node
  `AbortSignal` identity differs in the installed Vitest version, relax it to
  `expect.anything()`.

## Playwright follow-up (documented, not added)

After W6 integration, add a local/CI-optional route smoke test:

1. Add `@playwright/test` as a devDependency and a `playwright.config.js` with
   `webServer` running `bun run dev` (or a static preview of `dist`) and
   `baseURL: 'http://localhost:8080'`.
2. Add `tests/e2e/routes.spec.js` visiting `/`, `/browse`, `/blocks`, `/nodes`,
   `/proposals`, `/witnesses`, `/hbd`, `/market`, and asserting the page shell
   renders without console errors.
3. Add a `test:e2e` script and run it as a separate, non-blocking CI job until
   route stability is proven; do not gate the main CI job on it initially.
