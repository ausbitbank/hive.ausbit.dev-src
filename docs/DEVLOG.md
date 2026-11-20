# Devlog pipeline

`scripts/devlog.mjs` turns a commit range into a publishable Hive development
blog post. It exists so a future agent does not start from a blank page, a
`git log` dump and a screenshot folder.

The tool cannot write the final prose. It collects the evidence, proposes the
structure, captures and crops the screenshots, scaffolds the draft, and enforces
the Hive limits. The agent still writes the story.

## The editorial contract

Every devlog must satisfy four readers at once:

1. **The non-technical Hive user.** They want to know what changed, why it is
   useful and how to try it. Open with the user-visible change, not the
   implementation. Use a concrete example or a number.
2. **The technical reader.** They want the real detail. Give each section a
   short **Under the hood** paragraph and link the full workstream document.
3. **The contributor.** Anyone who filed an issue, opened a PR, reviewed a PR,
   commented with a reproduction or helped in any other way gets named. The
   script collects GitHub issue authors, PR authors, reviewers, issue
   commenters and commit authors, and excludes the project owner.
4. **The chain.** A Hive comment body is capped at **65,535 bytes**. The
   preview description is capped at **120 characters**. Images are URLs, not
   base64. Aim for 30–40 KB with 12–24 images.

The voice is first person, plain English, dry humour, no hype. “We” is fine for
the project; “I” is fine for decisions. Do not claim something is live unless it
was deployed or explicitly verified. Do not promise dates.

## One post in seven commands

```sh
# 1. Collect the evidence for the range
node scripts/devlog.mjs collect --since 2026-11-18 --until 2026-11-21 --slug 2026-11-21

# 2. Read the brief and the machine-readable context
less .devlog/2026-11-21/brief.md
jq '.surfaces, .contributors' .devlog/2026-11-21/context.json

# 3. Capture the proposed screenshots (edits the plan first)
node scripts/devlog.mjs shots --slug 2026-11-21

# 4. Scaffold the draft
node scripts/devlog.mjs draft --slug 2026-11-21

# 5. Write the real post in docs/blog/2026-11-21.md
#    Replace every <!-- DEVLOG: ... --> placeholder.

# 6. Validate size, images, links, description and praise
node scripts/devlog.mjs check docs/blog/2026-11-21.md --strict

# 7. Commit only the screenshots, then push when ready
node scripts/devlog.mjs package --slug 2026-11-21 --amend --tag

# 8. Record the published URL so the next post links back to it
node scripts/devlog.mjs record --slug 2026-11-21 --url https://hive.ausbit.dev/@ausbitbank/...
```

`bun run devlog -- help` is equivalent. The working directory `.devlog/` is
ignored by git. The draft is **not** committed. Only
`docs/screenshots/devlog/<slug>/` is packaged.

## Range selection

Prefer tags over dates. After publishing a post, create a `devlog-*` tag:

```sh
git tag devlog-2026-11-21
```

The next `collect` with no range uses the newest `devlog-*` tag and collects
everything after it. That is the regular update workflow.

Explicit ranges:

```sh
# Date range, inclusive
node scripts/devlog.mjs collect --since 2026-11-18 --until 2026-11-21

# Commit range
node scripts/devlog.mjs collect --from 70c28f4 --to HEAD

# Last N days
node scripts/devlog.mjs collect --last 3
```

Date-only values are expanded to local midnight, which avoids git’s surprising
date-only timezone parsing. The tool derives the diff base from the first
commit’s parent, so `+insertions / −deletions` match the actual range.

## What `collect` produces

| File | Use |
| --- | --- |
| `.devlog/<slug>/brief.md` | The human evidence pack. Read this first. |
| `.devlog/<slug>/context.json` | Commits, files, surfaces, workstreams, issues, PRs, contributors, metrics. |
| `.devlog/<slug>/meta.json` | Suggested title, 120-char description and tags. |
| `.devlog/<slug>/shots.json` | Editable screenshot plan. |
| `.devlog/<slug>/praise.md` | Ready-to-paste contributor paragraph. |
| `docs/devlog-posts.json` | Published-post history and the previous-post link. |

### Surfaces

`collect` maps changed files and commit scopes to product surfaces: home,
post, compose, search, communities, account, wallet, connections, delegations,
witnesses, proposals, nodes, magi, markets, lightning, blocks and platform. A
surface with no changed files is dropped.

For each surface the brief gives you:

- the commits that touched it;
- the files that changed;
- the workstream documents it maps to;
- the issues referenced by those commits;
- candidate facts and a suggested screenshot set.

### Workstreams

Every `docs/workstreams/W*.md` with a date in the range, or referenced by a
commit, is parsed for its title, status, scope, headings, verification section
and test counts. Use the scope paragraph for the plain-English explanation and
the verification section for numbers. Always link the full document in the
post.

### Contributors

The tool reads GitHub issues and PRs created or closed/merged in the range,
plus issue comments and PR reviews. It combines those with git commit authors,
excludes `ausbitbank`, bots and deleted accounts, and ranks by contribution.
`praise.md` contains a ready-to-paste sentence. Adjust the wording, but do not
drop the handles. The long-tail section should name the people whose reports
changed the work, with issue ranges where possible.

`--no-comments` skips the per-issue comment lookups. `--no-github` skips GitHub
entirely for an offline run.

### Numbers

`--tests` runs the unit suite and records the live count. Without it, the tool
uses the highest test count found in the relevant workstream verification
sections. Perf comes from `docs/performance/latest.json`, with deltas against
the first entry in `history.jsonl`.

Use numbers selectively. One number per section is usually enough. The intro
can carry the commit/file total and the test count.

## Screenshots

### The plan

`shots.json` is intentionally editable. Each entry selects a recipe and can
override the route, alt text, caption, crop, actions or viewport.

```json
{
  "slug": "2026-11-21",
  "baseUrl": "http://127.0.0.1:4173",
  "output": "docs/screenshots/devlog/2026-11-21",
  "vars": {
    "account": "ausbitbank",
    "post": "@worldmappin/travel-digest-3105",
    "block": "111823900",
    "search": "Steem Hostile Takeover"
  },
  "shots": [
    { "recipe": "home", "surface": "home", "enabled": true },
    { "recipe": "wallet", "surface": "wallet", "enabled": true,
      "alt": "The rebuilt wallet portfolio" }
  ]
}
```

`shots` starts `dist/spa` itself if nothing is listening on the base URL. Pass
`--build` to rebuild first. Pass `--only home,wallet` to re-shoot one or two
recipes. `--recipe` is not needed; edit `enabled` or use `--only`.

Capture behaviour:

- Chromium, 1440×1100 by default, `deviceScaleFactor: 1`, reduced motion.
- Waits for live data with `waitMs`, then `waitForText` if supplied.
- Runs a small action language: `clickRole`, `clickText`, `clickSelector`,
  `fill`, `type`, `scrollY`, `scrollToText`, `scrollToSelector`,
  `wheelSelector`, `waitMs`, `waitForText`, `press`.
- Crops with Playwright’s `clip`, so ImageMagick is not required for capture.
- Writes `NN-<recipe>.png` plus `shots-results.json` and a contact sheet.
- Records dimensions, bytes and SHA-256.

### Cropping rules

The goal is the feature, not the browser.

- Remove the global header, footer and account profile banner unless they are
  the point of the shot.
- Crop to **1280px wide** on desktop. Tall widgets may need a taller viewport
  and a taller crop; the content browser is 1280×1350.
- Start at the page heading or the relevant panel. Do not include a large empty
  gap.
- One feature per shot. Do not repeat the same screen with a different scroll
  position unless the second view shows a distinct feature.
- Leave enough context that a reader can tell what they are looking at.
- Write alt text as a sentence. The caption is optional and should add
  information, not restate the alt text.
- If a crop would cut a panel mid-word, move the scroll position, not the crop
  edge.
- Prefer a 1280px-wide crop of a 1440px viewport. The 80px side margins are
  usually empty.

### Recipes

`node scripts/devlog.mjs recipes` lists the built-in recipes. They cover the
surfaces that existed at the time of writing: home, content browser, dashboard
editor, widget library, post, composer, search, communities, account, wallet,
wallet Lightning/Magi, connections, witnesses, witness analytics, proposals,
proposal analytics, markets, internal market, HBD, nodes Magi, Magi contract,
Lightning, block and mobile home.

Add a recipe in `scripts/lib/devlog/config.mjs` when a new surface becomes
important. Keep the default crop honest; the plan can override it per post.

## Writing the draft

`draft` writes a scaffold with:

- the title, date range, stats and short-version bullets;
- one H2 per changed section, in the editorial order;
- the selected screenshots with alt text and captions;
- a placeholder for each section’s prose;
- an **Under the hood** line with workstream links;
- the contributor paragraph and touched issues;
- a “What’s next” placeholder and closing links.

Then the agent replaces the placeholders. The scaffold is not the post.

Suggested section rhythm:

1. **Plain-English lead.** What can the reader do now that they could not do
   before?
2. **One concrete detail.** A number, a flow, a comparison or a small story.
3. **Under the hood.** One or two sentences of implementation detail and the
   workstream link.

Use short paragraphs and bullets. Headings should be sentences a non-technical
reader would understand. Avoid changelog voice (“implemented X”). Prefer
“you can now…”, “the page shows…”, “the queue refuses…”.

The intro should include:

- the previous post link if there is one;
- the range and the commit/file total;
- the six-bullet short version;
- a statement that screenshots are from the current build.

The long tail should name external reporters and link the issue/PR numbers. The
closing should thank them again and link the repository.

## Validation

`check` fails on:

- body over 65,535 bytes;
- missing local images;
- missing workstream documents;
- descriptions over 120 characters;
- more than five tags;
- missing contributor handles in the long-tail section (warning).

`--strict` also fails on leftover `<!-- DEVLOG: ... -->` comments, `TODO` and
the draft’s `_Write the user-visible change…_` placeholder.

The check does not prove the prose is good. Read it once for tone: does the
first paragraph make sense to someone who has never used Hive? Does every
technical claim have a link?

## Publishing

`package` stages **only** the screenshot directory and commits it. It never
commits `.devlog/` or `docs/blog/`. `--amend` folds the images into the current
local commit; `--tag` creates `devlog-<slug>` for the next range; `--push` is
explicit and pushes both the commit and the tag.

Raw images resolve from:

```
https://raw.githubusercontent.com/ausbitbank/hive.ausbit.dev-src/master/docs/screenshots/devlog/<slug>/
```

They will 404 until the screenshot commit is pushed. If the frontend blocks
GitHub raw images, upload the same files through the editor; keep the alt text.

After proof-reading and posting:

```sh
git tag devlog-2026-11-21
git push --tags
node scripts/devlog.mjs record --slug 2026-11-21 \
  --url https://hive.ausbit.dev/@ausbitbank/128-commits-in-three-days-...
```

`docs/devlog-posts.json` is the published-post history. `collect` reads the
newest entry and puts a **Last time:** link into the draft, so the next update
continues the series without anyone pasting the previous URL by hand. The tag
is still the source of truth for the commit range; the JSON is the source of
truth for the public URL.

## Extending the tool

Add a surface in `SURFACES` when a new page becomes a regular part of the
product. Add its workstream IDs, route templates, file patterns and default
recipes. Add a section in `SECTIONS` if it deserves its own H2. The order of
`SECTIONS` is the order of the draft.

Add a recipe in `SHOT_RECIPES` for a new screenshot. Use `{{account}}`,
`{{post}}`, `{{block}}` and `{{search}}` for variables. Keep the default alt
text and caption specific; the agent will edit them anyway.

The module layout:

```
scripts/devlog.mjs                  CLI
scripts/lib/devlog/config.mjs       surfaces, sections, recipes, limits
scripts/lib/devlog/collect.mjs      git/GitHub/docs collection + brief
scripts/lib/devlog/shots.mjs        Playwright capture, crop, manifest
scripts/lib/devlog/draft.mjs        markdown scaffold
scripts/lib/devlog/check.mjs        Hive limits and link checks
scripts/lib/devlog/package.mjs      screenshot commit/tag/push
```

## Copy-paste prompt for the next agent

> Read `docs/DEVLOG.md`. Run `node scripts/devlog.mjs collect` for the range
> since the last `devlog-*` tag (or use the dates the user gives). Read
> `.devlog/<slug>/brief.md` and `context.json`. Review the proposed shots,
> edit `shots.json` to keep only shots that show a distinct changed feature,
> then run `shots`. Write the post in `docs/blog/<slug>.md` using the scaffold:
> plain-English first, one **Under the hood** paragraph per section with the
> workstream links, contributor thanks with handles, and the suggested
> 120-character description. Replace every `<!-- DEVLOG: ... -->` placeholder.
> Run `check --strict`, fix the warnings, then show the user the draft and the
> image contact sheet. Do not commit the draft or push without explicit
> permission.
