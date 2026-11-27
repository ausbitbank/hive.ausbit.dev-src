# Banksia roadmap

Last updated: 2026-11-27

This is the active roadmap. It lists the work that is still open and the
principles that constrain it. Delivered work and its verification records live in
[`docs/workstreams/`](workstreams/README.md) and are not repeated here.

## Current snapshot

- The 2026 revamp is deployed at <https://banksia.io>; the legacy
  <https://hive.ausbit.dev> host serves the same build.
- The latest shipped slice covers local-first moderation (W71–W78), the
  user-selectable image proxy (W79), post quick look and feed position
  restoration (W80), the Banksia rebrand and banksia.io cutover (W81), CSP
  reporting, vhost hardening, dependency updates, the repaired E2E suite, the
  profile metadata editor with image uploads (W83), and account blogs on
  `*.banksia.io` (W84).
- W84 is deployed: `*.banksia.io` resolves, the `banksia-metadata` Worker
  proxies the apex shell and serves blog metadata, RSS, sitemap, robots, the
  opt-in directory API, themed OG fallbacks and generated social cards, and the
  new SPA is live. A real claim has been tested and works, and the blog axe
  suite passes; custom domains remain.
- W85 adds blog customisation parity and expansion: reader Light/Dark/System,
  five themes with opposite-mode variants, grid/list/magazine layouts, page
  width, typography, hero style, custom navigation, tags/reading-time toggles
  and accessibility preference support.
- W86 gives blog owners final control over the subdomain presentation: a
  block-based section builder (hero, pinned, archive, about, contact, text),
  sanitised custom CSS, custom logo/hero/favicon, and a 12 KB blog object.
- W87 adds the blog portfolio and Hive Open Market shop: a curated image
  gallery with a full-screen viewer, a product catalog from `content_type:
  "product"` posts, and a `/pay` handoff that derives the amount and purchase
  memo from chain data and queues an approved transfer on the apex.
- W88 makes the blog shop owner-usable: market-api discovery with chain
  fallback, tag/featured/filter/sort/search storefront, product detail pages
  with Product/Offer JSON-LD, a Product mode in the composer, a local cart,
  per-product checkout, and `/orders` reads of purchases, sales and
  subscriptions. The blog stays read-only; every payment and cancellation is
  queued on the apex for wallet review. The protocol reference, honest
  limitations, non-goal justifications and the plan for escrow, reviews,
  shipping, fiat on-ramps and independent indexing live in
  [`docs/HIVE_OPEN_MARKET.md`](HIVE_OPEN_MARKET.md).
- W89 adds Banksia Vault: a single-tier, text-only, self-sovereign beta for
  members-only blog content. A creator can lock a section or a whole post,
  publish a Hive Open Market membership product and a hidden grant container,
  and issue posting-key-signed bulletins that wrap a per-period ring key to each
  reader. Content is AES-256-GCM with P-256 ECDH + HKDF-SHA256 via WebCrypto;
  payments are direct HBD recurrent transfers with a 0% platform fee. The blog
  stays read-only and custom domains deep-link premium reads to the apex. W89
  is **deployed and fully live-smoked**: product/container, premium post,
  0.001 HBD payment, signed grant, desktop/mobile unlock, expiry, restore, a
  second reader key, and a real HF28 cancel were all verified on `ausbit.vsc` /
  `ausbitclank`. See
  [`docs/workstreams/W89-premium-memberships.md`](workstreams/W89-premium-memberships.md).
- W91 makes the shop Vault-aware: membership products are labelled and routed
  to `/subscribe` so the reader key is attached, `/pay` and cart checkout refuse
  a generic membership transfer, and `/orders` links membership management to
  `/subscriptions`. No Vault crypto, metadata or grant code changed. See
  [`docs/workstreams/W91-shop-vault-integration.md`](workstreams/W91-shop-vault-integration.md).
- Local verification on 2026-11-27 at the W89 gate: `bun run lint` clean,
  `bun run test` green with **2,093 tests across 218 files**, `bun run build`
  succeeded, and `bun run perf:check` passed after a documented re-baseline.
  `e2e/vault.spec.js` passed **8/8** in Chromium with axe clean at 1440×900 and
  390×844 for the locked post, `/subscribe`, `/settings/blog/vault` and
  `/subscriptions`. The full Chromium suite ran **197 passed / 4 failed**; the
  four failures (badges shelf, login-key guide, header lockup, profile-skin
  scope) reproduce identically on pre-W89 `master` 8351c92 and are not Vault
  regressions. The Vault spec is excluded from the fast Obscura suite because
  it needs real IndexedDB/WebCrypto keys and axe.
- The full Chromium suite and the performance budgets are the CI release gate.
  The fast Obscura suite is the local loop; its current CDP build does not
  expose intercepted POST bodies and has pre-existing timeouts in this
  environment, so the network-mocked HOM and Vault E2E run under the full
  Chromium config.
- The next free workstream number is **W92**. **W90** remains reserved for the
  optional self-hosted Vault relay prompt in `docs/prompts/`.

## Vision

Make Banksia the fastest, most trustworthy Hive explorer for people who
use the chain every day: quick to open, resilient on weak or dead API nodes,
comfortable on mobile, and deep enough for governance, discovery and publishing
workflows.

## Product principles

1. **Fast by default.** Measure before changing. Enforce route and bundle budgets
   in CI. Prefer fewer requests, smaller payloads and progressive loading.
2. **Reliable under failure.** Every network path has a timeout, a fallback and a
   clear stale/error state. A dead node must not become a dead page.
3. **Evidence over guesses.** New behaviour gets unit tests, E2E coverage where it
   matters, and axe checks at desktop and mobile widths.
4. **Least privilege.** Posting keys stay posting; active actions stay active.
   Signing intent must be visible before broadcast.
5. **Accessible and mobile-first.** One page-level `h1`, semantic tables, visible
   focus, reduced-motion support and no horizontal overflow.
6. **Local-first by default.** Dashboards, drafts, appearance and moderation
   policy stay in the browser. There is no hidden global ban list.
7. **No unbounded scope.** Each workstream ships independently with a documented
   verification record.

## North-star metrics

| Area | Target |
| --- | --- |
| Initial route JavaScript | Keep the initial bundle below the CI budget |
| Route chunks | Each route-owned chunk stays within its budget |
| LCP / INP / CLS | LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1 at p75 |
| API reliability | p95 read latency ≤ 1.5s; failed-request rate < 1% |
| Cache efficiency | > 70% of repeat reads served without a network call |
| Resilience | Dead-node failover, offline shell and queue survive smoke tests |
| Accessibility | Zero axe WCAG A/AA violations on key routes at 1440px and 390px |
| Quality gate | Lint + unit + E2E + build + live smoke green for every workstream |

## Open work

The items below are the remaining work that is not fully verified or explicitly
deferred. Optional ideas are labelled so they are not mistaken for commitments.

### 1. HiveAuth physical-device matrix — W72

The client-side resume, reconnect and queue behaviour are implemented, deployed
and covered by mocked tests. What remains is the repeatable hardware run:

- Tier 1 devices: Keychain Mobile on Android and iOS, Safari iOS, Chrome
  Android, desktop Chrome/Firefox with QR.
- Login, vote, comment, transfer, image upload, keepsats, rejection, timeout,
  session expiry and a 3-action auto-send.
- Record build SHA, device/OS/browser, wallet version, network and background
  duration for each run.

Record: [`docs/workstreams/W72-hiveauth-resume.md`](workstreams/W72-hiveauth-resume.md).

### 2. Composer follow-ups — issue #82

The main composer workflow is shipped: drafts and history, autosave control,
leave guard, rename, media upload and embeds, snippets, templates, reminders,
community picker, checklist and publishing review. Remaining items:

- The optional visual WYSIWYG editor with Markdown/Visual/HTML parity.
- Gallery/grid media insertion and richer media types (3Speak upload, GIF
  picker).
- Post analytics.
- A real cross-client metadata broadcast check with `condenser_api.get_content`
  and another frontend.

Cloud/shared drafts and true scheduled publishing are **not** planned: both need
server-side key custody, which conflicts with the local-first signing model.

### 3. Optional moderation work — issue #94

W71 and W73–W78 shipped the policy engine, downvote transparency, list
subscriptions, the phishing safety floor, community context and the local
overrides. The following remain explicitly optional:

- On-chain list creation from the local list directory.
- Cross-account aggregate downvote signals and third-party labelers.
- Notification opt-ins.

W75 already delivered the per-row Show anyway override in search; any new
moderation surface should reuse the same explainability and override pattern.

Non-goals: a hidden global list, automatic punishment from heuristics, or a
global downvoter leaderboard.

### 4. Lightning operator checks — issue #87

The bridge client, keepsats reads, on-chain keepsats actions, POS/zaps, search
and tax legibility are implemented and covered by unit/E2E tests. Remaining
operator work:

- A live smoke of a small keepsats deposit, conversion and payment.
- Apply the checked-in vhost update that adds `/@account/pos` to the SSI
  metadata route; the repository line exists, so this is only a host reload.
- Repeat the HiveAuth matrix above for the Lightning signing paths.

Records: [`W54`](workstreams/W54-keepsats-onchain-actions.md),
[`W55`](workstreams/W55-pos-zaps.md),
[`W58`](workstreams/W58-keepsats-send-summary.md).

### 5. Research: the KE accountability ratio — issue #86

Investigate whether the KE accountability ratio — `(author + curation rewards) /
staked HP` — adds useful signal without becoming another opaque score. The
research already notes that it ignores witness, proposal and staking income,
beneficiary splits and legitimate reasons rewards leave the account. This is
research only: no UI or API commitment until the data source and its failure
modes are understood.

### 6. CI and delivery hygiene

- Upgrade `@playwright/test` beyond the current 1.58.x pin and then remove the
  `ubuntu-24.04` runner pin once the new version ships dependency mappings for
  the current image.
- Keep action versions pinned by SHA, Node and Bun pinned in CI, and Dependabot
  branches out of duplicate push runs.
- Make the build and performance checks deterministic enough for a PR gate.
  The home snapshot, feed and route measurements currently read live Hive and
  market hosts; either stub those hosts in CI or treat live-latency budgets as
  advisory while keeping bundle-size budgets blocking.
- Verify the deployed site after a deploy with `bun run verify:deploy`.

### 7. Account creation follow-ups — W82

The static signup and claim-link phase is implemented: `/join`, `/join/keys`,
`/create`, `/create/claim` and `/create/batch`, with public-key-only links and
no stored active authority. Remaining work:

- Test the multi-operation `create_claimed_account` batch signing against Hive
  testnet before using it with live account tokens.
- Run one small live Hivedex payment smoke (invoice → pay → account → status)
  before advertising the paid flow.
- Add opt-in `delegate_rc` / `delegate_vesting_shares` after account creation.
- Keyless Worker queue deferred by the operator; the static batch page is the
  current substitute.
- Later experiments: Butter Auth Google/GitHub/Discord signup and v4vapp
  Lightning onboarding.
- Publish a recovery-account policy before advertising the free pool.

Record: [`W82`](workstreams/W82-account-creation.md).

### 8. Blog hosting follow-ups — W84

The free account blog at `<account>.banksia.io` is deployed for public
previews, and the claim flow is verified. Remaining work:

- Custom domains via Cloudflare for SaaS custom hostnames, with a verification
  UI. Keep custom-domain blogs read-only for signing and premium reads on the
  apex.
- Canonical policy for the duplicate: the apex
  `banksia.io/@author/permlink` page still canonicalizes to itself, so a
  claimed blog post exists at two URLs. Decide whether the apex post should
  canonicalize to the blog or both should remain indexable.
- Decide whether unclaimed previews stay public or become claim-only after the
  first abuse report.

Record: [`W84`](workstreams/W84-blog-hosting.md).

### 9. Optional blog customisation follow-ups — W85

W85 shipped reader mode, layouts, width, typography, hero style, custom nav,
tags/reading time and two more themes. Explicitly deferred:

- Side navigation and a per-post layout override.
- Portfolio/gallery pages and a products/shop page.
- Localization of interface strings; posts stay in their own language.
- A full axe pass for every theme and both variants (token contrast is already
  validated for all variants; the E2E covers Paper light/dark).

Record: [`W85`](workstreams/W85-blog-customisation.md).

### 10. Optional blog owner-control follow-ups — W86

W86 shipped page sections, custom CSS and branding. Explicitly deferred:

- Side navigation and a per-post layout override.
- Portfolio/gallery and products/shop pages.
- Custom domains (W84). Premium entitlements are tracked in W89.
- A full axe matrix for every theme and both variants.
- Custom JavaScript is a non-goal: the blog stays read-only and signing stays on
  `banksia.io`.

Record: [`W86`](workstreams/W86-blog-owner-control.md).

### 11. Optional portfolio/shop follow-ups — W87/W88

W87 shipped the curated portfolio and the first Hive Open Market catalog. W88
shipped the owner-usable shop (catalog filters, product pages, authoring, cart,
checkout and orders). Explicitly deferred or out of scope:

- Escrow, shipping calculation, fiat checkout, reviews and buyer protection.
  The open-market MVP has none of these; every payment surface warns and relies
  on direct transfers.
- Automatic portfolio inclusion via a post flag and topic filters.
- A background subscription scheduler or any server-side order database. The
  cart is local and orders are re-read from public history.
- Order history beyond the most recent 3,000 account-history rows.
- Full axe matrix for every theme and both variants.
- The canonical HOM spec still has no versioned RFC; re-check the reference
  backend before changing metadata semantics.

Records: [`W87`](workstreams/W87-blog-portfolio-shop.md),
[`W88`](workstreams/W88-shop-refinements.md).

### 12. Banksia Vault follow-ups — W89

W89 shipped the self-sovereign membership beta: single tier, text-only,
keyring/full archive, locked section and whole post, HOM product plus hidden
container, AES-256-GCM/P-256/HKDF, 0% fee. Remaining work:

- Fix the current build blocker: `src/pages/compose.vue` imports
  `hasVaultMarker`/`vaultMarkerIndex` from `vaultPayload.js` instead of
  `vaultCompose.js`. Then deploy, `bun run verify:deploy`, record the backup
  path, and complete the live smoke (enable, publish, pay, unlock, reload,
  expire, cancel, restore).
- Bind bulletin signers to the blog (or implement delegation verification)
  before public launch; see the open risks in the W89 record.
- Relay and delegated signing so a reader can be granted while the creator is
  offline.
- Encrypted media (encrypted blobs or signed URLs); v1 is text-only and media
  URLs leak.
- Multi-tier, trials, gifts/claim codes, annual and lifetime plans.
- Bulletin splitting for large subscriber lists (schema reserved, not shipped).
- Reader-key registry and multi-device wrapping (schema exists, UI post-MVP).
- Verify the HF28 zero-amount cancel matching rule on Hive testnet before
  treating the cancel button as shipped.
- Run Agent F's E2E/axe suite and record the results.

Record: [`W89`](workstreams/W89-premium-memberships.md). Protocol:
[`docs/integrations/vault-protocol.md`](integrations/vault-protocol.md).

## Deferred and non-goals

- No server-side proxy for the v4v.app bridge; CORS is live and a proxy would
  only add a hop.
- No auto-broadcast of active-key actions and no key custody server.
- No global moderation list, automatic punishment or global downvoter
  leaderboard.
- No site-wide algorithmic feed that cannot be inspected or turned off.

## Definition of done

Every workstream must include:

- A `docs/workstreams/W*-*.md` record with scope, components, authorities,
  verification and notes.
- `bun run lint`, `bun run test`, `bun run build` and `bun run test:e2e:full`
  green (use the fast Obscura suite for the local loop).
- Axe checks at 1440px and 390px for affected routes.
- A browser smoke of the key flows, including stale/error states.
- Deploy with `./scripts/deploy.sh` and a live production smoke.
- Unit/E2E test counts, build/deploy status and backup path reported.
- Commit and push to `origin/master`, with a clean working tree.

## Standards

- Vue 3 + Quasar 2 + Vite.
- Design tokens and `.home-card` / `.home-panel` patterns.
- One page-level `h1`; section headings are `h2`.
- Sanitized UGC and `noopener noreferrer` on external links.
- Posting/active queue authorities preserved exactly.
- Expandable raw JSON on explorer pages.
- Shared UI primitives under `src/components/ui/`.
- Central API client and cached read layer for chain data.
- Visibility-aware polling; no background polling without intent.
- Prefer semantic tables, real buttons and keyboard-operable surfaces.
- Update [`docs/SECURITY.md`](SECURITY.md) when the header or key model changes.

## Suggested new-session prompt

> Read `docs/ROADMAP.md` first. Open work is listed there; completed features and
> their verification records are in `docs/workstreams/`.
>
> Pick one open item, give it the next free W-number if it becomes a workstream,
> and write its `docs/workstreams/W*-*.md` record alongside the code.
>
> Follow the standards in this roadmap: design tokens, one page-level `h1`,
> posting/active authority correctness, sanitized UGC and `noopener noreferrer`.
>
> Run `bun run lint`, `bun run test`, `bun run build` and `bun run test:e2e`
> locally, then the full Chromium suite before release; run
> axe at 1440px and 390px, smoke the key flows, deploy with
> `./scripts/deploy.sh`, and live-smoke production. Update `docs/workstreams/`
> and this roadmap, report unit/E2E counts, build/deploy status and backup path,
> then commit and push the verified work with a clean working tree.
>
> Do not redo finished workstreams except for integration fixes.
