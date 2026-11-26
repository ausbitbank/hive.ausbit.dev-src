# End-to-end tests

The repository has two Playwright suites that share the same spec files:

| Command | Browser | Scope |
| --- | --- | --- |
| `bun run test:e2e` | Obscura (CDP) | Functional flows (Chromium-only specs skipped) |
| `bun run test:e2e:full` | Chromium | Every spec |

CI runs the full Chromium suite. Use the Obscura suite for the local edit/run
loop.

## Fast suite (Obscura)

Install the binary once:

```bash
bun run e2e:install
```

This downloads the latest Linux/macOS release into `.tools/obscura/obscura`
(ignored by git). Point `OBSCURA_BIN` at another binary if you already have one.

```bash
bun run test:e2e
bun run test:e2e:fast:build   # build first
```

`scripts/e2e-fast.mjs` starts Obscura on port 9222 with
`--allow-private-network`, then runs Playwright with `OBSCURA_CDP` set.
`e2e/fixtures.js` connects the browser fixture over CDP when that variable is
present. The config uses four workers because Obscura is cheap to run.

The fast suite covers:

- login/session simulation, HiveAuth login and queue actions
- comment, proposal and transfer flows
- compose autosave/restore, queueing, cover/checklist warnings, supported upload flows and post metadata
- unified search, Lightning search, shared URLs, saved searches and the palette deep link
- browse filters, layout controls and infinite scroll
- 404 search, keyboard shortcuts, back-to-top and share actions
- witness/proposal analytics, delegations, authority risk and community insights
- dashboard layout editing, connections and profile badges
- moderation, downvote transparency, list subscriptions, theme wall, theme sharing and skin safety
- keepsats, POS, market sats quotes, vote directions and retry states

## Why not migrate everything?

Lightpanda and Obscura are built for automation, not for reproducing Chromium's
full rendering surface. This suite relies on Chromium for several checks:

- **axe WCAG A/AA and colour contrast** are checked in Chromium. Obscura's
  independent layout engine reports different computed geometry; two routes
  differed under axe, so these stay in the full suite.
- **Visual and layout assertions** (`polish.spec.js`, the 390px overflow check)
  depend on Chromium-compatible layout. Obscura reported a false horizontal
  overflow on `/proposals`.
- **Performance** needs `PerformanceObserver` LCP/CLS entries and Chromium
  network emulation. Obscura returned no LCP/navigation entries.
- **PWA/service worker/offline** flows need real service-worker and offline
  emulation support.
- **Resilience** uses route interception and offline signing semantics that are
  already covered by the Chromium path.

Lightpanda was also evaluated: it does not render (no screenshots/CSS layout),
which rules it out for the axe, polish and performance checks. Obscura supports
rendering, screenshots and CDP, so it is the better fit for functional tests,
but the Chromium-only list above still applies.

Beyond the seven `CHROMIUM_ONLY` specs in `playwright.obscura.config.js`, some
individual tests skip themselves when `OBSCURA_CDP` is set because they need
file inputs, clipboard permissions, mocked API responses or Chromium layout
measurement. Those checks remain in the full suite.

## Troubleshooting

- **`Obscura was not found`** — run `bun run e2e:install` or set
  `OBSCURA_BIN=/path/to/obscura`.
- **Port already in use** — set `OBSCURA_PORT` (default 9222) or stop the
  existing Obscura server.
- **A test that needs Chromium** — run `bun run test:e2e:full`. Adding
  `**/your.spec.js` to the `CHROMIUM_ONLY` list in
  `playwright.obscura.config.js` keeps it out of the fast run.
- **Screenshots on failure** are written to `test-results/`; traces are disabled
  in the fast suite because tracing is a Chromium-oriented path.
