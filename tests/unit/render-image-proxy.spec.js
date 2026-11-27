import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Render from '../../src/components/render.vue'
import { DEFAULT_IMAGE_PROXY, setImageProxyMode } from '../../src/services/imageProxy'

const BODY = '![photo](https://files.peakd.com/file/peakd-hive/alice/photo.jpg)'
const RAW_GITHUB_BODY = '![about](https://raw.githubusercontent.com/ausbitbank/hive.ausbit.dev-src/master/docs/screenshots/devlog/2026-11-27-devlog/01-about-mark.png)'

async function renderBody (body) {
  const wrapper = mount(Render, {
    props: { input: body },
    global: { stubs: { 'q-skeleton': true } }
  })
  await flushPromises()
  await vi.waitFor(() => expect(wrapper.html()).toContain('<img'))
  return wrapper
}

afterEach(() => setImageProxyMode(DEFAULT_IMAGE_PROXY))

describe('render image proxy', () => {
  it('serves body images from the Hive image host by default', async () => {
    setImageProxyMode('hive')
    const wrapper = await renderBody(BODY)
    const html = wrapper.html()
    expect(html).toContain('https://images.hive.blog/p/')
    expect(html).not.toContain('i.ecency.com/p/')
    // The Hive host does not produce AVIF, so the format sources are dropped.
    expect(html).not.toContain('<source')
  })

  it('loads GitHub raw images directly when the Hive proxy cannot fetch them', async () => {
    setImageProxyMode('hive')
    const wrapper = await renderBody(RAW_GITHUB_BODY)
    const html = wrapper.html()
    expect(html).toContain('https://raw.githubusercontent.com/ausbitbank/hive.ausbit.dev-src/')
    expect(html).not.toContain('images.hive.blog/p/')
  })

  it('keeps the Ecency transform and its AVIF/WebP sources when selected', async () => {
    setImageProxyMode('ecency')
    const wrapper = await renderBody(BODY)
    const html = wrapper.html()
    expect(html).toContain('https://i.ecency.com/p/')
    expect(html).toContain('<source')
    expect(html).toContain('format=avif')
  })

  it('loads the original file in direct mode', async () => {
    setImageProxyMode('direct')
    const wrapper = await renderBody(BODY)
    const html = wrapper.html()
    expect(html).toContain('https://files.peakd.com/file/peakd-hive/alice/photo.jpg')
    expect(html).not.toContain('/p/')
    expect(html).not.toContain('<source')
  })
})
