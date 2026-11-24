# W75 — Search result moderation override

Date: 2026-11-24
Status: implemented, deployed and live-smoked.

Follows the remaining Phase 1 polish in
[`W73-moderation-policy.md`](W73-moderation-policy.md). The policy engine already
labelled and collapsed search results, but a collapsed snippet had no per-row
way back.

## Scope

- Add a per-row **Show anyway** action to collapsed/hidden search results.
- Keep the row itself the open action; the override is a separate sibling
  button, so there are no nested interactive controls.
- Restore keyboard focus to the row after the override removes its own button.
- Fix duplicate post row keys found while testing the action.

No policy, storage or chain change. The override uses the existing local
`showItems` override, so it is reversible in `/settings/moderation` and never
changes the chain.

## Behaviour

- The action appears only when the moderation decision both has a reason and
  would collapse or hide the row (`display` is `collapse` or `hide`). Labelled
  but readable rows keep their label and need no action.
- The accessible name includes the result title, for example
  `Show A moderated post anyway`, so multiple rows do not share an ambiguous
  button name.
- Choosing it calls `moderationShowItem` with the decision, which persists the
  item key locally (guest policy or the signed-in store) and recomputes the
  search groups. The snippet appears, the moderation label clears for a shown
  item, and the action disappears.
- Focus moves to the row's open button on the next tick instead of dropping to
  the document body when the clicked action is removed.
- Post rows now use `post-<author>-<permlink>` keys. The previous generic key
  fell back to the author alone, so two posts by one author shared a key and
  the row DOM could be reused incorrectly.

## Files

- `src/components/search/ResultList.vue` — row restructure, sibling override
  button, focus restoration, collapsed/shown presentation.
- `src/pages/search.vue` — `@show` wiring, `showResult`, unique post keys.
- `tests/unit/search-result-list.spec.js` — row rendering, sibling buttons,
  labelled rows without an action, emitted payload and focus.
- `e2e/search.spec.js` — guest follow-only policy, collapsed result, action at
  1440px and 390px, axe on the list, focus, persisted override.

## Verification

- `bun run lint` — clean; theme-token scan clean.
- `bun run test` — 162 files, 1,416 tests passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/search.spec.js --project=chromium` — 5 passed.
- Obscura `bun run test:e2e -- e2e/search.spec.js` — 5 passed.
- Axe on the result list at 1440px and 390px — clean before and after the
  override.
- `bun run perf:check` — all budgets passed (one transient `/browse` LCP
  outlier passed on the rerun).

## Deployment

Deployed on 2026-11-24 from commit `ce38d36` with `./scripts/deploy.sh`.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T094544Z.tar.gz`
  (`sha256 b8d5083d…5f7448`).
- Rollback: `./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261124T094544Z.tar.gz`.
- Production `index.html` SHA-256 `07ccb17a…1f7571` matches the local build.
- Live Chromium smoke on `/search?q=hive&type=posts` at 390px:
  - a follow-only collapsed row showed “Not followed” with no snippet;
  - **Show anyway** revealed the snippet, cleared the label, restored focus to
    the row and persisted one local `showItems` key;
  - no page errors.
- Live HTTP: `/` and `/search?q=hive&type=posts` return 200.

## Notes and follow-ups

- Notification controls remain deferred, as recorded in W73.
- The action is deliberately per row. A “show all moderated results” control
  would be a separate, broader preference.
- Account rows keep their relationship label rather than a hide, so they do not
  show this action.
