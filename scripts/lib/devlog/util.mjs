import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export function rootPath (...parts) {
  return resolve(ROOT, ...parts)
}

export function relPath (path) {
  return relative(ROOT, path).replaceAll('\\', '/')
}

export function exists (path) {
  return existsSync(rootPath(path))
}

export function readText (path) {
  return readFileSync(rootPath(path), 'utf8')
}

export function readJson (path, fallback = null) {
  try {
    return JSON.parse(readText(path))
  } catch {
    return fallback
  }
}

export function ensureDir (path) {
  mkdirSync(rootPath(path), { recursive: true })
}

export function writeText (path, text) {
  ensureDir(dirname(rootPath(path)))
  writeFileSync(rootPath(path), text)
}

export function writeJson (path, value) {
  writeText(path, JSON.stringify(value, null, 2) + '\n')
}

export function listFiles (path, predicate = () => true) {
  const abs = rootPath(path)
  if (!existsSync(abs)) return []
  return readdirSync(abs)
    .map(name => join(abs, name))
    .filter(item => statSync(item).isFile() && predicate(item))
    .map(item => relPath(item))
}

export function sha256 (buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export function slugify (value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'devlog'
}

export function parseArgs (argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i]
    if (!item.startsWith('--')) {
      args._.push(item)
      continue
    }
    const [key, inline] = item.slice(2).split('=')
    if (inline !== undefined) {
      if (inline === 'false') args[key] = false
      else if (inline === 'true') args[key] = true
      else args[key] = inline
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[++i]
    } else {
      args[key] = true
    }
  }
  return args
}

export function run (command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options
  })
  if (result.error) throw result.error
  if (result.status !== 0 && !options.allowFail) {
    const detail = (result.stderr || result.stdout || '').trim().split('\n').slice(-4).join('\n')
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})${detail ? `\n${detail}` : ''}`)
  }
  return result
}

export function git (args, options = {}) {
  return run('git', args, options).stdout.trim()
}

export function gitMaybe (args) {
  try {
    return git(args)
  } catch {
    return ''
  }
}

export function hasCommand (command) {
  return spawnSync(command, ['--version'], { cwd: ROOT, stdio: 'ignore' }).status === 0
}

export function formatBytes (bytes) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function truncate (value, length = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= length ? text : text.slice(0, length - 1).trimEnd() + '…'
}

export function unique (values) {
  return [...new Set(values.filter(Boolean))]
}

export function pct (value) {
  return `${Math.round(value * 100)}%`
}

export function parseDayStart (value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`
  return value
}

export function parseDayEnd (value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T23:59:59`
  return value
}

export function pngSize (buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

export function fileSize (path) {
  try {
    return statSync(rootPath(path)).size
  } catch {
    return 0
  }
}

export function relativeImagePath (absolutePath) {
  return relPath(absolutePath).replace(/^docs\/screenshots\/devlog\//, '')
}

export function extension (path) {
  return extname(path).toLowerCase()
}

export function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function sortBy (items, key, direction = 'desc') {
  return [...items].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a[key]
    const bv = typeof key === 'function' ? key(b) : b[key]
    if (av === bv) return 0
    return (av < bv ? -1 : 1) * (direction === 'asc' ? 1 : -1)
  })
}
