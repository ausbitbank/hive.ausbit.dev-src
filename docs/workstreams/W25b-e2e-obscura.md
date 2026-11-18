# E2E performance — Obscura fast suite

Status: complete (2026-11-18)

## Scope

Reduce the local Playwright feedback loop without weakening the release gate.

Delivered:

- `scripts/install-obscura.mjs` downloads the latest Obscura release into
  `.tools/obscura` (gitignored).
- `scripts/e2e-fast.mjs` starts Obscura on CDP port 9222 and runs Playwright with
  `OBSCURA_CDP` set.
- `e2e/fixtures.js` connects the Playwright browser fixture over CDP when
  `OBSCURA_CDP` is present; otherwise the stock Chromium fixtures are used.
- `playwright.obscura.config.js` runs the functional specs with four workers and
  excludes Chromium-only specs.
- `bun run test:e2e` now runs the fast suite; `bun run test:e2e:full` keeps the
  complete Chromium suite, which CI uses.

## Result

- Fast suite: **16 passed, 1 skipped in ~35s** (4 workers).
- Full Chromium suite: **40 passed in ~6.9m**.
- Previous local loop: ~6.7–6.9m for every run.

## Why Obscura, not Lightpanda

Lightpanda has no rendering engine, so it cannot cover screenshots, CSS layout,
axe colour contrast or anything that inspects computed geometry. Obscura is a
Rust/V8 headless browser with native rendering, screenshots and a CDP server, so
it can run the functional flows.

Obscura still differs from Chromium in layout and platform APIs. The following
remain Chromium-only:

- `a11y.spec.js` — independent layout produced different contrast/geometry
  results on two routes.
- `polish.spec.js` and the 390px overflow assertion — Obscura reported a false
  overflow on `/proposals`.
- `perf.spec.js` — no LCP/CLS PerformanceObserver entries and no Chromium
  network emulation.
- `pwa.spec.js` — service worker/offline/update flows.
- `resilience.spec.js` — route interception and offline-signing semantics.

The fast suite also skips the network-heavy voter-sample click when
`OBSCURA_CDP` is set; the full suite still exercises it.

## Verification

- `bun run test:e2e` — 16 passed, 1 skipped, ~35s.
- `bun run test:e2e:full` — 40 passed, ~6.9m.
- `bun run lint` and `bun run test` unchanged.
- CI now runs `bun run test:e2e:full`.

## Follow-ups

- Revisit Lightpanda when it gains rendering and screenshots; it may be even
  cheaper for the functional subset.
- Re-evaluate Obscura's layout engine for axe/polish once its WPT coverage and
  layout parity improve.
