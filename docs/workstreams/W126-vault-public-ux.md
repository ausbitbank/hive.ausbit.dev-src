# W126 — Vault public-promotion UX pass

Date: 2026-11-28
Status: implemented and verified locally

## Goal

Make Banksia Vault ready to promote publicly to non-technical readers and
authors. This pass audited the reader paywall, subscribe flow, blog discovery,
creator setup, creator dashboard, shop product page and the public `/blogs`
story against the W89 research spec, then fixed the gaps that made the feature
feel like a protocol demo instead of a product.

The cryptographic design, on-chain schemas, payment operations and authority
matrix are unchanged. No new protocol field, signing path or key-handling code
was added.

## Audit findings

| Area | Finding | Fix |
| --- | --- | --- |
| Paywall | Price cadence was hard-coded as “per month”, so a weekly or yearly plan lied. | Cadence now comes from the plan recurrence, with a neutral fallback. |
| Paywall | Four full-width buttons competed for attention, including a device action that only makes sense in one state. | One primary CTA, one inline “Already a member? Restore access / Use this device” helper, and a retry only when relevant. |
| Paywall | The locked card did not identify the author and read like a generic wall. | Added author avatar/name, a framed offer block, a benefit heading and calmer trust microcopy. |
| Blog host | The primary apex link was invisible on the Paper theme because the post-body link rule overrode the filled button colour. | Scoped the post-body link rule away from paywall buttons and raised the primary button specificity. |
| Subscribe | Copy was developer-facing: “Queue 12 recurring payments”, “Memo shown in your wallet”, “HOM product”. | Plain “Pay … every month”, a three-step “How it works”, a price summary and collapsed payment details. |
| Subscribe | The terms checkbox always described a recurring payment, even in one-time mode. | Terms and the CTA now follow the selected payment mode. |
| Subscribe | The one-time option said “access for month”. | Singular/plural period copy is derived from the recurrence. |
| Discovery | Premium posts appeared in the archive with no marker; a reader could not see that the blog sold memberships. | Added a “Members” badge to blog cards, a membership callout after the hero, and a Membership nav link. |
| Creator setup | The setup card was a wall of renewal hours, executions, grant containers, bulletins, keys and vault exports. | Added a two-step offer/passphrase setup with one “Turn on memberships” action; technical controls moved under “Advanced settings”. |
| Creator setup | “Generate vault” flipped `enabled` before a product existed, which produced a validation error. | Vault creation no longer enables the feature; the one-action setup creates the vault, product and container together. |
| Creator setup | A creator on a new device was shown a “create a new vault” passphrase form even when the blog already sold memberships. | A configured blog now says the vault is missing on this device and points to the encrypted backup import; creating a fresh vault is only offered for a new setup. |
| Creator dashboard | The dashboard opened with relay, ring-key, bulletin and shard jargon. | Added a share-links card, plain-language overview, “Give access” wording, and moved relay/key tools under “Advanced tools”. |
| Shop product | Membership detail talked about reader keys and billing every 730 hours. | Now explains account-bound access and uses the same human recurrence copy. |
| `/blogs` | The public landing page still said paid extras were “later”. | Updated to “Free forever. Memberships optional.” and added membership FAQ entries. |
| README | Vault was absent from the feature tour. | Added the blog membership, `/subscribe`, `/subscriptions` and `/vault` dashboard surfaces. |

## Components

| Area | Files |
| --- | --- |
| Reader paywall | `src/components/blog/VaultPaywall.vue`, `src/pages/blog/BlogPost.vue`, `src/pages/post.vue` |
| Subscribe flow | `src/pages/subscribe.vue` |
| Blog discovery | `src/components/blog/BlogMembershipCallout.vue`, `src/components/blog/BlogPostCard.vue`, `src/pages/blog/BlogHome.vue`, `src/layouts/BlogLayout.vue`, `src/stores/blog.js` |
| Shop product | `src/pages/blog/BlogProduct.vue` |
| Creator setup | `src/components/blog/VaultSettings.vue` |
| Creator dashboard | `src/pages/blogVault.vue` |
| Public story | `src/pages/blogs.vue`, `README.md` |
| Tests | `tests/unit/blog-membership.spec.js`, `tests/unit/vault-settings-onboarding.spec.js`, `tests/unit/vault-render.spec.js`, `e2e/vault.spec.js`, `e2e/blog.spec.js` |

## Spec conformance

Against `docs/research/members-only-content.md` §6.1–6.2:

- Paywall card: title, one-sentence value proposition, price with USD estimate,
  benefits, Subscribe, Restore, “Cancel anytime” and “Powered by Hive” — present.
- Subscribe: plan, amount, recurrence, recipient, what happens next, terms and a
  single approve action — present; the raw memo moved behind “Payment details”.
- Unlock: inline, no reload, Member badge and watermark — unchanged from W89.
- Manage: `/subscriptions` lists plans, next payment, cancel, history and device
  keys — unchanged from W89/W93.
- Recovery: passphrase-encrypted reader-key export/import — unchanged from W89.
- Creator composer: Members-only toggle, lock marker, preview as reader, size
  meter and media warning — unchanged from W89.
- Dashboard: overview, subscribers, access updates, keys, relay, premium content
  and revenue — present, with technical tools collapsed.
- SEO: public teaser, `isAccessibleForFree: false` and the `.banksia-locked`
  `hasPart` block — unchanged and still asserted by `e2e/vault.spec.js`.

## Verification

Local, 2026-11-28:

- `bun run lint` — clean (ESLint + theme-token check).
- `bun run test` — **264 files / 2,473 tests passing**.
- `bun run build` — succeeded.
- `bun run test:e2e` — **156 passed** in the functional Chromium suite. The
  shop membership detail assertion was updated for the new copy.
- `e2e/vault.spec.js` — **14/14 passed**, including a new blog-home discovery
  test, locked-post plaintext absence, signed-grant unlock, expiry, tamper,
  subscribe, device authorization, dashboard, sharded bulletin, cancel and
  composer checks.
- Axe — clean at 1440×900 and 390×844 for the locked premium post, the read-only
  blog post, the blog membership home, the subscribe page, the dashboard and
  `/subscriptions`.
- Manual mocked-browser review at 1440 and 390 for paywall, subscribe, blog home,
  settings and dashboard confirmed the new hierarchy and the fixed primary
  button on the Paper theme.
- `bun run perf:check` — still reports the pre-existing budget drift on Home,
  Browse, Block, Post, Wallet, Internal market, Compose and Search. The measured
  Post route is a non-premium post that never loads the Vault chunk, and the
  other failing routes are untouched by this workstream, so this is not a
  Vault-only regression. Re-baseline separately rather than widening budgets
  inside a UX pass.

## Remaining work

- Custom domains remain read-only for premium reads; the apex link is explicit.
- Access is issued manually unless the creator dashboard tab is open with
  auto-issue enabled. A reader may wait while the creator is offline.
- A relay exists for offline issuance but is intentionally under “Advanced
  tools”; it is not part of the non-technical onboarding.
- No multi-tier, trials, gifts, claim codes, annual/lifetime plans or metered
  paywall (unchanged from W89).
- Images inside members-only posts still keep public URLs (unchanged).
- Price changes still apply to new subscriptions only.
- The account profile page on the apex has no dedicated membership CTA; the blog
  host and locked posts are the discovery surfaces.
- Full axe coverage for every blog theme/variant remains deferred.

## Promotion checklist

Before announcing the feature publicly:

1. Deploy this build and verify the Worker shell routes for `/subscribe*`,
   `/subscriptions*` and `/settings/blog*`.
2. Smoke a real creator on the apex: turn on memberships, publish a premium
   post, pay as a second account, receive access, cancel and restore.
3. Open a claimed blog host on desktop and mobile and confirm the membership
   callout, Members badge and apex handoff.
4. Check the Paper theme's filled buttons and the highest-contrast theme.
5. Keep the public claim honest: text-only, direct HBD, 0% fee, manual access
   while the creator is offline, custom domains read-only.
