#!/usr/bin/env node
// Download the latest Obscura release into .tools/obscura for the fast E2E
// suite. Run with `bun run e2e:install`.

import { spawn } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const TARGET = resolve(ROOT, '.tools/obscura')
const VERSION = process.env.OBSCURA_VERSION || 'latest'

function archiveFor (platform, arch) {
  if (platform === 'linux' && arch === 'x64') return 'obscura-x86_64-linux.tar.gz'
  if (platform === 'linux' && arch === 'arm64') return 'obscura-aarch64-linux.tar.gz'
  if (platform === 'darwin' && arch === 'arm64') return 'obscura-aarch64-macos.tar.gz'
  if (platform === 'darwin' && arch === 'x64') return 'obscura-x86_64-macos.tar.gz'
  return null
}

async function main () {
  const archive = archiveFor(process.platform, process.arch)
  if (!archive) {
    console.error('No Obscura release archive for ' + process.platform + '/' + process.arch)
    process.exit(1)
  }

  const url = VERSION === 'latest'
    ? 'https://github.com/h4ckf0r0day/obscura/releases/latest/download/' + archive
    : 'https://github.com/h4ckf0r0day/obscura/releases/download/' + VERSION + '/' + archive

  console.log('Downloading ' + url)
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error('Download failed with HTTP ' + response.status)

  await mkdir(TARGET, { recursive: true })
  const archivePath = resolve(TARGET, archive)
  await writeFile(archivePath, Buffer.from(await response.arrayBuffer()))
  console.log('Extracting to ' + TARGET)

  await new Promise((resolvePromise, reject) => {
    const tar = spawn('tar', ['-xzf', archivePath, '-C', TARGET], { stdio: 'inherit' })
    tar.on('exit', code => code === 0 ? resolvePromise() : reject(new Error('tar exited with code ' + code)))
  })

  await chmod(resolve(TARGET, 'obscura'), 0o755)
  console.log('Obscura installed at ' + resolve(TARGET, 'obscura'))
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
