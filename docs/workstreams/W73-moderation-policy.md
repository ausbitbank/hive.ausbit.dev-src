# W73 Phase 1 — Local moderation policy and explainability

Date: 2026-11-24
Status: implemented, deployed and live-smoked (client route).

Contract: issue #94. Plan:
[`W73-moderation-implementation-plan.md`](W73-moderation-implementation-plan.md).
W71 (profile skin safety) is the narrow slice this generalises.

## Scope

A local-first, user-configurable moderation layer for feeds, comments, profiles,
community feeds, search and skins. It is **not** a site-wide ban list and it
changes no chain state.

Shipped in this phase:

- Five presets: Open, Balanced (default), Strict, Follow-only and Custom, each
  explained in the UI.
- A pure content policy (`moderationContent.js`) with per-surface decisions and
  a strict skin gate (`moderationPolicy.js`).
- Distinct layers: direct mute, direct blacklist, followed mute list, followed
  blacklist, community post mute, community role, reputation, downvotes, NSFW,
  follow-only.
- Explainability and overrides on feed cards, comments, profile headers, post
  headers, community feeds, search rows and skins.
- Follows beat subscribed mute lists by default with a conflict badge. Negative
  reputation needs an explicit followed-reputation choice.
- First-use Balanced disclosure when the first item is labelled/collapsed.
- Per-item, per-author, always-show/hide and ignored-voter overrides.
- `/settings/moderation` with presets, custom matrix, list context, overrides,
  skin links, reset and versioned JSON export/import.
- Local context loads lazily on content/skin surfaces; guests never load the
  chain-read store.

## Preset behaviour

| Signal | Open | Balanced | Strict | Follow-only |
| --- | --- | --- | --- | --- |
| Direct mute | label | collapse | collapse | collapse |
| Followed mute list (not followed) | label | collapse | collapse | collapse |
| Followed mute list (followed) | show + conflict | show + conflict | show + conflict | show + conflict |
| Direct / followed blacklist | label | label | label | label |
| Community post mute | label | collapse | collapse | label |
| Community muted role | label | label | label | label |
| Negative reputation | label | collapse | collapse | label |
| Downvotes | label | label | collapse | label |
| NSFW | label | collapse | collapse | label |
| Not followed | show | show | show | collapse in feeds/comments/search |

`collapse` hides the body/media and keeps the author, title and “Show anyway”.
`hide` is only used for an explicit local hide (and would be reserved for a
reviewed safety floor). Profile/post surfaces never collapse or remove the item
the viewer deliberately opened; they show a label and management actions.
Comments collapse rather than disappear, preserving the thread shape.

## Implementation

| File | Role |
| --- | --- |
| `src/services/moderationPolicy.js` | Pure skin gate, reputation helper, shared name/list helpers. |
| `src/services/moderationContent.js` | Pure content decision engine, preset/custom rules, reason builders. |
| `src/services/moderationSettings.js` | Versioned policy schema, normalization/caps, storage, export/import. |
| `src/services/moderationData.js` | Cached mute/blacklist/followed-list/member reads and viewer context. |
| `src/services/moderationStoreLoader.js` | Lazy store loader for route-level code splitting. |
| `src/stores/moderation.js` | Reactive policy/context, overrides, disclosure, import/export. |
| `src/mixins/moderation.js` | Shared content wiring; guest policy is read locally without the store chunk. |
| `src/components/moderation/ModerationNotice.vue` | Reason chip, evidence, actions and first-use disclosure. |
| `src/components/theme/ProfileSkin.vue` | W71 skin gate plus lazy store and async blocked notice. |
| `src/components/postPreview.vue` | Feed-card label/collapse, surface prop, overrides. |
| `src/components/comment.vue` | Comment collapse/label, thread-wide show-all. |
| `src/components/comments.vue` | Passes the thread-wide show-all flag; no longer drops hidden subtrees. |
| `src/pages/account.vue`, `src/pages/post.vue` | Deliberate-visit labels and management actions. |
| `src/pages/search.vue`, `src/components/search/ResultList.vue` | Search row moderation labels and collapsed descriptions. |
| `src/pages/moderation.vue` | `/settings/moderation` UI. |
| `src/pages/appearance.vue` | Skin-safety rules and followed-account choices. |
| `src/services/followOps.js` | Preserves all follow flags when muting, unmuting, following or unfollowing. |
| `src/services/postSnapshot.js` | Preserves moderation fields in home/feed snapshots. |
| `src/services/shortForm.js`, `src/components/shortForm/ShortFormCard.vue` | Short-form cards collapse with an explanation instead of silently filtering. |

## Data and caching

- `bridge.get_follow_list` is read once for the viewer (muted, blacklisted,
  follow_muted, follow_blacklist), cached for 5 minutes. `follow_muted` and
  `follow_blacklist` owners are resolved to members with a 20-list cap;
  unresolved lists are counted and explained.
- The viewer snapshot is cached in `sessionStorage` for 10 minutes and bounded.
  Login/logout/account switch re-keys it.
- Content decisions are synchronous and read the cached snapshot. No network
  request is made while rendering a card or comment.
- Feed snapshots now keep `stats.hide/gray/hidden/flagged`, `muted_reasons`,
  `flag_weight`, `author_role` and `blacklists` so snapshot-painted feeds do not
  lose their policy inputs.
- Guest policy is read directly from `hive:moderation:v1:guest`; guests do not
  load the chain-read store chunk.

## Authorities

- No new signing path. `/settings/moderation` is local storage only.
- Mute/unmute/follow/unfollow continue to queue `posting` `custom_json` follow
  operations. `followOps` now sends the full `what` array, so an unmute no
  longer clears `blog`, `blacklist`, `follow_muted` or `follow_blacklist`.
- No server sync, no global list, no automatic downvote/mute/hide.

## Overrides and export

- Per-item `showItems`/`hideItems`, per-author `showAuthors`/`hideAuthors`,
  ignored voters, mute/blacklist owners and custom rules.
- Caps: 300 items, 200 authors, 500 voters, 200 list owners.
- Export envelope: `{ app, type: "hive-moderation-policy", version, exportedAt, policy }`.
  Import accepts the envelope, a bare policy or a JSON string; foreign/future
  files are rejected with a clear message.
- Only list owners are exported, never other people's member lists.

## Performance

The content policy is shared by Home, Browse, Post and Search. The store and
chain reads stay out of guest routes, the blocked/safety notices are async, and
the moderation page/settings chunk is route-local. The measured budgets were
updated in `docs/performance/budgets.json` and the table in
`docs/performance/README.md`:

| Route | Before | After |
| --- | ---: | ---: |
| Home route JS | 166 | 174 |
| Browse route JS | 140 | 145 |
| Post route JS | 300 | 303 |
| Search route JS | 120 | 125 |
| Initial JS | 160 | 160 |

LCP and CLS budgets are unchanged. `bun run perf:check` passes.

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean |
| `bun run test` | 151 files, **1324 tests**, all green |
| `bun run build` | green |
| `bun run perf:check` | all budgets passed |
| `e2e/moderation.spec.js` | 8/8 green (skins + settings + feed collapse/override) |
| axe: `/settings/moderation`, `/browse`, `/appearance`, `/themes`, profile, post | 6/6 green at 1440px and 390px |
| `e2e/themes.spec.js` + `e2e/theme-share.spec.js` | 6/6 green |
| `e2e/infinite-scroll.spec.js` comments + `e2e/search.spec.js` | 5/5 green |

The fast Obscura suite remains noisy in pre-existing live-data areas; W73 tests
that depend on mocked API rewrites are skipped there by design and run in
Chromium.

## Remaining Phase 1 polish

- Search rows show the label and hide the snippet when collapsed, but do not
  offer a per-row “Show anyway” button because the row itself is the open
  action. This needs a small row-action redesign.
- Notification controls are not added; there is no new downvote notification
  channel in this phase.
- The settings page surfaces followed lists read-only. Subscribing/unsubscribing
  lists and community-role/mute-note context remain Phase 3.

## Deployment

Deployed on 2026-11-24 with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T030308Z.tar.gz`
  (`sha256 f834a679…754e85`).
- Production index matches the local `assets/index-B8GOxLJX.js`.
- Live `curl`: `/`, `/appearance` and `/themes` return 200.
- Live browser smoke: opening Settings → Moderation navigates to
  `/settings/moderation`, renders the `Moderation` h1, 5 preset cards, the
  custom matrix and the export control with no page errors.
- Direct `GET /settings/moderation` currently returns **404 status** because the
  new exact nginx location is in the repo but not installed (root password
  needed). The SPA still renders the page from the 404 shell. The vhost entry is
  ready in `deploy/nginx/hive.ausbit.dev.conf`; install it and reload nginx to
  make the status 200.
- `/settings/moderation` is in `PRERENDER_ROUTES`; the next deploy/prerender
  writes its metadata shell (the route still needs the nginx location to serve
  it with a 200).

## Follow-ups

- Phase 2: downvote transparency (received/given, voter evidence, pattern hints,
  downvote-to-upvote context, per-voter local exclusion).
- Phase 3: list subscriptions with provenance, community moderation context,
  shareable profiles. The spike is in `W73-list-spike.md`.
- The nginx vhost needs the new `/settings/moderation` exact location installed
  by root. Until then the route works through client navigation but a direct
  request returns the 404 shell status.
