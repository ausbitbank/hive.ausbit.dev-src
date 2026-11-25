# W76 — Moderation transparency and honest partial indexes

Date: 2026-11-25
Status: implemented; local verification green (not deployed in this pass).

Contract: issue #94. Follows the Phase 1–3 records:
[`W73-moderation-policy.md`](W73-moderation-policy.md),
[`W73-downvote-transparency.md`](W73-downvote-transparency.md) and
[`W73-lists-community.md`](W73-lists-community.md).

This is a hardening pass over the shipped policy engine. It closes three places
where the UI promised more than the data could prove, or where a bounded read
looked complete when it was not.

## Scope

### 1. Per-voter exclusion now works where voters are known

Phase 1 offered an **Ignore this voter's downvotes** action on content notices,
but a content decision only carried aggregate vote data. The action looked for
a voter that was never present and did nothing. Phase 2's per-voter exclusion
worked on `/@account/downvotes`; the content action did not.

Now:

- `decideContent()` reads `post.active_votes` when the payload supplies it and
  exposes the actual downvoters in `decision.downvoters`, capped at 8.
- The notice lists each known downvoter with **Ignore @voter** or
  **Unignore @voter**; the action is emitted with the voter name and toggles the
  same local `ignoredVoters` policy used by the downvotes page.
- An ignored voter's downvote is excluded from the **local** downvote label,
  which can clear the label when the remaining votes are no longer negative.
  The evidence keeps the raw chain net and the excluded count, and the raw
  summary on the downvotes page is unchanged.
- When a payload has no `active_votes`, no per-voter action is offered. The
  notice still labels the downvote and points to the voter evidence instead of
  showing a dead control.

This is still a local view change only. It does not alter rewards, reputation,
the chain, or what other viewers see.

### 2. Partial list indexes are visible and fail closed for skins

`bridge.get_follow_list` returns the whole list and rejects `limit`, so the
client bounds every list at 10,000 names and caches at most 5,000 names per list
in the session snapshot. Previously a list over either cap was silently
partial: members in the tail were treated as if they were not on the list.

Now:

- `fetchModerationListSnapshot()` returns `{ entries, truncated, total }`; the
  existing entries/names helpers keep their contract.
- The viewer context records `listTruncated` entries with owner, list type,
  effective indexed count and total. The session snapshot preserves this state
  and lowers the indexed count when the snapshot cap is smaller than the live
  read.
- `/settings/moderation` shows a **Partial list index** section with per-list
  counts and explains that unindexed members are unknown, not safe. Followed
  list rows show “X of Y names indexed”.
- Content fails open with a labelled **Some list entries are not indexed**
  reason for authors the viewer does not follow.
- The skin gate fails closed for a partial **mute** list with
  `list-truncated`, unless the follow override applies. A direct follow can
  still win with the normal conflict explanation.
- Blacklist truncation is reported too, but it stays a label concern rather than
  a skin gate.

### 3. Downvote hints are explainable at the threshold

The evidence card already showed voters, targets, count, window and overlap when
a hint appeared. The thresholds themselves were only in the workstream record.

- `/@account/downvotes` now has a **How pattern hints work** disclosure with the
  exact rule: at least 3 distinct voters, 3 shared targets, a 72-hour window and
  at least 60% pairwise target overlap. It repeats that the label is evidence,
  never an automatic action.
- Added a **Minimum weight** filter (1%, 5%, 10%, 25%, 50%).
- Relationship filtering now exposes **followed mute list** and **followed
  blacklist**, matching the values the relationship helper already returned.

### 4. Preset copy no longer claims a safety floor that is not shipped

The Open preset said it would hide only a safety floor. No site-wide
phishing/malware floor is implemented, by design, because it needs its own
visible source and product review. The copy now says Open hides nothing by
preset. A narrow safety floor remains an explicit follow-up, not an implied
behaviour.

## Files

| File | Change |
| --- | --- |
| `src/services/moderationContent.js` | Downvoter evidence, local ignored-voter exclusion, partial-index reason, trimmed override list. |
| `src/services/moderationData.js` | Bounded list snapshot with truncation metadata; context records partial lists. |
| `src/services/moderationPolicy.js` | `LIST_TRUNCATED` skin decision; truncated mute lists fail closed; viewer-context normalisation. |
| `src/stores/moderation.js` | Snapshot/restore `listTruncated`; pass ignored voters and partial indexes into decisions. |
| `src/mixins/moderation.js` | Toggle a specific ignored voter in store and guest policy. |
| `src/components/moderation/ModerationNotice.vue` | Per-voter ignore/unignore controls; partial/ignored evidence labels. |
| `src/components/comment.vue`, `postPreview.vue`, `shortForm/ShortFormCard.vue`, `pages/account.vue`, `pages/post.vue` | Pass the emitted voter through to the shared toggle. |
| `src/pages/moderation.vue` | Partial-index section, followed-list counts, honest Open copy. |
| `src/pages/downvotes.vue` | Threshold explainer, minimum-weight filter, followed-list filters. |
| `docs/performance/budgets.json`, `docs/performance/README.md` | Measured route budget headroom for the shared policy growth. |

## Tests

- `tests/unit/moderation-policy.spec.js` — no voter action without evidence,
  per-voter evidence, local exclusion clearing the label, raw chain weight kept,
  partial-index content reason, partial mute list failing skins closed, follow
  override still winning.
- `tests/unit/moderation-data.spec.js` — snapshot truncation at the list cap,
  exactly-capped lists not marked truncated, partial subscribed list recorded in
  the context.
- `tests/unit/moderation-store.spec.js` — partial index restored from the
  session snapshot and skins failing closed from it.
- `tests/unit/moderation-notice.spec.js` — downvoter controls and the emitted
  voter payload.
- Existing downvote, policy, store, notice and search tests remain green.

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean; theme-token scan clean |
| `bun run test` | 162 files, **1428 tests**, all green |
| `bun run build` | green |
| `bun run perf:check` | all budgets pass after the documented 1–4 KB route-JS headroom |
| `e2e/moderation.spec.js` | 10/10 green against the rebuilt SPA |
| axe | not re-run; no route or landmark structure changed |

Initial JS remains 160 KB. The content-policy growth is confined to the existing
Home/Browse/Post/Search route chunks.

## Follow-ups

- The safety floor landed separately in
  [`W77-safety-floor.md`](W77-safety-floor.md): default-on, source-visible and
  overridable.
- Notification opt-ins remain deferred.
- On-chain list creation and aggregate community signals remain the explicitly
  deferred Phase 3 items.
- A future list-index design (Set-based membership, IndexedDB or a server-side
  index) could support lists above the client cap without a partial-index state.
