import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { accountWidgetMixin } from '../../src/components/dashboard/accountWidgetMixin'

function makeHarness (username = 'alice') {
  const deferred = new Map()
  const calls = []
  const Harness = {
    mixins: [accountWidgetMixin],
    props: { account: { type: String, default: '' } },
    render () {
      return h('div')
    },
    methods: {
      loadAccountData (name) {
        calls.push(name)
        return new Promise(resolve => deferred.set(name, resolve))
      },
      applyAccountData () {}
    }
  }
  const wrapper = mount(Harness, {
    props: { account: '' },
    global: { mocks: { $hiveStore: { user: { username } } } }
  })
  return { wrapper, deferred, calls }
}

describe('accountWidgetMixin', () => {
  it('ignores a superseded account response', async () => {
    const { wrapper, deferred, calls } = makeHarness('alice')
    expect(calls).toEqual(['alice'])

    await wrapper.setProps({ account: 'bob' })
    expect(calls).toEqual(['alice', 'bob'])

    deferred.get('bob')({ ok: true, accountName: 'bob', account: { name: 'bob' } })
    await flushPromises()
    expect(wrapper.vm.accountName).toBe('bob')
    expect(wrapper.vm.loading).toBe(false)

    deferred.get('alice')({ ok: true, accountName: 'alice', account: { name: 'alice' } })
    await flushPromises()
    expect(wrapper.vm.accountName).toBe('bob')
    expect(wrapper.vm.accountRecord.name).toBe('bob')
  })

  it('clears the previous record as soon as the target account changes', async () => {
    const { wrapper, deferred } = makeHarness('alice')
    deferred.get('alice')({ ok: true, accountName: 'alice', account: { name: 'alice' } })
    await flushPromises()
    expect(wrapper.vm.accountRecord.name).toBe('alice')

    await wrapper.setProps({ account: 'bob' })
    expect(wrapper.vm.accountName).toBe('')
    expect(wrapper.vm.accountRecord).toBeNull()
  })

  it('shows a guest state without requesting an account', async () => {
    const { wrapper, calls } = makeHarness('')
    await flushPromises()
    expect(calls).toEqual([])
    expect(wrapper.vm.state).toBe('guest')
  })
})
