#!/usr/bin/env node
import { collect } from './lib/devlog/collect.mjs'
import { shots, listRecipes } from './lib/devlog/shots.mjs'
import { draft } from './lib/devlog/draft.mjs'
import { check } from './lib/devlog/check.mjs'
import { packageShots } from './lib/devlog/package.mjs'
import { syncAssets } from './lib/devlog/assets.mjs'
import { recordPublishedPost } from './lib/devlog/history.mjs'
import { parseArgs, gitMaybe, formatBytes } from './lib/devlog/util.mjs'
import { HIVE_MAX_BODY_BYTES, DESCRIPTION_MAX, WORK_DIR, IMAGE_BASE } from './lib/devlog/config.mjs'

const HELP = `
devlog — build a Hive development blog post from git, GitHub and the live site

Usage:
  node scripts/devlog.mjs collect  [range] [--slug <slug>] [--tests] [--no-comments]
  node scripts/devlog.mjs shots    --slug <slug> [--only home,wallet] [--build]
  node scripts/devlog.mjs sync     --slug <slug> [--dry-run] [--host hurgenburgen]
  node scripts/devlog.mjs draft    --slug <slug> [--force] [--out <file>]
  node scripts/devlog.mjs check    <post.md> [--description "..."] [--strict]
  node scripts/devlog.mjs package  --slug <slug> [--amend] [--tag] [--push]
  node scripts/devlog.mjs record   --slug <slug> --url <hive-post-url> [--title "..."]
  node scripts/devlog.mjs status
  node scripts/devlog.mjs recipes

Range:
  --since 2026-11-18        start date (inclusive)
  --until 2026-11-21        end date (inclusive)
  --from <commit>           start commit (exclusive)
  --to <commit>             end commit (default HEAD)
  --last 3                  last N days when no --since/--from
  If none are given the last devlog-* tag is used; otherwise the last 3 days.

Outputs:
  ${WORK_DIR}/<slug>/brief.md          the evidence pack to read first
  ${WORK_DIR}/<slug>/context.json      machine-readable collection
  ${WORK_DIR}/<slug>/shots.json        editable screenshot plan
  ${WORK_DIR}/<slug>/shots-results.json
  ${WORK_DIR}/<slug>/meta.json         title, 120-char description, tags
  ${WORK_DIR}/<slug>/praise.md         ready-to-paste contributor thanks
  docs/screenshots/devlog/<slug>/      cropped screenshots
  docs/blog/<slug>.md                  the draft
  docs/devlog-posts.json               published-post history and previous-post link

Rules:
  - Body limit ${HIVE_MAX_BODY_BYTES} bytes; aim for 30–40 KB with image URLs.
  - Preview description max ${DESCRIPTION_MAX} characters.
  - Open with the user-visible change, then an "Under the hood" link block.
  - Thank external issue reporters, PR authors, reviewers and commenters.
  - Crop screenshots to the feature; omit global chrome.
  - Commit screenshots only. Never commit the draft or .devlog working data.
  - Images are served from ${IMAGE_BASE}/; run sync after capture and before publishing.

Examples:
  node scripts/devlog.mjs collect --since 2026-11-18 --until 2026-11-21 --slug 2026-11-21
  node scripts/devlog.mjs shots --slug 2026-11-21 --only home,wallet,lightning
  node scripts/devlog.mjs sync --slug 2026-11-21
  node scripts/devlog.mjs draft --slug 2026-11-21
  node scripts/devlog.mjs check docs/blog/2026-11-21.md --description "128 commits in 3 days: ..."
  node scripts/devlog.mjs package --slug 2026-11-21 --amend

Read docs/DEVLOG.md before writing. It contains the editorial checklist and the shot recipe schema.
`.trim()

function status () {
  const tag = gitMaybe(['tag', '--list', 'devlog-*', '--sort=-creatordate']).split('\n')[0] || ''
  const head = gitMaybe(['rev-parse', '--short', 'HEAD'])
  const count = tag ? gitMaybe(['rev-list', '--count', `${tag}..HEAD`]) : gitMaybe(['rev-list', '--count', '-n', '1', 'HEAD'])
  const last = gitMaybe(['log', '-1', '--format=%h %ad %s', '--date=short'])
  console.log(`HEAD        ${head}`)
  console.log(`last tag    ${tag || '(none)'}`)
  console.log(`since tag   ${count || 0} commits`)
  console.log(`last commit ${last}`)
  console.log(`work dir    ${WORK_DIR}`)
  console.log(`limits      body ${formatBytes(HIVE_MAX_BODY_BYTES)}, description ${DESCRIPTION_MAX} chars`)
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const command = args._[0]
  if (!command || command === 'help' || args.help) {
    console.log(HELP)
    return
  }
  if (command === 'recipes') {
    console.log(listRecipes().join('\n'))
    return
  }
  if (command === 'status') {
    status()
    return
  }
  if (command === 'collect') {
    await collect(args)
    return
  }
  if (command === 'shots') {
    await shots(args)
    return
  }
  if (command === 'sync') {
    await syncAssets(args)
    return
  }
  if (command === 'draft') {
    draft(args)
    return
  }
  if (command === 'check') {
    check({ ...args, file: args.file || args._[1] })
    return
  }
  if (command === 'package') {
    packageShots({ ...args, slug: args.slug || args._[1] })
    return
  }
  if (command === 'record') {
    recordPublishedPost(args)
    return
  }
  throw new Error(`Unknown command: ${command}\n\n${HELP}`)
}

main().catch(error => {
  console.error(`devlog: ${error.message}`)
  process.exitCode = 1
})
