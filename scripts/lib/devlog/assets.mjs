import { exists, fileSize, formatBytes, listFiles, run } from './util.mjs'
import { IMAGE_BASE, SHOT_ROOT } from './config.mjs'

// The asset vhost mirrors the repository path, so published URLs are stable and
// the devlog tooling does not reshape paths when the origin changes.
export const ASSET_HOST = 'hurgenburgen'
export const ASSET_ROOT = '/var/www/files.banksia.io'

// Both the current name and the pre-rename name resolve here while the old
// repository redirect lasts; drafts written before the move keep working.
const REPO_NAMES = ['ausbitbank/banksia.io', 'ausbitbank/hive.ausbit.dev-src']

export function imageUrl (file) {
  return `${IMAGE_BASE}/${String(file).replace(/^\/+/, '')}`
}

// Map a published image URL back to its repository path. Returns '' for images
// the devlog does not own, which `check` reports as unverifiable rather than
// missing.
export function localImagePath (url) {
  const clean = String(url).split(/[?#]/)[0]
  const hosted = `${IMAGE_BASE}/`
  if (clean.startsWith(hosted)) return clean.slice(hosted.length)

  const raw = clean.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/[^/]+\/(.+)$/)
  if (raw && REPO_NAMES.includes(raw[1])) return raw[2]

  const blob = clean.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/raw\/[^/]+\/(.+)$/)
  if (blob && REPO_NAMES.includes(blob[1])) return blob[2]

  return ''
}

// Copy a slug's screenshots to the asset host and prove they resolve. Uploading
// before the commit is deliberate: the draft embeds the public URLs, so they
// must work as soon as the draft is published.
export async function syncAssets (args) {
  const slug = args.slug
  if (!slug) throw new Error('Pass --slug <slug>')
  const dir = args.dir || `${SHOT_ROOT}/${slug}`
  if (!exists(dir)) throw new Error(`No screenshot directory: ${dir}`)

  const files = listFiles(dir, path => /\.(png|jpe?g|webp)$/i.test(path))
  if (!files.length) throw new Error(`No images in ${dir}`)

  const host = args.host || ASSET_HOST
  const remoteDir = `${ASSET_ROOT}/${dir}/`
  const total = files.length

  console.log(`Syncing ${total} images (${formatBytes(files.reduce((sum, file) => sum + (exists(file) ? fileSize(file) : 0), 0))})`)
  console.log(`  ${dir}/ -> ${host}:${remoteDir}`)
  if (args['dry-run']) {
    console.log(`  rsync -a --chmod=D755,F644 ${dir}/ ${host}:${remoteDir}`)
    return { dir, files }
  }

  run('rsync', ['-a', '--chmod=D755,F644', `${dir}/`, `${host}:${remoteDir}`], { stdio: 'inherit' })

  if (args['no-verify']) return { dir, files }

  const failures = []
  for (const file of files) {
    const url = imageUrl(file)
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) failures.push(`${response.status} ${url}`)
    } catch (error) {
      failures.push(`${error.message} ${url}`)
    }
  }
  if (failures.length) {
    throw new Error(`Uploaded images are not reachable:\n${failures.join('\n')}`)
  }
  console.log(`  verified ${total} URLs at ${IMAGE_BASE}`)
  return { dir, files }
}
