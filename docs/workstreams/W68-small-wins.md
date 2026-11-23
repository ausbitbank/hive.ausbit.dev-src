# W68 — Small wins: sats quote, metadata inspector, sats windows

Date: 2026-11-23
Status: implemented and verified locally; production deploy and live smoke pending

## Scope

Three bounded leftovers from the roadmap, issue #93 (dashboard widget
expansion) and issue #82 (composer improvements). No signing, authority or
schema changes.

### 1. HIVE in sats on the Coin prices widget

- The dashboard Coin prices widget footer shows `1 HIVE ≈ N sats` with a bolt
  icon when a BTC quote is available.
- The rate is derived from the widget's own HIVE and Bitcoin rows when both are
  selected, so the default layout adds no network request. When Bitcoin is not
  selected it falls back to the shared `getHivePrices()` 60-second cache.
- Uses the same maths and formatter as the `/markets` Sats quote card and the
  Lightning flows (`satsRatesFromPrices()` / `formatSats()`).
- Fails open: if no BTC quote is available the chip stays hidden and prices are
  unaffected. It refreshes with the widget's own refresh button.
- Settings, snapshots and the configured-widget contract are unchanged.

Completes the W65 Phase 2 leftover "HIVE in sats on the market widget".

### 2. Raw `json_metadata` inspector in the publish review

- The pre-publish review dialog gains a collapsible **Raw json_metadata**
  section and a **Copy JSON** action.
- The preview mirrors `buildPostMetadata` + `stripManagedMetadata`, including the
  edit rule that keeps an existing cover when the draft has no images of its own.
  On an edit, unknown keys written by another client are shown as preserved.
- This is a read-only debug surface: it does not change what is queued or signed.
- Closes the "raw-JSON inspector in the composer" item from issue #82 Phase 5.
  The real-broadcast `get_content` cross-frontend check remains manual.

### 3. Sats received window and largest payment

- The wallet's Lightning "Sats received" card gains **Last 7 days** and
  **Largest** rows.
- `lightningReceivedStats()` now returns `windowDays`, `windowSats`,
  `windowCount`, `largestSats` and `largestAt`, with the same defensive chain
  timestamp parsing used by the creator-stats service.
- The note states the 7-day figure is limited to the wallet rows already loaded,
  so it is not presented as a global Lightning index. Unique supporters are not
  derived because incoming v4vapp rows do not carry the original zapper identity.
- This covers the weekly-total and top-zap part of the roadmap's local
  creator-analytics follow-up.

## Files

- `src/components/HomeMarketCard.vue` — sats chip, local derivation and fallback.
- `src/services/homeMarket.js` — `satsPerHiveFromCoins()` pure helper.
- `src/pages/compose.vue` — metadata preview, copy action, review dialog styling.
- `src/services/lightningStats.js` — 7-day window, largest payment.
- `src/components/lightning/LightningReceivedCard.vue` — new rows and honest note.
- `tests/unit/lightning-stats.spec.js` — window and largest-payment coverage.
- `tests/unit/homeMarket.spec.js` — sats-per-HIVE derivation and fallbacks.
- `e2e/actions.spec.js` — asserts the review dialog shows the queued metadata.

## Verification

- `bun run lint` — clean; theme-token scan clean.
- `bun run test` — 140 files, 1,205 tests passed.
- `bun run build` — succeeded (production SPA, feed and home snapshot).
- `bun run test:e2e -- e2e/actions.spec.js -g "compose writes media, AI, countdown"` — 1 passed.
- Full `bun run test:e2e` — 76 passed, 20 failed, 9 skipped in this environment
  (19 minutes). The failures are live-data/Obscura issues: browser closed during
  editor clicks, empty clipboard reads, and a live image-probe count. Three
  representative failures (compose portrait-cover probe, dashboard reset,
  theme-code export) reproduce identically on the untouched `ea5f859` build in a
  separate worktree, so they are pre-existing. The Chromium suite and CI remain
  the release gate.
- `bun run perf:check` — all budgets passed; home 409.9 KB total. An earlier
  run reported a single flaky `/browse` LCP of 3.8s against a 3.5s budget; the
  unchanged route then measured 2.5–2.7s and no code on this pass touches
  `/browse`.

## Notes

- No new dependency, no new API host, no new background polling.
- No authority changes: the metadata inspector is read-only and the composer
  still queues posting-key operations only.
- Remaining W65 Phase 2 item: a merged "my communities" feed source for the
  posts widget. That needs bounded multi-community reads and is not part of this
  small-wins pass.
- Production deploy and live smoke for W65–W67b remain the outstanding gate.
