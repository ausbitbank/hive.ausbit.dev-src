import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { QIcon, QSpinnerDots, Quasar } from 'quasar'
import InfiniteScroll from '../../src/components/ui/InfiniteScroll.vue'

const global = {
  plugins: [[Quasar, {}]],
  components: { QIcon, QSpinnerDots }
}

let wrapper = null

function mountScroll (props = {}, slotProps = {}) {
  wrapper = mount(InfiniteScroll, {
    props: { canLoad: true, ...props },
    slots: slotProps,
    global,
    attachTo: document.body
  })
  return wrapper
}

// jsdom has no layout: give the footer a position so distance checks can run.
function placeFooter (top, height = 40) {
  const footer = wrapper.find('.infinite-scroll__footer').element
  footer.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top })
}

async function scroll () {
  window.dispatchEvent(new Event('scroll'))
  await new Promise(resolve => setTimeout(resolve, 200))
  await wrapper.vm.$nextTick()
}

beforeEach(() => {
  window.innerHeight = 800
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('InfiniteScroll', () => {
  it('renders slot content, footer and the manual button', () => {
    mountScroll({}, { default: '<ul class="list"><li>one</li></ul>' })
    expect(wrapper.find('.list li').text()).toBe('one')
    expect(wrapper.find('.infinite-scroll__more').exists()).toBe(true)
  })

  it('loads when the footer is within the offset of the viewport', async () => {
    mountScroll({ offset: 400 })
    placeFooter(700)
    await scroll()
    expect(wrapper.emitted('load')).toHaveLength(1)
  })

  it('does not load while the footer is far below the viewport', async () => {
    mountScroll({ offset: 400 })
    placeFooter(2000)
    await scroll()
    expect(wrapper.emitted('load')).toBeFalsy()
  })

  it('does not load when everything is already loaded', async () => {
    mountScroll({ canLoad: false })
    placeFooter(700)
    await scroll()
    expect(wrapper.emitted('load')).toBeFalsy()
  })

  it('does not load automatically while disabled but keeps the button', async () => {
    mountScroll({ disabled: true })
    placeFooter(700)
    await scroll()
    expect(wrapper.emitted('load')).toBeFalsy()

    await wrapper.find('.infinite-scroll__more').trigger('click')
    expect(wrapper.emitted('load')).toBeFalsy()
  })

  it('never requests automatically when automatic is off', async () => {
    mountScroll({ automatic: false })
    placeFooter(700)
    await scroll()
    expect(wrapper.emitted('load')).toBeFalsy()

    await wrapper.find('.infinite-scroll__more').trigger('click')
    expect(wrapper.emitted('load')).toHaveLength(1)
  })

  it('guards against repeat requests until the page resolves', async () => {
    mountScroll()
    placeFooter(700)

    await wrapper.find('.infinite-scroll__more').trigger('click')
    expect(wrapper.emitted('load')).toHaveLength(1)

    // Further scrolls and clicks are ignored while the request is in flight.
    await scroll()
    expect(wrapper.emitted('load')).toHaveLength(1)

    await wrapper.setProps({ loading: true })
    // A page that grew the list pushes the footer out of view.
    placeFooter(2000)
    await wrapper.setProps({ loading: false })
    await scroll()
    expect(wrapper.emitted('load')).toHaveLength(1)

    await wrapper.find('.infinite-scroll__more').trigger('click')
    expect(wrapper.emitted('load')).toHaveLength(2)
  })

  it('shows an aria-live spinner while loading and hides the button', () => {
    mountScroll({ loading: true })
    const indicator = wrapper.find('.infinite-scroll__loading')
    expect(indicator.attributes('role')).toBe('status')
    expect(indicator.attributes('aria-live')).toBe('polite')
    expect(wrapper.find('.infinite-scroll__more').exists()).toBe(false)
  })

  it('waits for a scroll after a page resolves while the end stays in view', async () => {
    mountScroll()
    placeFooter(700)
    await scroll()
    expect(wrapper.emitted('load')).toHaveLength(1)

    await wrapper.setProps({ loading: true })
    await wrapper.setProps({ loading: false })
    await wrapper.vm.$nextTick()

    // Still at the bottom: a programmatic check must not cascade.
    wrapper.vm.check()
    expect(wrapper.emitted('load')).toHaveLength(1)

    // Any user scroll re-arms it.
    await scroll()
    expect(wrapper.emitted('load')).toHaveLength(2)
  })

  it('renders the done slot once everything is loaded', () => {
    mountScroll({ canLoad: false }, { done: '<span class="end-marker">All caught up</span>' })
    expect(wrapper.find('.end-marker').text()).toBe('All caught up')
    expect(wrapper.find('.infinite-scroll__more').exists()).toBe(false)
  })
})
