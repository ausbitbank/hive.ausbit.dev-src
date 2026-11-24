# hive.ausbit.dev roadmap

Last updated: 2026-11-24

This is the active roadmap. It contains only open work. Delivered features and
their verification records live in `docs/workstreams/` and are not repeated
here.

## Vision

Make hive.ausbit.dev the fastest, most trustworthy Hive explorer for people who
use the chain every day: quick to open, resilient on weak or dead API nodes,
comfortable on mobile, and deep enough for governance, discovery and publishing
workflows.

## Product principles

1. **Fast by default.** Measure before changing. Enforce route and bundle budgets
   in CI. Prefer fewer requests, smaller payloads and progressive loading.
2. **Reliable under failure.** Every network path has a timeout, a fallback and a
   clear stale/error state. A dead node must not become a dead page.
3. **Evidence over guesses.** New behaviour gets unit tests, E2E coverage where it
   matters, and axe checks at desktop and mobile widths.
4. **Least privilege.** Posting keys stay posting; active actions stay active.
   Signing intent must be visible before broadcast.
5. **Accessible and mobile-first.** One page-level `h1`, semantic tables, visible
   focus, reduced-motion support and no horizontal overflow.
6. **No unbounded scope.** Each workstream ships independently with a documented
   verification record.

## North-star metrics

| Area | Target |
| --- | --- |
| Initial route JavaScript | Keep the initial bundle below the CI budget |
| Route chunks | Each route-owned chunk stays within its budget |
| LCP / INP / CLS | LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1 at p75 |
| API reliability | p95 read latency ≤ 1.5s; failed-request rate < 1% |
| Cache efficiency | > 70% of repeat reads served without a network call |
| Resilience | Dead-node failover, offline shell and queue survive smoke tests |
| Accessibility | Zero axe WCAG A/AA violations on key routes at 1440px and 390px |
| Quality gate | Lint + unit + E2E + build + live smoke green for every workstream |

## Open work

W34 (the 2026-11-19 issue sweep) and W35 (its five reopen follow-ups) are
complete. See `docs/workstreams/W34-issue-sweep.md` and
`docs/workstreams/W35-issue-followups.md`.

W36 (Lightning receive and pay, v4vapp Phase 1–2) is complete and deployed:
lint, unit tests, build, performance budgets, the targeted Lightning E2E and a
live browser smoke are green. The full fast suite has four pre-existing
live-data failures unrelated to this workstream. See
`docs/workstreams/W36-lightning-bridge.md`. Its keepsats, POS and zap follow-ups
are now covered by W52–W56.

W37 (dashboard Magi tokens, issue #76) and W38 (the last three open issues —
#50, #77 and #78) are complete. W38 adds community headers, forced dashboard
refreshes, an in-editor rows/masonry preview, auto-optimize and named layouts.
See `docs/workstreams/W37-dashboard-magi-tokens.md` and
`docs/workstreams/W38-dashboard-followups.md`.

W46 is the first composer slice from issue #82: image upload with Keychain and
SmartLock signing, drag/drop and paste, cover-image selection, an allow/decline
rewards choice, community subscription suggestions, and interoperable metadata
for descriptions, mentions, AI disclosure, countdowns, portfolio, collections
and display authors. It also renders that metadata on post pages and feed cards.
It is complete and deployed; the live smoke covered the composer, upload dialog,
post badges and the absence of page errors. See
`docs/workstreams/W46-post-composer-media.md`. Media embeds, a split live
preview, snippets, templates and the visual editor remain follow-ups.

W47 is the second composer phase: media embeds for video, audio and social
links; Write/Split/Preview modes with debounced live preview, top-down and
preview-embeds settings; HTML source mode; an expanded toolbar with headings,
task lists, table and media dialogs; list continuation, indentation and more
keyboard shortcuts. See `docs/workstreams/W47-composer-embeds-preview.md`.
Snippets, templates, draft recovery, the post-publish panel and an optional
visual editor remain.

W48 is the third composer phase: local snippets, post templates with a starter
library, draft search/sort/pinning/duplication, and a post-publish success
panel. It is complete and deployed; the live smoke covered the snippets and
templates dialogs and reported no page errors. See
`docs/workstreams/W48-composer-snippets-templates.md`. Draft version history,
snippet/template import/export, and the optional visual editor remain.

W49 is the fourth composer phase: draft version history with restore, plus
snippet and template JSON import/export. It is complete and deployed; the live
smoke covered the history, snippets and templates dialogs with no page errors.
See `docs/workstreams/W49-composer-history-backup.md`.

W50 is the fifth composer phase: active/archived draft views, archive/restore,
local publish reminders, approximate local storage usage, clear-all drafts, and
cross-tab synchronization. It is complete and deployed; the live smoke covered
the reminder banner, storage line and Archived view with no page errors. See
`docs/workstreams/W50-composer-reminders-lifecycle.md`.

W51 is the publishing-polish phase: beneficiary account search, defaults,
remove-all and save-as-default; an explicit My blog destination with recent
communities; topic suggestions from title/body and recent tags; and a topic
ordering dialog that marks the first five primary tags. See
`docs/workstreams/W51-composer-publishing-polish.md`. The optional visual
editor remains the last major composer item.

W52 (issue #87, Lightning CORS-live hardening) is complete. The production
origin is on v4v.app's CORS allowlist (verified 2026-11-21, API 6.6.1); the
bridge client separates offline, timeout, rate-limited, blocked and
unauthorized states, the health page shows an advisory bridge row, and a daily
read-only contract check fails if the allowlist or the public API shape drifts.
See `docs/workstreams/W52-lightning-cors.md`.

W53 (issue #87, Keepsats read-only session) is complete. The posting-key
v4v.app session is verified live; the wallet's Lightning section gains an
opt-in, secondary keepsats panel with a memory-only token, custody disclosure
and no write actions. See `docs/workstreams/W53-keepsats-read-only.md`.

W54 (issue #87, Keepsats on-chain actions) is complete. Deposit `#sats`,
conversion to HBD/HIVE, and Lightning invoice/address payments from keepsats are
built as `manualOnly` queue actions with the active key; wallet activity labels
`v4vapp_transfer`/`v4vapp_notification`. See
`docs/workstreams/W54-keepsats-onchain-actions.md`. A live operator smoke of a
small deposit/conversion/payment remains.

W55 (issue #87, POS and zaps) is complete. `/@account/pos` is a public keypad
that creates a fresh invoice per sale with local session totals; posts and short
posts gain a Zap button with 1k/5k/10k/21k sats presets. See
`docs/workstreams/W55-pos-zaps.md`. The nginx `pos` metadata line still needs a
root-managed install; the page works without it.

W56 (issue #87, explorer/markets/tax) is complete. Bridge custom JSON and
Lightning-style transfer memos are legible in block/transaction views,
`/markets` gains a live sats quote card, and wallet activity exports a
tax-friendly CSV with sats, fee, reference and parent id. See
`docs/workstreams/W56-explorer-markets-tax.md`.

W57 (issue #87, Lightning search and payment links) is complete. Search
recognises mainnet invoices, `lightning:` prefixes and Lightning addresses; the
search page offers an Open payment action, and `/lightning?pay=…` prefills the
pay dialog for logged-in users or shows a login hint. See
`docs/workstreams/W57-lightning-search.md`.

W58 (issue #87, keepsats send and local summary) is complete. Keepsats actions
gain Send to another Hive account, and the wallet shows a local sats-received
summary from the loaded rows with fees and latest date. See
`docs/workstreams/W58-keepsats-send-summary.md`.

W59 (issue #82, composer upload hardening) is complete. Image uploads gain real
per-file progress, cancel during signing or upload, per-file and retry-all
actions, and recent-upload rows with size, relative time and copy URL. See
`docs/workstreams/W59-composer-upload-hardening.md`.

W60 (issue #82, cover and checklist quality) is complete. Regular posts warn
about a missing cover, broken images, small or portrait covers and mismatched
community tags. Accounts can hide advisory warnings with “Don't warn again” and
restore them later; shorts and comments never get cover warnings. See
`docs/workstreams/W60-cover-checklist-quality.md`.

W61 (issue #82, composer community picker) is complete. The picker shows
community avatars, titles and subscriber counts, searches by title or name,
links to the community rules, and warns before posting outside the account's
subscriptions. See `docs/workstreams/W61-composer-community-picker.md`. Topic
drag controls, the remaining editor/draft gaps and metadata tooling remain.

W62 (public community browser) is complete. `/communities` (short alias `/c`)
lets anyone search all Hive communities by title, description and category,
compare subscribers and active authors, sort by trending, subscribers, active
authors or newest, and hide NSFW communities without signing in. See
`docs/workstreams/W62-public-community-browser.md`.

W64 (community search and discovery) is complete. Search now requests 100
matches per page, ranks title/name hits above description-only hits, exposes a
visible "Load more matches" control, and resolves partial `hive-123` community
names through account lookup. The empty-search view adds New communities, Active
right now and Largest communities shelves with compact community cards. See
`docs/workstreams/W64-community-search-discovery.md`.

W63 (theme system and profile skins) is implemented locally. Ten built-in
themes including the default Hive Dark and a light theme are selectable in
`/appearance`; the token layer and CI scanner replace the old hard-coded dark
palette. Authors can design a skin in `/settings/skin`, preview it, and publish
it as namespaced `posting_json_metadata` with posting authority. Visitors see a
skin on the author's profile, blog and posts inside a bounded, contrast-checked
scope, and can hide all skins at any time. `/themes` shows built-in themes and
skins from accounts the viewer follows. See
`docs/workstreams/W63-theme-system.md`.

W65 (issue #92, profile identity) is implemented locally. The sticker tray and
marquee ticker are gone; old themes still validate, stickers are ignored and
ticker text becomes a static status line. Account pages gain a fixed Profile
Shelf with a six-account Hive Circle, latest/pinned post and optional status.
See `docs/workstreams/W65-profile-identity.md`.

W66 (issue #92, badges) is implemented locally. A profile shelf confirms the
author's selected PeakD badge accounts directly with the chain-native follow
relationship; the Studio paginates followers only while the author is editing.
HiveBuzz reads only `state: "on"` badges. Both are cached, fail open and never
load on post pages. The curated credential allowlist is the only source of
“Verified”. See `docs/workstreams/W66-badges.md`.

W67 (issue #92, atmosphere and visual language) is implemented locally. Covers
and three-image collages become an app-owned atmosphere with an enforced
readability scrim; link/button/chip/divider/image/gradient enums and independent
light/dark token variants are available in the Studio. See
`docs/workstreams/W67-atmosphere-visual.md`.

W67b (issue #92, sharing and viewer control) is implemented locally. Theme codes
preview before apply, wall cards remix with attribution or adopt a palette
locally, and the wall has mode/tag/credential/recent/featured filters. Viewers
can calm effects and hide status or shelf extras while keeping per-author
ignore and “Hide all skins”. See
`docs/workstreams/W67b-sharing-viewer-control.md`.

W68 is a small-wins pass over the remaining issue #82/#93 and roadmap leftovers:
the Coin prices widget shows HIVE in sats, the publish review exposes the exact
`json_metadata`, and the wallet's sats-received card adds a loaded-rows 7-day
total and largest payment. It is deployed and live-smoked. See
`docs/workstreams/W68-small-wins.md`.

W69 closes the last W65 Phase 2 item: the posts widget can show **My
communities**, a merged feed across the signed-in account's community
subscriptions. The mode is available as a settings source and as
`/@me/communities`; it reads at most six communities, merges round-robin, shows a
login prompt for guests, and loads its data code on demand so the default home
bundle does not pay for it. It is deployed and live-smoked. See
`docs/workstreams/W69-my-communities-feed.md`.

The same release puts the W65–W67b theme, profile-shelf and badge code live;
their dedicated theme/skin/badge live smoke remains open (profile routes
currently sit behind a Cloudflare JS challenge for non-browser clients).

The issue #92 work is live. Remaining follow-ups with no open workstream: the
dedicated W65–W67b live smoke across themes, skins and badges, the optional
on-chain balance-request UI, the optional #63 server-side existence check at the
edge, and the optional visual editor from the composer roadmap.

W70 is a composer editor polish pass: a heading outline that jumps within the
body, a lazy-loaded emoji picker, and drag reordering in the Topic order dialog
(arrows kept for keyboard use). It also regenerates the icon subset for the new
`toc` glyph. An autosave toggle is deliberately deferred until there is a
navigation guard. It is deployed and live-smoked. See
`docs/workstreams/W70-composer-editor-polish.md`.

## Follow-ups from the 2026-11-23 “Looks, Words and Sats” response

Numbering note: `docs/workstreams/W62-hiveauth.md` and
`docs/workstreams/W62-public-community-browser.md` share a prefix. Refer to the
signing work as **W62-hiveauth**. W71 is complete; W72 is deployed with its
physical-device matrix still open; W73 is complete apart from the
explicitly deferred items in that section; W74 and W75 are deployed and
live-smoked. The next free workstream number is W76.

### W71 — Theme safety (complete)

W71 is implemented, deployed and live-smoked: a custom skin does not apply
from a muted author or an author with negative displayed reputation; the check
fails closed while unresolved; follows beat subscribed mute lists, negative
reputation needs an explicit trust choice, and the viewer can show a specific
skin anyway. It covers profile, blog, post, the theme wall and the Studio
preview. See
[`docs/workstreams/W71-theme-safety.md`](workstreams/W71-theme-safety.md) and
the rule in [`docs/SECURITY.md`](SECURITY.md).

### W72 — HiveAuth device matrix and background-resume hardening (deployed, device matrix open)

This is a follow-up to **W62-hiveauth**. Login, voting, commenting, rejection,
keepsats and queue auto-send are working on the initial device. The client-side
resume work and its automated tests are implemented, deployed and live-smoked;
the repeatable physical device matrix and the live operator smokes remain open.
Record: [`docs/workstreams/W72-hiveauth-resume.md`](workstreams/W72-hiveauth-resume.md).

Current client behaviour:

- One logical HiveAuth request at a time, keyed by the relay `uuid`.
- After an unexpected socket close with a pending request, reconnect with
  backoff (500 ms → 4 s) and send `attach_req`.
- On `visibilitychange` (when visible), `pageshow` and `online`, a pending
  request whose socket is not `OPEN` closes the stale socket and reconnects
  immediately, then sends `attach_req`.
- A single per-tab pending record in `sessionStorage`
  (`hiveauth:pending`, `{account, uuid, kind, expire}`) remembers the request.
  A login also keeps the temporary auth key so a reload within 60 seconds can
  finish it. Signing and challenge records never store a key.
- `attach_ack` resumes waiting; `attach_nack` fails with “request expired before
  it could be resumed — check the chain before retrying a transaction”.
- The relay's 60-second expiry is the hard deadline. There is no blind retry
  after an ambiguous `attach_nack`, to avoid duplicate broadcasts.
- The queue, login dialog and HiveAuth toast show “Waiting for wallet…”,
  “reconnecting (attempt N)…”, “expires in Ns” and clean expiry.
- Image uploads use the image host's `/cs/` checksum endpoint, so the HiveAuth
  request is a 47-byte challenge rather than the whole file.
- Queue auto-send/send-all process HiveAuth actions one at a time and wait for
  each phone approval; the first auto-send warns to keep Keychain Mobile in the
  foreground.

Open work:

- [x] Reconnect immediately on `visibilitychange`, `pageshow` and `online`
      instead of waiting for `onclose` or the next backoff tick.
- [x] Persist the pending `{uuid, kind, account, expire}` record in
      `sessionStorage`; keep the temporary auth key only for a login.
- [x] Mark a failed signing resume as a failed queue item with a
      check-the-chain message; never auto-retry an ambiguous `attach_nack`.
- [x] Show explicit waiting, reconnecting and expiry status; explain an expiry
      that happens while the page is closed.
- [x] Warn before an auto-send batch to keep Keychain Mobile in the foreground.
- [x] Add automated tests for socket drop → reconnect → `attach_ack`, tab
      reload → pending attach, `attach_nack`, expiry during reconnect, duplicate
      responses and the pending record lifecycle.
- [ ] Record every manual run with build SHA, device/OS/browser, wallet version,
      network (Wi-Fi/cellular) and background duration (10s, 30s, 55s), plus a
      screenshot for failures.

Device matrix:

| Tier | Devices / wallets | What we test |
| --- | --- | --- |
| **1 — release gate** | Keychain Mobile on Android + iOS; Safari iOS and Chrome Android; desktop Chrome/Firefox with QR | Login, vote, comment, transfer, image upload, keepsats, reject, timeout, session expiry, 3-action auto-send |
| **2 — supported** | HiveAuth Mobile; Keychain Mobile's in-app browser; Safari/Edge desktop; older Android/iOS | Same core flows, best-effort |
| **3 — resilience** | Page reload, OS tab discard, airplane-mode toggle, low-power mode, multi-account, account without an active key | Correct failure and no duplicate broadcast |

Known limitations to state plainly:

- The relay only holds a request for 60 seconds; the app cannot extend it.
- Keychain Mobile only surfaces a pending request when it is foregrounded or
  reopened. There is no site-side push; that is wallet behaviour.
- If the OS kills the page entirely, an in-flight request is lost unless the
  pending metadata was persisted; signing can only resume while the session key
  is valid.
- An ambiguous `attach_nack` can mean “expired” or “already processed”. The user
  must check the chain before retrying a transaction.

Acceptance:

- [ ] Tier 1 matrix passes on Android and iOS, including 10/30/55-second
      background cycles.
- [x] Mocked socket-drop, tab-reload and `attach_nack` tests pass.
- [ ] A 3-action HiveAuth auto-send completes one approval at a time; a timeout
      stops the batch without duplicate transactions.
- [ ] A real HiveAuth image upload succeeds through `/cs/` on Android and iOS.

### W73 — Moderation policy engine and downvote transparency

Implementation contract: issue **#94**. This is a local-first, user-configurable
moderation layer, not a site-wide ban list. W71 is the narrow skin-safety slice;
W73 generalises it into a policy engine that covers feeds, comments, community
mutes, skins and reputation-gated features.

Phase 1 is implemented, deployed and live-smoked:

- [x] Add a pure `moderationPolicy`/`moderationContent` module with
      Open/Balanced/Strict/Follow-only/Custom presets and per-surface decisions.
- [x] Keep direct mutes, direct blacklists, followed mute lists, followed
      blacklists and community muted roles/post mutes as distinct layers.
- [x] Add explainability and overrides to feeds, comments, profiles, community
      feeds and skins; follows beat subscribed mute lists with a conflict badge.
- [x] Add the first-use Balanced disclosure; label/collapse negative-rep content,
      never hide on reputation alone.
- [x] Give every reputation-gated feature an override, not only skins. The image
      host's gate is server-side and is explained rather than overridden.
- [x] Cache relationship/list flags and keep the policy check off the critical
      path for post pages.
- [x] Export/import the local policy as versioned JSON.

Phase 1 remaining polish: search results label a moderated post but do not yet
offer a per-row Show anyway action, and notification opt-ins are deferred. The
settings page is `/settings/moderation`; the record is
[`docs/workstreams/W73-moderation-policy.md`](workstreams/W73-moderation-policy.md).

Phase 2 is implemented, deployed and live-smoked:

- [x] Profile Downvotes tab with received/given rows: voter, weight, target and
      time, plus local relationship context.
- [x] Evidence-backed “possible coordinated downvotes” hint with voters,
      targets, count, window and overlap.
- [x] Downvote-to-upvote context: distinct voters, stake concentration and net
      direction in the post vote dialog.
- [x] Per-voter local exclusion while raw chain impact stays visible.
- [x] No global downvoter leaderboard.

See [`docs/workstreams/W73-downvote-transparency.md`](workstreams/W73-downvote-transparency.md).

Phase 3 is implemented, deployed and live-smoked: explicit mute/blacklist list
subscriptions with provenance and owner-only export references, multiple-list
conflict handling, community context links, and the reason/`get_follow_list`
spike. Optional on-chain list creation and aggregate signals remain deferred.
See [`docs/workstreams/W73-lists-community.md`](workstreams/W73-lists-community.md)
and [`docs/workstreams/W73-list-spike.md`](workstreams/W73-list-spike.md).

Do not ship a hidden global list, automatic punishment from heuristics, or a
global downvoter leaderboard. See #94 for the full research, data sources and
acceptance criteria.

The implementation brief for W71 + W73 (module map, preset matrix, data-source
spike results, test plan and release order) is
[`docs/workstreams/W73-moderation-implementation-plan.md`](workstreams/W73-moderation-implementation-plan.md).

### W74 — Composer autosave control, leave guard and draft rename

This closes the draft-safety half of the composer backlog. The editor settings
gain an autosave on/off switch (default on); turning it off saves the current
draft once, then in-app navigation and tab close ask before leaving unsaved
changes. The guard offers Save and leave, Leave without saving and Stay. Any
local draft can be renamed from the draft list, including the active draft.

No draft schema, signing or publish-path change. The explicit Save button and
publishing still work with autosave off. See
[`docs/workstreams/W74-composer-draft-safety.md`](workstreams/W74-composer-draft-safety.md).

W74 is deployed and live-smoked: the guard, discard path, reload and rename all
worked against production, and the dialogs are axe clean at 1440px and 390px.

### W75 — Search result moderation override

The last Phase 1 moderation polish item. Collapsed or hidden search results gain
a per-row **Show anyway** action as a sibling button, so the row itself stays the
open action and no interactive control is nested. The override uses the existing
local `showItems` policy, clears the label once shown, persists across reloads,
and restores focus to the row when the action disappears. Post row keys now
include the permlink, fixing duplicate keys for posts by the same author. See
[`docs/workstreams/W75-search-moderation-override.md`](workstreams/W75-search-moderation-override.md).

W75 is deployed and live-smoked: a guest follow-only search row collapsed with
“Not followed”, Show anyway revealed the snippet, cleared the label, restored
focus and persisted the local override.

## Definition of done

Every workstream must include:

- A `docs/workstreams/W*-*.md` record with scope, components, authorities,
  verification and notes.
- `bun run lint`, `bun run test`, `bun run build` and `bun run test:e2e` green.
- Axe checks at 1440px and 390px for affected routes.
- A browser smoke of the key flows, including stale/error states.
- Deploy with `./scripts/deploy.sh` and a live production smoke.
- Unit/E2E test counts, build/deploy status and backup path reported.
- Commit and push to `origin/master`, with a clean working tree.

## Standards

- Vue 3 + Quasar 2 + Vite.
- Design tokens and `.home-card` / `.home-panel` patterns.
- One page-level `h1`; section headings are `h2`.
- Sanitized UGC and `noopener noreferrer` on external links.
- Posting/active queue authorities preserved exactly.
- Expandable raw JSON on explorer pages.
- Shared UI primitives under `src/components/ui/`.
- Central API client and cached read layer for chain data.
- Visibility-aware polling; no background polling without intent.
- Prefer semantic tables, real buttons and keyboard-operable surfaces.

## Suggested new-session prompt

> Read `docs/ROADMAP.md` first. It lists only open work; completed features and
> their verification records are in `docs/workstreams/`.
>
> Pick the next workstream from the agreed scope, give it the next W-number, and
> write its `docs/workstreams/W*-*.md` record alongside the code.
>
> Follow the standards in this roadmap: design tokens, one page-level `h1`,
> posting/active authority correctness, sanitized UGC and `noopener noreferrer`.
>
> Run `bun run lint`, `bun run test`, `bun run build` and `bun run test:e2e`, run
> axe at 1440px and 390px, smoke the key flows, deploy with
> `./scripts/deploy.sh`, and live-smoke production. Update `docs/workstreams/`
> and this roadmap, report unit/E2E counts, build/deploy status and backup path,
> then commit and push the verified work with a clean working tree.
>
> Do not redo finished workstreams except for integration fixes.
