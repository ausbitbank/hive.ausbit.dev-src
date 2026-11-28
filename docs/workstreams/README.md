# Workstream records

Each substantial change to hive.ausbit.dev is delivered as a numbered
workstream. A workstream record captures the scope, the components and
authorities it touches, the verification that was run and any known limits. The
records are implementation history, not a promise that every follow-up is
finished; open work lives in [`docs/ROADMAP.md`](../ROADMAP.md).

## How to read a record

- **Status** near the top of a record reflects the state at the time it was
  written. Later records can supersede an earlier follow-up.
- **Verification** lists the checks that actually ran. A local pass is not the
  same as a deployment or a live smoke, and the records distinguish them. Test
  counts are from the worktree and branch used at that time; the current count
  lives in [`docs/ROADMAP.md`](../ROADMAP.md).
- **Open work** at the end of a record lists items that were deliberately
  deferred. Those items are only current if they also appear in the roadmap.

## Writing a new record

Give the workstream the next free number, use
`docs/workstreams/W<n>-<short-slug>.md`, and include: scope, affected routes and
components, authority and privacy impact, verification (lint, unit, build, E2E,
axe and live smoke as applicable), and remaining work. Update the roadmap in the
same change.

## Numbering collisions

Prefixes are not unique in a few places because parallel workstreams were
delivered independently. The filename disambiguates them:

- **W6** — package additions and tests/CI.
- **W7** — proposals parity and its implementation log.
- **W36** — layer-2 nodes and the Lightning bridge.
- **W62** — HiveAuth signing and the public community browser.
- **W65** — dashboard widget expansion and profile identity.
- **W73** — the moderation policy phases, downvote transparency, lists and the
  data spike.

The next free workstream number is **W121**. **W90** remains the separate
self-hosted relay implementation; its client-side companion is documented in
[`docs/integrations/vault-relay.md`](../integrations/vault-relay.md) and ships
under W89. The prompt in `docs/prompts/` is the starting point for that separate
service.

## Index

| Record | Topic |
| --- | --- |
| [W1-security](W1-security.md) | Security hardening |
| [W2-ux](W2-ux.md) | Mobile / UX / accessibility |
| [W3-seo](W3-seo.md) | SEO / meta / sitemap |
| [W4-features](W4-features.md) | Functionality |
| [W5a-perf](W5a-perf.md) | Performance / dependency sweeps |
| [W5b-visual](W5b-visual.md) | Visual polish |
| [W6-package-additions](W6-package-additions.md) | Package additions |
| [W6-tests](W6-tests.md) | Tests / CI |
| [W7-proposals](W7-proposals.md) | Proposals parity with PeakD |
| [W7-proposals-log](W7-proposals-log.md) | Proposals parity implementation log |
| [W8-block-view](W8-block-view.md) | Block detail view rebuild |
| [W9-post-reading](W9-post-reading.md) | Post reading and comment threads |
| [W10-transactions](W10-transactions.md) | Transaction detail pages |
| [W11-browse-previews](W11-browse-previews.md) | Browse listings and post previews |
| [W12-comment-composer](W12-comment-composer.md) | Comment composer and inline replies |
| [W13-home-dashboard](W13-home-dashboard.md) | Front page dashboard |
| [W14-wallet-account](W14-wallet-account.md) | Wallet and account overview |
| [W15-command-palette](W15-command-palette.md) | Command palette and navigation |
| [W16-wallet-rebuild](W16-wallet-rebuild.md) | Wallet page rebuild |
| [W17-witnesses-health](W17-witnesses-health.md) | Witnesses, network health and API nodes |
| [W18-markets](W18-markets.md) | Markets, HBD tools and the internal market |
| [W19-queue-login](W19-queue-login.md) | Queue, login and notifications |
| [W20-data-layer](W20-data-layer.md) | Data layer, shared UI and legacy page consistency |
| [W21-hardening](W21-hardening.md) | Quick wins and hardening |
| [W22-performance](W22-performance.md) | Performance measurement, dashboard and hard-reload startup |
| [W23-network-resilience](W23-network-resilience.md) | Network and data resilience |
| [W24-runtime-polish](W24-runtime-polish.md) | Runtime polish and startup |
| [W25-governance-intelligence](W25-governance-intelligence.md) | Governance and community intelligence |
| [W25b-e2e-obscura](W25b-e2e-obscura.md) | E2E performance — Obscura fast suite |
| [W26-drafts-creator-workflow](W26-drafts-creator-workflow.md) | Drafts and creator workflow |
| [W27-ui-polish](W27-ui-polish.md) | UI polish and visual consistency |
| [W27b-issue-triage](W27b-issue-triage.md) | GitHub issue triage (issues #30–#42) |
| [W28-search-discovery](W28-search-discovery.md) | Unified search and discovery |
| [W29-profile-communities](W29-profile-communities.md) | Profile communities directory and merged feed |
| [W30-editing-and-attribution](W30-editing-and-attribution.md) | Editing, deletion and cross-post attribution |
| [W31-api-nodes-beacon](W31-api-nodes-beacon.md) | API node upgrade (beacon parity) |
| [W32-hivesense-search](W32-hivesense-search.md) | HiveSense semantic search |
| [W33-customisable-dashboard](W33-customisable-dashboard.md) | Customisable home dashboard |
| [W34-issue-sweep](W34-issue-sweep.md) | GitHub issue sweep (issues #42–#72) |
| [W35-issue-followups](W35-issue-followups.md) | Re-opened issue follow-ups |
| [W36-layer2-nodes](W36-layer2-nodes.md) | Layer-2 nodes, Magi settings and contract viewer |
| [W36-lightning-bridge](W36-lightning-bridge.md) | Lightning receive and pay (v4vapp Phase 1–2) |
| [W37-dashboard-magi-tokens](W37-dashboard-magi-tokens.md) | Dashboard Magi tokens |
| [W38-dashboard-followups](W38-dashboard-followups.md) | Dashboard refresh, community headers and layout follow-ups |
| [W39-issue-80-default-dashboard](W39-issue-80-default-dashboard.md) | Issue #80 default dashboard |
| [W40-issue-81-notifications-header](W40-issue-81-notifications-header.md) | Issue #81 notifications widget header |
| [W41-hivesense-api-contract](W41-hivesense-api-contract.md) | HiveSense API contract and search classification |
| [W42-issue-83-magi-autoprobe](W42-issue-83-magi-autoprobe.md) | Issue #83 Magi node auto-probe |
| [W43-magi-route-title-flash](W43-magi-route-title-flash.md) | `/magi` 404 title flash |
| [W44-issue-85-threads-images](W44-issue-85-threads-images.md) | Issue #85 raw image URLs in Threads |
| [W45-issue-84-3speak-feed-badge](W45-issue-84-3speak-feed-badge.md) | Issue #84 3Speak feed play badge |
| [W46-post-composer-media](W46-post-composer-media.md) | Post composer media, rewards and metadata |
| [W47-composer-embeds-preview](W47-composer-embeds-preview.md) | Composer embeds, split preview and editor tools |
| [W48-composer-snippets-templates](W48-composer-snippets-templates.md) | Composer snippets, templates and draft controls |
| [W49-composer-history-backup](W49-composer-history-backup.md) | Composer draft history and snippet/template backup |
| [W50-composer-reminders-lifecycle](W50-composer-reminders-lifecycle.md) | Composer draft lifecycle and reminders |
| [W51-composer-publishing-polish](W51-composer-publishing-polish.md) | Composer publishing polish |
| [W52-lightning-cors](W52-lightning-cors.md) | Lightning CORS-live hardening (v4vapp Phase 1) |
| [W53-keepsats-read-only](W53-keepsats-read-only.md) | Keepsats read-only session (v4vapp Phase 2) |
| [W54-keepsats-onchain-actions](W54-keepsats-onchain-actions.md) | Keepsats on-chain actions (v4vapp Phase 3) |
| [W55-pos-zaps](W55-pos-zaps.md) | Point of sale and post zaps (v4vapp Phase 4) |
| [W56-explorer-markets-tax](W56-explorer-markets-tax.md) | Explorer, markets and tax legibility (v4vapp Phase 5) |
| [W57-lightning-search](W57-lightning-search.md) | Lightning search and payment links |
| [W58-keepsats-send-summary](W58-keepsats-send-summary.md) | Keepsats user transfers and local sats summary |
| [W59-composer-upload-hardening](W59-composer-upload-hardening.md) | Composer upload hardening |
| [W60-cover-checklist-quality](W60-cover-checklist-quality.md) | Cover quality and checklist warnings |
| [W61-composer-community-picker](W61-composer-community-picker.md) | Composer community picker |
| [W62-hiveauth](W62-hiveauth.md) | HiveAuth (HAS) signing option |
| [W62-public-community-browser](W62-public-community-browser.md) | Public community browser |
| [W63-theme-system](W63-theme-system.md) | Theme system and profile skins |
| [W64-community-search-discovery](W64-community-search-discovery.md) | Community search and discovery |
| [W65-dashboard-widget-expansion](W65-dashboard-widget-expansion.md) | Dashboard widget expansion |
| [W65-profile-identity](W65-profile-identity.md) | Profile identity cleanup |
| [W66-badges](W66-badges.md) | Badge shelf |
| [W67-atmosphere-visual](W67-atmosphere-visual.md) | Atmosphere and visual language |
| [W67b-sharing-viewer-control](W67b-sharing-viewer-control.md) | Sharing and viewer control |
| [W68-small-wins](W68-small-wins.md) | Sats quote, metadata inspector and sats windows |
| [W69-my-communities-feed](W69-my-communities-feed.md) | My communities feed |
| [W70-composer-editor-polish](W70-composer-editor-polish.md) | Composer editor polish |
| [W71-theme-safety](W71-theme-safety.md) | Profile skin safety |
| [W72-hiveauth-resume](W72-hiveauth-resume.md) | HiveAuth background resume and device hardening |
| [W73-moderation-policy](W73-moderation-policy.md) | Moderation policy and explainability (Phase 1) |
| [W73-downvote-transparency](W73-downvote-transparency.md) | Downvote transparency (Phase 2) |
| [W73-lists-community](W73-lists-community.md) | Lists, community context and portable profiles (Phase 3) |
| [W73-list-spike](W73-list-spike.md) | Lists and community mute reasons data spike |
| [W73-moderation-implementation-plan](W73-moderation-implementation-plan.md) | Moderation implementation plan |
| [W74-composer-draft-safety](W74-composer-draft-safety.md) | Composer autosave control, leave guard and draft rename |
| [W75-search-moderation-override](W75-search-moderation-override.md) | Search result moderation override |
| [W76-moderation-transparency](W76-moderation-transparency.md) | Moderation transparency and honest partial indexes |
| [W77-safety-floor](W77-safety-floor.md) | Default-on phishing safety floor |
| [W78-community-moderation-context](W78-community-moderation-context.md) | Community moderation context |
| [W79-image-proxy](W79-image-proxy.md) | User-selectable image proxy |
| [W80-post-quick-look](W80-post-quick-look.md) | Post quick look and feed position restoration |
| [W81-banksia-rebrand](W81-banksia-rebrand.md) | Banksia rebrand and banksia.io cutover |
| [W82-account-creation](W82-account-creation.md) | Account signup, public-key claim links and static batch signing |
| [W83-profile-metadata-editor](W83-profile-metadata-editor.md) | Profile metadata editor and image uploads |
| [W84-blog-hosting](W84-blog-hosting.md) | Account blogs on `*.banksia.io` |
| [W85-blog-customisation](W85-blog-customisation.md) | Blog customisation parity and expansion |
| [W86-blog-owner-control](W86-blog-owner-control.md) | Blog sections, custom CSS and branding |
| [W87-blog-portfolio-shop](W87-blog-portfolio-shop.md) | Blog portfolio and Hive Open Market shop |
| [W88-shop-refinements](W88-shop-refinements.md) | Shop catalog, product authoring, cart, checkout and orders |
| [W89-premium-memberships](W89-premium-memberships.md) | Banksia Vault premium memberships |
| [W91-shop-vault-integration](W91-shop-vault-integration.md) | Shop routing and guards for Vault membership products |
| [W92-shop-seller-trust](W92-shop-seller-trust.md) | Public seller signals and product edit visibility |
| [W93-subscription-cancel-safety](W93-subscription-cancel-safety.md) | Only cancel open Vault subscriptions; match pair_id |
| [W94-vault-pending-badge](W94-vault-pending-badge.md) | Vault pending-grant badge and visibility-aware auto-issue |
| [W95-reliability-sweep](W95-reliability-sweep.md) | Cache, account filters, polling and page states |
| [W96-read-path-performance](W96-read-path-performance.md) | Account, delegation, price, search and trail reads |
| [W97-component-a11y](W97-component-a11y.md) | Named controls, real buttons and carousel motion |
| [W98-queue-authority](W98-queue-authority.md) | Authority checks, stable status and active retry safety |
| [W99-blog-shop-hardening](W99-blog-shop-hardening.md) | Worker, CSS, routes, RSS and shop input hardening |
| [W101-dashboard-session-races](W101-dashboard-session-races.md) | Dashboard account races, HiveAuth/SmartLock sessions |
| [W102-search-settings](W102-search-settings.md) | Account search, facets, page state and node validation |
| [W103-state-cache-scoping](W103-state-cache-scoping.md) | Account-scoped queue/settings/inbox and cache safety |
| [W104-media-account-hardening](W104-media-account-hardening.md) | Uploads, image proxy, claims and Hivedex safety |
| [W105-search-data-integrity](W105-search-data-integrity.md) | Search races, settings migration, saved searches and CSV safety |
| [W106-dashboard-blog-reliability](W106-dashboard-blog-reliability.md) | Blog tenant, dashboard scope, widget races and state honesty |
| [W107-account-delegation](W107-account-delegation.md) | Opt-in post-creation RC and HP delegation |
| [W108-dashboard-edit-lifecycle](W108-dashboard-edit-lifecycle.md) | Single grid for edit/view and off-screen live-widget recycling |
| [W109-proposal-governance-truth](W109-proposal-governance-truth.md) | Proposal vote filtering, funding outliers and epoch expiry |
| [W110-wallet-witness-safety](W110-wallet-witness-safety.md) | Claim authority, HE JSON, memo privacy, amounts, IDs and witness state |
| [W111-proposal-paging-delegation](W111-proposal-paging-delegation.md) | Cursor-paged proposal voters and powerdown-aware delegation limits |
| [W112-authority-queue](W112-authority-queue.md) | Account-authority edits through the active signing queue |
| [W113-composer-draft-integrity](W113-composer-draft-integrity.md) | Cross-account draft safety, autosave persistence and publish integrity |
| [W114-blog-shop-seo](W114-blog-shop-seo.md) | Canonical/feed policy, reserved blog paths and shop order attribution |
| [W115-blog-directory-optout](W115-blog-directory-optout.md) | Re-verify stale directory entries against the on-chain opt-in |
| [W116-owner-authority](W116-owner-authority.md) | Keychain-only owner-authority add/remove |
| [W117-authority-key-editing](W117-authority-key-editing.md) | Active/posting public-key add/remove through the queue |
| [W118-batch-delegation](W118-batch-delegation.md) | Batch creation with HP in the atomic tx and RC after confirmation |
| [W119-duplicate-edit-draft](W119-duplicate-edit-draft.md) | Duplicate an edited post as a fresh draft for payout changes |
| [W120-active-retry-guidance](W120-active-retry-guidance.md) | Inline warning before retrying a failed active broadcast |
| [W121-active-retry-reconciliation](W121-active-retry-reconciliation.md) | Verify a failed active broadcast against the chain before retrying |
| [W100-lightning-amount-links](W100-lightning-amount-links.md) | HIVE/HBD amount payment links with live sats conversion |
