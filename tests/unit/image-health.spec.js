import { describe, expect, it, vi } from 'vitest'
import {
  analyzeImageHealth,
  coverIssueDetail,
  MIN_COVER_HEIGHT,
  MIN_COVER_WIDTH,
  probeImage,
  probeImages
} from '../../src/services/imageHealth'

function fakeImage (behaviour) {
  const instances = []
  class FakeImage {
    constructor () {
      this.naturalWidth = 0
      this.naturalHeight = 0
      instances.push(this)
    }

    set src (value) {
      this._src = value
      behaviour(this, value)
    }

    get src () {
      return this._src
    }
  }
  return { ImageImpl: FakeImage, instances }
}

describe('image probing', () => {
  it('reports dimensions for a loaded image', async () => {
    const { ImageImpl } = fakeImage(image => {
      image.naturalWidth = 1200
      image.naturalHeight = 630
      image.onload()
    })
    await expect(probeImage('https://images.hive.blog/cover.jpg', { ImageImpl }))
      .resolves.toEqual({
        url: 'https://images.hive.blog/cover.jpg',
        status: 'ok',
        width: 1200,
        height: 630
      })
  })

  it('reports broken, invalid and timed-out images', async () => {
    const broken = fakeImage(image => image.onerror())
    await expect(probeImage('https://images.hive.blog/missing.jpg', { ImageImpl: broken.ImageImpl }))
      .resolves.toMatchObject({ status: 'broken' })

    const timedOut = fakeImage(() => {})
    await expect(probeImage('https://images.hive.blog/slow.jpg', {
      ImageImpl: timedOut.ImageImpl,
      timeoutMs: 5
    })).resolves.toMatchObject({ status: 'timeout' })

    await expect(probeImage('javascript:alert(1)', { ImageImpl: broken.ImageImpl }))
      .resolves.toMatchObject({ status: 'invalid' })
  })

  it('deduplicates URLs before probing', async () => {
    const load = vi.fn(image => {
      image.naturalWidth = 800
      image.naturalHeight = 600
      image.onload()
    })
    const { ImageImpl, instances } = fakeImage(load)
    const results = await probeImages([
      'https://images.hive.blog/a.jpg',
      'https://images.hive.blog/a.jpg',
      'https://images.hive.blog/b.jpg'
    ], { ImageImpl })
    expect(results).toHaveLength(2)
    expect(instances).toHaveLength(2)
  })
})

describe('image health summary', () => {
  const ok = { url: 'https://images.hive.blog/ok.jpg', status: 'ok', width: 1200, height: 630 }
  const small = { url: 'https://images.hive.blog/small.jpg', status: 'ok', width: 320, height: 200 }
  const portrait = { url: 'https://images.hive.blog/portrait.jpg', status: 'ok', width: 700, height: 900 }
  const broken = { url: 'https://images.hive.blog/broken.jpg', status: 'broken' }

  it('flags broken images and small or portrait covers', () => {
    const brokenHealth = analyzeImageHealth([ok, broken], { coverUrl: ok.url })
    expect(brokenHealth.broken).toEqual([broken])
    expect(brokenHealth.coverIssues).toEqual([])

    const smallHealth = analyzeImageHealth([small], { coverUrl: small.url })
    expect(smallHealth.coverIssues.map(issue => issue.code)).toEqual(['small'])
    expect(coverIssueDetail(smallHealth.coverIssues)).toContain('320×200')

    const portraitHealth = analyzeImageHealth([portrait], { coverUrl: portrait.url })
    expect(portraitHealth.coverIssues.map(issue => issue.code)).toEqual(['portrait'])
    expect(coverIssueDetail(portraitHealth.coverIssues)).toContain('portrait')
    expect(coverIssueDetail(portraitHealth.coverIssues)).toContain(MIN_COVER_WIDTH + '×' + MIN_COVER_HEIGHT)
  })

  it('does not add quality issues for a broken cover', () => {
    const health = analyzeImageHealth([broken], { coverUrl: broken.url })
    expect(health.coverIssues).toEqual([])
    expect(health.cover).toEqual(broken)
  })
})
