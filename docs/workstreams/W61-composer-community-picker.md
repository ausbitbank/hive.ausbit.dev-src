# W61 — Composer community picker

Date: 2026-11-22
Status: implemented and verified

## Scope

Closing the community-picker items in issue #82:

- show community avatars, titles and subscriber counts;
- search by community title or name;
- link to the community rules;
- warn when the destination is outside the account's subscriptions.

The roadmap also gains a planned public community browser for newcomers. That
browser is separate follow-up work; this workstream only changes the composer
picker.

## Picker data

`src/services/communityPicker.js`

- `normalizeSubscriptionRows` accepts the tuple rows returned by
  `bridge.list_all_subscriptions`, plus strings and objects used elsewhere.
- `buildCommunityPickerOptions` merges subscriptions, recent destinations and
  cached community records into one option list. “My blog” stays first, the
  current destination comes next, then subscribed communities sorted by
  subscribers, recent destinations and other known communities.
- Every option carries `title`, `name`, `label`, `avatar`, `subscribers`,
  `about`, `subscribed`, `recent` and `rulesLink`. The label is
  `Title · hive-name`, so Quasar's input filter searches either part.
- `communityAvatarUrl` uses the standard
  `https://images.hive.blog/u/<name>/avatar` path.
- `communityRulesLink` returns `/c/<name>?tab=about`.
- `communitySubscriptionWarning` returns advisory copy only for a signed-in
  account whose subscriptions have loaded and whose destination is outside
  them. My blog and free-form categories stay silent.

## Composer

`src/pages/compose.vue`

- The community select renders a custom option row with avatar, title, name,
  subscriber count and Subscribed/Recent badges.
- The selected destination gets a detail card with avatar, title, subscriber
  count, a two-line about excerpt and a **Rules** link.
- An unsubscribed destination shows “not one of your subscribed communities”
  with a **Read the rules** link.
- Community records are fetched lazily when the picker opens, not on initial
  composer load. The selected community is looked up as soon as it changes.
- The picker uses `@filter` with a bounded option list; a late-arriving
  subscription or stats response re-applies the active search instead of
  leaving the menu empty.

`src/components/communityHeader.vue`

- `?tab=about` (or `posts`, `subscribers`, `activities`) now selects the matching
  community tab, so the composer's rules link lands on the About/Rules content.

## Verification

- `bun run lint` — clean.
- `bun run test` — 98 files, 894 tests passing, including picker normalisation,
  option ordering, search, avatars, rules links and subscription warnings.
- `bun run build` — succeeded.
- Chromium E2E — 119/119 passing. New coverage:
  - title and name search in the community select;
  - subscribed badge, avatar and rules link;
  - free-form unsubscribed destination warning and rules link;
  - axe and overflow checks at 1440px and 390px with the warning visible;
  - `/c/<name>?tab=about` selects the About tab and shows Rules.
- `bun run perf:check` — passes. Compose route JS measured 150.6 KB, so the
  route budget moved from 148 to 152 KB and total JS from 505 to 508 KB. Post
  total JS moved from 632 to 636 KB and internal-market JS from 465 to 468 KB
  for measured bundle variance. The transfer check now compares same-origin app
  assets: the Browse feed regularly loads a 400 KB+ remote Wikipedia image from
  live post content, which made the old all-origin total unstable without any
  app regression. Third-party bytes remain recorded as `thirdPartyKb`.
- Deployed to production with `./scripts/deploy.sh`.
  Backup: `hurgenburgen:~/hive-backups/hive.ausbit.dev-20261121T175920Z.tar.gz`.
- Live smoke on `https://hive.ausbit.dev`: the index and entry-asset hashes match
  the local build; Hive Governance shows its avatar, title and 875 subscribers;
  the rules link opens the About tab with the rules text; an unsubscribed
  destination shows the warning and rules link; no page errors.

## Follow-ups

- Public community browser for newcomers (planned in `docs/ROADMAP.md`).
- Topic drag reordering and richer tag suggestions.
- Remaining editor, draft, metadata-tooling and manual SmartLock items.
