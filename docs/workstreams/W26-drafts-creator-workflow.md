# W26 — Drafts and creator workflow

Date: 2026-11-18
Status: complete

## Scope

The explorer had reading, commenting and queuing, but no way to write a full
post. W26 adds a local-first creator workflow on top of the existing posting
queue: drafts, a richer markdown editor, community/tag selection, cross-post
attribution, beneficiaries and reward settings, a publish checklist, and JSON
backup.

The flow is deliberately local-first. Drafts never leave the browser until a
`comment` operation is queued, and publishing still requires the normal
Keychain/SmartLock posting-key signature.

## New surface

- `/compose` — the composer. `/drafts` redirects to it.
- The main header has a **Write a post** action.
- The drawer Tools section, command palette (`Write a post`, `New post`) and
  `g` then `c` keyboard shortcut link to the composer.

## Drafts

`src/services/drafts.js` owns the local draft model and storage:

- Drafts contain the title, body, tags, community, cross-post reference,
  beneficiaries and reward settings. They never contain keys.
- Autosave is debounced (700 ms) on every edit; explicit **Save** is also
  available with `Ctrl/⌘ S`.
- The most recent draft is restored on load. A draft id in the URL
  (`/compose/:draftId`) selects a specific draft, so the browser Back button and
  reload both work naturally.
- **Discard** is explicit and asks for confirmation. Clearing the body does not
  silently overwrite the last saved non-empty copy.
- Up to 40 drafts are kept, sorted by update time. Storage failures (quota or
  private mode) show a clear state instead of losing edits silently.
- `/compose` shows the last saved time, word/character/byte counts and reading
  time.

## Markdown editor

`src/components/MarkdownToolbar.vue` and `src/utils/markdownEditor.js` provide a
native textarea editor with:

- Bold, italic, heading, quote, bullet/numbered lists, inline code, code block
  and divider actions.
- Link and image insertion dialogs with alt text and `http(s)`/`mailto`
  validation through `safeExternalUrl`.
- Markdown table insertion (3×3 template).
- Write and Preview modes. Preview uses the same sanitised `render` component as
  posts and comments, so preview parity is exact.
- `Ctrl/⌘ B`, `Ctrl/⌘ I`, `Ctrl/⌘ K`, `Ctrl/⌘ S`, `Ctrl/⌘ Enter` and a visible
  keyboard hint.
- Draft length guidance: short/good/long ranges, reading time and the 65,535-byte
  Hive body limit.

## Community, tags and cross-posting

- The community/category becomes `parent_permlink` and the first
  `json_metadata.tags` entry.
- Tags are normalised to lowercase, spaces become hyphens, duplicates are
  removed and the metadata list is capped at five.
- Community options come from the account's subscriptions and any community info
  already loaded, but free-form entries are accepted.
- Cross-posting accepts a Hive post URL, `@author/permlink`, or a bare
  `author/permlink`. The original title/body fill the draft when it is empty, and
  the source is recorded as `json_metadata.cross_post = { author, permlink }`.
  The published item is a new top-level post that credits the original; it does
  not re-upload media or copy the original's beneficiaries.
- A loaded source is visible in the sidebar and can be removed before publishing.

## Publish checklist and authority

`src/services/publish.js` builds the operation and the checklist from the same
normalised data, so the preview cannot drift from what is queued:

- Title, body, byte limit, community/tags, beneficiary totals (≤100%, valid
  accounts, at most 8), payout cap, HBD/HP split, vote and curation flags.
- Cross-post source validity when present.
- A visible **Authority** row explains that publishing creates a posting-key
  `comment` operation only; no active-key operation is created.
- A **Beneficiary** row previews each account's share and the author's remaining
  share.

Publishing builds a top-level `comment` operation (`parent_author: ''`,
`parent_permlink` = community/category), includes `comment_options` inside the
comment for the queue, and removes the local draft after queueing. Nothing is
broadcast until the queue is signed.

The queue now passes `json_metadata` to Keychain through
`postMetadataArgument()`. Queue items already store metadata as a JSON string, so
the old `JSON.stringify` double-encoded it; tags and `cross_post` would have been
unreadable to Keychain-signed posts.

## Export and import

- **Export draft** downloads one JSON file with a versioned envelope.
- **Export all** downloads the visible drafts for backup.
- **Import** accepts the app envelope, a bare array or a single draft. Invalid
  JSON and empty entries are reported; imports merge by id and do not overwrite
  newer local drafts.

## Verification

- `bun run lint` — clean.
- `bun run test` — 50 files / 368 tests passing.
- `bun run build` — succeeds; `compose` route chunk 42.9 KB raw / 13.5 KB gzip.
- `bun run test:e2e` — 19 tests: 18 passed, 1 skipped (Chromium-only overflow
  check); includes autosave/reload, a runtime-error guard and a queued top-level
  post.
- `bun run test:e2e:full` — 44 Playwright tests passing, including axe at 1440px
  and 390px for `/compose` and the new compose mobile/desktop layout check.
- `bun run perf` / `bun run perf:check` — compose added to the dashboard:
  LCP 388 ms, route JS 98.1 KB, total transfer 631.2 KB; all budgets pass.
- Screenshots: `test-results/compose-1440.png` and
  `test-results/compose-390.png` during development (not committed).

## Deployment and live smoke

- `./scripts/deploy.sh` completed on 2026-11-18.
  - Build backup:
    `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261118T090223Z.tar.gz`.
  - Prerendered `/compose` metadata shell installed.
- The canonical nginx config now includes `compose` in the prerendered static
  route allowlist and redirects `/drafts` to `/compose`. The production config
  was backed up as
  `hurgenburgen:~/hive-backups/hive.ausbit.dev.nginx-20261118T085323Z`,
  validated with `nginx -t` and reloaded.
- Live checks:
  - `GET /compose` → 200, `text/html`, canonical
    `https://hive.ausbit.dev/compose`, title
    “Write a Hive post — drafts, preview and publishing”.
  - `GET /drafts` → 301 to `/compose`.
  - `/compose/` → 301 to `/compose`.
  - Production Playwright smoke: composer mounted, autosave persisted and
    restored after reload, zero page/console errors at 1440px and no horizontal
    overflow at 390px.
- Integration fix found by the live smoke: `notifications.vue` had
  `scheduleInitialRefresh()` / `cancelInitialRefresh()` outside `methods`, which
  raised `TypeError: this.scheduleInitialRefresh is not a function` for signed-in
  users. Both helpers now live in `methods`, and the fast compose test fails on
  new runtime errors.
- Deployment note: a separate witness-health change (`fix(witnesses): loosen
  missed-block alerts to top-20 after 60 blocks`, `fc78b21`) landed after the
  deploy. The production bundle was built with that change present, so
  `fc78b21` is the source of truth for production and should be
  re-deployed/modified independently.
- The compose prerender only covers the bare `/compose` URL. `/compose/:draftId`
  deep links return the SPA shell through the normal history fallback; the
  nginx allowlist and the `/drafts` redirect are in
  `deploy/nginx/hive.ausbit.dev.conf`.

## Files

- `src/pages/compose.vue` — composer page.
- `src/components/MarkdownToolbar.vue` — markdown toolbar and insertion dialogs.
- `src/utils/markdownEditor.js` — pure text/selection helpers.
- `src/services/drafts.js` — draft model, storage, export/import and length
  guidance.
- `src/services/publish.js` — post operation, metadata, URL parsing and publish
  checklist.
- `src/services/queue.js` — `postMetadataArgument()` for Keychain.
- `src/components/queue.vue` — uses the helper when posting.
- `src/router/routes.js`, `src/layouts/MainLayout.vue`,
  `src/components/CommandPalette.vue`, `src/components/ui/KeyboardShortcuts.vue`
  — route and navigation entry points.
- `tests/unit/drafts.spec.js`, `tests/unit/publish.spec.js`,
  `tests/unit/markdown-editor.spec.js`, `tests/unit/queue.spec.js`.
- `e2e/actions.spec.js`, `e2e/helpers.js`, `e2e/a11y.spec.js`,
  `e2e/polish.spec.js`.
- `scripts/perf-baseline.mjs`, `docs/performance/budgets.json`,
  `docs/performance/*`.

## Notes and limits

- Drafts are local to one browser profile and are not encrypted. Anyone with
  access to the profile can read them; export a backup before clearing site
  data.
- Images are inserted by URL. W26 does not add an image hosting/upload service.
- Cross-posting records attribution but does not mirror the original's payout
  options or upload its media.
- The composer is deliberately separate from `/create`, which remains the
  account-creation page.
