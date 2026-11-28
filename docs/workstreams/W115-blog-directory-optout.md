# W115 — Blog directory opt-out verification

Date: 2026-11-28
Status: implemented and verified locally; window and error handling updated by W123

## Scope

`GET /api/blogs` returned every Cloudflare KV entry without re-checking the
account's on-chain `claimed && directory` flags. An account that turned the
directory opt-in off could stay visible to non-Banksia consumers until its blog
host was visited or it pressed “Refresh directory listing”.

## Fix

- Directory entries older than six hours are re-verified against the chain when
  the public list is read. A stale entry whose `directory` flag is off is
  deleted; a valid entry is refreshed with a new timestamp.
- Verification is bounded to five concurrent chain reads, and a chain failure
  leaves the existing entry in place rather than deleting a valid opt-in.
- Fresh entries (written by registration or a blog-host visit) are returned
  without a chain request.

## Components

| Area | Files |
| --- | --- |
| Worker | `deploy/cloudflare/metadata-worker.mjs` |
| Tests | `tests/unit/blog-directory-worker.spec.js` |

## Authority and privacy

- No signing change.
- The public directory now enforces the on-chain opt-out for stale entries
  instead of relying on the SPA to hide them client-side.
- A transient chain error is treated as “keep the entry”, not as an opt-out.

## Verification

- `bun run lint` — clean.
- `bun run test` — Worker/directory suites pass.
- `bun run build` — succeeded.
- Targeted Worker tests: **23/23**.
- `bun run perf:check` — passed in an isolated worktree.

## Remaining

- Entries are still keyed in KV rather than derived from a chain index; a
  directory entry can be up to six hours stale before this read-time check.
- A very large directory still verifies in bounded batches; an account that is
  never read and never visits its blog can remain until the next `/api/blogs`
  read.
