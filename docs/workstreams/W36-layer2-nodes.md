# W36 — Layer-2 nodes, Magi settings and contract viewer

Date: 2026-11-20
Status: implemented

## Scope

Issue **#73** asked for the node tool to cover Hive-Engine and Magi, allow the
automatic best-node/failover behaviour to apply to those networks, and add a
Magi node preference to Settings.

The pass also adds the selected Magi follow-ups:

- a read-only Magi consensus/witness panel on `/nodes`
- Magi resource credits, nonce, node mode and consensus stake in the account
  and wallet surfaces
- a read-only Magi contract viewer at `/magi`

## Node rosters (`src/services/hiveNodes.js`)

- `HIVE_ENGINE_NODES` — four automatic candidates:
  `herpc.dtools.dev`, `api.hive-engine.com/rpc`, `api.primersion.com`,
  `enginerpc.com`.
- `WATCHED_HIVE_ENGINE_NODES` — ten additional public hosts from the Hive-Engine
  benchmark reports. They are probe-only and never auto-selected.
- `MAGI_NODES` — the three public GraphQL endpoints documented by Magi/Aioha:
  `vsc.techcoderx.com`, `api.vsc.eco` and `vsc.atexoras.com:2087`.
- Defaults: `DEFAULT_HIVE_ENGINE_NODE`, `DEFAULT_MAGI_NODE`.

There is no public Magi node registry, so the Magi roster stays curated and
users can override it in Settings.

## Probes

### Hive-Engine (`src/services/hiveEngine.js`)

`probeHiveEngineNode(url)` reads the status document at the host root
(`<host>/`) and returns sidechain head, Hive reference block, parsed Hive block,
SSC version, chain ID, light-node flag, disabled methods and last verified
block. The existing `/contracts` client is unchanged.

`selectHiveEngineNode(configuredUrl)` prefers a healthy configured host and
otherwise returns the fastest healthy candidate.

### Magi (`src/services/magi.js`)

`probeMagiNode(url)` runs the lightweight `localNodeInfo` GraphQL query and
returns processed Hive block, running version, git commit, epoch, consensus
version, processing state, consensus line and executor.

`magiEndpointOrder(preferred)` puts `settings.magiApiNode` first and de-dupes
the known fallbacks. Every Magi read uses this order.

New read models:

- `fetchMagiAccountDetails` — RC, nonce, node delegation mode, consensus stake.
- `fetchMagiDelegation(from, to)` — `getConsensusDelegation` edge in HIVE.
- `fetchMagiWitnesses(height)` — registered witnesses at a Hive block height.
- `fetchMagiContract(id)` — active/pending contract metadata and recent outputs.
- `fetchRecentMagiContracts(limit)`.
- `fetchMagiContractState(contractId, keys)` — `getStateByKeys`.
- `simulateMagiContractCall(...)` — read-only `simulateContractCalls`.

## `/nodes`

The page is now a three-network workspace with tabs:

- **Hive L1** — existing beacon, feature coverage, latency history and failover.
- **Hive-Engine** — status probes, sidechain head, Hive block lag, chain ID,
  versions, light nodes and `getStatus` coverage.
- **Magi** — processed head, epoch, consensus version, processing state,
  latency history, consensus/witness table and contract-viewer link.

Shared behaviour:

- per-network cards/compare views, filtering, sorting and latency history
- “Auto-select fastest”, automatic failover and the existing monitor
  preferences apply independently to the selected network
- selecting a node writes `apiNode`, `heApiNode` or `magiApiNode` immediately
- a network query parameter (`/nodes?network=magi`) opens the right tab
- the startup idle selector probes configured layer-2 endpoints; it only
  probes the wider roster when auto-select is enabled or the configured host is
  unhealthy

## Settings

The Network section adds a **Magi API node** dropdown seeded with the known
endpoints. Typing a custom URL adds it to the model via Quasar's
`new-value-mode`, so self-hosted Magi nodes work. The value is persisted as
`magiApiNode` and read by `fetchMagiAccount` immediately.

## Magi tokens (issue #75)

The Magi wallet section now merges standard `magi_token` balances from the
public indexer at `https://indexer.magi.milohpr.com/v1/graphql`:

- balances are keyed by `contract_id`, never by symbol, because test tokens can
  reuse a symbol
- raw integers are divided by `10^decimals` with an exact string formatter so
  large balances do not lose precision
- each row links to the token on Magi Blocks and to the read-only contract
  viewer
- a token index failure shows a small inline notice and does not hide the
  HIVE/HBD balances
- the Magi tab appears for accounts that hold only Magi tokens

The wallet Altera link now points at `https://alterawallet.com`.

## Magi account and wallet surfaces

- `components/account/MagiAccountSummary.vue` adds a sidebar card on account
  pages with Magi RC (used/max), nonce, node mode and consensus stake.
- `wallet/MagiBalances.vue` adds the same compact details strip and a
  delegation lookup (`from` the viewed account to a Magi node account).

## Magi contract viewer (`/magi`)

Read-only page with:

- contract ID search and recent-contract directory
- metadata (owner, creator, code CID, activation, proposer, description)
- pending timelocked updates
- recent contract outputs
- state-key CID reader
- read-only call simulation with posting/active authority choice

The page links to Magi Blocks for the full explorer and never signs or
broadcasts.

## Verification

- `bun run lint` — clean.
- `bun run test -- tests/unit/magi.spec.js tests/unit/layer2-nodes.spec.js` —
  17 tests passed, including Magi token formatting/merging and indexer reads.
- `bun run build` — succeeded.
- Live Chromium smoke against the built SPA:
  - `/nodes` switches between Hive L1, Hive-Engine and Magi
  - Hive-Engine probes all 14 hosts; Magi probes the three endpoints and marks
    `api.vsc.eco` unreachable
  - Magi tab renders 16 registered witnesses and the fast/sync state
  - `/nodes?network=magi` opens the Magi tab
  - Settings accepts and persists a custom Magi URL
  - “Auto-select fastest” writes `magiApiNode` and notifies
  - the wallet requests Magi data from the configured endpoint first
  - `/magi` loads a live contract, shows metadata and simulates a call
  - account sidebar shows Magi RC, nonce, node mode and consensus stake
  - Magi token rows render from the public indexer with decimals applied and
    duplicate symbols kept separate by contract ID
  - the wallet Altera link resolves to `alterawallet.com`
- axe WCAG A/AA clean at 1440px and 390px on `/nodes`, `/nodes?network=magi`,
  `/magi`, `/@ausbitbank` and `/@ausbitbank/wallet`. The shared `DataTable`
  scroll container is now keyboard-focusable with an accessible region name.
