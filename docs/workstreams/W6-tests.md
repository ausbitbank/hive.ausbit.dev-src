# W6 — Tests / CI

Status: **implemented and verified locally**. `bun run test` passes
44 tests across 6 files (Vitest 5.1.0).

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
- `tests/unit/safe-url.spec.js` (follow-up, W1 integration) — accepts absolute
  http/https, rejects `javascript:`, `data:`, `vbscript:`, `file:`, `ftp:`,
  `tel:`, protocol-relative URLs, control characters, malformed/non-absolute
  values and non-strings; covers `allowMailto` and `safeHrefAttrs`.
- `tests/unit/safe-html.spec.js` (follow-up, W1 integration) — keeps normal
  rich text, strips `<script>` (and content) and inline event handlers, removes
  `javascript:` iframes and unknown iframe hosts, keeps allowed https embeds
  (YouTube/Vimeo), and returns `''` for empty/non-string input.
- `tests/unit/hive-engine.spec.js` (follow-up, W1 integration) — mocks Quasar
  `LocalStorage` and global `fetch`:
  - `find()` posts the expected JSON-RPC body to `<node>/contracts` and returns
    the result array;
  - non-array/missing results return `[]`;
  - JSON-RPC errors reject after exhausting hosts;
  - a first-host network failure falls back to the next host.
  - Fake timers drive the 250 ms retry delay; module-level client caching is
    reset with `vi.resetModules()` + dynamic import per test.
- `.github/workflows/ci.yml` — push + pull_request, `ubuntu-latest`,
  `actions/checkout`, `oven-sh/setup-bun` (`bun-version: latest`),
  `bun install --frozen-lockfile`, `bun run lint`, `bun run test`,
  `bun run build`; concurrency cancels superseded runs.
- `docs/workstreams/W6-package-additions.md` — exact devDependencies, scripts
  and coordinator notes.

## Test results

Run on 2026-11-17 after installing Vitest 5.1.0 and W1 integration:

```
> vitest run

 Test Files  6 passed (6)
      Tests  44 passed (44)
   Start at  18:04:40
   Duration  2.09s (environment 93%, transform 3%, import 2%, tests 1%, worker 1%)
```

The 26 follow-up tests are split 15 (`safe-url`), 7 (`safe-html`) and 4
(`hive-engine`). ESLint on the three new spec files also passes.

## Not created (intentional)

- No Playwright config/spec. It cannot be added correctly without editing
  `package.json` and installing `@playwright/test`; see follow-up below.

## Deferred coverage (for later workstreams)

- `src/utils/pageMeta.js` — W3 file; test title/description/canonical/OG/
  Twitter updates against a jsdom document.
- Hive store **actions** — need Pinia plus `@hiveio/hive-js` mocks; mutations are
  covered now, so action tests can follow without blocking this batch.
- Component-level tests using `@vue/test-utils` (currently declared but unused),
  e.g. `render.vue` embeds and `accountHeader` link handling.

## Package / config changes applied by the coordinator

- devDependencies: `vitest@^5.1.0`, `@vitest/coverage-v8@^5.1.0`,
  `jsdom@^31.0.1`, `@vitejs/plugin-vue@^6.0.11`, `@vue/test-utils@^2.6.0`.
- scripts: `test`, `test:watch`, `test:coverage`.
- `coverage/**` is now in the ESLint ignores and `coverage` is in `.gitignore`.
- `bun.lock` includes the new devDependencies.

## Assumptions

- Quasar's Vite 8 toolchain is compatible with Vitest 5.1; `vitest` peer range
  explicitly includes Vite 8.
- `getHivePrices` keeps its module-level cache per module instance, so
  `vi.resetModules()` in `beforeEach` gives each prices test a cold cache.
  The same reset strategy isolates the module-level Hive-Engine client.
- `updateFollowCount` is intentionally pure with respect to its argument; the
  test pins that behaviour.
- Store mutations are plain functions using `this`, so tests can call them
  without booting Pinia.
- `ubuntu-latest` provides Node 20+, which the Quasar CLI needs even though Bun
  installs and runs the scripts.

## Risks / open issues

- `bun run build` was not re-run in this follow-up; `bun run test` and
  `bun run lint` both pass.
- Prices test asserts the `AbortSignal` passed to `fetch`; if the jsdom/Node
  `AbortSignal` identity differs in a future Vitest version, relax it to
  `expect.anything()`.
- The Hive-Engine error test asserts five host attempts; update it if
  `FALLBACK_HOSTS` changes.
- `@vue/test-utils` is declared but unused until component tests are added.

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
