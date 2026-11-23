# Traffic & Analytics Review — hive.ausbit.dev

**Window:** 2026-10-24 → 2026-11-22 (30 days, final day partial)
**Sources:** Cloudflare zone analytics (`ausbit.dev`), Cloudflare Web Analytics / RUM, Workers analytics
**Prepared:** 2026-11-23

---

## The short version

| Question | Answer |
|---|---|
| Requests reported | 33.3M to `hive.ausbit.dev`, 728 GB |
| Actually automated | **~89%** (29.6M requests) — bots, scrapers, synthetic entries |
| Real human visits | **roughly 400–900/day**, ~12k–27k/month *(confidence: medium)* |
| What Cloudflare Web Analytics shows | ~3,300 visits/day — **inflated ~4–8×** |
| Biggest waste | **513 GB (70% of bandwidth)** served from dead Vue 2 bundles that the current app doesn't use |
| Site health | Cache 98.8% (bytes), worker 0 errors, origin 522s ~64/day |

The headline is uncomfortable but useful: **you cannot trust the Web Analytics dashboard for this site.** It is being fed by an automated client that never loads a page, and the zone-level numbers are dominated by a scraper and an nginx/Cloudflare artifact. The good news is that once those are stripped out, the remaining signal is coherent — and it tells you a few concrete things to fix.

---

## 1. Traffic anatomy: who is actually hitting you

`hive.ausbit.dev` received **33,280,490 requests** and **728 GB** in 30 days. Breaking that down by client:

| Client | Requests | Share | What it is |
|---|---:|---:|---|
| Chrome/155 on Linux x86_64 | 15,255,740 | 45.9% | Automated asset hammering |
| `nginx-ssl early hints` | 7,927,660 | 23.8% | Synthetic 103 responses, not real requests |
| Chrome/145 on Windows | 3,298,440 | 9.9% | Systematic `/tx/<hash>` crawler |
| Chrome/146 on macOS | 1,617,630 | 4.9% | RUM beacon spammer (see §2) |
| Reflectionbot | 1,348,640 | 4.1% | AI crawler |
| ElevenlabsCrawler | 124,300 | 0.4% | AI crawler |
| **Everything else** | **3.7M** | **11%** | Actual browsers, mobile, misc |

That last row is the only one that contains humans, and it is itself contaminated.

### The Linux/Chrome-155 client — 46% of all traffic

A single, invariant user-agent string accounts for nearly half of every request to the site. Over 30 days it requested:

- `favicon.ico` 1,296,280 times
- `sw.js` 325,950 times
- `app.fa926b12.js` (old Vue 2 bundle) 323,000 times
- `app.2550b042.css` (old Vue 2 stylesheet) 318,420 times
- every individual lazy-loaded chunk in the current build, repeatedly

It started around 2026-11-02, exploded on 2026-11-19, and by 2026-11-22 was **89% of all traffic to the site** (~2.3M of 2.57M requests that day). It never varies its UA and never sends a RUM beacon. The server logs added on 2026-11-23 (§8) show it also fetches HTML routes — one request per IP, no referrer, never an asset — so it is a distributed crawler rather than a pure asset replay.

### The Windows/Chrome-145 client — a `/tx/` crawler

This one is more interesting. It walks transaction pages methodically, a few hundred hits per hash:

```
/@gifbt56791498              210
/tx/81fe870bdb09c7…          200
/tx/6639b37f1f82fd…          200
/tx/eeb79f8a5556c1…          200
/tx/774ee60391b5d7…          200
```

It also pulls the **legacy** `/js/vendor.f0ca49cb.js` 198,370 times. Either it is re-fetching an old app shell it cached months ago, or something is still serving it Vue 2 HTML. Worth resolving — see §5.

### The `nginx-ssl early hints` entries — 24% of requests that never happened

7.9M requests carry the user-agent `nginx-ssl early hints`. This is Cloudflare recording `103 Early Hints` responses from nginx as if they were requests. They aren't traffic; they're a protocol artifact inflating your totals by a quarter. If the server-level nginx config has `early_hints on`, consider whether the `Link` preloads are earning their keep — at minimum, stop reading that 24% as demand.

### AI crawlers

Reflectionbot (1.35M) and ElevenlabsCrawler (124k) together are ~4.5% of requests. That's a policy decision, not a bug — but it's free to make it: `robots.txt` rules or a WAF rule will reclaim both bandwidth and origin load.

---

## 2. How many actual users? (the honest answer)

Cloudflare Web Analytics reports **104,000 page loads** and **99,000 visits** over the window — about 3,300 visits/day. Server-side, the site received **158,910** beacon requests to `/cdn-cgi/rum`. Neither number is real.

### The evidence

| Test | Result |
|---|---|
| Share of `/cdn-cgi/rum` beacons from one macOS/Chrome-146 UA string | **143,280 / 158,910 = 90.2%** |
| Requests that UA made to `/` or `/index.html` in 30 days | **0** |
| Hourly distribution of that UA's beacons | **Flat, 2,200–3,000 every hour, all 24 hours** |
| Hourly distribution of all other beacons | Clear human curve: peaks 09:00–16:00 UTC, collapses after 18:00 |
| RUM country split | 84.6% US, 0.4% mobile, 83% macOS |

A browser that sends 143,280 page-view beacons while making **zero** HTML requests is not loading pages. The flat 24-hour curve is the giveaway: humans sleep. Add a four-day cliff (Nov 9–12, traffic dropped ~95%, then resumed) and this is automation — most likely something POSTing directly to `/cdn-cgi/rum`, which is a known way to poison Web Analytics.

The one benign explanation is service-worker-cached HTML: a returning user could navigate without hitting the network for `/`. That would still mean the numbers are unmeasurable, and it wouldn't explain the flat hourly curve.

### The estimate

```
Server-side beacon requests, 30 days            158,910
  minus the macOS/Chrome-146 client            −143,280
  = residual human-shaped beacons                15,630   → 521/day

The same ratio applied to RUM's sampled 104,000 loads:
  residual human-shaped page loads              ~10,400   → 347/day

Assume 20–40% of technical users block the beacon:
  → 450–900 page loads/day

Unique visits ≈ page loads (SPA, see §4)
  → ~400–900 visits/day
  → ~12,000–27,000 visits/month
```

**So: a few hundred to about a thousand real visits per day.** That is a credible audience for a niche Hive explorer maintained by one person — not a mass-market site, but not zero either.

Two caveats that could push the number up:

1. **Mobile is 0.4% of RUM.** That is almost certainly wrong for a Hive audience, which is mobile-heavy. Either your mobile instrumentation is broken or mobile users bounce before the beacon fires. Treat mobile as a blind spot, not a finding.
2. **Ad-blocking** on a crypto-adjacent site skews high. The true number may be 1.5–2× the beacon count.

The only way to settle this is server-side logs — see §7.

---

## 3. What real users actually do

Stripping the automation, the residual signal is coherent and looks like genuine Hive power-user behaviour:

**Landing pages**

| Path | Loads |
|---|---:|
| `/` | 1,150 |
| `/witnesses` | 150 |
| `/@ausbitbank` | 140 |
| `/@bcc` | 140 |
| `/@pjansen` | 130 |
| `/proposals` | 130 |
| `/search` | 120 |
| `/@ausbitbank/wallet` | 120 |
| `/@ausbitbank/blog` | 100 |
| `/compose` | 80 |
| `/shorts`, `/shorts/snaps` | 80 |
| `/witness`, `/browse`, `/hbd` | 40 each |

That mix — witness lists, proposals, account profiles, wallets, a compose screen — is exactly the Hive-toolkit use case the app is built for. It is not drive-by search traffic.

**Referrers:** 88,870 direct, 3,090 internal, then essentially nothing (github.com 40, bing.com 20). You have **no meaningful search or social acquisition**. Everything is either a bookmark, a direct link, or a bot. That is consistent with a tool used by people who already know about it.

**Geography (residual):** US, then Singapore, Australia, Hong Kong, Pakistan, Japan, Argentina, India, Brazil, Cuba, Venezuela. That's a much more Hive-shaped distribution than the 85% US in the raw numbers.

**What this means strategically:** you don't have an acquisition problem to optimise, you have a small loyal audience and a measurement problem. The highest-value work is retention and making the pages those users already open faster — not SEO.

---

## 4. Pain points, ranked by impact

### 1. 513 GB/month served from a dead application (70% of all bandwidth)

```
/js/vendor.f0ca49cb.js    297 GB   276,070 requests
/js/vendor.cced46e3.js    208 GB   229,740 requests
/css/app.2550b042.css      18 GB   425,260 requests
/js/app.fa926b12.js         2 GB   420,050 requests
/js/runtime.9107d6e5.js     0 GB   118,910 requests
```

These are the old Vue 2 filenames. The current build emits Vite output under `/assets/` — there is no `/js/` in `dist/spa`. So the old bundles are still being served from somewhere in the deployment, at ~1 MB per vendor file. **Two files account for 505 GB of your 728 GB.**

Why this matters beyond bandwidth:

- They are ~1 MB each, which suggests they are **not being compressed** (a brotli'd 1 MB JS file should leave the edge at ~250–300 KB). Verify `Content-Encoding` on `/js/vendor.*`.
- They are a stale-code trap. If any real client is still loading an old `index.html` or has a service worker pointing at these, those users are running the abandoned app. That would be invisible in the current analytics.
- `/js/runtime.9107d6e5.js` and `/js/vendor.cced46e3.js` show up **both** as 200s and as 404s in the same 30-day window — inconsistent cache/origin state.

**Action:** audit `/var/www/hive.ausbit.dev` for leftover `/js` and `/css` directories, purge the Cloudflare cache, and serve `410 Gone` for them so no client can silently keep using the old app. Then force a service-worker update. This is the single largest measurable win available.

### 2. Web Analytics is 4–8× wrong, so you're flying blind

Covered in §2. Until it's fixed, every product decision made from the dashboard is being made on bot data. Concretely, the dashboard reports 99.6% desktop / 83% macOS / 85% US, while the zone UA mix puts Windows Chrome (3.3M requests) well ahead of macOS Chrome (1.6M). Those cannot both be true.

### 3. `/null` is your #1 404 (1,135 hits in 7 days)

```
/null                          1,135
/magi                             46
/favicon.ico                      42
/api/session/properties           36
```

`/null` means something in the app is building a link from a missing field and rendering `href="/null"`. It's small in absolute terms but it's a deterministic client bug, and it's the top 404 by a wide margin. Easy win, and it may indicate a null-safety issue in a shared component.

`/magi`, `/contact`, `/appearance` also 404 — `/appearance` is supposed to be served, so that one is worth checking against the worker routes.

### 4. Origin timeouts: ~64 × `522` per day

| Status | 7-day count |
|---|---:|
| 200 | 15,888,427 |
| 204 | 81,988 |
| 301 | 6,495 |
| 404 | 4,770 |
| 499 (client closed) | 3,932 |
| **522 (origin timeout)** | **445** |
| 525 / 520 / 521 (TLS/handshake) | 31 / 22 / 14 |
| 500 | 2 |

445 origin timeouts in a week is not catastrophic but it is persistent, and it's invisible to users who just see a Cloudflare error page. With cache hit ratio at 98.8% by bytes, the origin only sees ~1.58M requests/week — so 445 timeouts is a meaningful failure rate on the requests that *do* reach it. Check nginx timeouts/worker limits and whether the 522s cluster around the bot spikes (Nov 19–22), which would make them a load symptom rather than a code bug.

### 5. Mobile: 208 ms INP and 0.079 CLS

CWV numbers are contaminated (see below), but the **mobile** slice is only 310 samples and still shows:

- LCP p75: 2.90 s — acceptable
- INP p75: **208 ms** — "needs improvement" (Google's good threshold is ≤200 ms)
- CLS p75: **0.079** — borderline (good is ≤0.1)

The desktop numbers (LCP p75 9.27 s) are meaningless because they're produced by the beacon spammer. Don't act on them. But mobile INP at 208 ms is worth a look — likely a heavy hydration path on the wallet or profile pages.

### 6. Service worker churn: 352,330 `/sw.js` requests in 30 days

326,030 of those are the Linux bot, so it's mostly noise. But the combination of a 30-minute update check, cached old bundles, and 404s on retired chunks is exactly the shape of "some users are stuck on an old version". After the legacy cleanup, confirm the update prompt actually fires for clients holding the old worker.

---

## 5. What's actually working

Worth stating plainly, because the report is otherwise negative:

- **Cache is excellent.** 88.9% hit ratio by request, **98.8% by bytes** (458.6 GB served from edge vs 5.7 GB dynamic). Your origin is well protected.
- **The metadata worker is healthy.** 96,262 requests in 7 days, **zero errors**, CPU p50 2.9 ms / p99 8.8 ms. 194k subrequests to `api.hive.blog`. Nothing to fix.
- **HTTP/2 + TLS 1.3 is near-universal** (15.7M of 16M requests). HTTP/3 is only 167k — fine, not a priority.
- **No evidence of an attack on the site.** The zone "threats" counter spikes (12.4M on Nov 20) are zone-wide and don't map to the site's own paths — treat them as an `rpc.ausbit.dev` / zone concern, not a `hive` one.

---

## 6. Your measurement setup has four structural gaps

These are worth fixing regardless of what the report says, because they will keep producing wrong answers:

1. **Zone uniques are not your users.** `ausbit.dev` uniques run 50k–99k/day — but `rpc.ausbit.dev` alone did **245M requests in 7 days** (15× the site). The zone's "unique visitors" are mostly RPC traffic. Never quote them as site audience.
2. **`httpRequests1dGroups.uniques` cannot be summed.** It's a per-day distinct count; adding 30 days overcounts massively. Report daily averages and peaks only.
3. **nginx logs record Cloudflare edge IPs.** `deploy/nginx/hive.ausbit.dev.conf` has no `real_ip_header CF-Connecting-IP` and no `set_real_ip_from`. So your own access logs cannot identify visitors, sessions, or geography. Three lines fix this permanently.
4. **SPA navigation is invisible.** RUM shows 1.05 page loads per visit. Either almost every visit is a single page (implausible for `/witnesses` → `/proposals` workflows), or in-app route changes aren't being counted. For an SPA this is the difference between "I know landing pages" and "I know what people use."

---

## 7. What to do next, in order

| # | Action | Effort | Expected effect |
|---|---|---|---|
| 1 | Restore real IPs in nginx (`set_real_ip_from` + `real_ip_header CF-Connecting-IP`) and add a log format with `$http_cf_connecting_ip`, `$http_user_agent`, `$request_time` | 10 min | Makes every future question answerable; no more guessing |
| 2 | Audit and remove leftover `/js`, `/css` Vue 2 bundles; purge cache; return `410` | 30 min | Cuts ~70% of bandwidth; eliminates the stale-app risk |
| 3 | Verify compression on legacy + current bundles (`curl -H 'Accept-Encoding: br' -I`) | 15 min | Potentially large egress reduction if `/js/*` is uncompressed |
| 4 | Challenge the distributed crawlers — Bot Fight Mode plus a managed challenge; see §8, rate limits will not work | 20 min | Removes the bulk of non-human HTML traffic |
| 5 | Fix `/null` link generation | 1–2 h | Removes top 404; likely a null-safety bug in a shared component |
| 6 | Decide AI-crawler policy in `robots.txt` / WAF | 15 min | Reclaims ~4.5% of requests |
| 7 | Add SPA page-view tracking (router `afterEach` → your own endpoint or worker) | 2–4 h | Real engagement data instead of landing pages only |
| 8 | Investigate the 522 cluster against the Nov 19–22 spike | 1 h | Either a load symptom or an origin timeout config issue |
| 9 | Profile mobile INP on wallet/profile routes | 1 day | 208 ms → under 200 ms |

### The measurement fix that matters most

Once real IPs are in the nginx logs, you can answer "how many users" definitively in one query:

```bash
# distinct visitors per day, excluding known bot UAs
grep -v -E 'Reflectionbot|Elevenlabs|early hints|Chrome/155' /var/log/nginx/access.log \
  | awk '{print $1}' | sort -u | wc -l
```

That is the number to trust — not the dashboard, not the zone uniques, not the RUM beacons.

---

## 8. Update — what the server logs showed (2026-11-23)

Real-IP logging was enabled at 15:48 CET. Within four minutes, 315 requests were recorded. They change the picture in one important way: **this is not one bot, it is a distributed scraping operation.**

| UA family | Requests | Distinct IPs | HTML | Assets | Referrers |
|---|---:|---:|---:|---:|---:|
| Linux x86_64 / Chrome 155 | 153 | 153 | 153 | 0 | 0 |
| Reflectionbot | 36 | 31 | 36 | 0 | 0 |
| Windows / Chrome 145 | 34 | 32 | 34 | 0 | 0 |
| macOS / Firefox 151 | 32 | 31 | 32 | 0 | 0 |
| macOS / Chrome 146 | 15 | 15 | 15 | 0 | 0 |
| macOS / Chrome 14x (second variant) | 11 | 11 | 11 | 0 | 0 |
| Windows / Chrome (real-looking) | 4 | **1** | 0 | **4** | **4** |

The signature is unmistakable: **roughly one request per IP**, HTML routes only (`/tx/<hash>`, `/@account`), no assets, no referrer. That is a pool of residential proxies fetching pages once each. The only genuine browser in the sample is the last row — one IP, several requests, assets, referrers.

Two consequences:

1. **Per-IP rate limiting will not work.** There is nothing to rate-limit when every IP makes a single request. This invalidates the rate-limit recommendation for rule 4 in `deploy/cloudflare/RULES.md`; it now recommends a managed challenge instead.
2. **The UA-based class labels are not behaviour labels.** The nginx map's `default` bucket was originally named `human`; the logs show it is mostly distributed scrapers with browser-like UAs. It has been renamed to `browser-ua`. Filter for humans by *behaviour* — several requests from one IP, asset loads, and a referrer — not by the class field alone.

It also means the 400–900 visits/day estimate in §2 should be treated as an **upper bound** until a full day of logs is in. The residual RUM traffic that looked human may include the macOS/Firefox crawler.

This is the payoff from the logging change: four minutes of ground truth overturned an inference that 30 days of Cloudflare aggregates could not settle.

---

## Appendix: raw figures

**Zone, `hive.ausbit.dev`, 30 days**

```
requests        33,280,490
bandwidth          728 GB
legacy /js/      1,522,690 req / 513 GB
cache hit           88.9% by request, 98.8% by bytes
origin requests     ~1.58M / 7 days
```

**Top bandwidth consumers**

```
297 GB  /js/vendor.f0ca49cb.js          276,070
208 GB  /js/vendor.cced46e3.js          229,740
 73 GB  /assets/serializer-bZO_BWwO.js  267,870
 18 GB  /css/app.2550b042.css           425,260
 10 GB  /assets/lib-96BoxN_p.js         166,350
```

**RUM / Web Analytics**

```
beacon requests     158,910
  macOS/Chrome-146  143,280  (90.2%)
  residual           15,630
RUM page loads      104,000
RUM visits           99,000
devices             desktop 99.6% / mobile 0.4%
countries           US 84.6%
referrers           direct 88,870 / internal 3,090 / external ~100
CWV desktop (n=65,570, contaminated)
  LCP p75 9.27 s · INP p75 72 ms · CLS 0.002
CWV mobile (n=310)
  LCP p75 2.90 s · INP p75 208 ms · CLS 0.079
```

**Worker `hive-metadata`, 7 days**

```
requests     96,262
errors            0
subrequests 194,267
CPU p50    2.9 ms
CPU p99    8.8 ms
```

**Zone context (not the site)**

```
rpc.ausbit.dev   244,996,569 requests / 7 days
hive.ausbit.dev   15,988,004 requests / 7 days
zone uniques        50k–99k / day (RPC-dominated)
```

---

### A note on this data

Everything above was pulled read-only via a zone-scoped Cloudflare API token that expires. Counts from Cloudflare's adaptive datasets are approximate; RUM counts are rounded/sampled and, as shown in §2, actively poisoned for this site. The 400–900 visits/day estimate should be treated as an order of magnitude, not a measurement. Server-side logs are the fix.
