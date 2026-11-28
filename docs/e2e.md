# End-to-end tests

The Playwright specs live in `e2e/` and run against a built production bundle
served by `scripts/serve-dist.mjs`.

| Command | Browser | Scope |
| --- | --- | --- |
| `bun run test:e2e` | Chromium | Fast functional suite (mocked flows) |
| `bun run test:e2e:full` | Chromium | Complete release gate |
| `bun run test:e2e:obscura` | Obscura | Optional non-mocked browser checks |

Install Chromium once:

```bash
bunx playwright install chromium
```

## Fast functional suite

```bash
bun run test:e2e
bun run test:e2e -- e2e/core.spec.js   # one spec while iterating
```

This lane keeps the functional flows and route mocks, skips the heavy
a11y/layout/perf/PWA/offline/Vault specs, and runs with four fully parallel
workers. It is the local edit/run loop and typically finishes in about three
minutes.

`scripts/e2e-run.mjs` starts the static server once before Playwright starts and
stops only the processes it started. This avoids the mid-run `Connection
refused` failures that happened when Playwright owned the server lifecycle under
parallel load. It also starts Obscura when `test:e2e:obscura` is used.

## Full Chromium gate

```bash
bun run test:e2e:full
bun run test:e2e:build   # build first
```

The full suite adds axe WCAG A/AA at desktop and mobile widths, visual/layout
assertions, LCP/CLS performance, PWA install/offline/update flows, wallet CSV
export, Lightning state coverage, Vault and resilience/offline signing. It is
the CI release gate.

A few release checks still read live public Hive APIs. They are slower and can
hit a transient node error or rate limit, so the full gate retries transient
failures. Prefer mocked specs for the local loop.

## Optional Obscura lane

Install the binary once:

```bash
bun run e2e:install
```

Obscura is a lightweight Rust/V8 headless browser with a CDP server. It is cheap
to start, but its CDP implementation does not expose request bodies, so specs
that rewrite JSON-RPC responses cannot work there. Use it only for non-mocked
browser checks:

```bash
bun run test:e2e:obscura
```

`scripts/e2e-run.mjs` starts Obscura on port 9222 with
`--allow-private-network`, then runs Playwright with `OBSCURA_CDP` set.
`e2e/fixtures.js` connects the browser fixture over CDP when that variable is
present. Point `OBSCURA_BIN` at an existing binary if needed.

## Why Chromium for the fast lane?

- **Route mocks need request bodies.** Obscura returns `null` from
  `request.postDataJSON()` and `request.postData()`, so a spec cannot tell
  `bridge.list_communities` from `condenser_api.get_accounts`. Chromium exposes
  the JSON-RPC payload and keeps the mocks deterministic.
- **Fewer live-network waits.** Mocked Chromium specs complete in seconds;
  equivalent Obscura specs fall back to live public nodes and can spend
  minutes in failover/retry paths.
- **Parallel isolation.** Chromium gives each test its own context, so fully
  parallel workers do not share local storage, cookies or service workers.

## Why not migrate everything to Obscura?

Obscura is built for automation, not for reproducing Chromium's full rendering
surface. This suite relies on Chromium for several checks:

- **axe WCAG A/AA and colour contrast** are checked in Chromium. Obscura's
  independent layout engine reports different computed geometry.
- **Visual and layout assertions** (`polish.spec.js`, the 390px overflow check)
  depend on Chromium-compatible layout.
- **Performance** needs `PerformanceObserver` LCP/CLS entries and Chromium
  network emulation.
- **PWA/service worker/offline** flows need real service-worker and offline
  emulation support.
- **Vault** needs real IndexedDB `CryptoKey` storage, axe and deterministic
  network mocking.

Beyond the `CHROMIUM_ONLY` specs in `playwright.functional.config.js`, some
individual tests skip themselves when `OBSCURA_CDP` is set because they need
file inputs, clipboard permissions, mocked API responses or Chromium layout
measurement. Those checks remain in the full suite.

## Troubleshooting

- **`Obscura was not found`** — run `bun run e2e:install` or set
  `OBSCURA_BIN=/path/to/obscura`.
- **Port already in use** — set `E2E_PORT` (static server, default 4173) or
  `OBSCURA_PORT` (default 9222).
- **Many `Connection refused` failures at `127.0.0.1:4173`** — stop any stale
  `scripts/serve-dist.mjs` or Obscura process and rerun. The wrapper now keeps
  the server alive; a stale process from an older run can still occupy the port.
- **A test that needs Chromium** — run `bun run test:e2e:full`. Add
  `**/your.spec.js` to the `CHROMIUM_ONLY` list in
  `playwright.functional.config.js` to keep it out of the fast run.
- **Screenshots on failure** are written to `test-results/`; traces are disabled
  in the fast suite and retained on failure in the full suite.
