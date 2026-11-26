# Modernization audit & revamp

Status: merged to `master` by fast-forward on 2026-11-17. The pre-revamp master
is preserved as tag `archive/pre-revamp-2026-11-17`.

This document records the audit of the abandoned codebase and the changes made
to bring it back to a supported stack. It is intentionally concrete so the
remaining follow-ups can be picked up later.

## 1. Baseline

At the start of the revamp the project was:

- Vue 2.6 + Vuex 3 + Vue Router 3
- Quasar 1.22 + `@quasar/app` 1.9 (webpack 4, Babel 7)
- Built with `node --openssl-legacy-provider` because webpack 4 needs MD4
- Electron 9, Cordova, SSR and PWA scaffolds included but unused
- `bun audit`: **364 vulnerabilities (15 critical, 155 high, 154 moderate, 40 low)**

There were no tests, no CI, no TypeScript, and ESLint 6 (EOL) with a Vue 2
rule set.

## 2. Findings (audit)

### Dead and half-finished features

- `hiveworld` dashboard: route commented out, 33 components / ~3k lines
  unreachable, full of "coming soon" tabs.
- `pages/blocks.vue`: no route and imported a component that did not exist.
- Unreferenced components: `HASWait`, `PriceFeed`, `ExpandoCard`,
  `communityPostsCarousel`, `communities` (0 bytes), `commentBody`,
  `Transfer`, `txView`.
- `submit.vue`: a full post form with no submit action.
- `twittergiveaway.vue`: in-memory only, never linked.
- `tribes.vue`: stale hard-coded Hive-Engine tribe list; SCOT API calls in the
  post browser.
- `downvoter.vue`: self-described "Alpha, buggy, don't use".
- `owners.vue`: `condenser_api.get_owner_history` returns empty in practice.
- HAS login: gated to two accounts, missing `has.vue`, token save used the typo
  `this.$q.locaStorage`, login type `'HAS'` never matched the `'has'` broadcaster
  branch, so HAS transactions never sent.
- HiveSigner login: button hidden behind `v-if="false"` and a queue branch that
  could never run.
- `exchange.vue`/`changelly.vue`: custom exchange depended on
  `exchange-api.ausbit.dev`, which has a broken TLS certificate.
- `rc.vue` live RC costs depended on `api.ausbit.dev/rc` (HTTP 502).

### Broken external endpoints

- `exchange-api.ausbit.dev` — TLS failure
- `api.ausbit.dev/rc` — 502
- `rpc.ausbit.dev` — 521
- 6 of the 9 hard-coded API failover nodes were down or refusing connections
- `@FullNodeUpdate` metadata used by the nodes page was 4 years stale
- `scribe.hivekings.com` (edit history links) — TLS failure
- `cloudflare-ipfs.com` — DNS no longer resolves
- Bittrex affiliate links, ticker API and TradingView pairs — exchange defunct

### Bugs and correctness issues

- `store` action `getAccountFollowing` called the API without arguments and
  committed a mutation that did not exist.
- `communityInfo` getter had an invalid signature and was always `undefined`.
- Store state was initialised by calling `store()` at module scope (throwaway
  Vuex instances, API node snapshotted at import time, SSR-unsafe).
- `settings.vue` did not persist `ahNode`, so account-history settings were lost;
  `tx.vue` read the wrong state path.
- `follow_api.get_following/get_followers` are not registered on public Hive
  nodes, so follower/following lists silently stayed empty.
- `proposals.vue` discarded the result of `concat` and hid the load-more button.
- `comments.vue` referenced an undefined `loggedInUser` and expected the
  sort method to be an object while initialising it as a string.
- `post.vue` did not load the author account on direct deep links.
- `create.vue` called `this.console.error` and `.error()` on a promise.
- `witness.vue` loaded the logged-in user instead of the requested account.
- `account.vue` had an unused `debounce` wrapper, an `autoRefresh` typo and a
  non-existent `destroy()` hook.
- `wallet.vue` transfer-in/out filters were inverted.
- `tax.vue` looked for `claim_rewards_balance` instead of
  `claim_reward_balance`.
- `debounce()` was used as if it scheduled work; the callbacks ran immediately.

### Security notes

- `smartlock/api.js` injected a hard-coded `ausbit.dev` 10% beneficiary into
  every post, ignoring the user's settings.
- `render.vue` wrote `data-embed-src` / `data-video-href` into `innerHTML`
  without validation, and registered a document-wide click listener at module
  scope.
- The Electron target shipped with `nodeIntegration: true`.
- `bs58` and other imports were undeclared and only present transitively.
- `sanitize-html` and `DOMPurify` were available, but the JSON viewer rendered
  HTML strings directly.

## 3. What changed

### Toolchain

- Vue **3.5**, Quasar **2.35**, Quasar CLI **@quasar/app-vite 3.10** (Vite 8 /
  Rolldown), Vue Router **5**, Pinia **4**.
- SPA-only: removed `src-electron`, `src-ssr`, `src-pwa`, Electron/Cordova
  configuration and the `--openssl-legacy-provider` workaround.
- `src/statics` → `public/statics` (Quasar Vite public folder).
- `quasar.conf.js` → `quasar.config.js`; `index.html` created with the
  `<!-- quasar:entry-point -->` marker.
- ESLint 10 flat config (`eslint.config.js`) with `eslint-plugin-vue` 10;
  `bun run lint` is clean.
- Declared previously-transitive `bs58`; removed unused
  `hive-auth-client`, `hive-auth-wrapper`, `qr-code-styling`, `codemirror`,
  `vue-simplemde`, `vue-sparklines`, `vue-timers`, `vue-trading-view`,
  `qrcode.vue` v1, Vuex 3, webpack 4 and Electron packages.

### Framework migrations

- Vuex 3 → Pinia (`src/stores`). Mutations became actions, persistence stays in
  storage. `this.$store.state.hive.*` → `this.$hiveStore.*` across the app.
- Vuex was dropped by Quasar CLI v2/v3, which is why Pinia was required.
- `defineAsyncComponent()` now wraps every `() => import()` component
  registration. In Vue 3 a bare function is a functional component, so every
  async child previously rendered `[object Promise]`.
- Removed `this.` from template expressions (not available in Vue 3 templates).
- Replaced Vue 2-only `.sync`, `beforeDestroy`, `Vue.set`, `Vue.prototype`.
- Quasar 1 → 2 component APIs: `q-table :data` → `:rows`, `@input` →
  `@update:model-value`, `new-value-mode="add"` → `"add-unique"`, removed
  invalid `q-card-header`, fixed `q-tabs` + `q-route-tab` active state.
- Replaced the abandoned `vue-timers` with `src/mixins/timers.js`.
- Replaced `vue-sparklines` with `src/components/Sparkline.vue`.
- Replaced `vue-simplemde` with `src/components/MarkdownToolbar.vue` and
  `src/utils/markdownEditor.js` (the composer's markdown editor).
- Replaced `vue-trading-view` with `src/components/TradingViewWidget.vue`.
- Upgraded `vue-json-pretty` to v2; rewrote `jsonViewer.vue` around
  `renderNodeValue`, with `h()` rendering and URL-scheme checks.

### Data layer

- `src/services/hive.js` is the API-node configurator and read facade;
  `src/services/hiveTx.js` owns the signing/key/memo stack. `src/services/hiveNodes.js`
  holds the reviewed live node list.
- `src/services/hiveEngine.js` replaces sscjs's bundled axios (which sent an
  invalid `Access-Control-Allow-Origin` header and broke CORS preflights) with a
  throttled `fetch` transport, retrying across fallback Hive-Engine nodes.
- `src/services/prices.js` uses CoinGecko and falls back to the on-chain median
  price when the public CoinGecko API is rate-limited or unavailable.
- Account, transaction, Hive-Engine and CoinGecko reads are no longer affected
  by mutating the global API node mid-request.

### Removed features

- `/exchange`, `/changelly`, `/hiveworld`, `/twittergiveaway`, `/tribes`,
  `/owners`, `/submit`, `/downvoter`.
- HAS and HiveSigner login paths (Keychain and SmartLock remained at revamp).
  HiveAuth was re-added as a first-class signer in W62; see
  [`docs/workstreams/W62-hiveauth.md`](workstreams/W62-hiveauth.md).
- The `@FullNodeUpdate` nodes report; the nodes page now probes nodes live from
  the browser and lets you switch the active node.
- Stale exchange links (Bittrex), stale Hive-Engine RC cost API, SCOT API.

### Bug fixes and improvements

- Follower/following lists now use `condenser_api.get_following/get_followers`.
- Proposals page loads, searches and filters correctly.
- Comments sort/filter controls work; comment submission reports success.
- Deep-linked posts load their author.
- Account auto-refresh and cleanup hooks work.
- Wallet history filters, tax reward aggregation, RC and witness pages fixed.
- Post rendering is sanitized with DOMPurify and an iframe host allowlist.
- SmartLock no longer overwrites post beneficiaries.
- Node settings apply immediately; API and Hive-Engine node settings persist.
- Live node health page with latency, head block and one-click switching.

## 4. Verification performed

- `bun install` (lockfile updated)
- `bun run build` — succeeds with Quasar 2.35 / Vite 8
- `bun run lint` — 0 errors, 0 warnings
- Browser smoke test (headless Chromium) across 30 routes: home, account,
  wallet, blog, posts, followers, following, communities, trail, tip, token,
  block, tx, proposals, witnesses, market(s), HBD, health, nodes, browse,
  trending, community, wallet tax export, HBD stabilizer, create and 404
- Interaction checks: Hive-Engine wallet tab, settings popup, login popup,
  deep-linked post rendering
- No `[object Promise]`, `[object Object]`, `NaN` or `undefined` markers in the
  rendered pages

## 5. Follow-ups (not in this branch)

1. ~~Replace `@hiveio/hive-js` with `@hiveio/dhive` (or `@hiveio/wax`).~~
   Done in #88: signing/keys/memos use lazy-loaded `hive-tx`, reads use
   `src/services/api.js`, and `@hiveio/hive-js` is removed.
2. Host a small server-side proxy for Hive-Engine / CoinGecko if public rate
   limits remain a problem in production. Not needed so far; the read layer
   already fails over between nodes.
3. ~~Replace `moment` with `dayjs` (30 files) and remove the remaining large
   legacy helpers.~~ Done: `src/utils/time.js` is a dayjs-backed compatibility
   shim and the `moment` dependency is gone.
4. ~~Add Vitest unit tests for the services/store and Playwright smoke tests to
   CI. The current browser smoke script is local-only.~~ Done: Vitest covers the
   services and stores, the Playwright suite runs in CI, and Obscura provides the
   fast local loop.
5. Consider Pinia `setup` stores and `<script setup>` for new components. Still
   optional; existing stores use the Options API consistently.
6. ~~Add an offline-capable PWA if that target is wanted again (it was removed
   because the app is deployed as a plain SPA).~~ Done: `src/boot/pwa.js`,
   the offline shell and the update prompt are part of the production build.
