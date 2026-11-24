# W71 — Profile skin safety

Date: 2026-11-24
Status: implemented, deployed and live-smoked (static surfaces).

Roadmap: W71 (issue #90/#92 follow-up). Plan:
[`W73-moderation-implementation-plan.md`](W73-moderation-implementation-plan.md).

## Scope

Custom profile skins must not load from an account the viewer has muted or an
account with negative displayed reputation. The rule fails closed: while the
check is unresolved, or if it cannot be completed, the built-in theme stays in
place. The viewer can still show a specific skin, and follows can keep the
skins of accounts they trust.

This is the narrow safety slice later generalised by W73. It is a local viewer
policy, not a site-wide ban list. No chain state is written and no key is used.

## Rule

Decision order in `src/services/moderationPolicy.js`:

1. explicit local hide;
2. explicit local show;
3. viewer context unresolved (`idle`/`loading`/`error`) → blocked;
4. direct Hive mute (`what: ["ignore"]`) → blocked;
5. negative displayed reputation → blocked, unless the viewer explicitly
   enabled the followed-reputation override (default off);
6. author appears on a subscribed mute list → blocked, unless followed and the
   followed mute-list override is on (default on);
7. a subscribed list could not be read → blocked unless a follow wins the
   mute-list conflict;
8. otherwise allowed.

A direct mute always wins over a follow. Following an account beats a
subscribed mute list by default, but it does **not** make a negative-reputation
skin visible unless the viewer turns on "Trust followed reputation" in
Appearance. An explicit per-author show override lifts any of these blocks.
An explicit local hide beats an explicit show.

Reputation handling is deliberately not `formatReputation()`: missing or
non-finite input is unknown and blocks; raw `0` displays as 25 and is allowed;
raw values above 1e9 use the standard log scale; already-displayed values pass
through.

## Implementation

| File | Role |
| --- | --- |
| `src/services/moderationPolicy.js` | Pure `decideSkin`, `displayedReputation`, name/list normalization. No Vue or network. |
| `src/services/moderationSettings.js` | Per-account local settings (`hive:moderation:v1:<scope>`), version 1, normalization/caps, guest fallback. |
| `src/services/moderationData.js` | Cached `bridge.get_follow_list` reads, following snapshot, bounded subscribed-list members. A malformed response is an error, not an empty list. |
| `src/stores/moderation.js` | Viewer context, 10-minute session snapshot, show/hide overrides, immediate mute/follow updates. |
| `src/services/moderationStoreLoader.js` | Tiny lazy loader so the moderation chunk is not part of the initial or browse budget. |
| `src/components/theme/ProfileSkin.vue` | Gate, owner/theme-author warning, Show anyway, follow override, preview override. Loads the store only when a theme exists. |
| `src/components/theme/SkinSafetyNotice.vue` | Async blocked-state notice and actions; loaded only when a skin is actually blocked. |
| `src/pages/themeWall.vue` | Blocked cards omit the palette, explain why and offer Show skin; palette adoption asks for confirmation. |
| `src/pages/skinStudio.vue` | Main and import previews go through the gate with an explicit Preview anyway. |
| `src/pages/appearance.vue` | `#skin-safety` section: enforced rules, followed-author override, context status and overridden-author restore list. |
| `src/components/settings.vue` | Link to skin safety. |
| `src/components/accountHeader.vue`, `src/components/userCard.vue` | Keep the live context in step with optimistic follow/mute actions. |

## Data and caching

- `bridge.get_follow_list({observer, follow_type: "muted"})` returns the whole
  list and rejects `limit` (verified 2026-11-24). It is cached for 5 minutes
  and bounded to 10,000 names.
- `follow_muted` owners keep their `muted_list_description`; members are read
  from each owner's `muted` list, capped at 20 lists. Unresolved lists are
  counted and make the gate conservative for authors that are not followed.
- The viewer's following snapshot is the existing `fetchFollowingNames` cache.
- Skin surfaces (`ProfileSkin`, the theme wall and Appearance) call
  `ensureContext()` on mount; non-skin routes never pay for the list reads.
- The store saves a 10-minute sessionStorage snapshot (bounded) so navigation
  does not flash the built-in theme or re-request the list. It never stores a
  private key or anything not public on chain.
- Post pages use `post.author_reputation`; profile/blog/wall pages use the
  cached account record. The gate adds no per-page request.
- Login/logout/account switch re-keys the store; one viewer's mute list cannot
  affect another viewer.

## Bundle and loading

There is no moderation boot file. `ProfileSkin` loads the store through
`moderationStoreLoader.js` only when it actually has a theme to render, and
the blocked notice is an async component. Non-account `/browse` renders a
zero-cost `NoSkin` shell, so the moderation/policy/data chunk stays out of the
browse and initial budgets. `bun run perf:check` passes all route, JS, CSS,
LCP and CLS budgets after this split.

## Authorities

- No signing, no broadcast, no queue item.
- Reads are public chain data: account records, mute/blacklist lists,
  following list, subscribed-list owners/members.
- Settings and overrides are local only (`localStorage`/`sessionStorage`).

## UI

- Blocked profile/blog/post: a site-themed notice above the still-rendered
  page content, with the specific reason, "Show this skin anyway",
  "Always show skins from accounts I follow" when applicable, and a link to
  skin safety.
- Visible skin: the badge still offers "Ignore this skin" and "Hide all
  skins"; an override shows a "Use default safety" action.
- A theme whose `theme.author` differs from the metadata owner is flagged; the
  owner remains authoritative.
- Studio previews require an explicit "Preview anyway" when blocked.
- Theme wall blocked cards keep the author, name and description, omit the
  palette swatches, and offer "Show skin". "Use palette" shows a confirmation
  before adopting a blocked author's palette as the site theme.

## Tests

Unit (`bun run test`):

- `tests/unit/moderation-policy.spec.js` — reputation edges (unknown, raw 0,
  negative raw/displayed), direct mute, followed override, direct mute
  precedence, context failure, list errors, explicit overrides,
  author normalization, no input mutation.
- `tests/unit/moderation-settings.spec.js` — version, defaults, normalization,
  caps, future-version rejection, corrupt storage, per-scope isolation.
- `tests/unit/moderation-data.spec.js` — list normalization, descriptions,
  malformed responses, unsupported types, subscribed-list failures/caps.
- `tests/unit/moderation-store.spec.js` — guest/loading/error states, snapshot
  restore, scope isolation, immediate mute/follow updates, override persistence.
- `tests/unit/profile-skin.spec.js` — blocked notice keeps page content,
  preview override, show action, clean skin, owner/theme-author warning,
  explicit ignore stays silent.

E2E (`e2e/moderation.spec.js`, Chromium):

- negative-reputation skin blocked, override shown and persisted after reload;
- muted author blocked for a signed-in viewer;
- followed author on a subscribed mute list shows the conflict note and is
  allowed;
- blocked notice is axe clean at 1440×1100 and 390×844;
- theme wall marks a blocked card and can show it.

Existing theme tests remain green (`e2e/themes.spec.js`,
`e2e/theme-share.spec.js`), and the standard axe routes for `/appearance`,
`/themes`, `/@ausbitbank` and the post page pass at both widths.

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean (ESLint + theme-token scan) |
| `bun run test` | 148 files, 1288 tests, all green |
| `bun run build` | green (SPA, feed and home snapshot) |
| `bun run perf:check` | all route/JS/CSS/LCP/CLS budgets passed |
| `bunx playwright test e2e/moderation.spec.js` | 6/6 green |
| `bunx playwright test e2e/themes.spec.js` | 2/2 green |
| `bunx playwright test e2e/theme-share.spec.js` | 4/4 green |
| axe: browse/appearance/themes/profile/post | 5/5 green at 1440px and 390px |
| `bun run test:e2e` (Obscura fast suite) | 76 passed, 14 skipped, 22 failed in existing live-data/Obscura areas (dashboard, infinite scroll, theme-share mocks). The W71 spec is skipped there by design because Obscura cannot rewrite mocked API responses; the Chromium suite above is the W71 gate. |
| `bun run test:e2e:full` | Started; `/health` axe failed on live data before the targeted runs, so it was stopped rather than left as a 30-minute flaky gate. The affected routes were re-run directly and are green. |

## Deployment

Deployed on 2026-11-24 with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T022115Z.tar.gz`
  (`sha256 7a49e733…c0f23cd`).
- The production index references the same `assets/index-XV6Trtpz.js` as the
  local build.
- Live `curl`: `/`, `/appearance`, `/themes` and `/settings/skin` return 200.
- Live browser smoke: `/appearance` renders the new **Skin safety** section
  with the rules and status line; `/themes` renders the wall and ends in the
  signed-out state. `#skin-safety` is present.
- Live profile/blog smoke is blocked by the existing Cloudflare JS challenge
  for automated clients (`403` / "Just a moment..."), as the roadmap notes.
  The blocked/visible skin states, overrides, wall and Studio are covered by
  the local Chromium suite against the same production build.

## Notes and follow-ups

- Phase 1 replaces the skin-only settings surface with the full moderation
  schema/presets and adds content explainability. The current
  `hive:moderation:v1:<scope>` document is forward-compatible (unknown keys are
  dropped; Phase 1 will extend the normalizer).
- `accountHeader.unignoreUser()` still sends `what: []`, which clears every
  follow flag. W71 syncs the local context but does not change the op shape;
  Phase 1 task P1-15 fixes it with a pure follow-state helper.
- A failed broadcast can leave the optimistic local mute/follow state ahead of
  the chain until the 5-minute list cache refreshes. The existing relationship
  UI has the same optimistic behaviour; Phase 1 can reconcile after queue
  completion.
- The wall shows at most the first 80 followed accounts (existing behaviour),
  and the gate resolves up to 20 subscribed mute lists. Beyond those bounds the
  UI says context is incomplete rather than guessing.
- Community skins remain out of scope, as in W63.
