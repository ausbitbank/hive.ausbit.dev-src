# W5a — Performance / dependency sweeps

Status: **implemented and verified locally** (`bun run lint` passes, `bun run test`
passes 65 tests across 8 files). `bun run build` was intentionally not run by
this workstream.

Branch: `improve/phase-2`.

## 1. `sanitize-html` → DOMPurify-based helpers

`src/utils/safeHtml.js` now also exports:

- `stripHtml(value)` — plain text from untrusted HTML/metadata.
  - returns `''` for `null`, `undefined` and any non-string;
  - inserts a space for block-level tags (`p`, `div`, `br`, `li`, headings,
    `blockquote`, `pre`, table cells, `hr`) so words do not run together;
  - parses with `DOMParser`, drops `script`/`style`/`noscript`/`template`
    contents, decodes entities and collapses runs of whitespace;
  - falls back to a tag-stripping regex when `DOMParser` is unavailable.
- `safeJsonParse(value, fallback = {})` — `JSON.parse` in a try/catch; returns
  `fallback` for non-string, malformed, `null` or non-object values. Callers can
  read `.profile`/`.tags` without per-access guards.

`src/components/render.vue` was already DOMPurify-based and was left unchanged.

### Files changed (8)

| File | Change |
|------|--------|
| `src/components/accountHeader.vue` | `Sanitize()` → `stripHtml`; `postingJsonMeta` and `coverImage` → `safeJsonParse` |
| `src/components/communityFeedCarousel.vue` | `s()` → `stripHtml` |
| `src/components/communityHeader.vue` | `postingJsonMeta` and `coverImage` → `safeJsonParse` |
| `src/components/postPreview.vue` | `s()` → `stripHtml` |
| `src/components/rankedPostsCarousel.vue` | `s()` → `stripHtml` |
| `src/components/recentPostsCarousel.vue` | `s()` → `stripHtml` |
| `src/components/userServices.vue` | removed unused `Sanitize()`; `returnServiceLink()` → `stripHtml`; metadata → `safeJsonParse` |
| `src/pages/post.vue` | title/description → `stripHtml`; removed `Sanitize()`; page-meta helper imported as `stripHtmlForMeta` (it is the W3 truncating variant) |

Descriptions/titles still render as plain text. Entity handling is now correct
(`&amp;` → `&`) instead of being re-escaped.

## 2. `moment` → `dayjs` compatibility wrapper

New `src/utils/time.js` wraps dayjs with the moment-style API and extends the
`utc`, `relativeTime` and `duration` plugins. Plugin imports use explicit `.js`
extensions so the module also resolves under native Node ESM (Vitest/Vite).

Supported and smoke-tested call patterns: `moment()`, `moment.utc()`,
`moment.utc(value)`, `moment.unix(value)`, `.format()`, `.fromNow()`,
`.diff()`, `moment.duration(n, unit).humanize(true)`, `.add()`, `.subtract()`,
`.isBefore()`, `.isAfter()`, and `new moment(value)` (tax page).

`import moment from 'moment'` → `import moment from 'src/utils/time'` in all 28
importing files (the 27 listed plus `src/pages/tax.vue`, which imported
`Moment`). No other date logic was changed.

Files: `src/components/{accountOperations, block, comment, communityFeedCarousel,
communityHeader, convertRequests, delegationDialog, delegations, internalMarket,
notifications, postFooter, postPreview, proposal, rankedPostsCarousel,
recentPostsCarousel, recentVotedPostsCarousel, savingsWithdrawalsInProgress,
unstakingDialog, userCard, witnesses}.vue` and
`src/pages/{account, blocks, hbdstabilizer, post, tax, token, tx, wallet}.vue`.
(`accountHeader.vue` does not use dates and was not touched for moment.)

## 3. Quasar animations

`quasar.config.js`: `animations: 'all'` → the nine classes actually used.

Audited with `grep -rhoE "animated [A-Za-z-]+" src`:

`bounceInDown`, `bounceInUp`, `bounceOutDown`, `bounceOutUp`, `fadeIn`,
`fadeInDown`, `fadeOut`, `fadeOutUp`, `zoomInDown`.

The `animated` props on `q-tabs`/`q-tab-panels`/`q-carousel` are component
props, not Animate.css class names, so they do not add to the list.

## 4. `index.html` connection hints

Added (without touching the W3 meta tags or the W2 viewport):

- `preconnect` + `dns-prefetch` for `https://api.hive.blog`,
  `https://images.hive.blog`, `https://api.coingecko.com`,
  `https://herpc.dtools.dev`, `https://api.hive-engine.com`;
- an extra `preconnect`/`dns-prefetch` for `https://history.hive-engine.com`
  (used by the wallet Hive-Engine history call).

`crossorigin` is set on the XHR/fetch API origins; the image origin is a plain
`preconnect`.

## Verification

- `bun run lint` — passes (0 errors).
- `bun run test` — 8 files / 65 tests pass (includes `safe-html.spec.js`).
- `grep -rn "sanitize-html\|from 'moment'" src` — no matches.
- `node` smoke test of `src/utils/time.js` covered every moment call pattern
  listed above.
- `stripHtml`/`safeJsonParse` smoke-tested under jsdom (entity decoding, block
  spacing, script removal, non-string handling, malformed JSON fallback).
- Build not run (per W5a instructions; coordinator runs the integration build).

## Coordinator dependency actions

`package.json` / `bun.lock` were **not** edited by this workstream.

1. Add `dayjs` (`node_modules` currently resolves 1.11.23 transitively):
   `bun add dayjs` → `"dayjs": "^1.11.23"`.
2. Remove `moment` (no longer imported anywhere in `src`): `bun remove moment`.
3. Remove `sanitize-html` (no longer imported anywhere in `src`):
   `bun remove sanitize-html`.
4. Run the integration build to confirm the animation list and dayjs tree-shake
   reduce the bundle (the ~197 KB `sanitize-html` chunk should disappear).

## Follow-ups (not in W5a scope)

- Other bare `JSON.parse(...json_metadata)` calls remain in `userCard.vue`,
  `account.vue`, `tipButton.vue`, `tipDialog.vue`, `recentVotedPostsCarousel.vue`
  and `post.vue` (`postMeta`). They did not use `sanitize-html`; migrating them
  to `safeJsonParse` would make malformed chain metadata non-fatal.
- `src/utils/pageMeta.js` keeps its own truncating `stripHtml` (W3). It could
  later delegate to `safeHtml.stripHtml` + `truncateText` to avoid duplicated
  parsing logic.
