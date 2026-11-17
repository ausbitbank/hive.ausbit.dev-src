# W6 package additions

The coordinator owns `package.json` / `bun.lock`. Apply the following, then run
`bun install` and commit the updated lockfile.

## devDependencies

```json
{
  "devDependencies": {
    "@vitejs/plugin-vue": "^6.0.11",
    "@vitest/coverage-v8": "^5.1.0",
    "@vue/test-utils": "^2.6.0",
    "jsdom": "^31.0.1",
    "vitest": "^5.1.0"
  }
}
```

Equivalent command:

```sh
bun add -d vitest@^5.1.0 @vitest/coverage-v8@^5.1.0 jsdom@^31.0.1 @vitejs/plugin-vue@^6.0.11 @vue/test-utils@^2.6.0
```

Version notes:

- `vitest` 5.1.x supports Vite `^6.4.0 || ^7.0.0 || ^8.0.0`, which covers the
  Vite version bundled by `@quasar/app-vite@^3.10.4`.
- `@vitest/coverage-v8` must stay exactly in lockstep with `vitest`.
- `@vitejs/plugin-vue` 6.x supports Vite 8 and Vue 3.5.
- `@vue/test-utils` is for future component tests; the current specs do not
  import it yet.
- `jsdom` 31 requires Node 20+, matching the repo's `engines.node`.

## scripts

Merge into the existing `scripts` object (keep `dev`, `build`, `lint`,
`lint:fix`):

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

`bun run test` must pass after install; `bun run test:coverage` writes
`coverage/coverage-summary.json` (v8, reporters `text` and `json-summary`).

## Recommended, non-blocking cleanups

1. Add `coverage/**` to the `ignores` array in `eslint.config.js` so generated
   coverage output never gets linted.
2. Add `coverage/` to `.gitignore`.
3. CI uses `bun install --frozen-lockfile`, so the lockfile **must** be updated
   in the same commit that adds the devDependencies.
4. Test files import `describe`/`it`/`expect`/`vi` explicitly from `vitest`.
   `globals: true` is enabled for convenience, but keeping explicit imports
   avoids any ESLint `no-undef` churn in the current flat config. Future tests
   should follow the same convention unless the coordinator adds Vitest globals
   to `eslint.config.js`.
