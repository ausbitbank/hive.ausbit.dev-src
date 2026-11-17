# W6 — Tests / CI

Status: **implemented and verified locally**. `bun run test` passes
65 tests across 8 files (Vitest 5.1.0); `bun run lint` passes with 0 errors
(3 pre-existing warnings in `src/components/searchbox.vue`).

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
- `tests/unit/hive-node-selection.spec.js` (follow-up, W4 integration) — mocks
  `@hiveio/hive-js` and `src/services/hiveNodes`:
  - `probeHiveNode` success returns the head block, non-OK HTTP and invalid
    head block return `ok: false`, timeout aborts via a signal-aware fetch, and
    a missing URL skips fetching;
  - `selectHiveNode` keeps a healthy configured node even when a fallback is
    faster, picks the fastest healthy fallback when configured fails, falls
    back to the configured URL when all probes fail, and launches every probe
    in parallel before any response resolves (deferred-promise assertion).
- `tests/unit/queue-persistence.spec.js` (follow-up, W4 integration) — mocks
  Quasar storage with in-memory `Map`s:
  - `persistQueue` writes `{ savedAt, owner, items }`, removes the key for
    empty/non-array queues, and swallows storage write failures;
  - `restoreQueue` returns valid items, keeps entries at exactly the TTL and
    drops/removes expired ones, rejects owner mismatches, filters corrupt items,
    handles malformed payloads, missing storage and storage that throws;
  - TTL is driven by `vi.setSystemTime` under fake timers.
- `.github/workflows/ci.yml` — push + pull_request, `ubuntu-latest`,
  `actions/checkout`, `oven-sh/setup-bun` (`bun-version: latest`),
  `bun install --frozen-lockfile`, `bun run lint`, `bun run test`,
  `bun run build`; concurrency cancels superseded runs.
- `docs/workstreams/W6-package-additions.md` — exact devDependencies, scripts
  and coordinator notes.

## Test results

Run on 2026-11-17 after W4 integration:

```
> vitest run

 Test Files  8 passed (8)
      Tests  65 passed (65)
   Start at  18:10:19
   Duration  2.47s (environment 92%, transform 3%, import 2%, worker 1%, tests 1%)
```

The 21 new tests are split 9 (`hive-node-selection`) and 12
(`queue-persistence`). The previous W1 batch added 26 tests (15 `safe-url`,
7 `safe-html`, 4 `hive-engine`); the original W6 batch had 18 tests.

`bun run lint` exits 0 with 0 errors and 3 warnings:

```
/mnt/arty/coding/ausbit.dev/hive/src/components/searchbox.vue
  116:16  warning  'e' is defined but never used  no-unused-vars
  175:16  warning  'e' is defined but never used  no-unused-vars
  188:16  warning  'e' is defined but never used  no-unused-vars

✖ 3 problems (0 errors, 3 warnings)
```

## Not created (intentional)

- No Playwright config/spec. It cannot be added correctly without editing
  `package.json` and installing `@playwright/test`; see follow-up below.

## Deferred coverage (for later workstreams)

- `src/utils/pageMeta.js` — W3 file; test title/description/canonical/OG/
  Twitter updates against a jsdom document.
- Hive store **Pinia actions** — need Pinia plus `@hiveio/hive-js` mocks;
  mutations and queue helpers are covered now, so action tests can follow
  without blocking this batch.
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
- The node-selection spec mocks `HIVE_API_NODES` with three fixed fallbacks and
  uses a signal-aware fetch to exercise the real abort timer; the parallel
  launch assertion relies on `probeHiveNode` calling `fetch` synchronously.
- Queue persistence stores `queue[0][0]` as the owner and expires entries after
  24 hours; the tests pin the exact TTL boundary with fake system time.
- `ubuntu-latest` provides Node 20+, which the Quasar CLI needs even though Bun
  installs and runs the scripts.

## Risks / open issues

- `bun run build` was not re-run in this follow-up; `bun run test` and
  `bun run lint` both pass.
- Lint has 3 pre-existing `no-unused-vars` warnings in
  `src/components/searchbox.vue` (not W6-owned). They do not fail CI.
- Prices test asserts the `AbortSignal` passed to `fetch`; if the jsdom/Node
  `AbortSignal` identity differs in a future Vitest version, relax it to
  `expect.anything()`.
- The Hive-Engine error test asserts five host attempts; update it if
  `FALLBACK_HOSTS` changes.
- The node-selection tests assert the mocked fallback list and parallel launch
  order; update the `hiveNodes` mock if `HIVE_API_NODES` changes.
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
