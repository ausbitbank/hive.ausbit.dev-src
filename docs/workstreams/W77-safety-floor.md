# W77 — Default-on phishing safety floor

Date: 2026-11-25
Status: implemented; local verification green (not deployed in this pass).

Contract: issue #94. Follows
[`W73-moderation-policy.md`](W73-moderation-policy.md) and
[`W76-moderation-transparency.md`](W76-moderation-transparency.md).

The issue's remaining safety question was answered: the floor is **on by
default** and **collapses** a match. This record covers that implementation.

## Scope

A narrow site-level default for known phishing and compromised accounts. It is
not a general moderation list: it reads one documented public phishing list,
labels every match with its source, and keeps a per-item and per-author
override.

Shipped:

- On by default for guests and signed-in viewers.
- Source: `@hive.blog`'s maintained phishing and hacked-account mute list.
  The source is named in the settings page and on every match; the client only
  reads the public list and never writes to it.
- Known accounts **collapse** in feeds, comments, community feeds and search,
  including the **Open** preset. Profiles and posts the viewer deliberately
  opens are labelled instead of removed, matching the existing deliberate-visit
  rule.
- `Show anyway`, `Always show @author` and the existing per-item override work.
  A follow does not silently beat the safety floor; an explicit viewer override
  does.
- `/settings/moderation` gains a **Phishing safety floor** section with:
  - an on/off toggle, default on;
  - the owner, title, source date and caution;
  - a live "checked" count, partial-index state or failure state;
  - a clear warning when the viewer turns it off.
- The policy is versioned and exported/imported with the rest of the local
  moderation document.
- A `Safety floor` signal is included in the custom per-surface matrix, so a
  viewer who wants only a label can choose `show`; the setting toggle disables
  the signal entirely.

## Data and behaviour

- `bridge.get_follow_list({ observer: 'hive.blog', follow_type: 'muted' })` is
  read through the cached API layer (5-minute TTL, in-flight deduplication).
- The last good list is also persisted locally for up to 30 days and rehydrated
  at boot, so repeat visits are protected before the refresh completes. A stale
  cache is refreshed in the background; a failed refresh keeps the last list
  and shows the failure in settings.
- The list is bounded at 10,000 names; a larger response is marked partial. The
  current source has roughly 956 names.
- Account names are validated before matching. Malformed rows are ignored.
- The read starts at boot through a small dynamically imported chunk so the
  first feed render is normally protected without blocking paint. Guests pay the
  same one cached read.
- Failure fails open: content is shown with the payload signals, and the
  settings page explains that the list could not be checked. Content never
  disappears because the source is unavailable.
- When the list is disabled, no request result is applied to content, but the
  settings source status remains visible.

## Explainability

A match returns a `safety-floor` reason with:

- the list owner (`@hive.blog`),
- the source title and `asOf` date,
- the source total,
- the usual `show-item`, `always-show-author`, `always-hide-author` and
  `manage` actions.

The notice's evidence line reads, for example,
`Source: @hive.blog · as of 2026-11-24`.

## Authorities and safety

- Read-only. No new signing path, queue item or chain write.
- No hidden site-wide ban list: the source, action and toggle are visible in
  settings, and the match itself is visible on the item.
- The floor is intentionally narrow. It should not absorb spam, political,
  social or merely unpopular content; those remain viewer-policy decisions.
- The source list can still be wrong or captured. The override is the
  mitigation, and the source owner remains responsible for list edits and
  appeals. This client does not claim to adjudicate them.

## Files

| File | Change |
| --- | --- |
| `src/services/safetyFloor.js` | Cached public-list read, validated names, reactive state, source metadata. |
| `src/boot/safetyFloor.js` | Early non-blocking read for guests and signed-in viewers. |
| `quasar.config.js` | Registers the safety-floor boot. |
| `src/services/moderationContent.js` | `safety-floor` layer/signal, collapse rules, source evidence. |
| `src/services/moderationSettings.js` | Default-on setting, normalization and export/import. |
| `src/stores/moderation.js` | Per-account toggle, content decision wiring. |
| `src/mixins/moderation.js` | Guest policy default and shared floor state. |
| `src/components/moderation/ModerationNotice.vue` | Source evidence line. |
| `src/pages/moderation.vue` | Safety-floor section, source status, preset copy, matrix label. |
| `docs/performance/budgets.json`, `docs/performance/README.md` | Measured route-budget headroom for the boot-loaded floor chunk. |

## Tests

- `tests/unit/safety-floor.spec.js` — normalization, dedupe, malformed rows,
  malformed response, loading state, failure state, cap/partial state.
- `tests/unit/moderation-policy.spec.js` — collapse in every preset, deliberate
  visit label, show override, disabled setting, custom `show` rule, source
  evidence.
- `tests/unit/moderation-settings.spec.js` — default-on, normalization, older
  policy migration, export/import round-trip with the floor disabled.
- `tests/unit/moderation-store.spec.js` — shared list application and persisted
  toggle.
- `tests/unit/moderation-notice.spec.js` — source evidence line.
- `e2e/moderation.spec.js` — default safety-floor collapse, source details,
  Show anyway and reload persistence; settings toggle, stored value and axe at
  1440px and 390px.

## Verification

| Check | Result |
| --- | --- |
| `bun run lint` | clean; theme-token scan clean |
| `bun run test` | 163 files, **1443 tests**, all green |
| `bun run build` | green |
| `bun run perf:check` | all budgets pass after the documented floor-chunk headroom |
| `e2e/moderation.spec.js` | 11/11 green |
| axe `/settings/moderation` | green at 1440px and 390px |

Initial JS remains 160 KB. The floor's dynamic chunk is about 2–5 KB of route
transfer on every route because guests are protected on any content surface.

## Follow-ups

- Notification opt-ins remain deferred.
- On-chain list creation and aggregate community signals remain the explicitly
  deferred Phase 3 items.
- The source list should be reviewed periodically; the settings source date is
  the visible record of the reviewed catalogue entry.
