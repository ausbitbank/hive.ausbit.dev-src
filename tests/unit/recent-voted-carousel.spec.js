import { afterEach, describe, expect, it, vi } from 'vitest'
import Carousel from '../../src/components/recentVotedPostsCarousel.vue'

const methods = Carousel.methods

describe('recent voted carousel helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads only https-agnostic metadata images safely', () => {
    expect(methods.returnPostImage({ json_metadata: '{"image":["https://cdn.example/a.png"]}' })).toBe('https://cdn.example/a.png')
    expect(methods.returnPostImage({ json_metadata: { image: ['https://cdn.example/b.png'] } })).toBe('https://cdn.example/b.png')
    expect(methods.returnPostImage({ json_metadata: { image: 'https://cdn.example/c.png' } })).toBe('https://cdn.example/c.png')
    expect(methods.returnPostImage({ json_metadata: 'not json' })).toBeNull()
    expect(methods.returnPostImage({ json_metadata: { image: [] } })).toBeNull()
    expect(methods.returnPostImage({})).toBeNull()
    expect(methods.returnPostImage(null)).toBeNull()
  })

  it('caps retries at five and stops after unmount', () => {
    vi.useFakeTimers()
    const context = {
      destroyed: false,
      retryTimer: null,
      retryCount: 0,
      getRecentVotes: vi.fn()
    }

    for (let index = 0; index < 8; index++) {
      methods.scheduleRetry.call(context, 'alice')
      vi.runAllTimers()
    }
    expect(context.getRecentVotes).toHaveBeenCalledTimes(5)

    const unmounted = {
      destroyed: true,
      retryTimer: null,
      retryCount: 0,
      getRecentVotes: vi.fn()
    }
    methods.scheduleRetry.call(unmounted, 'alice')
    vi.runAllTimers()
    expect(unmounted.getRecentVotes).not.toHaveBeenCalled()
  })
})
