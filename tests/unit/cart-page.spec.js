import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Quasar, QBtn } from 'quasar'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.mock('../../src/services/chainData', () => ({
  fetchAccountPosts: vi.fn(),
  fetchPostContent: vi.fn(),
  fetchRankedPosts: vi.fn()
}))

import CartPage from '../../src/pages/cart.vue'
import { fetchPostContent } from '../../src/services/chainData'
import { CART_STORAGE_KEY, useCartStore } from '../../src/stores/cart'

function makeRouter () {
  const page = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page },
      { path: '/blogs', component: page },
      { path: '/cart', name: 'cart', component: page },
      { path: '/checkout', component: page },
      { path: '/@:account', component: page }
    ]
  })
}

async function mountCart () {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()
  await router.push('/cart')
  await router.isReady()

  const wrapper = mount(CartPage, {
    global: {
      plugins: [[Quasar, {}], pinia, router],
      components: {
        QBanner: { template: '<div><slot /><slot name="action" /></div>' },
        QCard: { template: '<div><slot /></div>' },
        QCardSection: { template: '<div><slot /></div>' },
        QIcon: { template: '<i />' },
        QPage: { template: '<main><slot /></main>' },
        QSkeleton: { template: '<div />' },
        QBtn
      }
    }
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('CartPage stale items', () => {
  it('lets the buyer remove a line whose post no longer exists', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      items: [{ author: 'alice', permlink: 'deleted-product', quantity: 1 }]
    }))
    fetchPostContent.mockRejectedValue(new Error('not found'))

    const wrapper = await mountCart()

    expect(wrapper.text()).toContain('None of the products in your cart could be loaded from Hive.')
    expect(wrapper.text()).toContain('deleted-product')
    expect(wrapper.text()).toContain('Clear cart')

    await wrapper.get('[aria-label="Remove deleted-product from cart"]').trigger('click')
    await flushPromises()

    expect(useCartStore().items).toEqual([])
    expect(wrapper.text()).toContain('Your cart is empty')
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
  })

  it('disables checkout while no product can be loaded', async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
      items: [{ author: 'alice', permlink: 'deleted-product', quantity: 1 }]
    }))
    fetchPostContent.mockRejectedValue(new Error('not found'))

    const wrapper = await mountCart()

    const checkout = wrapper.findAll('button').find(button => button.text() === 'Checkout')
    expect(checkout.attributes('aria-disabled')).toBe('true')
  })
})
