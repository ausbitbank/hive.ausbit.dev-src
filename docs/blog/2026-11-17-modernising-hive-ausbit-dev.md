# Rescuing hive.ausbit.dev: from an abandoned Vue 2 app to a maintained Hive explorer

For the last few years, [hive.ausbit.dev](https://hive.ausbit.dev) has been live but frozen. It mostly worked, so it was easy to leave alone. Under the surface it was running Vue 2, Quasar 1 and webpack 4 — all end-of-life — with a dependency audit that made unpleasant reading, several integrations pointing at dead endpoints, and a pile of half-finished features that never shipped.

Today that changed. The site is running on a modern stack, the dangerous parts are fixed, the mobile experience is usable, and the whole thing is tested and deployed with a real rollback path. Here is what we found, what we changed, and what comes next.

## The starting point

The audit was not gentle. The old app had:

- Vue 2.6, Quasar 1.22, Vuex 3, webpack 4 and Electron 9
- A build that only worked with `--openssl-legacy-provider`
- **364 dependency audit findings**, including 15 critical and 155 high
- Several hard-coded API endpoints that were already dead
- An entire experimental dashboard (`hiveworld`) that was unrouted and unreachable
- A broken exchange integration, stale node lists, and half-finished voting/auth flows
- No tests, no CI, and ESLint 6 with a Vue 2 rule set
- Electron configured with `nodeIntegration: true`

Some of those were cosmetic. Some were not. The first job was to separate “old” from “actively risky”.

## First, make it build again

The foundation move was a full framework migration:

- Vue 2 → **Vue 3**
- Quasar 1 + webpack 4 → **Quasar 2 + Vite**
- Vuex → **Pinia**
- Vue Router 3 → **Vue Router 5**
- SPA-only: Electron, Cordova, SSR and PWA scaffolding removed

That migration surfaced a lot of accumulated damage. Async components were rendering `[object Promise]` in Vue 3. Template expressions used `this.` everywhere. Several features depended on libraries that only ever worked with Vue 2. The old build also depended on an OpenSSL compatibility hack; that is gone.

We also removed features that were dead for a reason: the unrouted `hiveworld` dashboard, a broken exchange/Changelly flow, the stale tribes list, the Twitter giveaway tool, the nonfunctional owner-history page, the post form with no submit action, and the HAS/HiveSigner login paths that could never complete a broadcast. Roughly **8,400 lines of dead or broken code** went away. The site got smaller before it got better.

## Security was the real priority

The most uncomfortable finding was in SmartLock. It was storing an unlocked posting key in browser storage for seven days. Any XSS on the origin could have read it.

That is now fixed properly:

- Unlocked keys live in **memory only**. A reload requires the password again.
- Legacy plaintext key-cache entries are **purged automatically** on first load.
- New SmartLock imports require an 8+ character password and use a stronger KDF setting.
- `sscjs` — which pulled in an old, vulnerable axios — was replaced with a small fetch-based Hive-Engine client with throttling, timeouts and fallback nodes.
- Community descriptions and rendered posts are sanitized with DOMPurify.
- Untrusted profile/token URLs are scheme-checked before becoming links.
- External links opened in new tabs now carry `rel="noopener noreferrer"`.

The production dependency audit went from **25 findings (12 high)** to **2 high**. Both remaining ones are `ws` advisories inside `@hiveio/hive-js`; that code is Node-only and not part of the browser bundle. The long-term fix is migrating to dhive/wax, which is documented as the next dependency project.

## Mobile wasn’t an afterthought — it was missing

At a 390px viewport, the old site had no search in the header, account tabs that were literally clipped off-screen, and carousels that forced horizontal scrolling. Those are not polish problems; they are broken navigation.

The mobile pass added:

- A real mobile search button and full-width search dialog
- Search that understands accounts, posts, tags, transaction ids, block numbers and Hive front-end URLs
- Responsive account/community tabs with mobile arrows
- Fluid carousels and a compact browse filter dialog
- An internal Explore/Tools navigation drawer so nodes, blocks, proposals, HBD, tax and account creation are discoverable
- Empty, loading and error states instead of blank cards

Accessibility got the same treatment: one `h1` per page, a skip link, accessible names for icon-only controls, image alt text, labelled progress bars, proper focus styles, reduced-motion support and contrast fixes. On the main pages, the axe WCAG A/AA scan is now **clean**.

## Making the site shareable

The old site had **zero Open Graph or Twitter tags**. Every share on Hive, Discord, Telegram or X looked like a bare link.

Every primary page now gets a real title, description, canonical URL, Open Graph and Twitter card. Posts and accounts also get JSON-LD. There is a sitemap and a robots directive.

One honest caveat: the tags are client-side. Google executes JavaScript; many social crawlers do not. The raw `index.html` still provides the default card, and per-post previews for non-JS crawlers will need SSR, prerendering or edge meta injection. That is on the list.

## New things you can actually use

This wasn’t only a cleanup. A few real features landed:

- A new **`/blocks`** page with live block updates and pause/resume
- **In-app proposal voting** through the same queue used for other broadcasts, instead of bouncing users to HiveSigner
- **Queue persistence** with a 24-hour expiry and owner guard. Restored queues start paused, so a reload never silently broadcasts a stale action.
- **API node health selection** at startup, with parallel probes and fallback if the configured node is down
- Account creation fees read from chain properties instead of a hard-coded 3 HIVE
- RC costs explicitly labelled as protocol approximations rather than pretending to be live

## Performance

We also removed a few heavy passengers:

- `moment` → `dayjs`
- `sanitize-html` → DOMPurify-based helpers
- Only the Quasar animation classes actually used are bundled
- Preconnect hints for the chain, image, price and Hive-Engine origins

The totals moved from **3,415 KB to 3,185 KB of JavaScript** and **255 KB to 248 KB of CSS**. Not a dramatic rewrite, but a cleaner dependency graph and fewer old libraries to keep alive.

## The safety net

A migration like this is only useful if it can be shipped and reverted.

The deployment script now:

1. Lints and builds
2. Takes a timestamped tarball backup of the live site
3. Uploads to a staging directory
4. Activates with a checksummed rsync
5. Prints the exact rollback command

There are now **98 unit tests across 12 files** and a GitHub Actions workflow that runs install → lint → test → build. The deploy/rollback path was tested against a throwaway directory before it was used for the real deployment. The live site has both a pre-phase-2 backup and the original pre-revamp backup on the server.

## What’s next

There is still work worth doing:

1. Apply CSP, HSTS, `X-Content-Type-Options` and `Referrer-Policy` at nginx or Cloudflare. The header policy is documented in `docs/SECURITY.md`.
2. Migrate from `@hiveio/hive-js` to dhive/wax.
3. Add SSR/prerender or edge meta injection for social crawlers.
4. Optional light theme. The current UI is intentionally dark because several surfaces use explicit dark backgrounds.
5. Add Playwright route tests to CI and more Pinia action coverage.

The full audit, the workstream plan and the results are in the repository under `docs/`. The code is open source at [github.com/ausbitbank/hive.ausbit.dev-src](https://github.com/ausbitbank/hive.ausbit.dev-src).

If you use the site and something looks wrong, please open an issue or reply here. The next round should be driven by real usage, not just an audit checklist.
