import { BRANCH, DESCRIPTION_MAX, HIVE_MAX_BODY_BYTES, HIVE_WARN_BODY_BYTES, RAW_BASE, WORK_DIR } from './config.mjs'
import {
  exists,
  fileSize,
  formatBytes,
  pngSize,
  readJson,
  readText,
  rootPath,
  slugify,
  truncate
} from './util.mjs'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

function localFromUrl (url) {
  if (url.startsWith(RAW_BASE + '/')) return url.slice(RAW_BASE.length + 1)
  if (url.startsWith('https://github.com/') && url.includes(`/raw/${BRANCH}/`)) {
    return url.split(`/raw/${BRANCH}/`)[1]
  }
  return ''
}

function resolveImagePath (url, postPath) {
  const fromUrl = localFromUrl(url)
  if (fromUrl) return fromUrl
  if (/^https?:\/\//.test(url)) return ''
  if (url.startsWith('/')) return url.slice(1)
  return resolve(dirname(rootPath(postPath)), url).replace(rootPath('.') + '/', '')
}

function sectionText (text, name) {
  const regex = new RegExp(`^##\\s+${name}.*$`, 'im')
  const match = regex.exec(text)
  if (!match) return ''
  const rest = text.slice(match.index + match[0].length)
  const end = rest.search(/^##\s+/m)
  return rest.slice(0, end === -1 ? rest.length : end)
}

export function check (args) {
  const postPath = args.file || args._[0]
  if (!postPath) throw new Error('Pass a markdown file, e.g. node scripts/devlog.mjs check docs/blog/2026-11-20.md')
  if (!exists(postPath)) throw new Error(`No such file: ${postPath}`)
  const text = readText(postPath)
  const bytes = Buffer.byteLength(text)
  const maxBytes = Number(args['max-bytes'] || HIVE_MAX_BODY_BYTES)
  const warnBytes = Number(args['warn-bytes'] || HIVE_WARN_BODY_BYTES)
  const strict = Boolean(args.strict)
  const errors = []
  const warnings = []

  if (bytes > maxBytes) errors.push(`Body is ${bytes} bytes, over the ${maxBytes}-byte Hive limit.`)
  else if (bytes > warnBytes) warnings.push(`Body is ${bytes} bytes; ${formatBytes(maxBytes - bytes)} of headroom left.`)

  const h1 = [...text.matchAll(/^#\s+(.+)$/gm)]
  if (h1.length !== 1) warnings.push(`Expected exactly one H1, found ${h1.length}.`)
  if (h1[0] && h1[0][1].length > 255) errors.push('Title is longer than 255 characters.')

  const images = [...text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map(match => ({ alt: match[1].trim(), url: match[2].trim() }))
  let imageBytes = 0
  const missingImages = []
  for (const image of images) {
    if (!image.alt) errors.push(`Image has no alt text: ${truncate(image.url, 100)}`)
    const local = resolveImagePath(image.url, postPath)
    if (!local) {
      warnings.push(`Remote image cannot be checked locally: ${truncate(image.url, 120)}`)
      continue
    }
    if (!exists(local)) {
      missingImages.push(local)
      errors.push(`Missing image: ${local}`)
      continue
    }
    const size = fileSize(local)
    imageBytes += size
    try {
      const buffer = readFileSync(rootPath(local))
      const dimensions = pngSize(buffer)
      if (dimensions && (dimensions.width > 2000 || dimensions.height > 2000)) {
        warnings.push(`Large image dimensions: ${local} (${dimensions.width}×${dimensions.height})`)
      }
    } catch {}
    if (!/^https?:\/\//.test(image.url)) warnings.push(`Image is not a public URL: ${local}`)
  }
  if (imageBytes > 6 * 1024 * 1024) warnings.push(`Images total ${formatBytes(imageBytes)}; consider re-cropping or optimising.`)
  if (!images.length) warnings.push('No images found.')

  const links = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(match => ({ label: match[1], url: match[2] }))
  for (const link of links) {
    if (link.url.includes('/docs/workstreams/')) {
      const path = link.url.split('/docs/workstreams/')[1]?.split(/[?#]/)[0]
      if (path && !exists(`docs/workstreams/${path}`)) errors.push(`Missing workstream doc: docs/workstreams/${path}`)
    }
  }

  const placeholders = [...text.matchAll(/<!--\s*DEVLOG:[\s\S]*?-->/g)]
  if (placeholders.length) {
    const message = `${placeholders.length} editor placeholder(s) left in the draft.`
    if (strict) errors.push(message)
    else warnings.push(message)
  }
  for (const token of ['_Write the user-visible change', 'TODO']) {
    if (text.includes(token)) {
      const message = `Placeholder text remains: "${token}"`
      if (strict) errors.push(message)
      else warnings.push(message)
    }
  }

  let meta
  if (args.meta) meta = readJson(args.meta)
  else {
    const slug = slugify(postPath.split('/').pop().replace(/\.md$/, ''))
    meta = readJson(`${WORK_DIR}/${slug}/meta.json`, null)
  }
  const description = args.description || meta?.description || ''
  if (description) {
    if (description.length > DESCRIPTION_MAX) errors.push(`Description is ${description.length}/${DESCRIPTION_MAX} characters.`)
    else console.log(`Description: ${description.length}/${DESCRIPTION_MAX} — ${description}`)
  } else {
    warnings.push('No 120-character description supplied (pass --description or --meta).')
  }
  if (meta?.tags && meta.tags.length > 5) errors.push('More than five Hive tags.')

  const tags = meta?.tags || (args.tags ? String(args.tags).split(',').map(tag => tag.trim()) : [])
  if (tags.length && tags.some(tag => !/^[a-z0-9-]+$/.test(tag))) warnings.push('Tags should be lowercase letters, numbers and hyphens.')

  const praise = sectionText(text, 'The long tail')
  if (!/@[a-z0-9.-]+/i.test(praise)) warnings.push('No contributor handles found in the long-tail section. Did you thank the issue reporters?')

  const report = {
    file: postPath,
    bytes,
    maxBytes,
    headroom: maxBytes - bytes,
    images: images.length,
    imageBytes,
    headings: h1.length,
    descriptionLength: description.length,
    errors,
    warnings,
    ok: errors.length === 0
  }

  console.log('')
  console.log(`Devlog check: ${postPath}`)
  console.log(`  body      ${bytes.toLocaleString()} / ${maxBytes.toLocaleString()} bytes (${formatBytes(maxBytes - bytes)} headroom)`)
  console.log(`  images    ${images.length} (${formatBytes(imageBytes)})`)
  console.log(`  headings  ${h1.length} H1, ${(text.match(/^##\s+/gm) || []).length} H2`)
  if (description) console.log(`  preview   ${description.length}/${DESCRIPTION_MAX} chars`)
  console.log('')
  for (const warning of warnings) console.log(`  ⚠ ${warning}`)
  for (const error of errors) console.log(`  ✗ ${error}`)
  if (!warnings.length && !errors.length) console.log('  ✓ clean')
  if (errors.length) process.exitCode = 1
  return report
}
