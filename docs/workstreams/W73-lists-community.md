# W73 Phase 3 — Lists, community context and portable profiles

Date: 2026-11-24
Status: implemented, deployed and live-smoked (client route).

Contract: issue #94. Prior records:
[`W73-moderation-policy.md`](W73-moderation-policy.md),
[`W73-downvote-transparency.md`](W73-downvote-transparency.md). Data spike:
[`W73-list-spike.md`](W73-list-spike.md).

## Scope

Explicit, opt-in list subscriptions and portable policy references, plus the
community context that was missing from the content notices.

Shipped:

- Subscribe/unsubscribe to a Hive mute or blacklist list by owner account.
  The action is a normal `follow` `custom_json` queued with **posting**
  authority; it preserves every existing `what` flag (`blog`, `ignore`,
  `blacklist`, `follow_muted`, `follow_blacklist`).
- `/settings/moderation` shows followed lists with owner, description, member
  count (when resolved), a profile link and an Unsubscribe action.
- A subscribe form validates the owner, refuses self-subscription and refuses
  a duplicate subscription.
- Imported policy references are shown as **suggestions**; the viewer must
  click Subscribe. Import never writes to the chain.
- Multiple subscribed mute lists are represented as separate owners; a follow
  conflict lists every owner in the badge/notice. The existing
  “let subscribed mute lists override follows” toggle controls precedence.
- Community notices can link to the community context (`/c/:community`), and
  `stats.muted_reasons` still distinguishes community moderation, community
  type, muted parent, low reputation and muted role.
- Export includes owner references only (`subscriptions.muteOwners`,
  `subscriptions.blacklistOwners`); no member lists and no account data.
- A curated, default-unsubscribed discovery set with live counts where
  practical.

## Discovered lists (verified 2026-11-24)

Hive has no global on-chain directory of lists. The practical discovery surface
is a curated seed set, verified against the chain, shown default-unsubscribed.

| Owner | Type | Names | State | Why show it |
| --- | --- | ---: | --- | --- |
| `hive.blog` | mute | 956 | maintained | Hive.blog phishing/hacked-account list; overlaps Plenty of Phish (785 shared) and adds newer entries. |
| `plentyofphish` | mute | 914 | static source | The Plenty of Phish GitHub-backed phishing source used by hive.blog and anti-abuse tools; last on-chain update 2021. |
| `ecency` | mute | 71 | active | Ecency's active team spam/bot mute list (41 updates in the last 90 days at probe time). Broader than phishing. |
| `spaminator` | blacklist | 35 | legacy | Spaminator/Hivewatchers warning list with a documented Discord appeal path; last on-chain update 2023. |
| `themarkymark` | blacklist | 70,963 | active / not supported | Hive Analytics bot/spam warning set (88 updates in 90 days). Too large for this client: **not offered for subscription**. |

Excluded from the default set:

- `hivewatchers` — profile says the project is shut down.
- `steemcleaners` — legacy and inactive.
- `hive.blog`'s 8-entry blacklist — too narrow to be a useful discovery card.
- `blocktrades`, `peakd`, `deathwing` and similar small personal lists — not
  published anti-abuse lists.

The discovery cards show known counts immediately, refresh the smaller lists
live, and never subscribe automatically. `themarkymark` is deliberately not
fetched because the full list is too large; its known count is labelled
approximate, the Subscribe action is disabled and the card explains why.

### Large-list limit (measured)

The `themarkymark` list does **not** fit the current client model:

- The live `bridge.get_follow_list` response is **5.86 MB / 70,963 names** and
  took about **3.6 seconds** in the probe.
- `MODERATION_LIST_MAX` is **10,000** names, so only about 14% would be
  recognised; names after the cap would be silently unlabelled.
- The session snapshot caps at **5,000** names, so a reload would preserve
  roughly 7% of the list.
- A pure policy benchmark with 70k array members cost about **4.9 ms per
  decision** (10k was about 1.1 ms), before multiple lists or a feed of cards.
- The member count would show 10,000, not 70,963, making the list look complete
  when it is not.

Supporting a list this size would need a separate design: a live `Set`-based
index, no array-normalisation per decision, IndexedDB or a server-side index,
and an explicit “partial index” state. That is outside Phase 3. The UI therefore
shows the list as advanced context but does not offer the subscription.

## Implementation

| File | Role |
| --- | --- |
| `src/services/followLists.js` | Validate owners, compose the preserving subscription op, membership/subscription helpers. |
| `src/services/followOps.js` | Full `what` array composition shared by follow/mute/list actions. |
| `src/stores/moderation.js` | Optimistic list context update, policy owner references, export subscriptions. |
| `src/services/moderationSettings.js` | Export/import `subscriptions` references with the versioned policy. |
| `src/pages/moderation.vue` | Subscribe form, provenance/member count, unsubscribe, imported suggestions, discovery cards. |
| `src/services/moderationLists.js` | Curated discovery seeds, status/caution labels, grouping. |
| `src/services/moderationContent.js` | Community id on decisions. |
| `src/components/moderation/ModerationNotice.vue` | Community context link. |

## Authorities and safety

- Subscription writes are `posting` authority. They go through the normal
  signing queue and are never auto-broadcast.
- The operation preserves all follow flags; this is the P1-15 fix applied to
  lists as well.
- No list is silently applied: subscription is explicit, provenance is shown,
  and the list can be removed with one click.
- No global list is created or subscribed to by default.
- Imported list references do not subscribe automatically and do not include
  member lists.
- `bridge.get_follow_list` still rejects `limit`; the client caches the full
  list and bounds the member index. Spike evidence is in `W73-list-spike.md`.

## Tests

- `tests/unit/follow-lists.spec.js` — owner validation, all five relationship
  flags, subscribe/unsubscribe preservation, blacklist composition, membership.
- `tests/unit/moderation-store.spec.js` — optimistic subscription state,
  owner-only export, imported references without auto-subscribe.
- `tests/unit/moderation-policy.spec.js` — multiple-list conflict owners.
- `e2e/moderation.spec.js` — settings subscribe queues a posting
  `custom_json` with `follow_muted`, shows the followed list, and the feed
  notice exposes the community context link.
- Axe: `/settings/moderation` and `/@ausbitbank/downvotes` at both widths.

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean |
| `bun run test` | 154 files, **1347 tests**, all green |
| `bun run build` | green |
| `bun run perf:check` | all budgets pass |
| `e2e/moderation.spec.js` | 10/10 green |
| axe `/settings/moderation`, downvotes | green at 1440px + 390px |

## Deferred (explicit)

- On-chain list creation is a separate posting-key feature and is not shipped.
- Optional community/aggregate signals and automatic enforcement are not
  shipped.
- The nginx exact location/sub-route regex is in the repo but needs a root
  install/reload; client navigation works.

## Deployment

Deployed on 2026-11-24 with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T053841Z.tar.gz`
  (`sha256 87d824be…1cc1b0b`).
- Production index matches local `assets/index-*.js` for this build.
- Live browser smoke through the SPA router (account routes are behind the
  existing Cloudflare challenge for direct automated requests): the moderation
  page renders its h1, five presets, matrix, export control, subscribe form and
  discovery cards; the discovery counts were live **956 / 914 / 71 / 35** and
  the very-large list showed the approximate 70,963 with **no Subscribe
  button** and the “not supported in this client” explanation; `@hive3/downvotes`
  renders 40 rows; no page errors.
- The Cloudflare metadata Worker now has the `/settings/moderation*` route and
  a `settings/moderation.html` shell mapping. A normal browser GET returns
  **200** with `x-hive-meta: theme-shell` and the correct title.
- Non-HTML requests (for example `curl -H 'Accept: application/json'`) still
  reach the origin and return 404 until root installs the nginx exact
  location. The Worker intentionally only serves HTML clients.
- Direct `/@account/downvotes` is still behind the Cloudflare challenge for
  automated clients; the account-subroute nginx regex includes `downvotes` for
  the eventual origin install.
