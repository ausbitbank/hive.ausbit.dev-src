import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import AccountWelcome from '../../src/components/onboarding/AccountWelcome.vue'

function makeWrapper ({ account, settings = { beneficiary: [] }, localStorageGet = null } = {}) {
  const getAccount = vi.fn()
  const updateSettings = vi.fn()
  const storageSet = vi.fn()
  const routerPush = vi.fn(() => Promise.resolve())
  const wrapper = mount(AccountWelcome, {
    global: {
      plugins: [[Quasar, {}]],
      mocks: {
        $hiveStore: {
          user: { username: 'newuser', settings },
          accounts: { newuser: account },
          getAccount,
          updateSettings
        },
        $q: {
          localStorage: {
            getItem: vi.fn(() => localStorageGet),
            set: storageSet,
            remove: vi.fn()
          },
          notify: vi.fn()
        },
        $router: { push: routerPush }
      }
    }
  })
  return { wrapper, getAccount, updateSettings, storageSet, routerPush }
}

const newAccount = {
  created: new Date().toISOString().replace(/\.\d{3}Z$/, ''),
  json_metadata: JSON.stringify({ onboarding: { sponsor: 'sponsor' } }),
  posting_json_metadata: ''
}

describe('AccountWelcome', () => {
  it('prompts a new account to set a profile and opt into the sponsor beneficiary', async () => {
    const { wrapper } = makeWrapper({ account: newAccount })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.open).toBe(true)
    expect(wrapper.vm.needsProfile).toBe(true)
    expect(wrapper.vm.needsSponsor).toBe(true)
  })

  it('only adds the sponsor beneficiary after explicit opt-in', async () => {
    const settings = { beneficiary: [{ account: 'ausbitbank', weight: 1000 }] }
    const { wrapper, updateSettings } = makeWrapper({ account: newAccount, settings })
    await wrapper.vm.$nextTick()

    wrapper.vm.supportSponsor = true
    wrapper.vm.saveSponsorBeneficiary()

    expect(updateSettings).toHaveBeenCalledTimes(1)
    const next = updateSettings.mock.calls[0][0]
    expect(next.beneficiary).toEqual(expect.arrayContaining([
      { account: 'ausbitbank', weight: 1000 },
      { account: 'sponsor', weight: 500 }
    ]))
    expect(wrapper.vm.beneficiarySaved).toBe(true)
  })

  it('does not prompt old accounts with no profile and no sponsor metadata', async () => {
    const oldAccount = {
      created: '2024-01-01T00:00:00',
      json_metadata: '',
      posting_json_metadata: ''
    }
    const { wrapper } = makeWrapper({ account: oldAccount })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.open).toBe(false)
  })

  it('does not reopen after it has been dismissed', async () => {
    const { wrapper } = makeWrapper({ account: newAccount, localStorageGet: true })
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.open).toBe(false)
  })

  it('deep-links the profile editor to the posting metadata panel', async () => {
    const { wrapper, routerPush } = makeWrapper({ account: newAccount })
    await wrapper.vm.$nextTick()
    wrapper.vm.openProfile()
    expect(routerPush).toHaveBeenCalledWith({
      path: '/@newuser',
      query: { edit: 'posting' }
    })
  })
})
