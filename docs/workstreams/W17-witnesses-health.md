# W17 — Witnesses, network health and API nodes

Date: 2026-11-18
Status: complete

## Scope

Priority 2 rebuild: the witness directory, witness editing, the network health
dashboard and API node status. All four pages use the existing design tokens,
`.home-card` / `.home-panel` card language, one page-level `h1`, and section
`h2` headings.

## Witness directory (`/witnesses`)

`src/pages/witnesses.vue` replaces the old embedded `components/witnesses.vue`
card. The page loads the top 200 witnesses by approval, adds any voted witness
outside that list, and renders a searchable, sortable directory.

- Search by witness name, URL, version, hardfork vote or account fee.
- Sort by rank, votes, missed blocks, price-feed age, version, name or warning
  count, with ascending/descending direction.
- My-votes view with an x/30 vote-slot counter.
- Vote and unvote through the signing queue with active authority.
- Voting proxy dialog with account-name validation, setting and clearing.
- Vote-weight calculator showing effective HP, share of network HP, vote slots,
  top-20 cutoff and projected rank/support for a selected witness.
- Health warnings for signing disabled, stale price feed, missed scheduled
  blocks and consensus version mismatch. Cumulative missed blocks stay visible
  in the row metadata but do not create a warning on their own.
- Expandable witness details with raw JSON, URL, registration age, last
  confirmed block, price feed, hardfork vote, APR and profile links.
- URL query state for search, sort, direction, my votes and warnings-only.

Backup witnesses are not flagged for a missed signing slot because they are not
scheduled; the missed-slot check only applies to the top-21 consensus set.

### Components

| File | Responsibility |
| --- | --- |
| `src/pages/witnesses.vue` | Data loading, filters, vote/proxy queue actions, dialogs |
| `src/components/witness/WitnessHeader.vue` | Page title, summary stats, my-votes/proxy/tools actions |
| `src/components/witness/WitnessFilters.vue` | Search, sort, direction, my-votes and warnings filters |
| `src/components/witness/WitnessRow.vue` | Rank, badges, health warnings, vote/unvote and expandable details |
| `src/components/witness/WitnessVoteCalculator.vue` | Vote-weight and top-20 impact calculator |

## Witness editing (`/witness`)

`src/pages/witness.vue` was rebuilt as a proper settings page:

- Logged-out, loading and not-a-witness states share the standard empty/state
  card patterns.
- Live witness status cards: rank, approval, missed blocks, price feed, signing
  key and version health.
- Editable public identity, chain parameters and advanced subsidy settings with
  inline validation.
- Labelled public signing keys saved locally in the browser, with one-click
  switching, duplicate-label updates and deletion. Only public keys are stored.
- HBD interest is entered as a percentage and converted back to chain basis
  points; maximum block size is range-checked against the chain limits.
- Transaction preview shows the exact `witness_update` payload and a copyable
  `cli_wallet` command.
- Reset changes, queue update, register a new witness and disable signing with
  explicit confirmation.
- Authority is stated on the page and on the action area: witness operations
  require the active key.

## Network health (`/health`)

`src/pages/health.vue` replaces the old widget stack with a dashboard:

- Overall health banner with alert summaries and last-updated time.
- Witness participation (128-block window, 21 scheduled seats).
- HBD debt ratio using treasury-excluded HBD and the HIVE median price, with
  the 20% soft and 30% hard limits.
- HIVE median price and feed range.
- Vesting resource pool, total VESTS, HP per 1M VESTS and account-subsidy pool.
- Hardfork status, required witnesses and chain/consensus version drift.
- Chain state: head, last irreversible block, account count, HBD print rate,
  HBD savings APR, block interval and latest irreversible block links.
- Scheduled witness list with per-witness health warnings.
- API latency summary (healthy count, fastest node, average latency, head lag,
  versions) with a link to `/nodes`.

## API nodes (`/nodes`)

`src/pages/nodes.vue` and `src/components/nodes/NodeStatusRow.vue` replace the
old small node picker:

- Probes every configured node for head, latency and software version.
- Healthy/unreachable, head lag, version and mismatch badges.
- Per-node latency sparkline, sample count, min/max and trend from the last 24
  checks, persisted locally.
- Automatic re-check every 30 seconds so latency history grows while open.
- Manual node selection, “Auto-select fastest” and per-node use actions.
- Automatic failover when the active node is unreachable or behind.
- Optional auto-select-fastest preference, stored separately from account
  settings.
- Version comparison against the chain config build.

## Services

| File | Responsibility |
| --- | --- |
| `src/services/witnesses.js` | Health checks, search/sort/filter, vote weight, vote impact, proxy/form validation, update payloads and active-authority queue builders |
| `src/services/network.js` | Median price, HBD debt ratio, participation, resource pool, chain versions, node summaries, failover selection and status formatting |
| `src/services/nodeHistory.js` | Local latency history and node monitor preferences |
| `src/services/witnessKeys.js` | Label validation, saved-key collection and local persistence for public signing keys |
| `src/services/hive.js` | Added `probeHiveNodeVersion` and `probeHiveNodeFull` |

Removed the unused legacy `src/components/witnesses.vue` and
`src/components/nodes.vue` after migrating all callers.

## Queue authorities

| Action | Authority |
| --- | --- |
| Witness vote / unvote | active |
| Voting proxy set / clear | active |
| Witness update / registration / disable signing | active |

After a witness vote, proxy or update broadcast, the queue now refreshes the
affected account so the UI reflects the new votes/proxy.

## Verification

- `bun run lint` — clean.
- `bun run test` — 23 files / 188 tests passing (46 new tests across witness,
  network, node-history and saved-key helpers).
- `bun run build` — succeeded.
- Headless Chromium smoke:
  - one `h1` and zero horizontal overflow on all four pages at 1440px and
    390px;
  - witness search narrows the 200-row list correctly;
  - logged-in vote and unvote both queue `account_witness_vote` with active
    authority and correct approve values;
  - proxy dialog queues `account_witness_proxy` with active authority, then
    blocks direct votes and shows the proxy note;
  - witness edit loads live data for a registered witness, validates the form,
    previews JSON/CLI and does not broadcast during smoke;
  - saving two labelled public keys, switching between them, deleting one and
    reloading keeps the saved-key list and transaction preview in sync;
  - witness feed ages render as “40 minutes ago”, not “in 40 minutes”;
  - health shows 100% participation, the live debt ratio, median price,
    resource pool, chain versions and 21 scheduled witnesses;
  - nodes show 4 healthy nodes, head lag, versions, auto-select updates the
    active API node, and the 30-second re-check produces latency history and
    sparklines.
- Axe WCAG A/AA: zero violations at 1440px and 390px on `/witnesses`,
  `/witness`, `/health` and `/nodes`, including with a witness detail row
  expanded.
- Deployed with `./scripts/deploy.sh` and live-smoked.

## Notes

- The witness directory ranks the top 200 by approval. Voted witnesses outside
  that list are fetched separately so “My votes” is complete.
- Health warnings distinguish critical (signing disabled) from warning (stale
  feed, missed scheduled slot, version mismatch). Backup witnesses are not
  warned for not signing.
- Latency history is browser-local and capped at 24 samples per node. The node
  monitor preferences use their own storage key so saving the existing account
  settings panel does not reset them.
- Saved signing keys are public keys only, stored under the browser-local
  `witnessSigningKeys` key. They are never queued or broadcast on their own.
