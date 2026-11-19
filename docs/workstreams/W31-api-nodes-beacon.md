# W31 — API node upgrade (beacon parity)

Date: 2026-11-19
Status: complete

## Scope

The `/nodes` page now covers the full public Hive API roster from the Hive Node
Beacon monitor (`https://beacon.peakd.com`) and adds comparison, filtering and
feature information on top of the existing browser probes, latency history and
failover.

## Node roster (`src/services/hiveNodes.js`)

- `HIVE_API_NODES` expanded from 4 to 9 fast, fully-synced nodes and is used by
  the failover client, startup selection and witness-voter fetch.
- `WATCHED_HIVE_NODES` holds beacon-listed nodes that were flaky or limited at
  review time. They are probed and shown but never used as automatic fallbacks.
- `PARTIAL_FEATURE_NODES` marks hosts known to expose only a subset of the API.

## Browser probes (`src/services/hive.js`)

- `probeHiveNode` now also returns `headTime` (chain time of the head block),
  `rpcMs` and `serverVersion` when a node reports them.
- `probeHiveNodeVersion` distinguishes a missing `get_version` method
  (`missing: true`) from a node error and captures `node_type`.
- `probeHiveNodeFull` carries `nodeType` and `versionMissing` through.
- `typicalLatency` computes the median of recent successful samples.
- `isMissingMethodError` (internal) classifies JSON-RPC method-not-found errors.

## Beacon integration (`src/services/beacon.js`, `src/services/network.js`)

- `fetchBeaconNodes` reads `https://beacon.peakd.com/api/nodes` with a timeout
  and always resolves; failures return an empty map so the page works from
  local probes alone.
- `parseBeaconNodes` maps rows by normalised URL and derives uptime.
- Helpers: `beaconStatus`, `beaconEntryFor`, `attachBeacon`, `featureMatrix`,
  `featureLabel`, `featureCoverage`, `coverageLabel`, `featureGaps`,
  `minimumScore`, `headAge`, `formatHeadAge`, `formatPercent`.
- Sorting/filtering: `sortNodes` (latency, head lag, beacon score, version,
  name), `filterNodes` (all, healthy, fallback, problems). Healthy nodes always
  sort before failing ones; ties break on head lag, typical latency, then URL.

## Page (`src/pages/nodes.vue`)

- Probes the fallback roster, the active node and optionally the watched nodes.
- Stat cards add beacon reliability (lowest score among healthy nodes).
- Cards/Compare view toggle.
- Compare view (`NodeCompareTable.vue`) shows status, typical and current
  latency, node type, head, head age, version, beacon score, uptime, app checks
  and advertised features.
- Feature coverage (`NodeFeatureCoverage.vue`) groups nodes by advertised
  feature with per-feature coverage bars.
- Search by host, version or feature; filter and sort controls.
- Automatic selection now prefers fallback nodes and can require account
  history and broadcast when `requireFeatures` is on.
- Beacon data is fetched on mount and refreshed at most every five minutes.

## Preferences (`src/services/nodeHistory.js`)

New keys, persisted under the existing `nodeMonitorPrefs` storage key:
`includeWatched` (default on) and `requireFeatures` (default off). Latency
samples now also store `headTime` and the failure message.

## Verification

- `bun run lint` — clean.
- `bun run test` — 56 files / 455 tests passing, including the new
  `tests/unit/beacon-nodes.spec.js` and probe/version tests.
- `bun run build` — succeeded.
- Headless Chromium smoke against the live beacon API and real nodes:
  - 12 nodes probed, beacon scores, uptime and features shown;
  - feature coverage renders all 11 advertised features;
  - compare view, search (`syncad` → one row), sort and view toggle work;
  - "Use node" switches the active node and survives reload;
  - zero horizontal overflow and zero axe WCAG A/AA violations on both views at
    1440px and 390px.
