<!-- rp1:start -->
## Repository guidance

No generated rp1 knowledge base is committed to this repository. Start with
`README.md`, `docs/ROADMAP.md`, `docs/workstreams/README.md` and
`docs/SECURITY.md`. If a local `.rp1/context/index.md` exists, read it first and
then load `architecture.md`, `modules.md`, `patterns.md` or `concept_map.md` as
the task requires.

Do not use `/knowledge-load` in subagents (it can cause an early exit). Use the
Read tool directly.
<!-- rp1:end -->

## Testing rules

These rules apply to every change, including AI-assisted work.

- **Test observable behavior only.** Add tests for business rules, user-visible
  outcomes, critical state transitions, auth/security boundaries, and bug
  regressions. Do not add tests for language features, component metadata,
  getters/setters, constant snapshots, registry shape, or framework defaults.
- **Never couple tests to internals.** Do not mock private helpers or assert
  exact internal call counts, private field names, or log strings. Mock only
  external boundaries (network, storage, chain RPC, browser APIs).
- **Reuse before creating.** Prefer an existing spec, fixture, helper, or
  table-driven pattern. Do not create a new spec file when the module already
  has one, and do not duplicate setup blocks that belong in `tests/setup.js`,
  `e2e/helpers.js`, or `e2e/fixtures.js`.
- **Keep the valuable edge cases.** Preserve tests for past regressions,
  security checks, authorization boundaries, payment/signing logic, and the
  critical end-to-end flows. Expensive but important coverage stays in the full
  suite.
- **Iterate narrowly.** During feature work run `bun run test:affected` (changed
  files) or a targeted `bunx vitest run tests/unit/<file>.spec.js`. Run the full
  suite only after the feature is complete.
- **Tag, do not delete, slow coverage.** Add `{ tags: ['slow'] }` to genuinely
  expensive tests (PBKDF2/KDF, reconnect backoff). Never tag security or
  business-logic tests merely to make the fast lane greener.

### Test commands

| Command | Use |
| --- | --- |
| `bun run test:affected` | Fastest local loop: changed files, slow tests excluded |
| `bun run test:fast` | All unit tests except `slow`-tagged coverage |
| `bun run test` / `bun run test:unit` | Full unit suite, including slow coverage |
| `bun run test:e2e` | Fast functional Chromium suite (~3 minutes, mocked flows) |
| `bun run test:e2e:full` | Full Chromium release gate, including live-data/a11y checks |
| `bun run test:e2e:obscura` | Optional Obscura lane for non-mocked browser checks |
| `bun run test:all` | Pre-push gate: full unit suite + build + full Chromium E2E |
