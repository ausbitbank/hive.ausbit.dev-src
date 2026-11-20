import { BLOB_BASE, DESCRIPTION_MAX, WORK_DIR, BLOG_DIR, HIVE_MAX_BODY_BYTES, RAW_BASE } from './config.mjs'
import {
  exists,
  readJson,
  readText,
  slugify,
  unique,
  writeJson,
  writeText
} from './util.mjs'

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

function praiseFromContext (context) {
  const people = (context.contributors || []).filter(item => item.issues?.length || item.prs?.length || item.comments?.length || item.reviews?.length)
  if (!people.length) return ''
  const parts = people.slice(0, 6).map(person => {
    const bits = []
    if (person.issues?.length) bits.push(`issues ${numbersText(person.issues)}`)
    if (person.prs?.length) bits.push(`PRs ${numbersText(person.prs)}`)
    if (person.comments?.length) bits.push(`comments on ${numbersText(person.comments)}`)
    if (person.reviews?.length) bits.push(`reviews on ${numbersText(person.reviews)}`)
    return `@${person.login || person.name} (${bits.join(', ')})`
  })
  return `Thank you to ${parts.join(', ')} — these reports and contributions directly shaped this update.`
}

function sectionImages (section, plan, results) {
  const enabled = (plan.shots || []).filter(shot => shot.enabled !== false)
  const indexes = new Map(enabled.map((shot, index) => [shot.recipe, index + 1]))
  const captured = new Map((results?.shots || []).map(shot => [shot.recipe, shot]))
  return enabled
    .filter(shot => section.surfaces.includes(shot.surface))
    .map(shot => {
      if (captured.has(shot.recipe)) return captured.get(shot.recipe)
      const index = String(indexes.get(shot.recipe) || 0).padStart(2, '0')
      const file = `${plan.output}/${index}-${shot.recipe}.png`
      return {
        name: shot.recipe,
        surface: shot.surface,
        file,
        url: `${RAW_BASE}/${file}`,
        alt: shot.alt,
        caption: shot.caption
      }
    })
}

function docForSurface (id, surfaceKey, context) {
  const candidates = (context.workstreams || []).filter(doc => doc.id === id)
  if (!candidates.length) return null
  const key = String(surfaceKey || '').toLowerCase()
  return candidates.find(doc => key && doc.path.toLowerCase().includes(key)) || candidates[0]
}

function docLinks (surfaceKey, context) {
  const surface = context.surfaces.find(item => item.key === surfaceKey)
  if (!surface) return ''
  const docs = (surface.docs || [])
    .map(id => docForSurface(id, surfaceKey, context))
    .filter(Boolean)
    .slice(0, 5)
  return docs.map(doc => `[${doc.id}](${BLOB_BASE}/${doc.path})`).join(', ')
}

function shortVersion (context) {
  const sections = context.suggested.sections || []
  return sections.slice(0, 6).map(section => {
    const surfaces = section.surfaces
      .map(key => context.surfaces.find(item => item.key === key))
      .filter(Boolean)
    const labels = surfaces
      .map(item => item.label.toLowerCase())
      .filter(label => !section.title.toLowerCase().includes(label.split(' ')[0]))
      .slice(0, 3)
      .join(', ')
    return `- **${section.title}.**${labels ? ` ${labels}.` : ''}`
  }).join('\n')
}

function daysLabel (days) {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function draft (args) {
  const slug = slugify(args.slug || args._[0] || '')
  if (!slug) throw new Error('Pass --slug <slug> (from collect)')
  const context = readJson(`${WORK_DIR}/${slug}/context.json`)
  if (!context) throw new Error(`No context at ${WORK_DIR}/${slug}/context.json. Run collect first.`)
  const metaPath = `${WORK_DIR}/${slug}/meta.json`
  const plan = readJson(`${WORK_DIR}/${slug}/shots.json`, { shots: [] })
  const results = readJson(`${WORK_DIR}/${slug}/shots-results.json`, null)
  const meta = readJson(metaPath, context.meta)
  if (args.title) meta.title = args.title
  if (args.description) meta.description = args.description
  if (args.tags) meta.tags = String(args.tags).split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 5)

  const out = args.out || `${BLOG_DIR}/${slug}.md`
  if (exists(out) && !args.force) throw new Error(`${out} already exists. Pass --force to overwrite.`)

  const range = context.range
  const stats = context.stats
  const lines = []
  lines.push(`# ${meta.title}`)
  lines.push('')
  lines.push(`*A build update for ${range.sinceDate} to ${range.untilDate}.*`)
  lines.push('')
  if (meta.previousPost?.url) {
    lines.push(`Last time: [${meta.previousPost.title || meta.previousPost.slug}](${meta.previousPost.url}).`)
    lines.push('')
  }
  lines.push(`<!-- DEVLOG: Replace this intro. Open with the user-visible change, not the implementation. Suggested facts: ${stats.commits} commits, ${stats.filesChanged} files, +${stats.insertions.toLocaleString()} / −${stats.deletions.toLocaleString()}. -->`)
  lines.push('')
  lines.push(`The last ${daysLabel(range.days)} produced **${stats.commits} commits** across **${stats.filesChanged} files**. This is what changed, why it matters, and how to try it.`)
  lines.push('')
  lines.push('Here is the short version:')
  lines.push('')
  lines.push(shortVersion(context))
  lines.push('')
  lines.push('Everything below is grouped by the part of the site you actually use. Technical readers can follow the workstream links at the end of each section.')
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const section of context.suggested.sections || []) {
    lines.push(`## ${section.title}`)
    lines.push('')
    const images = sectionImages(section, plan, results)
    for (const image of images) {
      const url = image.url || image.file
      lines.push(`![${image.alt || image.name}](${url})`)
      if (image.caption) lines.push(`*${image.caption}*`)
      lines.push('')
    }
    lines.push(`<!-- DEVLOG: Write 2–4 plain-English paragraphs for "${section.title}". ${section.promise} -->`)
    lines.push('')
    lines.push('_Write the user-visible change first, then the one detail or number that proves it._')
    lines.push('')
    const docs = unique(section.surfaces.flatMap(key => {
      const surface = context.surfaces.find(item => item.key === key)
      return surface?.docs || []
    }))
    const links = unique(section.surfaces.map(key => docLinks(key, context)).filter(Boolean)).join(', ')
    if (docs.length || links) {
      lines.push(`**Under the hood:** ${links || docs.join(', ')}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  }

  lines.push('## The long tail: bugs, edges and paper cuts')
  lines.push('')
  lines.push('<!-- DEVLOG: Mention the issue sweep and the paper cuts that mattered. Keep it specific and short. -->')
  const praise = praiseFromContext(context) || readTextSafe(`${WORK_DIR}/${slug}/praise.md`).trim()
  if (praise) {
    lines.push('')
    lines.push(praise)
  }
  if (context.issues?.length) {
    lines.push('')
    lines.push('Issues touched in this range:')
    for (const issue of context.issues.slice(0, 12)) {
      lines.push(`- #${issue.number} ${issue.title} — @${issue.author || 'unknown'}`)
    }
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## What\'s next')
  lines.push('')
  lines.push('<!-- DEVLOG: List 3–4 concrete next steps. Do not promise dates. -->')
  lines.push('')
  lines.push('The code is open source at [github.com/ausbitbank/hive.ausbit.dev-src](https://github.com/ausbitbank/hive.ausbit.dev-src). If something looks wrong or a feature would make the site more useful, open an issue or reply here.')
  lines.push('')
  writeText(out, lines.join('\n'))

  const description = String(meta.description || '')
  const bytes = Buffer.byteLength(lines.join('\n'))
  const report = {
    out,
    bytes,
    maxBytes: HIVE_MAX_BODY_BYTES,
    description,
    descriptionLength: description.length,
    descriptionMax: DESCRIPTION_MAX,
    images: (results?.shots || []).length,
    placeholders: (lines.join('\n').match(/DEVLOG:/g) || []).length
  }
  writeJson(`${WORK_DIR}/${slug}/draft-report.json`, report)
  console.log(`Draft: ${out}`)
  console.log(`  ${bytes} bytes (limit ${HIVE_MAX_BODY_BYTES}), ${description.length}/${DESCRIPTION_MAX} description chars`)
  console.log(`  ${report.images} captured images, ${report.placeholders} editor placeholders`)
  if (description.length > DESCRIPTION_MAX) console.warn(`  ⚠ description is ${description.length - DESCRIPTION_MAX} chars over the preview limit`)
  if (bytes > HIVE_MAX_BODY_BYTES) console.warn('  ⚠ body exceeds the Hive limit')
  return report
}

function readTextSafe (path) {
  try {
    return readText(path)
  } catch {
    return ''
  }
}
