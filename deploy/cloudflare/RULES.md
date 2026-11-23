# Cloudflare rules — hive.ausbit.dev

Draft rules based on the traffic analysis in [`docs/analytics-review.md`](../../docs/analytics-review.md).
Apply in **Security → WAF → Custom rules** and **Security → WAF → Rate limiting rules**.
The Free plan allows a small number of custom rules (currently 5) and limited
rate limiting — prioritise in the order below.

> **Roll out in stages.** Every rule below starts as **Log**, not Block. Check
> **Security Events** after 24 hours, confirm zero legitimate hits, then
> escalate to Block. The one exception is the AI crawlers, which are safe to
> block immediately.
>
> **Updated 2026-11-23:** the real-IP nginx log changed rules 3 and 4. The
> traffic is a pool of residential proxies making **one request per IP** with
> no referrer and no asset loads. Per-IP rate limiting does nothing against
> that; use a managed challenge instead. See §8 of
> [`docs/analytics-review.md`](../../docs/analytics-review.md).

---

## 0. Turn on Bot Fight Mode (one toggle, try this first)

**Security → Bots → Bot Fight Mode: On.**

This is the cheapest lever for distributed scraping: Cloudflare challenges
traffic it already suspects is automated, with no per-IP state required. It is
zone-wide, so watch Security Events for a day. On a niche site the risk of
challenging a real user is low, and a challenge is invisible to real browsers.

---

## 1. Block AI crawlers (safe, do now)

Reflectionbot sent 1,348,640 requests in 30 days; ElevenlabsCrawler 124,300.
Neither serves a user.

```
(http.host eq "hive.ausbit.dev" and
 (http.user_agent contains "Reflectionbot" or
  http.user_agent contains "ElevenlabsCrawler"))
```

**Action:** Block

---

## 2. Block exploit probes (safe, do now)

The 404 list contains `/wp-includes/...`, `/file.php`, `/admin.php`,
`/.well-known/assetlinks.json` scans and similar. They never succeed and never
will on a static SPA.

```
(http.host eq "hive.ausbit.dev" and
 http.request.uri.path matches "^/(wp-(admin|includes|content|login)|file\.php|admin\.php|xmlrpc\.php|\.env|\.git/)")
```

**Action:** Block

---

## 3. Challenge the `/tx/` and `/@` crawlers

The Windows/Chrome-145 client walked transaction pages systematically —
3,298,440 requests in 30 days. The nginx log now shows the pattern: **one
request per IP, HTML only, no referrer, no assets**, across several UA families
(Linux/Chrome-155, Windows/Chrome-145, macOS/Firefox-151, macOS/Chrome-146).

A bare challenge on these paths **breaks link previews and search indexing** —
verified bots get the 403 too. The expression below exempts them:

```
(http.host eq "hive.ausbit.dev" and
 (starts_with(http.request.uri.path, "/tx/") or
  starts_with(http.request.uri.path, "/@")) and
 not cf.client.bot and
 not (http.user_agent contains "Discordbot" or
      http.user_agent contains "Twitterbot" or
      http.user_agent contains "facebookexternalhit" or
      http.user_agent contains "Slackbot" or
      http.user_agent contains "TelegramBot" or
      http.user_agent contains "WhatsApp" or
      http.user_agent contains "LinkedInBot" or
      http.user_agent contains "Bluesky"))
```

**Action:** Managed Challenge.

- `not cf.client.bot` lets Googlebot, Bingbot and other verified crawlers
  through. Without it, `/@` pages drop out of search and previews break.
- The UA list covers the preview fetchers that are not always classified as
  verified bots.
- **Do not use a rate limit here.** There is nothing to rate-limit when each IP
  makes a single request.

**Verify after saving:** the Chrome/155 UA should get `403` with
`cf-mitigated: challenge`; Googlebot, Discordbot and a normal browser should
get `200`.

### 3b. If the crawler pivots

It will. In testing, challenging `/tx/` and `/@` moved it to `/b/<block>` and
`/trending/<tag>` within minutes. To cover every HTML route without listing
them, add a second rule in **Log** mode first:

```
(http.host eq "hive.ausbit.dev" and
 http.referer eq "" and
 not cf.client.bot and
 not (http.user_agent contains "Discordbot" or
      http.user_agent contains "Twitterbot" or
      http.user_agent contains "facebookexternalhit" or
      http.user_agent contains "Slackbot" or
      http.user_agent contains "TelegramBot" or
      http.user_agent contains "WhatsApp") and
 not starts_with(http.request.uri.path, "/assets/") and
 not starts_with(http.request.uri.path, "/statics/") and
 not starts_with(http.request.uri.path, "/fonts/") and
 not http.request.uri.path contains ".")
```

A managed challenge is invisible to real browsers, so a first-time visitor with
no referrer still gets through. Watch Log mode for 24 hours before switching the
action to Managed Challenge.

---

## 4. Challenge the browser-UA crawlers

15,255,740 requests (46% of all traffic) from one Linux/Chrome-155 UA, plus
smaller pools behind Windows/Chrome-145 and macOS/Firefox-151. The nginx log
shows all of them doing **one request per IP, HTML only, no referrer, no
assets** — a residential-proxy pool, not browsers.

```
(http.host eq "hive.ausbit.dev" and
 http.user_agent contains "X11; Linux x86_64" and
 http.user_agent contains "Chrome/155.")
```

**Action:** Managed Challenge.

**Why not a rate limit:** one request per IP means the rule never fires.
**Why not a hard block:** Chrome 155 on Linux x86_64 is a plausible real browser
version. A challenge lets a real user through and stops the non-JS client.
**Why this is a stopgap:** each bot family uses a different UA and they rotate.
The behavioural rule in §3 and Bot Fight Mode are the durable controls; retire
this rule when the UA string changes.

To see what the class is actually doing before you escalate:

```bash
jq -r 'select(.class=="bot-linux155") | .uri' \
  /var/log/nginx/hive.ausbit.dev.access.log \
  | sort | uniq -c | sort -rn | head
```

---

## 5. Stop the RUM beacon flood

The macOS/Chrome-146 client sent 143,280 beacons (90% of all Web Analytics
traffic) with **zero** HTML requests. It is poisoning your dashboard.

```
(http.host eq "hive.ausbit.dev" and
 http.request.uri.path eq "/cdn-cgi/rum" and
 http.user_agent contains "Macintosh" and
 http.user_agent contains "Chrome/146.")
```

**Action:** Block — this blocks *only* the beacon endpoint, not the site. Worst
case, real macOS Chrome 146 users lose analytics attribution, not access.

**If WAF does not evaluate `/cdn-cgi/*` on your plan** (check Security Events
after enabling), there is no clean edge-side fix. In that case treat Web
Analytics as unusable and rely on the nginx JSON log, which is the better source
anyway.

---

## robots.txt

`robots.txt` is advisory — bots that ignore it need the WAF rule above — but it
is free to declare intent. Add to `public/robots.txt`:

```
User-agent: Reflectionbot
Disallow: /

User-agent: ElevenlabsCrawler
Disallow: /
```

If you want to keep search engines but drop AI training crawlers, also add:

```
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Google-Extended
Disallow: /
```

---

## Retire the legacy bundles (nginx, after the logs confirm)

The Vite build emits only `/assets/`. Nothing in `dist/spa` references `/js/` or
`/css/`, yet 1,522,690 requests and **513 GB** were served from those paths in 30
days. Once rule 4 is in place and the logs show no real browser using them:

```nginx
# Retired Vue 2 bundles. The current build emits /assets/ only.
location ^~ /js/ {
    return 410;
}

location ^~ /css/ {
    return 410;
}
```

Then purge the Cloudflare cache for `/js/*` and `/css/*`.

**Tradeoff:** a client still holding an old `index.html` or an old service worker
will get a broken page until it reloads and picks up the new shell. `/sw.js`
itself is not under `/js/`, so the update path still works. Do this *after*
watching the `class` field in the new log for a day, not before.

---

## Check the `early_hints` artifact

24% of requests carried the synthetic UA `nginx-ssl early hints` — Cloudflare
recording nginx `103 Early Hints` responses as requests. It is not traffic.

```bash
nginx -T | grep -i early_hints
```

If it is enabled and the `Link` preloads are not measurably helping, turning it
off removes 7.9M phantom requests/month from your dashboards. If you keep it,
subtract it from every request total.

---

## Verification

After the first 24 hours with the new nginx log (`jq` required — `sudo apt install jq` if missing):

```bash
LOG=/var/log/nginx/hive.ausbit.dev.access.log

# traffic by class
jq -r '.class' "$LOG" | sort | uniq -c | sort -rn

# requests per IP: a real browser makes several, a proxy-pool scraper makes one
jq -r '.ip' "$LOG" | sort | uniq -c | sort -rn | head -20

# likely humans: IPs with 2+ requests that loaded an asset or sent a referrer
jq -s '
  group_by(.ip)
  | map({
      ip: .[0].ip,
      n: length,
      assets: (map(select(.uri | test("^/(assets|statics|fonts|js|css)/"))) | length),
      refs: (map(select(.ref != "")) | length)
    })
  | map(select(.n > 1 and (.assets > 0 or .refs > 0)))
  | length
' "$LOG"

# what those multi-request IPs actually open
jq -s '
  group_by(.ip)
  | map(select(length > 1))
  | map(.[].uri)
  | group_by(.)
  | map({uri: .[0], n: length})
  | sort_by(-.n)
  | .[:25][]
' "$LOG"
```

The per-IP query is the important one. If most IPs appear exactly once, the
traffic is a proxy pool and the "visitor count" is the number of IPs that
behaved like a browser — not the number of rows, and not anything the RUM
dashboard reports.
