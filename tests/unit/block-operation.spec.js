import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import BlockOperation from 'src/components/BlockOperation.vue'

function mountOperation (operation) {
  return mount(BlockOperation, {
    props: { operation: { op: operation } },
    global: {
      plugins: [[Quasar, {}]],
      stubs: {
        'router-link': { template: '<a><slot /></a>' }
      }
    }
  })
}

describe('BlockOperation bridge legibility', () => {
  it('renders a keepsats conversion as human-readable text', () => {
    const wrapper = mountOperation(['custom_json', {
      required_auths: ['alice'],
      required_posting_auths: [],
      id: 'v4vapp_transfer',
      json: JSON.stringify({ from_account: 'alice', to_account: 'v4vapp', sats: '1234', memo: '#HBD' })
    }])

    const text = wrapper.text()
    expect(text).toContain('Keepsats')
    expect(text).toContain('Convert keepsats to HBD')
    expect(text).toContain('1,234 sats')
    expect(text).toContain('@alice')
    expect(text).toContain('@v4vapp')
    expect(wrapper.text()).not.toContain('open JSON for payload')
  })

  it('renders a bridge notification with its reference', () => {
    const wrapper = mountOperation(['custom_json', {
      required_auths: ['v4vapp'],
      required_posting_auths: [],
      id: 'v4vapp_notification',
      json: JSON.stringify({
        from_account: 'v4vapp',
        to_account: 'alice',
        memo: 'Insufficient Keepsats balance | § XYZ',
        msats: '0',
        parent_id: 'XYZ',
        notification: true
      })
    }])

    const text = wrapper.text()
    expect(text).toContain('v4vapp notice')
    expect(text).toContain('v4vapp notification · XYZ')
    expect(text).toContain('Insufficient Keepsats balance')
    expect(text).toContain('ref XYZ')
  })

  it('labels an invoice transfer memo without showing the raw BOLT11', () => {
    const wrapper = mountOperation(['transfer', {
      from: 'alice',
      to: 'v4vapp',
      amount: '1.000 HBD',
      memo: 'lnbc1000u1pabc #v4vapp'
    }])

    const text = wrapper.text()
    expect(text).toContain('⚡ Lightning')
    expect(text).toContain('Lightning invoice payment')
    expect(text).not.toContain('lnbc1000u1pabc')
  })

  it('shows exchanged sats and fee from a v4vapp memo', () => {
    const wrapper = mountOperation(['transfer', {
      from: 'v4vapp',
      to: 'kriszrokk',
      amount: '0.421 HIVE',
      memo: 'Converted 77 sats to 0.421 HIVE with fee: 52 sats for kriszrokk | thank you | § abc | Thank you for using v4v.app'
    }])

    const text = wrapper.text()
    expect(text).toContain('⚡ Lightning')
    expect(text).toContain('Converted 77 sats')
    expect(text).toContain('fee 52 sats')
  })

  it('keeps unrelated custom JSON generic', () => {
    const wrapper = mountOperation(['custom_json', {
      required_posting_auths: ['alice'],
      id: 'follow',
      json: '["bob"]'
    }])

    const text = wrapper.text()
    expect(text).toContain('custom JSON')
    expect(text).toContain('follow')
    expect(text).toContain('open JSON for payload')
  })
})
