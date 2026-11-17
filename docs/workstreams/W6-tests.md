# W6 — Tests / CI

Status: **implemented and verified locally**. `bun run test` passes
98 tests across 12 files (Vitest 5.1.0); `bun run lint` exits 0 with no errors
or warnings.

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
- `tests/unit/text-helpers.spec.js` — `safeHtml` text helpers:
  - `stripHtml` removes tags, decodes entities, spaces block elements,
    collapses whitespace, drops script/style/noscript content, and returns `''`
    for null/non-string input;
  - `safeJsonParse` parses objects, falls back for invalid JSON, null/undefined,
    non-strings and primitive JSON, and defaults the fallback to `{}`.
- `tests/unit/page-meta.spec.js` — jsdom metadata tests with `document.head`
  reset per test:
  - asserts title, description, canonical, OG, Twitter and default values;
  - normalises relative URLs to absolute `BASE_URL` URLs and keeps absolute
    cross-origin URLs;
  - consecutive calls replace tags instead of duplicating them;
  - long/HTML descriptions are stripped and truncated with `…`;
  - JSON-LD is added, replaced in place, and removed by `setJsonLd(null)` or a
    `setPageMeta` call without `jsonLd`;
  - exercises the exported `pageMeta.stripHtml(value, maxLength)` helper.
- `tests/unit/time.spec.js` — dayjs compatibility wrapper under fake system
  time: `moment.utc().format`, `moment.unix().format/.utc`, `fromNow`,
  `moment.duration().humanize(true)`, add/subtract chains, isBefore/isAfter and
  `Date` input.
- `tests/unit/smartlock-cache.spec.js` — stubs the global `localStorage` with an
  in-memory map: purges only the two legacy plaintext cache prefixes, preserves
  the locker and unrelated keys, returns the removed count, returns 0 on a
  second call, and returns 0 when storage is missing or throws.
- `.github/workflows/ci.yml` — push + pull_request, `ubuntu-latest`,
  `actions/checkout`, `oven-sh/setup-bun` (`bun-version: latest`),
  `bun install --frozen-lockfile`, `bun run lint`, `bun run test`,
  `bun run build`; concurrency cancels superseded runs.
- `docs/workstreams/W6-package-additions.md` — exact devDependencies, scripts
  and coordinator notes.

## Test results

Run on 2026-11-17 after the final helper integration:

```
> vitest run

 Test Files  12 passed (12)
      Tests  98 passed (98)
   Start at  18:46:39
   Duration  4.39s (environment 94%, transform 2%, import 1%, tests 1%, worker 1%)
```

The 33 new tests are split 11 (`text-helpers`), 11 (`page-meta`), 7 (`time`)
and 4 (`smartlock-cache`). Earlier batches: 21 (`hive-node-selection` +
`queue-persistence`), 26 (`safe-url` + `safe-html` + `hive-engine`) and the
original 18 W6 tests.

`bun run lint` exits 0 with no output (0 errors, 0 warnings).

## Not created (intentional)

- No Playwright config/spec. It cannot be added correctly without editing
  `package.json` and installing `@playwright/test`; see follow-up below.

## Deferred coverage (for later workstreams)

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
- `pageMeta` tests reset `document.head` per test and assert relative URLs
  against the exported `BASE_URL`; jsdom supplies `DOMParser` and
  `HTMLScriptElement`.
- Time tests pin the fake clock to 2026-11-17T12:00:00Z; the relative-time
  assertions use dayjs's wording (for example `an hour ago`).
- The SmartLock test stubs the global `localStorage`; the module's encryption
  utilities are imported but not exercised by the purge helper.
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
- The node-selection tests assert the mocked fallback list and parallel launch
  order; update the `hiveNodes` mock if `HIVE_API_NODES` changes.
- Relative-time tests pin dayjs output strings; update them if the dayjs
  relativeTime wording or thresholds change.
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
