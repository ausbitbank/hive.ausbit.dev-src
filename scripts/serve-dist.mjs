#!/usr/bin/env node
// Minimal static server for built dist/spa with history-mode fallback.
// Used by Playwright; intentionally dependency-free.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.cwd(), 'dist/spa')
const port = Number(process.env.PORT) || 4173
const host = process.env.HOST || '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
}

async function fileFor (pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(root, clean)
  try {
    const info = await stat(candidate)
    if (info.isFile()) return candidate
  } catch {}
  try {
    const dirIndex = join(candidate, 'index.html')
    const info = await stat(dirIndex)
    if (info.isFile()) return dirIndex
  } catch {}
  return join(root, 'index.html')
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost')
    const file = await fileFor(url.pathname)
    const body = await readFile(file)
    response.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'no-cache'
    })
    response.end(body)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Static server error: ' + error.message)
  }
})

server.listen(port, host, () => {
  console.log('Serving dist/spa at http://' + host + ':' + port)
})
