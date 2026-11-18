#!/usr/bin/env node
// Cloudflare Rocket Loader rewrites module scripts unless they opt out. The
// app is already a single ES-module entry; letting Rocket Loader defer it only
// delays the first paint. Mark the entry script so Cloudflare leaves it alone.

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'dist/spa/index.html')
const html = await readFile(file, 'utf8')
const next = html.replace(
  /<script type="module"([^>]*)>/g,
  (tag, attrs) => attrs.includes('data-cfasync=') ? tag : '<script data-cfasync="false" type="module"' + attrs + '>'
)
if (next !== html) {
  await writeFile(file, next, 'utf8')
  console.log('Marked the SPA entry script with data-cfasync="false".')
} else {
  console.log('SPA entry script already compatible with Rocket Loader.')
}
