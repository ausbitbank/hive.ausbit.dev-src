import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import {
  QBadge,
  QBanner,
  QBtn,
  QCard,
  QCardSection,
  QIcon,
  QInput,
  QSelect,
  QToggle,
  Quasar
} from 'quasar'

vi.mock('src/services/vaultKeys', () => ({
  createCreatorVault: vi.fn(async () => ({ account: 'alice', keyring: {}, ringKey: 'ring', ringKid: '2026-11' })),
  saveCreatorVault: vi.fn(async () => {}),
  loadCreatorVault: vi.fn(async () => null),
  hasCreatorVault: vi.fn(() => false),
  exportCreatorVault: vi.fn(async () => ({})),
  importCreatorVault: vi.fn(async () => ({ account: 'alice', keyring: {}, ringKey: 'ring', ringKid: '2026-11' }))
}))

vi.mock('src/services/vaultSession', () => ({
  setCreatorVaultSession: vi.fn()
}))

import VaultSettings from '../../src/components/blog/VaultSettings.vue'
import { defaultVaultSettings } from '../../src/services/vaultSettings'

function mountSettings () {
  return mount(VaultSettings, {
    props: {
      account: { name: 'alice' },
      modelValue: defaultVaultSettings('alice'),
      canEdit: true
    },
    global: {
      plugins: [[Quasar, {}], createPinia()],
      components: {
        QBadge,
        QBanner,
        QBtn,
        QCard,
        QCardSection,
        QIcon,
        QInput,
        QSelect,
        QToggle
      },
      mocks: {
        $q: { notify: () => {}, dialog: () => ({ onOk: () => ({ onCancel: () => {} }) }) }
      }
    }
  })
}

describe('Vault onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('turns memberships on with one action: vault, product, container and saved settings', async () => {
    const wrapper = mountSettings()
    wrapper.vm.priceInput = '7.000'
    wrapper.vm.passphrase = 'correct horse battery'
    wrapper.vm.passphraseConfirm = 'correct horse battery'
    wrapper.vm.benefitsText = 'Weekly essays\nFull archive'

    await wrapper.vm.enableMembership()

    const queued = wrapper.emitted('queue') || []
    expect(queued).toHaveLength(2)
    expect(queued[0][0][0]).toBe('comment')
    expect(queued[0][0][1].permlink).toBe('membership')
    expect(queued[1][0][0]).toBe('comment')

    const updates = wrapper.emitted('update:modelValue') || []
    const settings = updates.at(-1)[0]
    expect(settings.enabled).toBe(true)
    expect(settings.product).toBe('alice/membership')
    expect(settings.price).toBe('7.000 HBD')
    expect(settings.benefits).toEqual(['Weekly essays', 'Full archive'])
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('offers a single clear primary action before setup', () => {
    const wrapper = mountSettings()
    const primary = wrapper.findAllComponents(QBtn)
      .find(button => button.props('label') === 'Turn on memberships')
    expect(primary).toBeTruthy()
    expect(primary.props('disable')).toBe(false)
    expect(wrapper.text()).toContain('Protect your content')
  })
})
