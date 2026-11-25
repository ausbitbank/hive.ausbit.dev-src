# W78 — Community moderation context

Date: 2026-11-25
Status: implemented, deployed and live-smoked.

Contract: issue #94. Prior records:
[`W73-lists-community.md`](W73-lists-community.md),
[`W76-moderation-transparency.md`](W76-moderation-transparency.md) and
[`W77-safety-floor.md`](W77-safety-floor.md).

This is the first slice of the optional community/aggregate signals item. It
does not add automatic enforcement, a reputation score or a leaderboard.

## Scope

The community pages already had an activity panel and a small “visible
signals” card. That card now becomes a **Community moderation context** section
with the information a viewer needs to understand what the community did and
why:

- The current muted feed count, explicitly labelled as a sample rather than a
  historical total.
- A breakdown by the bridge's `stats.muted_reasons` categories:
  - hidden by community moderation,
  - restricted by the community type,
  - reply to a post the community muted,
  - low reputation,
  - muted community role.
- Honest fallbacks when the bridge does not expose a reason: “Hidden by Hive
  bridge”, “Greyed by Hive bridge”, “Reason not exposed” and “Unrecognised
  bridge reason”.
- The five most recent posts in the current muted feed, with author, title,
  reason and link to the post.
- The community team role counts, linking to the existing Rules and team tab.
- NSFW/restricted settings and the community's flag text.
- Links to the muted feed and the viewer's own moderation settings.
- A plain-language separation: community mutes are the community's decision;
  they are not the viewer's personal mute list, a subscribed list, or the local
  display policy.
- A note that this is the current bridge feed, not a complete moderation
  history, and that per-post moderator notes are not exposed so are not
  invented.

The existing content notice's **Community context** link now targets
`/c/:community#moderation-context`, so a viewer can jump from a muted or
labelled item to the explanation.

## Data

No new network request was added. `fetchCommunityInsightData` already reads the
current muted feed via
`bridge.get_ranked_posts({ sort: 'muted', tag: community, limit: 20 })`.
`bridge.get_community` already supplies `team`, `settings`, `flag_text` and
NSFW/restricted state.

The aggregation is pure in `src/services/communityModeration.js`; it accepts
missing or malformed stats without inventing a reason.

A post with more than one bridge reason is counted in each category. The UI
states this explicitly.

## Explainability and boundaries

- Community mutes are shown with the bridge's own categories; the client does
  not claim to know a moderator's note.
- A sample count is not presented as a total or an audit.
- Team roles are descriptive, not a trust score.
- No automatic hide, mute, downvote or report is triggered from this context.
- The viewer's local policy still controls whether the item is shown, labelled
  or collapsed.
- There is no global moderation ranking or leaderboard.

## Files

| File | Change |
| --- | --- |
| `src/services/communityModeration.js` | Pure reason/role/recent-post aggregation with honest fallbacks. |
| `src/services/moderationContent.js` | Shares the community reason labels instead of duplicating them. |
| `src/components/community/CommunityInsights.vue` | New Community moderation context card, links and reason/recent lists. |
| `src/components/moderation/ModerationNotice.vue` | Community context link targets the new section. |
| `tests/unit/community-moderation.spec.js` | Reason grouping, unknown codes, roles, titles, empty state. |
| `e2e/moderation.spec.js` | Mocked community context, reason breakdown, roles, rules link, muted feed link and axe. |
| `docs/performance/budgets.json`, `docs/performance/README.md` | Small shared-policy budget adjustments. |

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean; theme-token scan clean |
| `bun run test` | 164 files, **1447 tests**, all green |
| `bun run build` | green |
| `bun run perf:check` | all budgets pass |
| `e2e/moderation.spec.js` | **12/12** green, including the community context and axe |
| axe `/c/:community` | green in the community context test |

## Deployment

Deployed on 2026-11-25 from commit `3187378` with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261125T041222Z.tar.gz`
  (`sha256 2cec8363…5b4204d`).
- Production `index.html` SHA-256 `ffadaf3c…59f58bc` matches the local build.
- Live `/` and `/c/hive-139531` return 200.
- Live smoke: the community page renders **Community moderation context**,
  team counts (`1 owner · 5 admins · 19 mods`), the muted-feed link
  `/muted/hive-139531`, the Rules and team link and the honest empty state,
  with no page errors.

## Follow-ups

- A historical moderation audit would need a reliable community-op/note
  source; `bridge.get_community` and the muted feed do not provide one.
- `bridge.list_community_roles` could add a dedicated muted-role list if the
  live nodes expose it consistently. The current view reports muted-role reasons
  from the muted feed instead.
- Cross-account aggregate downvote patterns and optional third-party labelers
  remain the larger, separate parts of the community/aggregate-signals item.
