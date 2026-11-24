# W73 Phase 3 data spike — lists and community mute reasons

Date: 2026-11-24
Status: complete (read-only probe). No source changes.
Endpoint used: `https://api.hive.blog` (public Hive API node).

This record answers the two unknowns issue #94 flags for Phase 3 and confirms
the Phase 2 downvote sources. It does not add a UI or a write path.

## 1. `bridge.get_follow_list`

### Observed calls

```json
{"jsonrpc":"2.0","id":1,"method":"bridge.get_follow_list",
 "params":{"observer":"ausbitbank","follow_type":"muted"}}
```

Returns an array of:

```json
[{"name":"apshamilton","blacklist_description":"","muted_list_description":""}]
```

`follow_type: "muted"` returned 13 entries for `ausbitbank`. The same call for
`hive.blog` returned **956** entries. `follow_type: "blacklisted"` returned
`[]` for `ausbitbank`. `follow_type: "follow_muted"` returned:

```json
[{"name":"hive.blog","blacklist_description":"","muted_list_description":"Phishing accounts"}]
```

### Findings

- **No pagination.** The documented `limit` argument is rejected:
  `Assert Exception: got an unexpected keyword argument 'limit'`.
- The response is the **entire list** in one call.
- Each row carries `muted_list_description` and `blacklist_description`; for
  `follow_muted`/`follow_blacklist` these describe the subscribed list.
- **Provenance is available for subscribed lists**: owner name + description.
  Member count is only known after reading the owner's `muted`/`blacklisted`
  list.
- Lists can be large (956 rows in one sampled list). A UI must not assume a
  short list.

### Recommendation

- Never send `limit`.
- Cache the full array with a 5-minute TTL and a bounded index (e.g. 10k
  names) for policy membership checks.
- Resolve members only for lists the viewer actually subscribes to, in
  parallel, with a cap (20 lists) and a visible "some list context is
  unavailable" state beyond the cap.
- Do not expose a bulk member table in the first UI; show owner, description,
  member count, and link.

## 2. `bridge.get_relationship_between_accounts`

```json
{"method":"bridge.get_relationship_between_accounts",
 "params":["ausbitbank","hive3"]}
```

Returns:

```json
{"follows":false,"ignores":false,"blacklists":false,
 "follows_muted":false,"follows_blacklists":false}
```

All five states are distinct and can coexist. Use this for a single author,
or the cached following snapshot for card grids.

## 3. Community mute reasons

`bridge.get_ranked_posts` with `sort: "muted"` returned posts carrying:

```json
"stats": {"gray":true,"hide":false,"flag_weight":0,"total_votes":30,
          "muted_reasons":[3]},
"author_role":"guest"
```

`bridge.list_muted_reasons_enum` returned:

| Value | Name |
| --- | --- |
| 0 | `MUTED_COMMUNITY_MODERATION` |
| 1 | `MUTED_COMMUNITY_TYPE` |
| 2 | `MUTED_PARENT` |
| 3 | `MUTED_REPUTATION` |
| 4 | `MUTED_ROLE_COMMUNITY` |

### Findings

- **Per-post reasons are exposed on the muted feed** through
  `stats.muted_reasons`, contrary to the more pessimistic note in issue #94.
- A normal ranked feed (`sort: "created"`) did not include `muted_reasons` on
  the sampled posts, even when `stats.gray` was present. Do not invent a
  reason there; say "greyed by Hive bridge (reason not exposed)".
- `author_role` is present on posts (`guest`, `mod`, etc.).
- `stats.flag_weight` is present and can describe aggregate downvote weight,
  but it is an aggregate, not a voter list.
- `stats.hide` / `stats.gray` remain bridge judgments; a community post mute
  and a reputation mute both surface as `gray`/`hide` on non-muted feeds.

### Recommendation

- Map `muted_reasons` to precise labels when present:
  community moderation, community type restriction, muted parent, low
  reputation, muted community role.
- Otherwise use a generic, honest label.
- Do not parse `mutePost` chain notes for v1; the enum + bridge state is
  enough, and note parsing has no proven reliability or ordering.

## 4. Phase 2 downvote sources (confirmed)

### `condenser_api.get_account_history`

```json
{"method":"condenser_api.get_account_history",
 "params":["hive3",-1,1000,"1",null]}
```

- The bitmask (`"1"`, `null`) filters to `vote` (operation id 0).
- 1000 rows returned, all `vote` ops.
- Vote rows include `voter`, `author`, `permlink`, `weight` and `timestamp`.
- A raw `vote` row has **no** `rshares` or `percent`; classify direction from
  `weight`.
- 98 downvotes were present in the sample.
- The virtual `effective_comment_vote` row (op id 72) shares the block/trx and
  carries `rshares`, `pending_payout` and `total_vote_weight`. Include it in
  the bitmask when historical impact is needed.
- Rows are oldest → newest within a page; page backwards with the first index
  and dedupe by `(trx_id, op_in_trx)`.

`makeBitMaskFilter([0])` from `src/services/hiveOperations.js` produces the
same arguments.

### `condenser_api.get_active_votes`

```json
{"method":"condenser_api.get_active_votes",
 "params":["hive3","buzz-invite-mwsiltrl"]}
```

Returns `{voter, weight, percent, rshares, reputation, time}`. The sample
included a negative vote (`percent: -9900`, `rshares: -1073543807079`), so
up/down context and stake concentration are computable without a backend.

### Recommendation

- Load vote history lazily, cap pages, cache 5 minutes, and never block an
  account page.
- Show raw chain impact next to any "ignored voter" local view.
- Keep the coordination heuristic conservative and evidence-backed; no
  automatic action.

## 5. Residual unknowns

1. Whether `muted_reasons` is populated on every community muted page or only
   some bridge versions. Code must tolerate an absent field.
2. How often a subscribed list changes; the 5-minute TTL is a product choice,
   not an API guarantee.
3. Whether an unsubscribed candidate list's description can be fetched without
   first following it. The sampled API exposes descriptions on
   `follow_muted`/`follow_blacklist` rows; the subscribe UI should show owner +
   member-count preview and reveal the description after subscription.
4. Exact upper bound of a list response. Plan for thousands, not hundreds.

## 6. Reproduce

```bash
curl -s https://api.hive.blog -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"bridge.get_follow_list","params":{"observer":"ausbitbank","follow_type":"muted"}}'

curl -s https://api.hive.blog -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"bridge.get_follow_list","params":{"observer":"ausbitbank","follow_type":"muted","limit":10}}'
# -> Assert Exception: got an unexpected keyword argument 'limit'

curl -s https://api.hive.blog -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"bridge.get_ranked_posts","params":{"sort":"muted","tag":"hive","observer":"ausbitbank","limit":5}}'

curl -s https://api.hive.blog -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"condenser_api.get_active_votes","params":["hive3","buzz-invite-mwsiltrl"]}'
```
