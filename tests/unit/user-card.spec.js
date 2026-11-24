import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useHiveStore } from '../../src/stores/hive'
import UserCard from '../../src/components/userCard.vue'

const { fetchFollowingNames, rememberFollowing } = vi.hoisted(() => ({
  fetchFollowingNames: vi.fn(),
  rememberFollowing: vi.fn(() => true)
}))

vi.mock('../../src/services/chainData', () => ({
  fetchFollowingNames,
  rememberFollowing
}))

function mountCard ({ username = 'alice', viewer = 'viewer' } = {}) {
  setActivePinia(createPinia())
  const store = useHiveStore()
  store.user.username = viewer
  return {
    store,
    wrapper: mount(UserCard, {
      props: { username },
      global: {
        plugins: [{ install (app) { app.config.globalProperties.$hiveStore = store } }],
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
          'q-avatar': { template: '<div><slot /></div>' },
          'q-img': true,
          'q-icon': true,
          'q-btn': { props: ['label', 'ariaLabel'], template: '<button :aria-label="ariaLabel">{{ label }}</button>' }
        }
      }
    })
  }
}

describe('userCard follow state', () => {
  beforeEach(() => {
    fetchFollowingNames.mockReset()
    rememberFollowing.mockClear()
  })

  it('shows Following when the viewer already follows the account', async () => {
    fetchFollowingNames.mockResolvedValue(['alice', 'bob'])
    const { wrapper } = mountCard()
    await flushPromises()

    expect(fetchFollowingNames).toHaveBeenCalledWith('viewer')
    expect(wrapper.vm.isFollowing).toBe(true)
    expect(wrapper.find('button').text()).toBe('Following')
    expect(wrapper.find('button').attributes('aria-label')).toBe('Unfollow @alice')
  })

  it('shows Follow when the account is not in the viewer following snapshot', async () => {
    fetchFollowingNames.mockResolvedValue(['bob'])
    const { wrapper } = mountCard()
    await flushPromises()

    expect(wrapper.vm.isFollowing).toBe(false)
    expect(wrapper.find('button').text()).toBe('Follow')
  })

  it('queues an unfollow without an extra relationship request', async () => {
    fetchFollowingNames.mockResolvedValue(['alice'])
    const { wrapper, store } = mountCard()
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(store.queue).toHaveLength(1)
    expect(store.queue[0][2][0]).toBe('custom_json')
    expect(JSON.parse(store.queue[0][2][1].json)[1].what).toEqual([])
    expect(rememberFollowing).toHaveBeenCalledWith('viewer', 'alice', false)
    expect(wrapper.vm.isFollowing).toBe(false)
  })

  it('queues a follow and remembers it for the next render', async () => {
    fetchFollowingNames.mockResolvedValue([])
    const { wrapper, store } = mountCard()
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(store.queue).toHaveLength(1)
    expect(JSON.parse(store.queue[0][2][1].json)[1].what).toEqual(['blog'])
    expect(rememberFollowing).toHaveBeenCalledWith('viewer', 'alice', true)
    expect(wrapper.vm.isFollowing).toBe(true)
    expect(wrapper.vm.followingNames).toContain('alice')
  })

  it('does not render a follow button for the signed-in account', async () => {
    fetchFollowingNames.mockResolvedValue([])
    const { wrapper } = mountCard({ username: 'viewer' })
    await flushPromises()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(fetchFollowingNames).not.toHaveBeenCalled()
  })
})
