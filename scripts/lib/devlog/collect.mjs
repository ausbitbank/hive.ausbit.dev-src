import { existsSync } from 'node:fs'
import { latestPublishedPost } from './history.mjs'
import {
  BLOG_DIR,
  BLOB_BASE,
  DEFAULTS,
  DESCRIPTION_MAX,
  OWNER,
  REPO,
  SECTIONS,
  SHOT_RECIPES,
  SURFACES,
  TAG_DEFAULTS,
  WORK_DIR
} from './config.mjs'
import {
  ensureDir,
  formatBytes,
  git,
  gitMaybe,
  hasCommand,
  listFiles,
  parseDayEnd,
  parseDayStart,
  readJson,
  readText,
  run,
  slugify,
  sortBy,
  truncate,
  unique,
  writeJson,
  writeText
} from './util.mjs'

const SCOPE_TO_SURFACE = {
  dashboard: 'home',
  home: 'home',
  post: 'post',
  comments: 'post',
  media: 'post',
  compose: 'compose',
  drafts: 'compose',
  search: 'search',
  communities: 'communities',
  community: 'communities',
  account: 'account',
  wallet: 'wallet',
  connections: 'connections',
  delegations: 'delegations',
  witness: 'witnesses',
  witnesses: 'witnesses',
  proposals: 'proposals',
  governance: 'witnesses',
  nodes: 'nodes',
  health: 'nodes',
  magi: 'magi',
  market: 'markets',
  markets: 'markets',
  hbd: 'markets',
  lightning: 'lightning',
  block: 'blocks',
  blocks: 'blocks',
  tx: 'blocks',
  transactions: 'blocks',
  perf: 'platform',
  performance: 'platform',
  seo: 'platform',
  a11y: 'platform',
  runtime: 'platform',
  resilience: 'platform',
  deploy: 'platform',
  meta: 'platform',
  metadata: 'platform',
  pwa: 'platform',
  test: 'platform',
  tests: 'platform',
  hardening: 'platform',
  ui: 'platform',
  login: 'platform',
  queue: 'platform',
  notifications: 'platform',
  settings: 'platform'
}

const SURFACE_TAGS = {
  home: 'dashboard',
  post: 'writing',
  compose: 'writing',
  search: 'search',
  communities: 'communities',
  account: 'account',
  wallet: 'wallet',
  connections: 'social',
  delegations: 'delegations',
  witnesses: 'governance',
  proposals: 'dhf',
  nodes: 'nodes',
  magi: 'magi',
  markets: 'markets',
  lightning: 'lightning',
  blocks: 'explorer',
  platform: 'performance'
}

const BOT_RE = /(\[bot\]|(^|[-_])bot($|[-_])|dependabot|github-actions|renovate)/i

function latestDevlogTag () {
  const tags = gitMaybe(['tag', '--list', 'devlog-*', '--sort=-creatordate'])
    .split('\n')
    .map(value => value.trim())
    .filter(Boolean)
  return tags[0] || ''
}

function resolveRange (args) {
  const from = args.from
  const to = args.to
  const tag = !from && !args.since && !args.last ? latestDevlogTag() : ''
  let rangeArgs
  let base
  let label

  if (from) {
    rangeArgs = [`${from}..${to || 'HEAD'}`]
    base = from
    label = `${from}..${to || 'HEAD'}`
  } else if (tag) {
    rangeArgs = [`${tag}..HEAD`]
    base = tag
    label = `${tag}..HEAD`
  } else {
    const since = parseDayStart(args.since) || parseDayStart(args.last ? `${new Date(Date.now() - Number(args.last) * 86400000).toISOString().slice(0, 10)}` : '')
    const until = parseDayEnd(args.until)
    rangeArgs = ['--since=' + (since || '1970-01-01T00:00:00')]
    if (until) rangeArgs.push('--until=' + until)
    label = `${args.since || 'last 3 days'}..${args.until || 'HEAD'}`
  }

  const commits = readCommits(rangeArgs)
  if (!commits.length) throw new Error(`No commits found for ${label}`)

  if (!base) {
    const first = commits[0].hash
    base = gitMaybe(['rev-parse', `${first}^`]) || first
  }

  const head = to || commits[commits.length - 1].hash
  const sinceDate = args.since || commits[0].date.slice(0, 10)
  const untilDate = args.until || commits[commits.length - 1].date.slice(0, 10)
  const start = new Date(`${sinceDate}T00:00:00`)
  const end = new Date(`${untilDate}T00:00:00`)
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1)

  return { rangeArgs, base, head, commits, label, sinceDate, untilDate, days, tag }
}

function readCommits (rangeArgs) {
  const format = '%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e'
  const raw = git(['log', '--reverse', `--format=${format}`, ...rangeArgs])
  return raw
    .split('\x1e')
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const [hash, author, email, date, subject, body = ''] = block.split('\x1f')
      const parsed = parseSubject(subject)
      return {
        hash,
        author,
        email,
        date,
        subject,
        body,
        type: parsed.type,
        scope: parsed.scope,
        description: parsed.description,
        issues: [...new Set([...subject.matchAll(/#(\d+)/g)].map(match => Number(match[1])))],
        docs: [...new Set([...subject.matchAll(/\b(W\d+[a-z]?)\b/gi)].map(match => match[1].toUpperCase()))]
      }
    })
}

function parseSubject (subject) {
  const match = String(subject).match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.*)$/)
  if (!match) return { type: 'other', scope: '', description: subject }
  return { type: match[1].toLowerCase(), scope: (match[2] || '').toLowerCase(), description: match[3] }
}

function readCommitFiles (rangeArgs) {
  const raw = git(['log', '--reverse', '--format=__DEVLOG_COMMIT__%H', '--name-only', ...rangeArgs])
  const map = new Map()
  let current = ''
  for (const line of raw.split('\n')) {
    if (line.startsWith('__DEVLOG_COMMIT__')) {
      current = line.slice('__DEVLOG_COMMIT__'.length).trim()
      map.set(current, [])
    } else if (line.trim() && current) {
      map.get(current).push(line.trim())
    }
  }
  return map
}

function diffStats (base, head) {
  const short = gitMaybe(['diff', '--shortstat', `${base}..${head}`])
  const numstat = gitMaybe(['diff', '--numstat', `${base}..${head}`])
  const files = []
  let insertions = 0
  let deletions = 0
  for (const line of numstat.split('\n')) {
    const [add, del, path] = line.split('\t')
    if (!path) continue
    const additions = Number(add) || 0
    const removals = Number(del) || 0
    insertions += additions
    deletions += removals
    files.push({ path, additions, deletions: removals })
  }
  const fileCountMatch = short.match(/(\d+) files? changed/)
  const insertMatch = short.match(/(\d+) insertions?/)
  const deleteMatch = short.match(/(\d+) deletions?/)
  return {
    filesChanged: Number(fileCountMatch?.[1] || files.length),
    insertions: Number(insertMatch?.[1] || insertions),
    deletions: Number(deleteMatch?.[1] || deletions),
    files: sortBy(files, file => file.additions + file.deletions),
    short: short || 'No diff data'
  }
}

function parseWorkstreams () {
  return listFiles('docs/workstreams', path => path.endsWith('.md')).map(path => {
    const text = readText(path)
    const rawId = (path.match(/\/(W\d+[a-z]?)/i) || [])[1] || ''
    const id = rawId ? rawId.replace(/^w/, 'W').replace(/[A-Z]$/, char => char.toLowerCase()) : ''
    const title = (text.match(/^#\s+(.+)$/m) || [])[1]?.trim() || path
    const date = (text.match(/^Date:\s*(.+)$/m) || [])[1]?.trim() || ''
    const status = (text.match(/^Status:\s*(.+)$/m) || [])[1]?.trim() || ''
    const headings = [...text.matchAll(/^#{2,3}\s+(.+)$/gm)].map(match => match[1].trim())
    const scope = extractSection(text, ['Scope', 'Goal', 'Overview', 'Why'])
    const verification = extractSection(text, ['Verification', 'Deploy', 'Deployment'], 1800)
    const tests = parseTests(text)
    return { id, path, title, date, status, headings, scope, verification, tests }
  })
}

function extractSection (text, names, limit = 1200) {
  for (const name of names) {
    const regex = new RegExp(`^##\\s+${name}\\s*$`, 'im')
    const match = regex.exec(text)
    if (!match) continue
    const start = match.index + match[0].length
    const rest = text.slice(start)
    const end = rest.search(/^##\s+/m)
    return truncate(rest.slice(0, end === -1 ? rest.length : end).trim(), limit)
  }
  return ''
}

function parseTests (text) {
  const tests = []
  for (const match of text.matchAll(/([\d,]+)\s+tests?\s+(?:passed|passing)/gi)) {
    tests.push(Number(match[1].replaceAll(',', '')))
  }
  const files = []
  for (const match of text.matchAll(/([\d,]+)\s+files?\s*(?:[\n,]|$)/gi)) {
    files.push(Number(match[1].replaceAll(',', '')))
  }
  return {
    tests: tests.length ? Math.max(...tests) : 0,
    files: files.length ? Math.max(...files) : 0
  }
}

function inDateRange (value, sinceDate, untilDate) {
  if (!value) return false
  const day = String(value).slice(0, 10)
  return day >= sinceDate && day <= untilDate
}

function ghJson (args, fallback = []) {
  if (!hasCommand('gh')) return fallback
  const result = run('gh', args, { allowFail: true })
  if (result.status !== 0 || !result.stdout.trim()) return fallback
  try {
    return JSON.parse(result.stdout)
  } catch {
    return fallback
  }
}

function ghLines (args) {
  if (!hasCommand('gh')) return []
  const result = run('gh', args, { allowFail: true })
  if (result.status !== 0) return []
  return result.stdout.split('\n').map(line => line.trim()).filter(Boolean)
}

function isOwner (person) {
  const value = `${person.login || ''} ${person.name || ''} ${person.email || ''}`.toLowerCase()
  return value.includes(OWNER.toLowerCase())
}

function isBot (login) {
  return BOT_RE.test(String(login || ''))
}

function loadGithub (range, args) {
  if (args['no-github']) return { issues: [], prs: [], comments: [] }
  const sinceDate = range.sinceDate
  const untilDate = range.untilDate
  const issues = ghJson([
    'issue', 'list', '--state', 'all', '--limit', '500',
    '--json', 'number,title,author,createdAt,closedAt,state,url,labels'
  ])
    .filter(issue => inDateRange(issue.createdAt, sinceDate, untilDate) || inDateRange(issue.closedAt, sinceDate, untilDate))
    .map(issue => ({
      number: issue.number,
      title: issue.title,
      author: issue.author?.login || '',
      state: issue.state,
      url: issue.url,
      createdAt: issue.createdAt,
      closedAt: issue.closedAt,
      labels: (issue.labels || []).map(label => label.name)
    }))

  const prs = ghJson([
    'pr', 'list', '--state', 'all', '--limit', '300',
    '--json', 'number,title,author,createdAt,mergedAt,state,url,reviews'
  ])
    .filter(pr => inDateRange(pr.createdAt, sinceDate, untilDate) || inDateRange(pr.mergedAt, sinceDate, untilDate))
    .map(pr => ({
      number: pr.number,
      title: pr.title,
      author: pr.author?.login || '',
      state: pr.state,
      url: pr.url,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      reviews: (pr.reviews || []).map(review => review.author?.login).filter(Boolean)
    }))

  const comments = []
  if (!args['no-comments']) {
    for (const issue of issues.slice(0, 80)) {
      const authors = ghLines(['api', `repos/${REPO}/issues/${issue.number}/comments`, '--jq', '.[].user.login'])
      for (const login of authors) {
        if (login && !isOwner({ login }) && !isBot(login)) {
          comments.push({ number: issue.number, login })
        }
      }
    }
  }

  return { issues, prs, comments }
}

function addContributor (map, key, base) {
  if (!map.has(key)) map.set(key, { key, score: 0, issues: [], prs: [], comments: [], reviews: [], commits: [], ...base })
  const item = map.get(key)
  for (const [field, values] of Object.entries(base)) {
    if (Array.isArray(values)) item[field] = unique([...(item[field] || []), ...values])
    else if (values) item[field] = values
  }
  return item
}

function buildContributors (commits, github) {
  const map = new Map()
  for (const commit of commits) {
    if (isOwner({ name: commit.author, email: commit.email })) continue
    const key = commit.author.toLowerCase()
    const item = addContributor(map, key, { name: commit.author, email: commit.email, kind: 'git' })
    item.commits.push(commit.hash)
  }

  for (const issue of github.issues) {
    if (!issue.author || isOwner({ login: issue.author }) || isBot(issue.author)) continue
    const item = addContributor(map, issue.author.toLowerCase(), {
      login: issue.author,
      url: `https://github.com/${issue.author}`,
      kind: 'github'
    })
    item.issues.push(issue.number)
  }

  for (const pr of github.prs) {
    if (pr.author && !isOwner({ login: pr.author }) && !isBot(pr.author)) {
      const item = addContributor(map, pr.author.toLowerCase(), {
        login: pr.author,
        url: `https://github.com/${pr.author}`,
        kind: 'github'
      })
      item.prs.push(pr.number)
    }
    for (const review of pr.reviews || []) {
      if (isOwner({ login: review }) || isBot(review)) continue
      const item = addContributor(map, review.toLowerCase(), {
        login: review,
        url: `https://github.com/${review}`,
        kind: 'github'
      })
      item.reviews.push(pr.number)
    }
  }

  for (const comment of github.comments) {
    if (!comment.login || isOwner({ login: comment.login }) || isBot(comment.login)) continue
    const item = addContributor(map, comment.login.toLowerCase(), {
      login: comment.login,
      url: `https://github.com/${comment.login}`,
      kind: 'github'
    })
    item.comments.push(comment.number)
  }

  for (const item of map.values()) {
    item.issues = unique(item.issues).sort((a, b) => a - b)
    item.prs = unique(item.prs).sort((a, b) => a - b)
    item.comments = unique(item.comments).sort((a, b) => a - b)
    item.reviews = unique(item.reviews).sort((a, b) => a - b)
    item.commits = unique(item.commits)
    item.score = item.issues.length * 3 + item.prs.length * 4 + item.comments.length + item.reviews.length + item.commits.length
  }

  return sortBy([...map.values()], item => item.score)
}

function buildSurfaces (commits, files, workstreams, issues) {
  const surfaces = new Map(SURFACES.map(surface => [surface.key, {
    ...surface,
    score: 0,
    files: [],
    commits: [],
    issues: [],
    docs: [...surface.docs]
  }]))

  for (const file of files) {
    for (const surface of surfaces.values()) {
      if (surface.patterns.some(pattern => file.path.includes(pattern))) {
        surface.files.push(file.path)
        surface.score += 1
      }
    }
  }

  for (const commit of commits) {
    const keys = new Set()
    for (const file of commit.files || []) {
      for (const surface of surfaces.values()) {
        if (surface.patterns.some(pattern => file.includes(pattern))) keys.add(surface.key)
      }
    }
    if (SCOPE_TO_SURFACE[commit.scope]) keys.add(SCOPE_TO_SURFACE[commit.scope])
    for (const key of keys) {
      const surface = surfaces.get(key)
      if (!surface) continue
      surface.commits.push(commit.hash)
      surface.issues.push(...commit.issues)
      surface.docs.push(...commit.docs)
      surface.score += 2
    }
  }

  for (const issue of issues) {
    for (const commit of commits) {
      if (commit.issues.includes(issue.number)) {
        for (const surface of surfaces.values()) {
          if (surface.commits.includes(commit.hash)) surface.issues.push(issue.number)
        }
      }
    }
  }

  for (const doc of workstreams) {
    for (const surface of surfaces.values()) {
      if (surface.docs.includes(doc.id)) surface.docs.push(doc.id)
    }
  }

  for (const surface of surfaces.values()) {
    surface.files = unique(surface.files)
    surface.commits = unique(surface.commits)
    surface.issues = unique(surface.issues).sort((a, b) => a - b)
    surface.docs = unique(surface.docs)
  }

  return sortBy([...surfaces.values()].filter(surface => surface.score > 0), item => item.score)
}

function relevantWorkstreams (all, surfaces, range) {
  const referenced = new Set(surfaces.flatMap(surface => surface.docs))
  return all.filter(doc => referenced.has(doc.id) || inDateRange(doc.date, range.sinceDate, range.untilDate))
}

function buildMetrics (range, surfaces, workstreams, args) {
  const diff = diffStats(range.base, range.head)
  const messages = range.commits.map(commit => commit.subject)
  const conventional = range.commits.reduce((acc, commit) => {
    acc[commit.type] = (acc[commit.type] || 0) + 1
    return acc
  }, {})
  const testsFromDocs = workstreams
    .filter(doc => doc.tests.tests)
    .map(doc => ({ id: doc.id, path: doc.path, ...doc.tests }))
    .sort((a, b) => b.tests - a.tests)[0] || null
  const testsLive = args.tests ? runTests() : null
  const perf = readPerf()
  return {
    commits: range.commits.length,
    filesChanged: diff.filesChanged,
    insertions: diff.insertions,
    deletions: diff.deletions,
    short: diff.short,
    topFiles: diff.files.slice(0, 20),
    conventional,
    messages,
    tests: testsLive || testsFromDocs,
    perf,
    surfaces: surfaces.length,
    workstreams: workstreams.length
  }
}

function runTests () {
  const command = existsSync('bun.lock') ? 'bun' : 'npm'
  const result = run(command, ['run', 'test'], { allowFail: true, timeout: 240000 })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const testMatch = output.match(/Tests\s+([\d,]+)\s+passed/)
  const fileMatch = output.match(/Test Files\s+([\d,]+)\s+passed/)
  if (!testMatch) return null
  return {
    tests: Number(testMatch[1].replaceAll(',', '')),
    files: fileMatch ? Number(fileMatch[1].replaceAll(',', '')) : 0,
    source: 'live test run',
    path: ''
  }
}

function readPerf () {
  const latest = readJson('docs/performance/latest.json')
  const history = readTextSafe('docs/performance/history.jsonl')
  if (!latest) return null
  const entries = history
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line) } catch { return null }
    })
    .filter(Boolean)
  const baseline = entries[0] || null
  const previous = entries.length > 1 ? entries[entries.length - 2] : baseline
  const routes = (latest.routes || []).map(route => {
    const before = baseline?.routes?.find(item => item.route === route.route)
    return {
      route: route.route,
      name: route.name,
      lcpMs: route.lcpMs,
      cls: route.cls,
      totalKb: route.totalKb,
      routeJsKb: route.routeJsKb,
      lcpDeltaPct: before?.lcpMs ? Math.round((1 - route.lcpMs / before.lcpMs) * 100) : null,
      clsBefore: before?.cls ?? null
    }
  })
  return {
    generatedAt: latest.generatedAt,
    label: latest.label,
    commit: latest.commit,
    baselineLabel: baseline?.label || '',
    previousLabel: previous?.label || '',
    routes,
    bundle: latest.bundle?.initial || null
  }
}

function readTextSafe (path) {
  try {
    return readText(path)
  } catch {
    return ''
  }
}

function numbersText (values) {
  const numbers = unique(values).sort((a, b) => a - b)
  const groups = []
  for (const number of numbers) {
    const last = groups[groups.length - 1]
    if (last && number === last[last.length - 1] + 1) last.push(number)
    else groups.push([number])
  }
  return groups.map(group => {
    if (group.length === 1) return `#${group[0]}`
    if (group.length === 2) return `#${group[0]}, #${group[1]}`
    return `#${group[0]}–#${group[group.length - 1]}`
  }).join(', ')
}

function praiseParagraph (contributors) {
  const people = contributors.filter(item => item.issues.length || item.prs.length || item.comments.length || item.reviews.length)
  if (!people.length) return ''
  const parts = people.slice(0, 6).map(person => {
    const bits = []
    if (person.issues.length) bits.push(`issues ${numbersText(person.issues)}`)
    if (person.prs.length) bits.push(`PRs ${numbersText(person.prs)}`)
    if (person.comments.length) bits.push(`comments on ${numbersText(person.comments)}`)
    if (person.reviews.length) bits.push(`reviews on ${numbersText(person.reviews)}`)
    return `@${person.login || person.name} (${bits.join(', ')})`
  })
  return `Thank you to ${parts.join(', ')} — these reports and contributions directly shaped this update.`
}

function orderedSurfaces (surfaces) {
  const byKey = new Map(surfaces.map(surface => [surface.key, surface]))
  return SECTIONS
    .flatMap(section => section.surfaces)
    .map(key => byKey.get(key))
    .filter(Boolean)
}

function daysLabel (days) {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function makeTitle (range, surfaces) {
  const labels = orderedSurfaces(surfaces).slice(0, 3).map(surface => surface.label.toLowerCase())
  const theme = labels.length ? labels.join(', ') : 'the site'
  return `${range.commits.length} commits in ${daysLabel(range.days)}: ${theme}`
}

function makeTitleOptions (range, surfaces) {
  const labels = orderedSurfaces(surfaces).slice(0, 3).map(surface => surface.label.toLowerCase())
  return [
    `${range.commits.length} commits in ${daysLabel(range.days)} on banksia.io`,
    `${range.commits.length} commits in ${daysLabel(range.days)}: ${labels.join(', ')}`,
    `Building on banksia.io: ${labels.slice(0, 2).join(' and ')}`
  ]
}

function makeDescription (range, surfaces) {
  const labels = orderedSurfaces(surfaces).slice(0, 4).map(surface => surface.label.toLowerCase())
  const base = `${range.commits.length} commits in ${daysLabel(range.days)}: ${labels.join(', ') || 'a faster, smarter Hive explorer'} on banksia.io.`
  if (base.length <= DESCRIPTION_MAX) return base
  const short = `${range.commits.length} commits in ${daysLabel(range.days)}: dashboards, search and Lightning on banksia.io.`
  return short.length <= DESCRIPTION_MAX ? short : truncate(short, DESCRIPTION_MAX)
}

function makeDescriptionOptions (range, surfaces) {
  const labels = orderedSurfaces(surfaces).slice(0, 4).map(surface => surface.label.toLowerCase())
  const options = [
    `${range.commits.length} commits in ${daysLabel(range.days)}: ${labels.join(', ')} on banksia.io.`,
    `${range.commits.length} commits in ${daysLabel(range.days)}: dashboards, search and Lightning on banksia.io.`,
    `${range.commits.length} commits in ${daysLabel(range.days)}. Here is what changed on banksia.io.`
  ]
  return unique(options.map(option => option.length <= DESCRIPTION_MAX ? option : truncate(option, DESCRIPTION_MAX)))
}

function makeTags (surfaces) {
  const tags = [...TAG_DEFAULTS]
  for (const surface of orderedSurfaces(surfaces)) {
    const tag = SURFACE_TAGS[surface.key]
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return tags.slice(0, 5)
}

function makeShotPlan (slug, surfaces, range) {
  const selected = []
  const seen = new Set()
  for (const section of SECTIONS) {
    for (const surfaceKey of section.surfaces) {
      const surface = surfaces.find(item => item.key === surfaceKey)
      if (!surface) continue
      for (const recipe of surface.shots) {
        if (seen.has(recipe) || !SHOT_RECIPES[recipe]) continue
        seen.add(recipe)
        selected.push({
          recipe,
          surface: surfaceKey,
          enabled: true,
          alt: SHOT_RECIPES[recipe].alt,
          caption: SHOT_RECIPES[recipe].caption
        })
      }
    }
  }
  if (!selected.length) selected.push({ recipe: 'home', surface: 'home', enabled: true, alt: SHOT_RECIPES.home.alt, caption: SHOT_RECIPES.home.caption })
  return {
    slug,
    baseUrl: DEFAULTS.baseUrl,
    output: `docs/screenshots/devlog/${slug}`,
    vars: {
      account: DEFAULTS.account,
      post: DEFAULTS.post,
      block: DEFAULTS.block,
      search: DEFAULTS.search
    },
    range: { sinceDate: range.sinceDate, untilDate: range.untilDate, base: range.base, head: range.head },
    shots: selected
  }
}

function writeBrief ({ slug, range, stats, surfaces, workstreams, issues, prs, contributors, metrics, meta, plan }) {
  const lines = []
  const docById = new Map(workstreams.map(doc => [doc.id, doc]))
  lines.push(`# Devlog brief — ${slug}`)
  lines.push('')
  lines.push(`Range: **${range.sinceDate} → ${range.untilDate}** (${daysLabel(range.days)}, ${range.commits.length} commits)`)
  lines.push('')
  const baseLabel = /^[0-9a-f]{7,40}$/i.test(range.base) ? range.base.slice(0, 8) : range.base
  lines.push(`Base \`${baseLabel}\` → head \`${range.head.slice(0, 8)}\``)
  if (meta.previousPost?.url) {
    lines.push('')
    lines.push(`Previous post: [${meta.previousPost.title || meta.previousPost.slug}](${meta.previousPost.url})`)
  }
  lines.push('')
  lines.push('## Suggested metadata')
  lines.push('')
  lines.push(`- **Title:** ${meta.title}`)
  lines.push(`- **Description:** ${meta.description} (${meta.description.length}/${DESCRIPTION_MAX})`)
  lines.push(`- **Tags:** ${meta.tags.join(', ')}`)
  if (meta.titleOptions?.length) {
    lines.push('- Title options:')
    for (const option of meta.titleOptions) lines.push(`  - ${option}`)
  }
  if (meta.descriptionOptions?.length) {
    lines.push('- Description options:')
    for (const option of meta.descriptionOptions) lines.push(`  - ${option} (${option.length}/${DESCRIPTION_MAX})`)
  }
  lines.push(`- **Slug:** \`${slug}\``)
  lines.push('')
  lines.push('## Numbers')
  lines.push('')
  lines.push(`- ${stats.commits} commits, ${stats.filesChanged} files, +${stats.insertions.toLocaleString()} / −${stats.deletions.toLocaleString()}`)
  if (metrics.tests) lines.push(`- Tests: ${metrics.tests.tests ? `${metrics.tests.tests} passed` : '—'}${metrics.tests.files ? ` across ${metrics.tests.files} files` : ''}${metrics.tests.source ? ` (${metrics.tests.source})` : ''}`)
  if (metrics.perf) {
    lines.push(`- Perf baseline: ${metrics.perf.label || 'latest'}${metrics.perf.generatedAt ? ` (${metrics.perf.generatedAt.slice(0, 10)})` : ''}`)
    for (const route of metrics.perf.routes.slice(0, 6)) {
      lines.push(`  - ${route.name}: LCP ${route.lcpMs} ms${route.lcpDeltaPct != null ? ` (${route.lcpDeltaPct > 0 ? '−' : '+'}${Math.abs(route.lcpDeltaPct)}% vs baseline)` : ''}, CLS ${route.cls}`)
    }
  }
  lines.push('')
  lines.push('## Contributors to thank')
  lines.push('')
  const praise = praiseParagraph(contributors)
  if (praise) {
    lines.push(praise)
    lines.push('')
    for (const person of contributors) {
      const bits = []
      if (person.issues.length) bits.push(`issues ${numbersText(person.issues)}`)
      if (person.prs.length) bits.push(`PRs ${numbersText(person.prs)}`)
      if (person.comments.length) bits.push(`comments ${numbersText(person.comments)}`)
      if (person.reviews.length) bits.push(`reviews ${numbersText(person.reviews)}`)
      if (person.commits.length) bits.push(`${person.commits.length} commits`)
      lines.push(`- @${person.login || person.name} — ${bits.join(', ') || 'contribution'}`)
    }
  } else {
    lines.push('_No external contributors detected in this range._')
  }
  lines.push('')
  lines.push('## Sections')
  lines.push('')

  for (const section of SECTIONS) {
    const sectionSurfaces = section.surfaces
      .map(key => surfaces.find(surface => surface.key === key))
      .filter(Boolean)
    if (!sectionSurfaces.length) continue
    lines.push(`### ${section.title}`)
    lines.push('')
    lines.push(`_${section.promise}_`)
    lines.push('')
    for (const surface of sectionSurfaces) {
      lines.push(`**${surface.label}** — ${surface.commits.length} commits, ${surface.files.length} files, ${surface.issues.length} issues`)
      const docs = surface.docs.map(id => docById.get(id)).filter(Boolean)
      if (docs.length) {
        lines.push(`- Docs: ${docs.map(doc => `[${doc.id}](${BLOB_BASE}/${doc.path})`).join(', ')}`)
      }
      const commits = range.commits.filter(commit => surface.commits.includes(commit.hash)).slice(0, 7)
      if (commits.length) {
        lines.push('- Candidate facts:')
        for (const commit of commits) lines.push(`  - ${commit.subject} (\`${commit.hash.slice(0, 7)}\`)`)
      }
      if (surface.files.length) {
        lines.push(`- Touched: ${surface.files.slice(0, 8).map(file => `\`${file}\``).join(', ')}`)
      }
      lines.push('')
    }
  }

  lines.push('## Suggested screenshots')
  lines.push('')
  lines.push('| Recipe | Surface | Route | Crop |')
  lines.push('| --- | --- | --- | --- |')
  for (const shot of plan.shots) {
    const recipe = SHOT_RECIPES[shot.recipe]
    lines.push(`| ${shot.recipe} | ${shot.surface} | \`${recipe.route}\` | ${recipe.crop || recipe.element || 'viewport'} |`)
  }
  lines.push('')
  lines.push('## Issue and PR facts')
  lines.push('')
  if (issues.length) {
    for (const issue of issues.slice(0, 30)) lines.push(`- #${issue.number} ${issue.title} — @${issue.author || 'unknown'} (${issue.state})`)
  } else {
    lines.push('_No matching issues._')
  }
  if (prs.length) {
    lines.push('')
    lines.push('### Pull requests')
    lines.push('')
    for (const pr of prs.slice(0, 20)) lines.push(`- #${pr.number} ${pr.title} — @${pr.author || 'unknown'} (${pr.state})`)
  }
  lines.push('')
  lines.push('## Writing rules')
  lines.push('')
  lines.push('- Open with the user-visible change, not the implementation.')
  lines.push('- Every section gets one plain-English explanation, then a short **Under the hood** paragraph with workstream links.')
  lines.push('- Keep the body under 65,535 bytes; aim for 30–40 KB with images as URLs.')
  lines.push('- Use the 120-character description from this brief.')
  lines.push('- Praise external issue reporters, PR authors, reviewers and commenters by handle.')
  lines.push('- Screenshots should show the feature, not the whole browser. Prefer a crop that removes global chrome.')
  lines.push('- Do not commit the draft. Commit only the screenshots after proof-reading.')
  lines.push('')
  lines.push('## Next commands')
  lines.push('')
  lines.push('```sh')
  lines.push(`node scripts/devlog.mjs shots --plan ${WORK_DIR}/${slug}/shots.json`)
  lines.push(`node scripts/devlog.mjs draft --slug ${slug}`)
  lines.push(`node scripts/devlog.mjs check ${BLOG_DIR}/${slug}.md`)
  lines.push('```')
  lines.push('')
  writeText(`${WORK_DIR}/${slug}/brief.md`, lines.join('\n'))
}

export async function collect (args) {
  const slug = slugify(args.slug || `${new Date().toISOString().slice(0, 10)}-devlog`)
  ensureDir(`${WORK_DIR}/${slug}`)
  const range = resolveRange(args)
  const commitFiles = readCommitFiles(range.rangeArgs)
  for (const commit of range.commits) commit.files = commitFiles.get(commit.hash) || []

  const allWorkstreams = parseWorkstreams()
  const github = loadGithub(range, args)
  const surfaces = buildSurfaces(range.commits, diffStats(range.base, range.head).files, allWorkstreams, github.issues)
  const workstreams = relevantWorkstreams(allWorkstreams, surfaces, range)
  const contributors = buildContributors(range.commits, github)
  const metrics = buildMetrics(range, surfaces, workstreams, args)
  const previousPost = latestPublishedPost()
  const meta = {
    title: args.title || makeTitle(range, surfaces),
    titleOptions: makeTitleOptions(range, surfaces),
    description: args.description || makeDescription(range, surfaces),
    descriptionOptions: makeDescriptionOptions(range, surfaces),
    tags: args.tags ? String(args.tags).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 5) : makeTags(surfaces),
    slug,
    previousPost,
    range: {
      sinceDate: range.sinceDate,
      untilDate: range.untilDate,
      base: range.base,
      head: range.head,
      days: range.days,
      commits: range.commits.length
    }
  }
  const plan = makeShotPlan(slug, surfaces, range)
  const context = {
    slug,
    generatedAt: new Date().toISOString(),
    range: {
      label: range.label,
      sinceDate: range.sinceDate,
      untilDate: range.untilDate,
      days: range.days,
      base: range.base,
      head: range.head,
      commits: range.commits.length
    },
    stats: metrics,
    meta,
    previousPost,
    commits: range.commits.map(commit => ({
      hash: commit.hash,
      short: commit.hash.slice(0, 7),
      author: commit.author,
      email: commit.email,
      date: commit.date,
      subject: commit.subject,
      type: commit.type,
      scope: commit.scope,
      issues: commit.issues,
      docs: commit.docs,
      files: commit.files
    })),
    surfaces: surfaces.map(surface => ({
      key: surface.key,
      label: surface.label,
      score: surface.score,
      files: surface.files,
      commits: surface.commits,
      issues: surface.issues,
      docs: surface.docs,
      routes: surface.routes,
      shots: surface.shots
    })),
    workstreams,
    issues: github.issues,
    prs: github.prs,
    contributors,
    suggested: {
      title: meta.title,
      description: meta.description,
      tags: meta.tags,
      sections: SECTIONS.filter(section => section.surfaces.some(key => surfaces.some(surface => surface.key === key))),
      shots: plan.shots
    }
  }

  writeJson(`${WORK_DIR}/${slug}/context.json`, context)
  writeJson(`${WORK_DIR}/${slug}/shots.json`, plan)
  writeJson(`${WORK_DIR}/${slug}/meta.json`, meta)
  writeText(`${WORK_DIR}/${slug}/praise.md`, `${praiseParagraph(contributors)}\n`)
  writeBrief({ slug, range, stats: metrics, surfaces, workstreams, issues: github.issues, prs: github.prs, contributors, metrics, meta, plan })

  console.log(`Collected ${range.commits.length} commits (${formatBytes(Buffer.byteLength(JSON.stringify(context)))} context)`)
  console.log(`  ${surfaces.slice(0, 6).map(surface => surface.label).join(', ')}`)
  console.log(`  ${workstreams.length} workstreams, ${github.issues.length} issues, ${contributors.length} contributors`)
  console.log(`  ${WORK_DIR}/${slug}/brief.md`)
  console.log(`  ${WORK_DIR}/${slug}/shots.json`)
  return context
}
