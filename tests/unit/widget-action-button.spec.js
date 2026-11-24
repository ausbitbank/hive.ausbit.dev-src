import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QBadge, QBtn, QCard, QCardActions, QCardSection, QDialog, QIcon, Quasar } from 'quasar'
import WidgetActionButton from '../../src/components/dashboard/WidgetActionButton.vue'
import { claimInterestAction, claimRewardsAction } from '../../src/services/widgetActions'

function mountButton (action, overrides = {}) {
  const addToQueue = vi.fn()
  const notify = vi.fn()
  const wrapper = mount(WidgetActionButton, {
    props: {
      action,
      account: 'ausbitbank',
      ...overrides
    },
    global: {
      plugins: [[Quasar, {}]],
      components: { QBadge, QBtn, QCard, QCardActions, QCardSection, QDialog, QIcon },
      mocks: {
        $hiveStore: { addToQueue },
        $q: { notify }
      }
    }
  })
  return { wrapper, addToQueue, notify }
}

describe('WidgetActionButton', () => {
  it('shows the action with an explicit confirmation label', async () => {
    const action = claimRewardsAction('ausbitbank', {
      reward_hive_balance: '1.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '0.000000 VESTS'
    })
    const { wrapper } = mountButton(action)
    const button = wrapper.get('button')
    expect(button.text()).toContain('Claim rewards')
    expect(button.attributes('aria-label')).toBe('Claim rewards — opens a confirmation')

    wrapper.vm.open = true
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    const dialog = document.body.textContent
    expect(dialog).toContain('Signing queue')
    expect(dialog).toContain('Posting key')
    expect(dialog).toContain('Nothing is broadcast until you review and send it')
    wrapper.unmount()
  })

  it('queues every operation with its declared authority', async () => {
    const action = claimInterestAction('ausbitbank')
    const { wrapper, addToQueue, notify } = mountButton(action)
    await wrapper.vm.confirm()

    expect(addToQueue).toHaveBeenCalledTimes(2)
    expect(addToQueue).toHaveBeenNthCalledWith(1, ['ausbitbank', 'active', [
      'transfer_from_savings',
      expect.objectContaining({ from: 'ausbitbank', request_id: 42069420 })
    ]])
    expect(addToQueue).toHaveBeenNthCalledWith(2, ['ausbitbank', 'active', [
      'cancel_transfer_from_savings',
      { from: 'ausbitbank', request_id: 42069420 }
    ]])
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Claim interest queued for signing'
    }))
    expect(wrapper.emitted('queued')).toHaveLength(1)
  })

  it('normalises the @ prefix before queueing', async () => {
    const action = claimInterestAction('ausbitbank')
    const { wrapper, addToQueue } = mountButton(action, { account: '@ausbitbank' })
    await wrapper.vm.confirm()
    expect(addToQueue).toHaveBeenNthCalledWith(1, expect.arrayContaining(['ausbitbank', 'active']))
  })

  it('does nothing without an account or action', async () => {
    const { wrapper, addToQueue, notify } = mountButton(null)
    await wrapper.vm.confirm()
    expect(addToQueue).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
