#!/usr/bin/env node
// Run the fast functional E2E suite against Obscura.
//
// Obscura exposes a CDP server; `e2e/fixtures.js` connects Playwright over CDP
// when OBSCURA_CDP is set. Chromium-only specs (perf, PWA and resilience) are
// excluded by playwright.obscura.config.js and still run with `test:e2e:full`.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const PORT = Number(process.env.OBSCURA_PORT) || 9222
const CDP_URL = 'ws://127.0.0.1:' + PORT + '/devtools/browser'
const HEALTH_URL = 'http://127.0.0.1:' + PORT + '/json/version'
const DEFAULT_BIN = resolve(ROOT, '.tools/obscura/obscura')
const OBSCURA_BIN = process.env.OBSCURA_BIN || DEFAULT_BIN

async function isRunning () {
  try {
    const response = await fetch(HEALTH_URL)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer (attempts = 40) {
  for (let index = 0; index < attempts; index++) {
    if (await isRunning()) return true
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  return false
}

let obscura = null

async function main () {
  if (!(await isRunning())) {
    if (!existsSync(OBSCURA_BIN)) {
      console.error('Obscura was not found at ' + OBSCURA_BIN)
      console.error('Install it with: bun run e2e:install')
      console.error('Or point OBSCURA_BIN at an existing obscura binary.')
      process.exit(1)
    }

    obscura = spawn(OBSCURA_BIN, [
      'serve',
      '--port', String(PORT),
      '--allow-private-network',
      '--quiet'
    ], { stdio: 'inherit' })

    obscura.on('exit', code => {
      if (code && code !== 0) console.error('Obscura exited with code ' + code)
    })

    if (!(await waitForServer())) {
      console.error('Obscura did not start on ' + HEALTH_URL)
      obscura.kill('SIGTERM')
      process.exit(1)
    }
  }

  const args = [
    'test',
    '--config=playwright.obscura.config.js',
    ...process.argv.slice(2)
  ]
  const runner = spawn(resolve(ROOT, 'node_modules/.bin/playwright'), args, {
    stdio: 'inherit',
    env: { ...process.env, OBSCURA_CDP: CDP_URL }
  })

  runner.on('exit', code => {
    if (obscura) obscura.kill('SIGTERM')
    process.exit(code ?? 1)
  })
}

function shutdown () {
  if (obscura) obscura.kill('SIGTERM')
  process.exit(130)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch(error => {
  console.error(error.message)
  shutdown()
})
