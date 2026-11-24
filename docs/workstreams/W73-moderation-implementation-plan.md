# W71 + W73 moderation implementation plan

Date: 2026-11-24
Status: **W71 implemented and locally verified** (2026-11-24); W73 Phases 1–3
remain. This is still the pre-implementation brief for W73.
Covers: roadmap **W71** (skin safety), issue **#94** / roadmap **W73**
Phases 1–3, and the small data spikes the issue asks for.

> This is a planning record, not a delivery record. When code ships, replace it
> with `docs/workstreams/W71-theme-safety.md` and
> `docs/workstreams/W73-moderation-policy.md` (and Phase 2/3 records as they
> land). The roadmap's definition of done applies to each release separately.

## 1. Scope and non-goals

In scope, in this order:

1. **W71** — never apply a custom profile skin from an account the viewer has
   muted or an account with negative displayed reputation; add a visible,
   local override path. Fail closed while the check is unresolved.
2. **W73 Phase 1** — a pure, local-first moderation policy engine with
   Open/Balanced/Strict/Follow-only/Custom presets, distinct mute and
   blacklist layers, explainability and overrides on feeds, comments,
   profiles, community feeds, search and skins, a `/settings/moderation` page,
   and versioned JSON export/import.
3. **W73 Phase 2** — profile downvote transparency (received/given), per-post
   voter breakdown, evidence-backed pattern hints, downvote-to-upvote context
   and per-voter local exclusion. No global leaderboard.
4. **W73 Phase 3** — list subscriptions with provenance, community
   moderation context, and shareable local moderation profiles. On-chain list
   creation stays out of scope (separate posting-key feature).

Out of scope:

- a site-wide ban list, hidden defaults, automatic muting/downvoting/hiding
  from heuristics, or replacing community moderators;
- changing Hive rewards/reputation or other frontends;
- cross-device sync or a moderation backend;
- a new downvote notification channel. If the existing bridge notifications
  already carry vote events, filtering them can be a later small win; do not
  invent a notification source for this workstream;
- **W72** (HiveAuth device matrix). It requires physical Android/iOS devices
  and wallet versions; it is not part of this issue and should stay a separate
  workstream.

## 2. Baseline (verified before planning)

| Check | Result |
| --- | --- |
| Branch / commit | `master` @ `0d8be38` |
| Working tree at baseline | only `docs/ROADMAP.md` modified (the W71–W73 planning additions). This brief adds two untracked docs; no source file is touched. |
| `bun run lint` | clean, including `scripts/check-theme-tokens.mjs` |
| `bun run test` | 142 files, **1223 tests**, all green at the pre-W71 baseline. After W71: 148 files, **1288 tests**, green. |
| `bun run build` | succeeded (SPA, `feed.xml`, home snapshot) |
| E2E | not run in the prep pass (requires Obscura/Chromium and a served build). The roadmap notes four pre-existing live-data failures in the fast suite; capture a baseline at the start of Release 1 so a new failure is never mistaken for a pre-existing one. |

This is the reference point for "did this workstream regress anything".

## 3. Live data findings (verified 2026-11-24, `api.hive.blog`)

These replace guesses in issue #94 with observed behaviour.

| Call | Verified result | What it means |
| --- | --- | --- |
| `bridge.get_follow_list` with `{observer, follow_type: "muted"}` | Returns the full list as `[{name, blacklist_description, muted_list_description}]` (956 entries for `hive.blog`). Passing `limit` fails: `got an unexpected keyword argument 'limit'`. | Do **not** send `limit`. Cache the whole list with a size cap; never call this per card. |
| `follow_type: "follow_muted"` | Returns the list owners, each with `muted_list_description` (e.g. `hive.blog` → `"Phishing accounts"`). | List provenance (owner + description) is available for followed mute lists. Membership requires reading the owner's `muted` list. |
| `bridge.get_relationship_between_accounts(viewer, author)` | `{follows, ignores, blacklists, follows_muted, follows_blacklists}` | One cached call resolves all five viewer/author flags. Prefer the viewer's cached following snapshot for card grids. |
| `bridge.get_ranked_posts` normal sorts | Posts include `author_reputation`, `author_role`, `stats.{gray,hide,flag_weight,total_votes}` and `blacklists`. | Reputation and community role are already in the post payload; no extra request needed for feed labels or W71 on post pages. |
| `bridge.get_ranked_posts` with `sort: "muted"` | Posts include `stats.muted_reasons`, e.g. `[3]`; enum is `0 MUTED_COMMUNITY_MODERATION`, `1 MUTED_COMMUNITY_TYPE`, `2 MUTED_PARENT`, `3 MUTED_REPUTATION`, `4 MUTED_ROLE_COMMUNITY`. | The Phase 3 "per-post reason" spike is partly solved for muted feeds: show only a reason that is actually present. Normal feeds may not expose a reason, so keep the generic bridge label there. |
| `condenser_api.get_account_history` with `[account, -1, 1000, "1", null]` | Works; returns vote-only rows with `voter`, `author`, `permlink`, `weight` and `timestamp` (98 downvotes in a sample account). A raw `vote` row has **no** `rshares`/`percent`. | Phase 2 reads are viable. Use `makeBitMaskFilter([0])` from `hiveOperations.js`; page backwards and dedupe. Classify direction from `weight`, not `rshares`. |
| `get_account_history` with `vote` + `effective_comment_vote` | The virtual `effective_comment_vote` row (op id 72) shares the block/trx and carries `rshares`, `pending_payout`, `total_vote_weight`. | Pair the two rows when historical rshares/impact is needed. For current impact, `get_active_votes` is simpler. |
| `condenser_api.get_active_votes(author, permlink)` | Returns `{voter, weight, percent, rshares, reputation, time}`, including negative `rshares`/`percent`. | Per-post up/down context, stake concentration and distinct-voter counts are viable without a backend. |

Caveats to encode in the code:

- `get_account_history` returns a page oldest→newest; take the first cursor
  index from the page when paging backwards, and dedupe by
  `(trx_id, op_in_trx)`.
- A raw `vote` row carries signed `weight` (basis points) but no `rshares`.
  `voteBreakdown.voteDirection()` therefore needs a `weight` fallback, or a
  history-specific normalizer. Do not display `rshares` for a history row
  unless it is paired with `effective_comment_vote`.
- Include op id 72 (`effective_comment_vote`) in the bitmask when historical
  rshares/payout are required; pair by `(trx_id, voter, author, permlink)`.
- Filtered history can throw
  `Could not find filtered operation in ...` with a `sequence` cursor at
  `error.data.stack[0].data.sequence`; existing pages retry from that cursor.
  Put the retry in the service, not the component.
- A 1000-row history page can be entirely votes for an active curator. Cap
  pages, show a "load older" control and never block the account page.
- Some public nodes intermittently return an OpenAPI-shaped schema stub for
  history/bridge methods. Validate the row shape (array of `[index, record]`)
  and retry/fail over, following `src/services/witnessVoters.js`.
- `stats.hide`/`stats.gray` are bridge judgments. Without `muted_reasons`, say
  "hidden/greyed by Hive bridge" and do not claim a specific reason.
- `bridge.get_follow_list` returns very large lists. Keep the raw read cached
  but expose a bounded index to the policy (e.g. 10k names) so localStorage
  and render work stay bounded.
- Posts already carry `author_reputation`; use it for an immediate skin/feed
  decision on post routes so the check does not wait for the account record.
  The account record remains the fallback for profile/blog/wall views.

## 4. Architecture

### 4.1 Module map

| Layer | File | Responsibility |
| --- | --- | --- |
| Pure rules | `src/services/moderationPolicy.js` (new) | Preset matrix, precedence, surfaces, reasons, display decisions, skin gate. No Vue, Pinia, storage or network. |
| Pure settings | `src/services/moderationSettings.js` (new) | Defaults, normalization, per-account scope, versioned export/import, override caps. No Vue. |
| Chain reads | `src/services/moderationData.js` (new) | Cached mute/blacklist/followed-list/relationship reads, list members, batch reputation. Uses `bridgeRequest`, `loadCached`, `fetchAccounts`, `fetchFollowingNames`. |
| Reactive state | `src/stores/moderation.js` (new) | Loaded policy + viewer context + disclosure state; delegates to the pure modules; exposes actions used by components. |
| Boot/global | `src/boot/moderation.js` (new) | Creates the store, exposes `$moderation`, hydrates settings for the current account. Added after `hiveStore` in `quasar.config.js`. |
| Reusable UI | `src/components/moderation/*` (new) | `ModerationNotice.vue` (reason chip + popover), `ModeratedItem.vue` (label/collapse/hide wrapper), `ModerationDisclosure.vue` (first-use), `ModerationMatrix.vue` (settings table). |
| Settings page | `src/pages/moderation.vue` (new) | `/settings/moderation`: presets, custom matrix, lists, overrides, skins, export/import, reset. |
| Skin integration | `src/components/theme/ProfileSkin.vue`, `src/pages/themeWall.vue`, `src/pages/skinStudio.vue`, `src/pages/appearance.vue` | Apply the skin gate, explain blocks, offer overrides. |
| Content integration | feeds/comments/community/profile/search components | Compute decisions, render notices/collapsed rows, persist overrides. |
| Docs | `docs/SECURITY.md`, `docs/workstreams/W71-*.md`, `W73-*.md` | Rule, threat model, verification record. |

### 4.2 Data flow

```
viewer signs in
  └─ $moderation.ensureContext()
       ├─ fetchFollowingNames(viewer)            (existing cache)
       ├─ get_follow_list(viewer, "muted")       (new, 5 min)
       ├─ get_follow_list(viewer, "blacklisted") (new, 5 min)
       ├─ get_follow_list(viewer, "follow_muted") (new, 5 min)
       ├─ get_follow_list(viewer, "follow_blacklist")
       └─ resolve members of followed lists (bounded, cached per owner)
  └─ context snapshot { muted, blacklisted, following, listHits, status }

surface renders item
  └─ moderationPolicy.decideContent({surface, item, context, policy})
       └─ {display, reasons, overrideKey, conflict, disclosure}
  └─ ModeratedItem renders show / label / collapse / hide + "Show anyway"
  └─ override action updates $moderation -> store commit -> policy re-evaluates
```

Nothing in the render path awaits a network request. If context is still
loading, content renders normally with an optional "moderation data loading"
note; skins stay on the built-in theme until the gate resolves.

### 4.3 Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | All rules live in a pure `moderationPolicy` module; Vue only renders decisions and persists overrides. | The issue explicitly asks for this; it makes the matrix exhaustively testable. |
| D2 | Keep settings validation/export in a pure `moderationSettings` module, separate from the Pinia store. | Mirrors `savedSearches.js`; tests need no Pinia or DOM. |
| D3 | Use a thin Pinia store for reactivity and `$moderation` in components. | Multiple surfaces need the same live context and overrides; a pure service alone would not update rendered chips. |
| D4 | Store policy per account: `hive:moderation:v1:<scope>`, `guest` fallback, version `1`. | One viewer's overrides must not leak to the next account on a shared device. |
| D5 | **Content fails open; skins fail closed.** If moderation context cannot load, content shows with an "explanation unavailable" note; a custom skin does not apply until identity/reputation/mute are proven safe. | Silence is the failure mode the issue warns about; a skin is an active visual surface and can be withheld safely. |
| D6 | Reuse `fetchFollowingNames` and the account cache; add list reads with 5-minute TTL and relationship reads with 60-second TTL. | No new request per card; the following snapshot already exists and is used by `userCard`. |
| D6a | Hydrate the signed-in viewer's moderation context from a 10-minute `sessionStorage` snapshot and refresh in the background; update it immediately after mute/unmute/follow actions. Skin surfaces call `ensureContext()` on mount, so non-skin routes never load the lists. | Prevents a built-in-theme flash on every navigation and avoids a network call per page. |
| D6b | Do not use `formatReputation()` to decide safety: it turns a missing value into `"25"`. Use a pure helper that returns `null` for missing/non-finite raw reputation, `25` for raw `0`, and the displayed score otherwise. | Unknown reputation must fail closed for skins; raw `0` must not. |
| D7 | No hidden global list. Only chain facts (direct mute/blacklist, community state), explicitly subscribed lists, and local overrides. The site safety floor is documented and has no live feed in Phase 1. | Anti-capture principle 1 and 10; do not invent an unreviewable ban list. |
| D8 | "Hide" is implemented as an **explainable collapse** at item level (header + reason + Show anyway), and as a count summary in dense lists. Only the safety floor and an explicit "always hide this author" remove content entirely. | Satisfies "show why" and prevents silent vanishing. |
| D9 | Follows beat subscribed mute lists by default, with a visible conflict badge. A direct mute still beats a follow. Strict/Custom may opt into lists overriding follows. | Issue #94 decision; keeps the viewer's explicit follow meaningful. |
| D10 | Every override is local, reversible and capped (authors/items/voters). Export/import round-trips them. | Portability and abuse resistance. |
| D11 | Downvote patterns are labels with evidence, never automatic hiding or punishment. | Issue #94 decision; avoids a heuristic soft-shadowban. |
| D12 | Use `stats.muted_reasons` when present; otherwise say "bridge judgment, reason not exposed". | Only claim what can be proven. |
| D13 | Skin gate order: explicit show override → explicit hide → direct mute → negative reputation (followed-rep override off by default) → subscribed mute list member (follows beat lists by default) → allow. Unknown reputation blocks. | W71 acceptance; direct mute remains authoritative; negative reputation needs an explicit trust choice. |
| D14 | New settings route `/settings/moderation`, linked from the toolbar settings popup and `/appearance`. | Discoverable without crowding the appearance page. |
| D15 | No new hard-coded colours; use `var(--c-*)`, `var(--space-*)`, `var(--radius-*)`. | `scripts/check-theme-tokens.mjs` runs in `bun run lint`. |
| D16 | Safety decisions use the **account name passed by the mount**, never the self-declared `theme.author`. `theme.author` is display attribution only. If it disagrees with the account name, show the mismatch and do not let it influence the gate. | `theme.author` is an unauthenticated ≤32-char string; trusting it would let a theme claim to be someone else. |
| D17 | Reset moderation context and per-account overrides when the signed-in account changes or logs out; the session snapshot is keyed by viewer. | Logout currently leaves `accounts`/`apiCache` in place; a mute list must never leak to the next viewer. |

### 4.4 Preset matrix

`display` is the strongest outcome; reasons are always attached.

| Signal | Open | Balanced (default) | Strict | Follow-only |
| --- | --- | --- | --- | --- |
| Safety floor (phishing/malware, curated) | hide | hide | hide | hide |
| Direct mute (`ignore`) | label | collapse | collapse | collapse |
| Direct blacklist | label | label | label | label |
| Followed mute list (author not followed) | label | collapse | collapse | collapse |
| Followed mute list (author followed) | show + conflict | show + conflict | show + conflict | show + conflict |
| Followed blacklist list | label | label | label | label |
| Community post mute / `stats.hide` | label | collapse | collapse | collapse |
| Community muted role | label | label | label | label |
| Negative displayed reputation | label | collapse | collapse | label |
| Net-negative votes | label | label | collapse (heavy) | label |
| NSFW | label | collapse | collapse | label |
| Author not followed | show | show | show | collapse in feeds/comments/search |
| Unknown moderation context | show + note | show + note | show + note | show + note |

`collapse` hides the body/thumbnail and keeps the author, title and reason
visible with "Show anyway"; it is how "hide muted authors" is implemented
without silent vanishing. `hide` (safety floor or an explicit "always hide
this author") renders no item body and only a list-level notice.

Strict "heavy" downvotes threshold starts conservative:
`net_votes <= -5` **or** downvote weight share ≥ 60% with at least 3 distinct
downvoters. Document it in the settings page; do not tune silently.

NSFW is a signal only when it is present in the payload: an `nsfw` tag in
`json_metadata.tags` or the community's NSFW setting. Do not infer it from
images or text.

Surface rules:

- **Profile and post detail**: personal mute/reputation/downvote signals never
  remove the content the viewer deliberately opened. Show the content with a
  label and an unmute/manage action. Safety floor still applies.
- **Comments**: collapse keeps the header and thread shape; never drop a
  subtree. "Show anyway" is per comment; the existing thread-wide
  "Show hidden or flagged comments" remains as a temporary show-all.
- **Community feed**: community mutes are labelled separately from personal
  mutes. If `muted_reasons` is present, map it to a specific reason; otherwise
  say "muted by community moderation or bridge".
- **Search**: decisions apply to post/account results; a muted result is
  collapsed with a reason and "Show anyway". Account search results get a
  relationship label, not a hide.
- **Skins**: use `decideSkin`, not the content matrix. A blocked skin shows
  the explanation and overrides outside the skin scope.

### 4.5 Decision contract

```js
// moderationPolicy.decideContent(input) -> Decision
{
  display: 'show' | 'label' | 'collapse' | 'hide',
  visible: true,                    // false only for safety/hard hide
  reasons: [{
    layer: 'safety-floor' | 'personal-mute' | 'personal-blacklist' |
           'followed-mute-list' | 'followed-blacklist' | 'community-post-mute' |
           'community-role' | 'reputation' | 'downvotes' | 'nsfw' |
           'follow-only' | 'context-unavailable',
    source: 'site' | 'viewer' | 'list-owner' | 'community' | 'bridge' | 'chain' | 'heuristic',
    label: 'Muted by you',
    detail: 'You added @x to your ignore list.',
    evidence: { /* counts, owners, voters, window, weight */ },
    overrideKey: 'unmute' | 'always-show-author' | 'show-item' | 'ignore-voter' | null
  }],
  conflict: { kind: 'follow-vs-mutelist', owners: ['hive.blog'] } | null,
  overrides: ['show-item', 'always-show-author', 'hide-author', 'unmute', 'manage'],
  unknownContext: false
}
```

Skin decisions use a smaller shape:

```js
// moderationPolicy.decideSkin(input) -> { allowed, reason, evidence, overrides }
{ allowed: false, reason: 'negative-reputation', overrides: ['show-author', 'manage'] }
```

### 4.6 Persistence schema

```json
{
  "version": 1,
  "preset": "balanced",
  "disclosureSeen": false,
  "custom": {
    "feed":     { "mute": "collapse", "blacklist": "label", "listMute": "collapse", "reputation": "collapse", "downvotes": "label", "community": "label", "nsfw": "collapse", "followOnly": "off" },
    "comments": { "...": "same shape" },
    "community":{ "...": "same shape" },
    "search":   { "...": "same shape" }
  },
  "lists": {
    "muteOwners": [],
    "blacklistOwners": [],
    "listsOverrideFollows": false
  },
  "skins": {
    "blockMuted": true,
    "blockNegativeReputation": true,
    "followedMuteListOverride": true,
    "followedReputationOverride": false
  },
  "overrides": {
    "showAuthors": [],
    "hideAuthors": [],
    "showItems": [],
    "hideItems": [],
    "ignoredVoters": []
  },
  "updatedAt": "2026-11-24T00:00:00.000Z"
}
```

Rules:

- `preset` drives defaults; `custom` is only consulted for `custom`.
- Array caps: 500 authors/items, 200 list owners, 500 ignored voters.
- Names normalized to lowercase, max 16 chars; item keys capped at 200 chars.
- Import accepts the full envelope, a bare policy object or a version-1
  export; reject future versions with a clear message; strip unknown keys;
  reject `__proto__`/`constructor`/`prototype`.
- Export envelope:
  `{ app: "hive.ausbit.dev", type: "hive-moderation-policy", version: 1, exportedAt, policy }`.
- Never export expanded members of someone else's list; export list owner
  references only (privacy + size). Document this in the import dialog.

### 4.7 Failure and caching policy

| Read | TTL | On failure |
| --- | --- | --- |
| `get_follow_list` (own lists / members) | 5 min | content: label "moderation data unavailable"; skins: block |
| `get_relationship_between_accounts` | 60 s | treat flags as unknown; content label; skin block |
| following snapshot (`fetchFollowingNames`) | 60 s, existing | conflict/override unavailable; content label |
| account reputation (`fetchAccounts`) | 15 s, existing | skin block if reputation unknown |
| viewer context snapshot (`sessionStorage`) | 10 min, hydrated synchronously | stale snapshot is used; background refresh; skins block only while the first-ever check is unresolved |
| downvote history | 5 min, on demand | panel error with retry; never block |
| `get_active_votes` | 5 min, on demand | panel error with retry; never block |

If the viewer is not signed in, the mute/blacklist/followed-list context is
empty (not "unknown"), and only reputation/community/safety signals apply.

### 4.8 Surface integration map

| Surface | Entry points | How the decision is applied |
| --- | --- | --- |
| Browse / created / trending / hot / profile feeds | `src/components/browseContainer.vue` → `src/components/postPreview.vue` | Keep the existing manual filter checkboxes as explicit user filters. After them, pass each post to the policy and let `postPreview` render label/collapse inside the card (thumbnail/summary hidden, header/title/reason kept). Never silently drop. |
| Home trending / recent / dashboard posts | `HomeTrendingPosts.vue`, `HomeRecentPosts.vue`, dashboard widgets that use `postPreview` | Same `postPreview` path with `surface="feed"`; no extra request. |
| My communities merged feed | `CommunityFeed.vue` (merged mode) | Same card path, `surface="community"`; community context from the merged row. |
| Single community feed | `browseContainer.vue` (tag route) | `surface="community"`; use `stats.muted_reasons` when present. |
| Comments | `comments.vue` → `flattenDiscussion` → `comment.vue` | `flattenDiscussion` must stop dropping filtered subtrees. It returns every comment; `comment.vue` collapses the body and shows the reason. The existing thread-wide checkbox becomes "show all in this thread" (temporary). |
| Short form | `src/services/shortForm.js` `containerTimeline` | Replace the implicit `stats.gray`/`stats.hide` drop with the same decision; show a compact notice/collapse in the timeline card. |
| Search | `src/pages/search.vue` custom result rows | Collapse the snippet/body with a reason and Show anyway; account rows get a relationship label, not a hide. |
| Post detail | `src/pages/post.vue` | Deliberate visit: content always renders; add a label/manage action using signals already present (`post.author_reputation`, viewer relationship/flags, `author_role` if in the payload). Do not add a `bridge.get_post` read just to decorate a deliberate visit. No rep-only removal. |
| Profile | `src/pages/account.vue`, `accountHeader.vue` | Deliberate visit: content always renders; header gets "You mute this author" + unmute/manage. Use the account record and the cached relationship; no new per-profile request. |
| Skins | `ProfileSkin.vue`, `themeWall.vue`, `skinStudio.vue` | `decideSkin`; blocked surfaces show explanation + overrides outside the skin scope. |
| Snapshots | `src/services/postSnapshot.js` | Preserve `stats.hide`, `stats.gray`, `stats.hidden`, `stats.muted_reasons`, `stats.flag_weight`, `author_role` and `blacklists` so a snapshot-painted feed does not lose its policy inputs. Old snapshots without them render as "context unavailable" rather than guessing. |
| Names / cards | `src/components/userCard.vue` | Add relationship labels/actions only where they already exist; do not add a new card-level network read. |

### 4.9 First-use disclosure

Balanced is the default, so it must explain itself. On the first non-show
decision in a session where `disclosureSeen` is false and the preset is
`balanced`, mount a compact `q-dialog` (or a `role="status"` banner on
low-attention surfaces):

- "Balanced mode labels or collapses some content instead of deleting it."
- what was labelled/collapsed (layer names only);
- "Nothing was removed from the blockchain."
- actions: "Review settings", "Got it".

Dismiss writes `disclosureSeen: true` for the account. A "Reset explanations"
control on the settings page clears it. Strict/Follow-only presets explain
themselves on the settings page; they do not get an unsolicited dialog.

## 5. Work breakdown

### 5.1 W71 — skin safety (first release, complete)

W71 is shipped and locally verified. The tasks below are kept as the
implementation record reference; see
[`W71-theme-safety.md`](W71-theme-safety.md) for the verification record and
the notable follow-up (P1-15, unmute preserving other follow flags).

| ID | Task | Files |
| --- | --- | --- |
| W71-1 | Add pure `decideSkin` and constants. Inputs: author, raw/display reputation, viewer mute set, followed set, followed-list membership, overrides, context status, audience. Unknown reputation blocks; raw `0` means displayed 25 and is allowed. | `src/services/moderationPolicy.js` (new) |
| W71-2 | Add cached reads: viewer muted/blacklisted lists, followed mute/blacklist owners, list members, relationship. | `src/services/moderationData.js` (new) |
| W71-3 | Store: `ensureContext`, `skinDecision(author, account)`, override actions. Expose `$moderation`. | `src/stores/moderation.js`, `src/boot/moderation.js`, `quasar.config.js` |
| W71-4 | Call `ensureContext()` on layout mount/login; keep it off the critical path. | `src/layouts/MainLayout.vue` |
| W71-5 | Gate `ProfileSkin`: while checking show the built-in theme; blocked shows a notice with "Show this skin anyway", "Always show skins from accounts I follow" (when followed), "Manage moderation". Keep "Ignore this skin"/"Hide all skins". Bind the decision to the mount-provided account name, not `theme.author`; display the owner account and flag a mismatched self-declared author. Add a `reputation` prop so `post.vue` can pass `post.author_reputation` immediately. | `src/components/theme/ProfileSkin.vue`, `src/pages/post.vue` |
| W71-6 | Wall and Studio: blocked cards keep author/payload visible, omit the skin surface, explain and offer the override. `previewTheme` must not bypass the gate; the Studio gets an explicit "Preview anyway" local override. Gate "Use palette" adoption and the remix hand-off too, not only the rendered skin. | `src/pages/themeWall.vue`, `src/pages/skinStudio.vue` |
| W71-7 | Appearance page link + blocked-author restore list. | `src/pages/appearance.vue`, `src/components/settings.vue` |
| W71-8 | Unit tests: muted, negative, zero, unknown, lookup failure, cached mute state, followed-author override, direct mute beats follow, spoofed `theme.author`, preview override, wall palette adoption. E2E: mock `get_accounts` reputation + `get_follow_list`; assert skin hidden, explanation, override, persistence. | `tests/unit/*`, `e2e/moderation.spec.js` |
| W71-9 | Document rule and threat model. | `docs/SECURITY.md`, `docs/workstreams/W71-theme-safety.md`, `docs/workstreams/W63-theme-system.md` |
| W71-10 | Clear/re-key moderation context on login change, logout and account switch; test that viewer A's mute list cannot block viewer B's skins. | `src/stores/moderation.js`, `src/components/userLogin.vue`, `src/layouts/MainLayout.vue`, tests |

> Note for Phase 1: today `accountHeader.unignoreUser()` calls
> `unfollowUser()`, which sends `what: []` and clears every follow flag
> (`blog`, `blacklist`, `follow_muted`, …). The moderation overrides must not
> build on that. Add a pure `followOps` helper in Phase 1 (see P1-15).

Acceptance gate: a muted author's skin never applies; negative-rep skin never
applies; unknown/failed check leaves the built-in theme; the wall and Studio
explain why; no new request per post page; overrides persist.

### 5.2 W73 Phase 1 — policy engine and explainability (second release)

| ID | Task | Files |
| --- | --- | --- |
| P1-1 | Pure policy: presets, surfaces, precedence, reason builders, conflict detection, safety floor hook. | `src/services/moderationPolicy.js` |
| P1-2 | Pure settings: defaults, normalize, scope, export/import, caps, version. | `src/services/moderationSettings.js` (new) |
| P1-3 | Store: hydrate/persist, preset/custom setters, list subscriptions (read-only in Phase 1), override actions, disclosure, context invalidation on mute/unmute/follow. | `src/stores/moderation.js` |
| P1-4 | Extend `moderationData` from the W71 mute read to blacklists, followed mute/blacklist owners, bounded members and a batch reputation helper. | `src/services/moderationData.js` |
| P1-5 | Components: `ModerationNotice`, `ModeratedItem`, `ModerationDisclosure`; accessible reason popover with evidence and actions. | `src/components/moderation/*` |
| P1-6 | Settings page: preset cards, custom matrix, list layers with provenance, overrides, skin controls, export/import, reset, privacy note, first-use reset. Add the route to `PRERENDER_ROUTES` and the nginx metadata location so direct navigation returns a real 200 (not the 404 shell). | `src/pages/moderation.vue`, `src/router/routes.js`, `src/components/settings.vue`, `scripts/lib/prerender-meta.mjs`, `deploy/nginx/hive.ausbit.dev.conf`, `e2e/a11y.spec.js` |
| P1-7 | Feeds: compute decisions once per visible post; label/collapse inside `postPreview` with Show anyway; keep the existing manual filters as explicit user filters; explain counts. Cover home, dashboard, profile and community feeds. | `src/components/browseContainer.vue`, `src/components/postPreview.vue`, `HomeTrendingPosts.vue`, `HomeRecentPosts.vue`, dashboard post widgets |
| P1-8 | Comments: stop dropping filtered subtrees; render collapse with reason, keep thread shape; thread-wide show-all remains. | `src/services/comments.js`, `src/components/comments.vue`, `src/components/comment.vue` |
| P1-9 | Community: separate personal mute / followed list / community mute / role / bridge gray; map `muted_reasons`; link community context. Treat `stats.hidden` and `stats.hide` as the same bridge hide flag. Pass the signed-in viewer as `observer` where the feed is the viewer's own (`communities.vue` currently sends `null` for self) so bridge personalisation is not lost. | `src/components/community/CommunityFeed.vue`, `src/services/community.js`, `src/pages/communities.vue` |
| P1-10 | Profile/post: deliberate visits show content with labels and manage/unmute actions; no false hide. | `src/pages/account.vue`, `src/pages/post.vue`, `src/components/accountHeader.vue` |
| P1-11 | Search: label/collapse muted/reputation results with reasons; never claim a reason that is not proven. | `src/pages/search.vue` |
| P1-12 | Skins: replace the W71 temporary gate with the policy-driven gate and overrides; keep W71 behaviour. | `ProfileSkin.vue`, `themeWall.vue`, `skinStudio.vue` |
| P1-13 | Tests: exhaustive matrix, overrides, conflict, unknown context, settings round-trip, component render, E2E settings/comments/feeds/skin, axe desktop+mobile. | `tests/unit/*`, `e2e/moderation.spec.js`, `e2e/a11y.spec.js` |
| P1-14 | Record. | `docs/workstreams/W73-moderation-policy.md`, `docs/SECURITY.md` |
| P1-15 | Add a pure follow-state helper that adds/removes one flag (`blog`, `ignore`, `blacklist`, `follow_muted`, `follow_blacklist`) while preserving the others, and use it for mute/unmute and follow/unfollow. Current unmute sends `what: []` and silently unfollows the author. Unit-test every transition. | `src/services/followOps.js` (new), `src/components/accountHeader.vue`, `src/components/userCard.vue`, tests |
| P1-16 | Preserve policy inputs in feed snapshots (`stats.hide/gray/hidden/muted_reasons/flag_weight`, `author_role`, `blacklists`). Today `trimPost` keeps only `stats.total_votes`, so snapshot-painted feeds cannot be judged. Old snapshots must render as "context unavailable", not "clean". | `src/services/postSnapshot.js`, `tests/unit/postSnapshot.spec.js` |
| P1-17 | Short-form timelines: replace the silent `stats.gray`/`stats.hide` drop with the policy decision and a compact explanation. | `src/services/shortForm.js`, short-form card component, tests |

Acceptance gate: presets explain themselves; Balanced never hides on
reputation alone; direct mute/blacklist/followed-list layers stay distinct;
follow-vs-list conflict is visible; every non-show decision has a reason and
an override; export/import round-trips; no policy request blocks a post page.

### 5.3 W73 Phase 2 — downvote transparency (third release)

| ID | Task | Files |
| --- | --- | --- |
| P2-1 | Pure analysis: normalize history vote rows (`weight` fallback), received/given summaries, grouping by voter/target/day, distinct voters, stake concentration, net direction, conservative pattern evidence. Reuse `governance.voteOverlap()` / `voterConcentration()` and `witnessVoters.voterSegments()` rather than inventing new math. | `src/services/downvotes.js` (new), `src/services/governance.js`, `src/services/witnessVoters.js` |
| P2-2 | Reads: paged `get_account_history` with a vote bitmask (optionally `effective_comment_vote` for historical rshares), `get_active_votes` wrapper, cache, abort, cap, dedupe, filtered-gap retry, OpenAPI-stub retry. Add the missing `apiGetActiveVotes` and bitmask-capable history helper. | `src/services/accountDownvotes.js` (new), `src/services/moderationData.js`, `src/services/api.js`, `src/services/hive.js` |
| P2-3 | Account "Downvotes" tab: received/given, filters (relationship, time, post/comment, weight), grouping, evidence card, ignored-voter action. Do not load it in the account overview's `init()`; lazy-load on tab open. Adding a 9th tab breaks the 8-tab narrow-screen layout, so adjust `tabsPerRow`/CSS and test at 390px. Add `downvotes` to the account sub-route nginx regex (or a dedicated metadata location) and the a11y route list. | `src/pages/downvotes.vue` (new), `src/router/routes.js`, `src/components/accountHeader.vue`, `deploy/nginx/hive.ausbit.dev.conf`, `e2e/a11y.spec.js` |
| P2-4 | Per-post context: the existing `votesDialog` already shows voter, percent/weight, rshares, reputation, time, top up/down voters and full data. Extend it with distinct up/down voters, stake concentration, net direction, per-voter relationship and local-exclusion state; feed it `get_active_votes` when `active_votes` is absent. | `src/components/votesDialog.vue`, `src/services/voteBreakdown.js`, `src/pages/post.vue` |
| P2-5 | Local ignored voters: remove their influence from labels while keeping raw chain impact visible; export/import the list. | policy + settings + downvote views |
| P2-6 | Tests: analysis fixtures (bots, retaliation, single whale, broad downvote), pagination, ignored voter, e2e tab, axe. | `tests/unit/*`, `e2e/moderation.spec.js` |
| P2-7 | Record. | `docs/workstreams/W73-downvote-transparency.md` |

Acceptance gate: voter/weight/target/time are visible; pattern hints show
evidence and a "possible" qualifier; downvote-to-upvote context shows distinct
voters, stake concentration and net direction; no global leaderboard; ignored
voters do not affect labels but raw impact stays; lazy loading never blocks
the account page.

### 5.4 W73 Phase 3 — lists, community and portability (fourth release)

Prerequisite: the spike is complete. See
[`W73-list-spike.md`](W73-list-spike.md); the live API already answers the
pagination and reason questions.

| ID | Task | Files |
| --- | --- | --- |
| P3-1 | Spike record: `get_follow_list` has no pagination and rejects `limit`; lists can be large; `follow_muted` exposes owner descriptions; `muted_reasons` exists on muted feeds. | `docs/workstreams/W73-list-spike.md` |
| P3-2 | List subscriptions: subscribe/unsubscribe a mute or blacklist list with the posting key, preserving existing `what` flags, via the queue; show owner, description, member count, link and appeal/contact path. | settings page, `src/services/followLists.js` (new), `accountHeader` relationship actions |
| P3-3 | Multiple lists + conflicts: union of members, per-list provenance, "always show" precedence, local opt-out. | policy + settings |
| P3-4 | Community context: muted role/post mute labelled separately; community rules/role link; local override; no claim beyond `muted_reasons`. | community components |
| P3-5 | Shareable moderation profiles: export/import references only; versioned JSON; confirm before replacing; no server sync. | settings + service |
| P3-6 | Tests + axe + record. | `tests/unit/*`, `e2e/moderation.spec.js`, `docs/workstreams/W73-lists-community.md` |

On-chain list creation is explicitly deferred; it needs its own posting-key
review.

## 6. Test plan

### 6.1 Unit (pure first)

`tests/unit/moderation-policy.spec.js`

- Every preset × every signal: expected `display` and reason layer.
- Surfaces: feed, comment, profile, post, community, search, skin.
- Overrides: show-item, always-show-author, always-hide-author, unmute,
  ignore-voter; precedence and conflict badge.
- Unknown context: content fail-open + note; skin fail-closed.
- Reputation: raw negative, raw 0 (display 25), missing/null, lookup failure.
- Downvote thresholds and evidence builder; no hide from heuristics.
- Determinism: same input → same output; no mutation of inputs.

`tests/unit/moderation-settings.spec.js`

- Defaults; corrupt/missing storage; per-account scope and guest fallback.
- Normalization/caps/prototype-pollution rejection.
- Export envelope; import envelope/bare/array; future version rejected;
  round-trip equality of semantic fields.

`tests/unit/moderation-data.spec.js`

- Cached list reads; no `limit` argument; failure returns a typed error/empty
  snapshot; relationship TTL; list member resolution cap.

`tests/unit/downvotes.spec.js`

- Received/given; grouping; distinct voters; stake concentration; net
  direction; ignored-voter filtering keeps raw totals; conservative
  coordination evidence; empty/malformed rows.
- History `weight` fallback (no rshares) and pairing with
  `effective_comment_vote` for historical rshares.
- Filtered-gap retry, schema-stub rejection and dedupe by index/trx.
- `normalizeVote` retains `weight` (or a history-specific normalizer does)
  without breaking the existing votes dialog tests.

Component tests (Vue Test Utils + Quasar):
- `ModerationNotice` renders reason/evidence, emits override, accessible
  button names.
- `ModeratedItem` renders show/label/collapse/hide correctly.
- `ModerationDisclosure` role/status, dismiss, no duplicate dialog.
- `ProfileSkin` blocked state renders explanation and override.

Snapshot/timeline tests:
- `postSnapshot.trimPost` keeps the policy inputs and drops nothing else it
  previously kept.
- An old snapshot without policy inputs yields `context-unavailable`, not
  `show` as a false clean result.
- Short-form timeline uses the decision instead of silently filtering.

### 6.2 E2E (Playwright)

`e2e/moderation.spec.js`:

- Settings page: preset change persists after reload; custom toggles; export
  download; import file; reset.
- First-use disclosure: appears once, dismiss persists, reset brings it back.
- Comments: mocked discussion with gray/hide/negative-rep comments; collapsed
  body + reason; "Show anyway" expands without reload; thread shape survives.
- Feed: mocked muted/negative-rep posts; collapse + conflict badge; Show
  anyway; no silent disappearance.
- Skins: mocked `get_accounts` with negative reputation and mocked
  `bridge.get_follow_list` for a direct mute; skin hidden; explanation;
  override shows it; reload keeps override.
- Downvotes: mocked history and `get_active_votes`; tab renders voter/weight/
  target/time; evidence; ignored voter action; mobile layout.
- Use `page.route` like `e2e/themes.spec.js`; Obscura cannot rewrite mocked
  API responses, so guard those tests with
  `test.skip(Boolean(process.env.OBSCURA_CDP))`. Keep local-only settings tests
  in both suites.
- Existing mocks need review: `e2e/theme-share.spec.js` answers every
  `condenser_api.get_following` with `alice`, and `e2e/badges.spec.js` returns a
  relationship without `ignores`. Add explicit `bridge.get_follow_list` and
  full five-flag relationship mocks so the new gate is deterministic.
- Add `/settings/moderation` and `/@ausbitbank/downvotes` to
  `e2e/a11y.spec.js` (desktop 1440×1100 and mobile 390×844).

### 6.3 Manual and live

- Browser smoke on `/settings/moderation`, a feed, a post with comments, a
  profile with a skin, the theme wall and a downvotes tab, signed in and out.
- Verify offline/stale: kill the API node request and confirm content fails
  open with a note while skins fall back to the built-in theme.
- Confirm no extra chain request on a normal post page beyond the existing
  account/post reads (Network panel).
- Production smoke after each release; record build SHA, backup path and
  counts.

## 7. Acceptance traceability

| Issue #94 acceptance criterion | Where it is met |
| --- | --- |
| Presets Open/Balanced/Strict/Follow-only/Custom, each explained | settings page preset cards + matrix; `P1-6` |
| Balanced labels/collapses negative-rep/downvoted; no hide on rep alone; first collapse explains itself | matrix D8, `P1-1`, `P1-5`, disclosure; policy tests |
| Muted author's skin not applied; override per author/followed | `W71-1`–`W71-6`; skin tests |
| Negative-rep skin not applied; override | same |
| Every reputation-gated feature has an override | Audit result: the client-side reputation gates are skins (W71) and content collapse (Phase 1); both get overrides. The image-host reputation gate is server-side (`src/services/imageHost.js`) and cannot be overridden by this client — surface its error and explain, do not pretend otherwise. Any future client-side gate must use the same override contract. |
| Direct mute, direct blacklist, followed mute list, followed blacklist visibly distinct | reasons layers + settings list sections; `P1-3`, `P1-6` |
| Followed author on subscribed mute list shows conflict; always show works | conflict badge + D9; policy tests |
| Community post mutes and muted roles labelled separately | `muted_reasons` mapping + `P1-9` |
| Every hidden/collapsed item explains signal/source/override | reason contract + `ModerationNotice`; component tests |
| Show anyway works without reload and is remembered | store override actions; E2E |
| Downvotes received shows voter/weight/target/time/relationship; given works | `P2-1`–`P2-3` |
| Pattern hints show evidence and "possible"; no auto-hide | `P2-1`, policy label only; unit tests |
| Downvote-to-upvote context: distinct voters, stake concentration, net direction | `P2-4` |
| Ignore a voter locally; raw impact visible | `P2-5` |
| No global leaderboard, no server ban list, no hidden default | D7, settings copy, review checklist |
| Export/import round-trips and is versioned | `moderationSettings`; unit tests |
| Lazy/caching keeps policy off the post-page critical path | D5/D6, `moderationData`; network smoke |
| Mobile/axe for settings and downvote surfaces | `a11y.spec.js` route additions |

## 8. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Over-filtering / echo chambers | Balanced is label/collapse, never rep-only hide; every decision explains itself; settings show the exact matrix. |
| Harassment via transparency | Per-account views only; no leaderboard; aggregate evidence; no notifications by default. |
| Heuristic false positives | "Possible" labels with voters/count/window/targets; never hide/punish automatically. |
| Performance on large lists/history | Full-list reads cached; bounded index; history is lazy, paged, capped; no policy read on the post critical path. |
| List capture | Explicit subscription, provenance, multiple lists, follow override, one-click unsubscribe. |
| List API inconsistency | Verified live 2026-11-24; no `limit`; full list with caps; spike record before UI. |
| Community reason opacity | Use `muted_reasons` where present; otherwise generic bridge label. |
| Privacy / lost device | Local only; export/import; clear copy states there is no sync. |
| Safety floor scope creep | Phase 1 defines a hook and documents it; no live feed, no unreviewed list. |
| Scope explosion | Four independently verified releases; no release depends on another's deploy. |

## 9. Execution order and release gates

1. **Release 1 — W71 (done and deployed).** Pure skin gate + data reads +
   lazy store + ProfileSkin/wall/Studio + tests + docs + deploy/live smoke.
2. **Release 2 — W73 Phase 1.** Policy + settings + components + feeds/comments/
   community/profile/search + settings page + tests + axe + deploy.
3. **Release 3 — W73 Phase 2.** Downvote analysis/read + tab + post context +
   tests + deploy.
4. **Release 4 — W73 Phase 3.** List subscriptions + community context +
   shareable profiles + spike record + tests + deploy.

Each release follows the roadmap definition of done:

- `bun run lint`, `bun run test`, `bun run build`, `bun run test:e2e` green;
- new static routes are in `PRERENDER_ROUTES` and the nginx config; new
  dynamic account routes are in the nginx account-subroute regex. The nginx
  file is root-managed, so record the exact install step in the workstream
  record instead of assuming `./scripts/deploy.sh` applies it;
- axe at 1440px and 390px for affected routes;
- browser smoke including stale/error states;
- `./scripts/deploy.sh` + live production smoke;
- unit/E2E counts, build/deploy status and backup path reported;
- `docs/workstreams/W*-*.md` record, roadmap updated, clean tree, pushed to
  `origin/master`.

Suggested commit slices:

- `feat(moderation): add pure policy model and preset matrix`
- `feat(moderation): cache relationship and list context`
- `feat(moderation): add settings schema and import/export`
- `feat(skin): block muted and negative-reputation skins`
- `feat(moderation): explain and collapse moderated content`
- `feat(moderation): add settings page and first-use disclosure`
- `feat(downvotes): add transparency views and voter evidence`
- `feat(moderation): subscribe to lists and add community context`

## 10. Resolved open questions (defaults for this implementation)

1. **Coordination thresholds**: start conservative — "possible coordinated
   downvotes" only when ≥3 distinct voters hit ≥3 shared targets within 72h
   with ≥60% pairwise target overlap; otherwise show plain counts and weights.
   Make the rule visible in the panel and unit-test it.
2. **Site-level hiding beyond the safety floor**: none in Phase 1. The safety
   floor hook exists, is documented and is off unless a reviewed feed is added.
3. **Local report action**: none. Mute/ignore/blacklist plus community links
   cover Phase 1; a report without a recipient is theatre.
4. **Community mute reasons**: use `stats.muted_reasons` when present; do not
   parse chain notes for v1. Phase 3 may add note parsing only if the spike
   shows it is reliable.
5. **List subscription UX**: subscribe by account name, show owner +
   description + member count + link; no bulk import of members; no `limit`.
6. **Exporting another list's members**: never. Export list owner references,
   local overrides and settings only.

## 11. Start prompt for the implementation session

> Read `docs/ROADMAP.md`, issue #94, and
> `docs/workstreams/W73-moderation-implementation-plan.md`.
>
> Start with **Release 1 (W71)** only. Add the pure `skinSafety`/policy slice,
> the cached list/relationship reads, the moderation store and boot, gate
> `ProfileSkin`, the wall and the Studio, and write the unit/E2E coverage and
> `docs/workstreams/W71-theme-safety.md`. Follow the plan's decisions D1–D17.
> Run lint, unit tests, build and the targeted E2E; axe the profile, wall and
> settings routes at 1440 and 390; smoke the live flows; deploy and live-smoke;
> then update the roadmap and commit.
>
> Do not start Phase 2 or 3 in the same release. Do not add a global list or
> automatic punishment. Keep chain facts and local judgments visibly separate.
