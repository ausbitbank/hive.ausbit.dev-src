import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import DelegationOptions from '../../src/components/onboarding/DelegationOptions.vue'

function makeWrapper (modelValue = {}) {
  return mount(DelegationOptions, {
    props: { modelValue },
    global: { plugins: [[Quasar, {}]] }
  })
}

describe('delegation options', () => {
  it('is opt-in and explains the active-key steps', () => {
    const wrapper = makeWrapper()
    expect(wrapper.get('h3').text()).toContain('Help the new account start')
    expect(wrapper.text()).toContain('posting key')
    expect(wrapper.text()).toContain('active')
    expect(wrapper.text()).toContain('Resource Credits')
    expect(wrapper.text()).toContain('Hive Power')
  })

  it('emits complete objects and coerces numeric input', () => {
    const wrapper = makeWrapper({ rcEnabled: false, rcAmount: 5, hpEnabled: false, hpAmount: 5 })

    wrapper.vm.set('rcEnabled', true)
    expect(wrapper.emitted('update:modelValue')[0][0]).toEqual({
      rcEnabled: true,
      rcAmount: 5,
      hpEnabled: false,
      hpAmount: 5
    })

    wrapper.vm.setNumber('rcAmount', '2.5')
    expect(wrapper.emitted('update:modelValue')[1][0].rcAmount).toBe(2.5)

    wrapper.vm.setNumber('hpAmount', 'not a number')
    expect(wrapper.emitted('update:modelValue')[2][0].hpAmount).toBe(0)
  })

  it('shows the HP conversion note only when enabled', async () => {
    const wrapper = makeWrapper()
    expect(wrapper.text()).not.toContain('delegated in VESTS')
    await wrapper.setProps({ modelValue: { hpEnabled: true, hpAmount: 5 } })
    expect(wrapper.text()).toContain('delegated in VESTS')
  })
})
