#!/usr/bin/env node
// Stamp the production build so an already-open tab can notice a deploy.
//
// A service worker only updates when /sw.js changes byte-for-byte, so a static
// worker means the "update available" prompt in src/boot/pwa.js never fires on
// a normal deploy. The build id below is injected into the worker's cache name
// (public/sw.js contains the placeholder) and published as /version.json.
//
// Usage: node scripts/stamp-build.mjs [dist-directory]

import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BUILD_ID_PLACEHOLDER = '__HIVE_BUILD_ID__'

function gitShortSha () {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export function makeBuildId (now = new Date(), sha = gitShortSha()) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `${stamp}-${sha}`
}

/**
 * Replace the worker's cache placeholder and write version.json. Returns the
 * build id that was stamped.
 */
export async function stampBuild (dir, id = makeBuildId()) {
  const swPath = resolve(dir, 'sw.js')
  const worker = await readFile(swPath, 'utf8')
  if (!worker.includes(BUILD_ID_PLACEHOLDER)) {
    throw new Error(`${swPath} does not contain ${BUILD_ID_PLACEHOLDER}`)
  }

  await writeFile(swPath, worker.split(BUILD_ID_PLACEHOLDER).join(id), 'utf8')
  await writeFile(
    resolve(dir, 'version.json'),
    JSON.stringify({ id, builtAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8'
  )
  return id
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const dist = resolve(process.argv[2] || 'dist/spa')
  const id = await stampBuild(dist)
  console.log(`Stamped build ${id} into sw.js and version.json`)
}
