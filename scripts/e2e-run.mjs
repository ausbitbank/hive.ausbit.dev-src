#!/usr/bin/env node
// Run a Playwright suite with a statically managed build server.
//
// Playwright's webServer lifecycle has dropped the static server mid-run under
// parallel load, producing false "connection refused" failures. This wrapper
// starts the server once, waits for it, and only stops processes it started.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PORT = Number(process.env.E2E_PORT) || 4173
const BASE_URL = 'http://127.0.0.1:' + PORT
const OBSCURA_PORT = Number(process.env.OBSCURA_PORT) || 9222
const OBSCURA_CDP = 'ws://127.0.0.1:' + OBSCURA_PORT + '/devtools/browser'
const OBSCURA_HEALTH = 'http://127.0.0.1:' + OBSCURA_PORT + '/json/version'
const OBSCURA_BIN = process.env.OBSCURA_BIN || resolve(ROOT, '.tools/obscura/obscura')
const USE_OBSCURA = process.env.E2E_BROWSER === 'obscura'

let config = process.env.E2E_CONFIG || 'playwright.config.js'
const passthrough = []
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--config=')) config = arg.slice('--config='.length)
  else passthrough.push(arg)
}

async function isUp (url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

async function waitFor (url, attempts = 40) {
  for (let index = 0; index < attempts; index++) {
    if (await isUp(url)) return true
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return false
}

async function ensureStaticServer () {
  if (await isUp(BASE_URL)) return null
  const child = spawn(process.execPath, [resolve(ROOT, 'scripts/serve-dist.mjs')], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(PORT) }
  })
  if (!(await waitFor(BASE_URL))) {
    child.kill('SIGTERM')
    throw new Error('Static server did not start on ' + BASE_URL)
  }
  return child
}

async function ensureObscura () {
  if (await isUp(OBSCURA_HEALTH)) return null
  if (!existsSync(OBSCURA_BIN)) {
    throw new Error(
      'Obscura was not found at ' + OBSCURA_BIN + '\n' +
      'Install it with: bun run e2e:install\n' +
      'Or set OBSCURA_BIN to an existing binary.'
    )
  }
  const child = spawn(OBSCURA_BIN, [
    'serve',
    '--port', String(OBSCURA_PORT),
    '--allow-private-network',
    '--quiet'
  ], { stdio: 'inherit' })
  if (!(await waitFor(OBSCURA_HEALTH))) {
    child.kill('SIGTERM')
    throw new Error('Obscura did not start on ' + OBSCURA_HEALTH)
  }
  return child
}

function stop (child) {
  if (child && !child.killed) child.kill('SIGTERM')
}

let server = null
let obscura = null
let runner = null

function shutdown () {
  stop(runner)
  stop(obscura)
  stop(server)
  process.exit(130)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main () {
  server = await ensureStaticServer()
  const env = { ...process.env }
  if (USE_OBSCURA) {
    obscura = await ensureObscura()
    env.OBSCURA_CDP = OBSCURA_CDP
  }

  runner = spawn(resolve(ROOT, 'node_modules/.bin/playwright'), [
    'test',
    '--config=' + config,
    ...passthrough
  ], { stdio: 'inherit', env })

  runner.on('exit', code => {
    stop(obscura)
    stop(server)
    process.exit(code ?? 1)
  })
}

main().catch(error => {
  console.error(error.message)
  stop(obscura)
  stop(server)
  process.exit(1)
})
