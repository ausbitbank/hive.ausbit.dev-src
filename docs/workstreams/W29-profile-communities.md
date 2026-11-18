# W29 — Profile communities directory and merged feed

Date: 2026-11-18
Status: complete

## Scope

`/@:username/communities` was a single 400px card: an autoplaying community
feed carousel (`communityFeedCarousel.vue`) wrapped around a plain `<q-list>`
of subscription rows. It showed community names and roles only, lost all
community context below the slug, and could not be scanned.

The view is now a full directory:

- **Summary strip** — community count with the role breakdown, plus combined
  subscribers, active authors and pending payouts.
- **Community cards** (`components/community/CommunityCard.vue`) — avatar,
  title, community id, official role badge, description, subscribers / active
  authors / pending payouts, NSFW and restricted flags, and quick links to
  trending, new, hot and the tag feed.
- **Filters** — role chips (owner, admin, mod, member, guest) with counts, a
  name/description search and sort by role, subscribers, authors, rewards or
  name.
- **Expanded feed** (`components/community/CommunityFeed.vue`) — a card grid
  rendered with the shared `post-preview` card, sortable by trending, new or
  hot. For the account's own profile it merges the newest posts from up to
  twelve communities, round-robin so one busy community cannot dominate; pinned
  posts lead. Single-community feeds page through "Load more".
- Offline/stale snapshots and inline retry states match the home dashboard.

## Data

- `bridge.list_all_subscriptions` (new `apiListAllSubscriptions` wrapper) gives
  `[name, title, role, guestTitle]` rows, cached for 60s
  (`fetchAccountSubscriptions`).
- `bridge.list_communities` has no multi-id lookup. `fetchCommunityInfoBatch`
  walks the top ten ranked pages (400 communities), then searches the title of
  anything still missing — long-tail communities such as `hive-197955`
  (Hive Australia) are not ranked high enough to appear otherwise. Results are
  cached for five minutes and merged with the subscription rows by
  `buildCommunityCards`.
- `mergeCommunityFeeds` interleaves per-community feeds, de-duplicates
  restacked posts, fills in `community`/`community_title` when the node omits
  them and lifts pinned posts to the top.

Both pure helpers live in `services/community.js` and are covered by
`tests/unit/community-directory.spec.js`.

## Removed

- `src/components/communityFeedCarousel.vue` — the only consumer was this page.

## Follow-ups

- Hivemind does not expose subscriber lists for long-tail communities; their
  cards fall back to the subscription title and show no stats.
- A "pinned only" toggle would need `bridge.get_pinned_post` per community.
