import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BUILD_ID_PLACEHOLDER, makeBuildId, stampBuild } from '../../scripts/stamp-build.mjs'

let dir

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

describe('build stamping', () => {
  it('produces a sortable id that includes the commit', () => {
    const id = makeBuildId(new Date('2026-11-25T10:11:12.000Z'), 'abc123')
    expect(id).toBe('20261125T101112Z-abc123')
  })

  it('rewrites the service worker cache name and publishes version.json', async () => {
    dir = await mkdtemp(join(tmpdir(), 'hive-stamp-'))
    await writeFile(
      join(dir, 'sw.js'),
      "const CACHE = 'hive-ausbit-shell-" + BUILD_ID_PLACEHOLDER + "'\n",
      'utf8'
    )

    const id = await stampBuild(dir, 'test-build-id')

    expect(id).toBe('test-build-id')
    expect(await readFile(join(dir, 'sw.js'), 'utf8')).toContain("'hive-ausbit-shell-test-build-id'")
    const version = JSON.parse(await readFile(join(dir, 'version.json'), 'utf8'))
    expect(version.id).toBe('test-build-id')
    expect(Number.isNaN(Date.parse(version.builtAt))).toBe(false)
  })

  it('fails loudly when the worker template has no placeholder', async () => {
    dir = await mkdtemp(join(tmpdir(), 'hive-stamp-'))
    await writeFile(join(dir, 'sw.js'), 'const CACHE = "fixed"\n', 'utf8')
    await expect(stampBuild(dir, 'test-build-id')).rejects.toThrow(BUILD_ID_PLACEHOLDER)
  })
})
