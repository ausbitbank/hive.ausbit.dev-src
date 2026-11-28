#!/usr/bin/env node
// Minimal static server for built dist/spa with history-mode fallback.
// Used by Playwright and the performance baseline; intentionally dependency-free.
// Text assets are compressed with Brotli/gzip when the client supports it so
// local measurements match production transfer sizes more closely.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib'

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

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.xml', '.txt', '.svg', '.map'])
const COMPRESSED = new Map()
const MAX_CACHE_ENTRIES = 240

function compress (file, body, encoding, stamp) {
  const key = file + ':' + encoding + ':' + stamp
  const cached = COMPRESSED.get(key)
  if (cached) return cached
  const result = encoding === 'br'
    ? brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } })
    : gzipSync(body, { level: 6 })
  if (COMPRESSED.size >= MAX_CACHE_ENTRIES) COMPRESSED.clear()
  COMPRESSED.set(key, result)
  return result
}

function accepts (header, encoding) {
  if (!header) return false
  return header.split(',').some(part => {
    const [name, q] = part.trim().split(';q=')
    return name.trim() === encoding && Number(q ?? 1) > 0
  })
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
    // A rebuilt file can keep the same byte length (asset hashes are the same
    // shape), so stamp the cache with mtime instead of the length.
    const stamp = (await stat(file)).mtimeMs
    const type = MIME[extname(file)] || 'application/octet-stream'
    const encodingHeader = request.headers['accept-encoding'] || ''
    const encoding = COMPRESSIBLE.has(extname(file)) && body.length > 1024
      ? (accepts(encodingHeader, 'br') ? 'br' : accepts(encodingHeader, 'gzip') ? 'gzip' : null)
      : null
    const payload = encoding ? compress(file, body, encoding, stamp) : body
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': payload.length,
      'Cache-Control': file.endsWith('sw.js') ? 'no-store' : 'no-cache',
      'Vary': 'Accept-Encoding',
      ...(encoding ? { 'Content-Encoding': encoding } : {})
    })
    response.end(payload)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Static server error: ' + error.message)
  }
})

server.listen(port, host, () => {
  console.log('Serving dist/spa at http://' + host + ':' + port)
})
