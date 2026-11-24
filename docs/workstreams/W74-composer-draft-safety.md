# W74 — Composer autosave control, leave guard and draft rename

Date: 2026-11-24
Status: implemented, deployed and live-smoked.

Issue: <https://github.com/ausbitbank/hive.ausbit.dev-src/issues/82>. Follows
[`W70-composer-editor-polish.md`](W70-composer-editor-polish.md), which deferred
the autosave toggle until an unsaved-changes flow existed.

## Scope

Three draft-safety gaps from the composer backlog:

1. an autosave on/off setting, default on;
2. an in-app and tab-close guard when autosave is off or the last save failed;
3. rename for any local draft.

No draft schema, signing, authority or publish-path change. Drafts remain v3 and
the queue is untouched.

## Autosave setting

- Stored as `composeAutosave` in local storage; default is on.
- The editor settings dialog gains an **Autosave drafts** row with a plain
  explanation of the trade-off.
- Turning autosave off saves the current draft once before disabling, so the
  switch itself cannot discard work. Turning it back on resumes the 700 ms
  debounce and marks any remaining difference dirty.
- The save chip reads “Unsaved changes — autosave off” while the setting is off
  and the draft differs from the last stored copy.
- `scheduleAutosave`, `flushAutosave`, tab hide and unmount all respect the
  setting. The explicit **Save** button and publishing still work normally.

## Leave guard

- `beforeRouteLeave` runs for in-app navigation.
- With autosave on it flushes synchronously; a successful flush continues the
  navigation without a prompt.
- With autosave off, or when the flush fails (for example storage is full), a
  persistent dialog offers:
  - **Save and leave** — save, then continue; stays on failure;
  - **Leave without saving** — continue and keep the last stored copy;
  - **Stay** — abort the navigation.
- Closing or reloading the tab with autosave off and unsaved changes sets
  `beforeunload`, so the browser asks first. With autosave on, the same handler
  flushes silently as before.
- Leaving with no content, or with draft content equal to the last stored
  snapshot, never prompts. Queuing a post leaves a blank draft, so the
  post-publish navigation is unaffected.

## Draft rename

- Every draft row gains a rename button with an accessible label.
- The dialog edits the local draft title (the post title used by the publish
  path) and rejects an empty title or one longer than 255 characters.
- Renaming an inactive draft updates its stored copy.
- Renaming the active draft updates the editor title immediately; with autosave
  on it silently saves the current state, and with autosave off the change stays
  dirty so the leave guard protects it.
- Renaming does not append a draft-history snapshot or duplicate the draft.

## Files

- `src/pages/compose.vue` — setting row, watcher, guard, beforeunload, dialogs,
  rename methods and dirty predicate.
- `e2e/actions.spec.js` — autosave/guard/discard flow and rename flow.
- `e2e/a11y.spec.js` — axe checks for both new dialogs at 1440px and 390px.

## Verification

Verified in a clean worktree at commit `7a17928` because another process was
editing dashboard files in the shared checkout. The worktree contained only this
workstream's commit.

- `bun run lint` — clean; theme-token scan clean.
- `bun run test` — 154 files, 1,360 tests passed.
- `bun run build` — succeeded.
- `bunx playwright test e2e/actions.spec.js --project=chromium -g "autosave toggle|renames a local draft|autosaves and restores"` — 3 passed.
- `bunx playwright test e2e/a11y.spec.js --project=chromium -g "compose unsaved-changes"` — axe clean for both dialogs.
- Obscura targeted run of the two new action tests — 2 passed.
- `bun run perf:check` — all budgets passed.

## Deployment

Deployed on 2026-11-24 from commit `7a17928` with `scripts/deploy.sh` run in the
clean worktree.

- Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261124T073948Z.tar.gz`
  (`sha256 22cb0c7e…a20593`).
- Rollback: `./scripts/rollback.sh ~/hive-backups/hive.ausbit.dev-20261124T073948Z.tar.gz`.
- Production `index.html` SHA-256 `a43dbd40…697c9` matches the clean build.
- Live Chromium smoke on `/compose`:
  - autosave off, edit, then leaving showed “Unsaved changes” with Stay, Leave
    without saving and Save and leave;
  - Stay kept `/compose` and the unsaved body;
  - Leave without saving navigated home and the reloaded draft still had the
    last saved body;
  - renaming the draft updated the editor title and the stored draft;
  - no page errors.
- Live HTTP: `/`, `/compose` and `/market` return 200.

## Notes and follow-ups

- The guard deliberately does not prompt while autosave is on and a flush
  succeeded; that matches the autosave promise and keeps normal navigation
  quiet.
- A separate trash view is still not added; archive/restore already covers the
  “keep it but get it out of the list” case. Rename closes the last missing
  basic draft action from #82.
- Visual WYSIWYG editing, gallery insertion, cross-post attribution polish and
  metadata verification remain separate #82 items.
