# Contributing to Banksia

Thanks for helping improve Banksia. This is a production Hive explorer,
wallet and publishing toolkit, so changes are expected to be small, tested and
safe to deploy.

## Before you start

- **Bugs and small fixes** can go straight to a pull request.
- **Features and behaviour changes** should start as an issue so the scope and
  the signing model can be agreed first.
- **Security issues** must not be reported in a public issue. See
  [SECURITY.md](SECURITY.md).

## Development setup

Requirements: [Bun](https://bun.sh) 1.2 or newer and Node.js 24.15+ (LTS),
Node 22.22.2+ or Node 26+ (`.nvmrc` selects Node 24).

```bash
bun install
bun run dev
```

The dev server runs at <http://localhost:8080>.

For the full end-to-end gate you also need Chromium once per machine:

```bash
bunx playwright install chromium
bun run e2e:install
```

## Checks before opening a pull request

Run the checks that match your change. CI runs lint, unit tests, the production
build, the full Chromium E2E suite and the performance budgets.

```bash
bun run lint
bun run test
bun run build
bun run test:e2e        # fast Obscura loop
bun run test:e2e:full   # full Chromium suite, required for UI, a11y and PWA work
```

Also run `bun run perf:check` when you touch a route bundle, shared component or
startup path.

For user-facing work, include a browser smoke of the affected routes and check
axe at 1440px and 390px. Keep one page-level `h1`, semantic controls, visible
focus and no horizontal overflow.

## Code and documentation conventions

- Vue 3 Options API, Quasar 2 and Vite. Follow the structure and naming of the
  surrounding files.
- Use the semantic theme tokens in `src/css/`; do not hard-code palette values.
  `bun run lint` includes the theme-token scanner.
- Put shared primitives under `src/components/ui/`, chain reads under
  `src/services/`, and persisted state under the appropriate Pinia store.
- Sanitize all user-generated content and keep `noopener noreferrer` on external
  links.
- Preserve the posting/active authority split. Never widen an action's authority
  or auto-broadcast a queued action.
- Update the relevant document in `docs/` when behaviour, deployment or the
  security model changes. Substantial work gets a `docs/workstreams/W*.md`
  record with scope, verification and known limits.

## Commit messages

Use a short conventional prefix and a focused subject:

```text
feat(wallet): add keepsats send summary
fix(lightning): recover after a relay disconnect
test(e2e): cover the browse append path
docs(security): document CSP reporting
```

## Pull requests

A pull request should explain:

1. What changed and why.
2. Which routes or user flows are affected.
3. The checks you ran, including any known failures.
4. Screenshots for visible changes.
5. Any deployment or migration step.

Keep unrelated refactors out of a bug fix. Dependabot bumps are merged
separately.

## License

By contributing you agree that your contribution is released into the public
domain under the [Unlicense](LICENSE), the same licence as the project.
