import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useHiveStore } from '../../src/stores/hive'
import PostPreview from '../../src/components/postPreview.vue'
import { postImage, postSummary, previewImageUrl } from '../../src/utils/postPreview'
import { prefetchRoute, resetPrefetchCache } from '../../src/router/prefetch'

describe('postImage', () => {
  it('prefers metadata thumbnails, then image arrays', () => {
    expect(postImage({
      json_metadata: JSON.stringify({ thumbnails: ['https://cdn.example/thumb.jpg'], image: ['https://cdn.example/full.jpg'] })
    })).toBe('https://cdn.example/thumb.jpg')
    expect(postImage({
      json_metadata: JSON.stringify({ image: ['https://cdn.example/full.jpg'] })
    })).toBe('https://cdn.example/full.jpg')
  })

  it('decodes HTML entities in image URLs', () => {
    expect(postImage({
      json_metadata: JSON.stringify({ image: 'https://cdn.example/a.jpg?x=1&amp;y=2' })
    })).toBe('https://cdn.example/a.jpg?x=1&y=2')
  })

  it('finds markdown, HTML and bare body images', () => {
    expect(postImage({ body: '![alt](https://cdn.example/markdown.png)' })).toBe('https://cdn.example/markdown.png')
    expect(postImage({ body: '<p><img src="https://cdn.example/html.webp" alt=""></p>' })).toBe('https://cdn.example/html.webp')
    expect(postImage({ body: 'Look https://cdn.example/bare.gif here' })).toBe('https://cdn.example/bare.gif')
  })

  it('returns an empty string when no image exists', () => {
    expect(postImage(null)).toBe('')
    expect(postImage({ body: 'Plain text only.' })).toBe('')
  })

  it('requests a small Cloudinary variant for card images', () => {
    expect(postImage({
      json_metadata: JSON.stringify({
        image: 'https://res.cloudinary.com/demo/image/upload/v1234/photo.jpg'
      })
    })).toBe('https://res.cloudinary.com/demo/image/upload/w_480,q_auto:eco,f_auto/v1234/photo.jpg')

    expect(postImage({
      json_metadata: JSON.stringify({
        image: 'https://res.cloudinary.com/demo/image/upload/w_320,q_auto/v1234/photo.jpg'
      })
    })).toBe('https://res.cloudinary.com/demo/image/upload/w_320,q_auto/v1234/photo.jpg')
  })

  it('requests a resized copy through images.hive.blog for card images', () => {
    expect(previewImageUrl('https://images.hive.blog/DQmExample/photo.png', 400))
      .toBe('https://images.hive.blog/400x0/https://images.hive.blog/DQmExample/photo.png')
    expect(previewImageUrl('https://files.peakd.com/file/peakd-hive/alice/photo.png', 480))
      .toBe('https://images.hive.blog/480x0/https://files.peakd.com/file/peakd-hive/alice/photo.png')
    // Already transformed URLs and unknown hosts are left untouched.
    expect(previewImageUrl('https://images.hive.blog/p/abc?width=400', 400))
      .toBe('https://images.hive.blog/p/abc?width=400')
    expect(previewImageUrl('https://cdn.example/photo.png', 400))
      .toBe('https://cdn.example/photo.png')
  })

  it('requests the compact YouTube thumbnail for card images', () => {
    expect(postImage({
      json_metadata: JSON.stringify({
        image: 'https://i.ytimg.com/vi/4mvf4Bguquo/maxresdefault.jpg'
      })
    })).toBe('https://i.ytimg.com/vi/4mvf4Bguquo/hqdefault.jpg')
  })
})

describe('postSummary', () => {
  it('strips markdown, links, images and code', () => {
    const summary = postSummary({
      body: '# Heading\n\n![image](https://cdn.example/a.png)\n\nA [link](https://example.com) and `code`.\n\n```js\nconst x = 1\n```'
    }, 200)
    expect(summary).toContain('Heading')
    expect(summary).toContain('A link and')
    expect(summary).not.toContain('https://')
    expect(summary).not.toContain('const x')
  })

  it('decodes entities and truncates at a word boundary', () => {
    const summary = postSummary({ body: 'One &amp; two three four five six seven eight nine ten' }, 24)
    expect(summary).toContain('One & two')
    expect(summary.endsWith('…')).toBe(true)
    expect(summary.length).toBeLessThanOrEqual(27)
  })

  it('returns an empty string for missing bodies', () => {
    expect(postSummary(null)).toBe('')
    expect(postSummary({ body: '' })).toBe('')
  })
})

describe('post card vote indicator', () => {
  function mountCard (vote) {
    setActivePinia(createPinia())
    const store = useHiveStore()
    store.user.username = 'alice'
    const basePost = {
      author: 'bob',
      permlink: 'hello-world',
      title: 'Hello',
      children: 0,
      json_metadata: {},
      stats: { total_votes: 12 },
      active_votes: [{ voter: 'alice', rshares: vote }]
    }
    return mount(PostPreview, {
      props: { post: basePost, styleType: 'cards' },
      global: {
        plugins: [{ install (app) { app.config.globalProperties.$hiveStore = store } }],
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
          'q-avatar': true,
          'q-img': true,
          'q-icon': { template: '<i class="q-icon"><slot /></i>' },
          'q-space': true
        }
      }
    })
  }

  it('marks an upvoted card', () => {
    const wrapper = mountCard(12345)
    expect(wrapper.find('.post-card').classes()).toContain('post-card--voted-up')
    expect(wrapper.find('.post-card__stat--voted-up').exists()).toBe(true)
    expect(wrapper.find('.post-card__voted-label').text()).toBe('Upvoted')
  })

  it('marks a downvoted card', () => {
    const wrapper = mountCard('-12345')
    expect(wrapper.find('.post-card').classes()).toContain('post-card--voted-down')
    expect(wrapper.find('.post-card__stat--voted-down').exists()).toBe(true)
    expect(wrapper.find('.post-card__voted-label').text()).toBe('Downvoted')
  })

  it('leaves an unvoted card plain', () => {
    const wrapper = mountCard(0)
    expect(wrapper.find('.post-card').classes()).not.toContain('post-card--voted-up')
    expect(wrapper.find('.post-card').classes()).not.toContain('post-card--voted-down')
    expect(wrapper.find('.post-card__voted-label').exists()).toBe(false)
  })
})

describe('prefetchRoute', () => {
  it('loads each matched route loader once', async () => {
    resetPrefetchCache()
    const loader = vi.fn(() => Promise.resolve())
    const router = { resolve: vi.fn(() => ({ matched: [{ components: { default: loader } }] })) }

    expect(prefetchRoute(router, '/browse')).toBe(true)
    expect(prefetchRoute(router, '/browse')).toBe(false)
    await Promise.resolve()
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('ignores paths without a matched route', () => {
    resetPrefetchCache()
    const router = { resolve: vi.fn(() => ({ matched: [] })) }
    expect(prefetchRoute(router, '/missing')).toBe(false)
  })
})
