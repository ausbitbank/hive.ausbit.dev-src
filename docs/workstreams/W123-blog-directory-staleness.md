# W123 — Faster directory opt-out and chain-error safety

Date: 2026-11-28
Status: implemented and verified locally

## Scope

W115 re-verified stale `/api/blogs` entries against the on-chain opt-in, but the
window was six hours. It also claimed that a chain error kept the entry; in
practice every directory write used the tolerant `rpc()` helper, which returns
`null` when all nodes fail, and `verifyBlogDirectory` treated that as “not
listed”. A node outage could therefore delete valid directory entries.

## Behaviour

1. **The re-verify window is 30 minutes** (was 6 hours). An opted-out account
   disappears from the public directory on the next `/api/blogs` read after the
   window, instead of potentially most of a day later.
2. **Directory verification distinguishes “no” from “no answer”.** A new strict
   RPC helper throws when every configured node fails. A failed lookup keeps the
   existing entry; only a successful chain answer that says the directory flag
   is off deletes it.
3. **`POST /api/blogs/register` fails closed on a chain outage** with `503` and
   leaves the stored entry untouched, rather than reporting a false opt-out.
4. **Bounded concurrency is unchanged** at five chain reads, and fresh entries
   (written by registration or a blog-host visit) are still returned without a
   chain request.
5. The public list response keeps `cache-control: public, max-age=60`.

## Components

| Area | Files |
| --- | --- |
| Worker | `deploy/cloudflare/metadata-worker.mjs` |
| Tests | `tests/unit/blog-directory-worker.spec.js` |

## Authority and privacy

- No new inputs, signing or key handling.
- The directory remains a cache of the public on-chain `claimed && directory`
  flags; the Worker still has no moderation list and no server key custody.
- A chain outage is now explicitly “keep the entry”, matching the W115 intent.

## Verification

- `bun run lint` — clean.
- `bun run test` — full suite green (see `docs/ROADMAP.md`).
- Worker directory suite — 9/9, including window timing, opt-in refresh,
  chain-failure retention, register `503` and bounded concurrency.
- `bun run build` — succeeded.
- `bun run perf:check` — passed in this isolated worktree.

## Remaining

- KV entries are still a cache rather than a chain-derived index. An account
  that opts out propagates within 30 minutes plus the 60-second edge cache, or
  immediately when it presses “Refresh directory listing”.
- Deploying the Worker is a separate release step; this record covers the local
  code and tests only.
