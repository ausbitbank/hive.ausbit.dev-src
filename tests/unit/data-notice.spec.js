import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { QBtn, QIcon, Quasar } from 'quasar'
import DataNotice from '../../src/components/ui/DataNotice.vue'

const global = { plugins: [[Quasar, {}]], components: { QBtn, QIcon } }

describe('DataNotice', () => {
  it('renders the action with a contrast-safe colour on tinted notices', () => {
    const wrapper = mount(DataNotice, {
      props: { variant: 'stale', message: 'Showing saved prices.', actionLabel: 'Retry' },
      global
    })

    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('Retry')
    expect(button.classes()).toContain('text-light-blue-3')
    expect(button.classes()).not.toContain('text-primary')
  })
})
