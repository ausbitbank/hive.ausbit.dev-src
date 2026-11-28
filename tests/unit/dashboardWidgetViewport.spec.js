import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { Quasar } from 'quasar'
import DashboardWidgetViewport from '../../src/components/dashboard/DashboardWidgetViewport.vue'

let observer

class MockIntersectionObserver {
  constructor (callback, options) {
    this.callback = callback
    this.options = options
    this.disconnected = false
    observer = this
  }

  observe () {}
  disconnect () { this.disconnected = true }
}

function makeWrapper (props = {}) {
  return mount(DashboardWidgetViewport, {
    props,
    slots: { default: '<div class="widget-body">body</div>' },
    global: { plugins: [[Quasar, {}]] }
  })
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('dashboard widget viewport', () => {
  it('latches a deferred widget once it has been seen', async () => {
    const wrapper = makeWrapper({ enabled: true })
    expect(wrapper.find('.widget-body').exists()).toBe(false)

    observer.callback([{ isIntersecting: true }])
    await nextTick()
    expect(wrapper.find('.widget-body').exists()).toBe(true)
    expect(observer.disconnected).toBe(true)

    observer.callback([{ isIntersecting: false }])
    await nextTick()
    expect(wrapper.find('.widget-body').exists()).toBe(true)
    wrapper.unmount()
  })

  it('recycles a live widget when it leaves the viewport', async () => {
    const wrapper = makeWrapper({ enabled: true, recycle: true })
    expect(observer.options.rootMargin).toBe('240px')

    observer.callback([{ isIntersecting: true }])
    await nextTick()
    expect(wrapper.find('.widget-body').exists()).toBe(true)

    observer.callback([{ isIntersecting: false }])
    await nextTick()
    expect(wrapper.find('.widget-body').exists()).toBe(false)
    expect(observer.disconnected).not.toBe(true)

    wrapper.unmount()
    expect(observer.disconnected).toBe(true)
  })

  it('renders immediately when disabled', async () => {
    const wrapper = makeWrapper({ enabled: false })
    await nextTick()
    expect(wrapper.find('.widget-body').exists()).toBe(true)
    wrapper.unmount()
  })
})
