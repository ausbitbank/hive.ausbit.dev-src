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

## Implementation

| File | Role |
| --- | --- |
| `src/services/followLists.js` | Validate owners, compose the preserving subscription op, membership/subscription helpers. |
| `src/services/followOps.js` | Full `what` array composition shared by follow/mute/list actions. |
| `src/stores/moderation.js` | Optimistic list context update, policy owner references, export subscriptions. |
| `src/services/moderationSettings.js` | Export/import `subscriptions` references with the versioned policy. |
| `src/pages/moderation.vue` | Subscribe form, provenance/member count, unsubscribe, imported suggestions. |
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

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T034359Z.tar.gz`
  (`sha256 d0f9d2e2…91ce0`).
- Production index matches local `assets/index-DBi3Q3AN.js`.
- Live browser smoke through the SPA router (account routes are behind the
  existing Cloudflare challenge for direct automated requests): the moderation
  page renders its h1, five presets, matrix, export control and list subscribe
  form; `@hive3/downvotes` renders 40 rows; no page errors.
- Direct `/settings/moderation` and `/@account/downvotes` still return the
  404/403 shell status until root installs the nginx exact location/sub-route
  regex. Client navigation works.
