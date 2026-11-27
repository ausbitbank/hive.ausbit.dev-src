import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  QBadge,
  QBanner,
  QBtn,
  QCard,
  QCardSection,
  QIcon,
  QInput,
  QSelect,
  QSeparator,
  QToggle,
  Quasar
} from 'quasar'
import { createPinia } from 'pinia'
import VaultSettings from '../../src/components/blog/VaultSettings.vue'
import { defaultVaultSettings } from '../../src/services/vaultSettings'

function mountSettings (canEdit) {
  return mount(VaultSettings, {
    props: {
      account: { name: 'alice' },
      modelValue: defaultVaultSettings('alice'),
      canEdit
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
        QSeparator,
        QToggle
      },
      mocks: {
        $q: { notify: () => {}, dialog: () => ({ onOk: () => ({ onCancel: () => {} }) }) }
      }
    }
  })
}

function button (wrapper, label) {
  return wrapper.findAllComponents(QBtn).find(item => item.props('label') === label)
}

describe('Vault settings controls', () => {
  it('enables owner actions when the signed-in account can edit', () => {
    const wrapper = mountSettings(true)
    expect(wrapper.props('canEdit')).toBe(true)
    expect(wrapper.vm.busy).toBe('')
    expect(button(wrapper, 'Publish product & container').props('disable')).toBe(false)
    expect(button(wrapper, 'Save Vault settings').props('disable')).toBe(false)
    const toggle = wrapper.findAllComponents(QToggle).find(item => item.props('label') === 'Enable members-only content')
    expect(toggle.props('disable')).toBe(false)
    const price = wrapper.findAllComponents(QInput).find(item => item.props('label') === 'Price')
    expect(price.props('disable')).toBe(false)

    wrapper.vm.priceInput = '0.500'
    wrapper.vm.commitPrice()
    const updates = wrapper.emitted('update:modelValue') || []
    expect(updates.at(-1)[0].price).toBe('0.500 HBD')
  })

  it('keeps every action disabled for a read-only viewer', () => {
    const wrapper = mountSettings(false)
    expect(button(wrapper, 'Publish product & container').props('disable')).toBe(true)
    expect(button(wrapper, 'Save Vault settings').props('disable')).toBe(true)
  })
})
