# W120 — Failed active broadcast guidance

Date: 2026-11-28
Status: implemented and verified locally

## Scope

An active broadcast can succeed on chain even when its response is lost (closed
wallet, dropped network). The queue marked it failed and offered Retry, which
builds a new transaction. A user could send a transfer twice. W110 removed a
modal warning to stay inside the bundle budget; this slice adds a compact inline
warning instead.

## Behaviour

- A failed **active** queue item now shows “A failed active broadcast may already
  have landed” with a link to the account's public activity page before Retry.
- Posting items are unchanged; a lost posting broadcast is idempotent enough in
  normal use, and the queue already provides retry.
- The warning is inline text, not a modal, so it adds no blocking flow or new
  network read.

## Components

| Area | Files |
| --- | --- |
| Queue UI | `src/components/queue.vue` |

## Authority and privacy

- No signing change. Active retries still require the normal per-item approval.
- The warning points at public account activity, not a server-side status store.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite passing.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- This is guidance, not reconciliation. A full fix would query
  `transaction_status_api.find_transaction` or account history and only re-enable
  Retry when the original operation is proven absent.
