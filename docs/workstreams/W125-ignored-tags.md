# W121 — Ignored tags in feed listings

Date: 2026-11-28
Status: implemented and verified locally

## Scope

Readers can keep a local list of tags and remove matching posts from feed
listings. The goal is noise reduction while browsing, not content moderation:
the list never hides a post the reader deliberately opens.

## Behaviour

- The ignored-tag list is stored in the existing per-account moderation policy,
  so it follows the local export/import and the guest policy shape.
- Browse, account, community and tag feeds, the home posts panel and the
  community feed drop matching posts. The filter dialog keeps its existing
  “hidden by filters” count and the filter button badge counts each ignored tag
  alongside the other active filters.
- The browse filter dialog has an ignored-tag editor. “Reset filters” clears
  the tag list along with the transient toggles.
- `/settings/moderation` has an “Ignored tags” section with add, remove and
  clear-all controls.
- Quick actions: a tag feed header can ignore/unignore its tag, and tag chips on
  post cards and the post page toggle the same list. The post page itself is
  never collapsed or removed.
- Tags match case-insensitively, ignore a leading `#`, and consider the post
  category, reply target and metadata tags. Post metadata is parsed with the
  existing helper, so bridge objects and condenser strings both work.

## Components

| Area | Files |
| --- | --- |
| Pure matching | `src/services/tagFilters.js` |
| Policy schema | `src/services/moderationSettings.js` |
| Store and quick actions | `src/stores/moderation.js`, `src/mixins/moderation.js` |
| Browse filter and tag feed | `src/components/browseContainer.vue`, `src/pages/browse.vue` |
| Post surfaces | `src/components/postPreview.vue`, `src/pages/post.vue` |
| Other feeds | `src/components/community/CommunityFeed.vue`, `src/components/HomeTrendingPosts.vue` |
| Settings | `src/pages/moderation.vue` |

## Authority and privacy

- Local only. No signing, network write or server sync.
- Guest choices use the existing `hive:moderation:v1:guest` local policy; signed-in
  choices use the per-account moderation key.
- The moderation export gains a `tags.ignored` array. The schema version moves
  to 2; version 1 exports still import and normalize cleanly.

## Verification

- `bun run lint` — clean.
- `bun run test` — 2,397 passed across 251 files.
- `bun run build` — succeeded.
- Focused E2E — `e2e/browse.spec.js` passed 3 checks (filter dialog, quick tag
  action, reset) and the Moderation settings test now covers add, persist and
  clear-all for the ignored-tag list.
- `bun run perf:check` — measured; the shared worktree reports small pre-existing
  overages across Home, Browse, Block, Post, Wallet, Market, Compose and Search,
  including routes this slice does not touch, consistent with the uncommitted
  Vault work noted in the roadmap. This slice adds the tag matcher and filter
  controls to the Browse and Home chunks.
- The full release E2E gate is run as part of the normal workstream gate; record
  any environment-specific flake here.

## Remaining

- The ignored-tag editor is text entry, not tag autocomplete from the loaded
  feed. A future pass can reuse the trending-tag data already on the dashboard.
- Blog-host feed surfaces are not part of this slice; they keep their own
  curated ordering.
