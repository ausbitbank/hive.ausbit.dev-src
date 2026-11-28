import { describe, expect, it, vi } from 'vitest'

// Only the shared loader is mocked; `useSignedInUsername` stays real so the
// test exercises the same account resolution the app uses.
const loadAccountWidgetData = vi.fn()
vi.mock('../../src/composables/useAccountWidget', async importOriginal => {
  const original = await importOriginal()
  return { ...original, loadAccountWidgetData }
})

const { default: accountWidgetMixin } = await import('../../src/components/dashboard/accountWidgetMixin')

function makeVm ({ account = '', username = 'alice' } = {}) {
  const state = accountWidgetMixin.data()
  const vm = { account, $hiveStore: { user: { username } }, ...state }
  // Vue resolves computed getters onto the instance; mirror the ones that do
  // not depend on each other.
  Object.defineProperty(vm, 'signedInUser', {
    get: () => accountWidgetMixin.computed.signedInUser.call(vm)
  })
  Object.defineProperty(vm, 'targetAccount', {
    get: () => accountWidgetMixin.computed.targetAccount.call(vm)
  })
  Object.defineProperty(vm, 'state', {
    get: () => accountWidgetMixin.computed.state.call(vm)
  })
  for (const [name, fn] of Object.entries(accountWidgetMixin.methods)) {
    vm[name] = fn.bind(vm)
  }
  return vm
}

describe('account widget mixin', () => {
  it('resolves the account to the signed-in user by default', () => {
    expect(makeVm().targetAccount).toBe('alice')
    expect(makeVm({ account: '@bob' }).targetAccount).toBe('bob')
    expect(makeVm({ username: '' }).state).toBe('guest')
  })

  it('stores the account, global properties and prices after loading', async () => {
    loadAccountWidgetData.mockResolvedValueOnce({
      ok: true,
      accountName: 'alice',
      account: { name: 'alice', vesting_shares: '1000000.000000 VESTS' },
      globalProps: { total_vesting_fund_hive: '219009570.055 HIVE', total_vesting_shares: '350926957853.133505 VESTS' },
      prices: { hive: { usd: 0.4 }, hive_dollar: { usd: 1 } }
    })
    const vm = makeVm()
    await vm.reload()
    expect(vm.accountName).toBe('alice')
    expect(vm.accountRecord.vesting_shares).toBe('1000000.000000 VESTS')
    // Every HP/USD figure in the widgets depends on these two.
    expect(vm.globalProps.total_vesting_fund_hive).toBe('219009570.055 HIVE')
    expect(vm.prices.hive.usd).toBe(0.4)
    expect(vm.state).toBe('ready')
  })

  it('reports an error when the account cannot be loaded', async () => {
    loadAccountWidgetData.mockResolvedValueOnce({ ok: false, accountName: 'alice', error: 'Account @alice was not found.' })
    const vm = makeVm()
    await vm.reload()
    expect(vm.loadError).toBe('Account @alice was not found.')
    expect(vm.state).toBe('error')
  })

  it('normalises a configured widget account', async () => {
    const { resolveWidgetAccount } = await import('../../src/composables/useAccountWidget')
    expect(resolveWidgetAccount({ account: '@Alice' }, '')).toBe('alice')
    expect(resolveWidgetAccount({}, 'Bob')).toBe('bob')
  })

  it('drops a late account read after unmount', async () => {
    let resolveLoad
    loadAccountWidgetData.mockImplementationOnce(() => new Promise(resolve => { resolveLoad = resolve }))
    const vm = makeVm()
    const apply = vi.fn()
    vm.applyAccountData = apply

    const loading = vm.reload()
    accountWidgetMixin.beforeUnmount.call(vm)
    resolveLoad({
      ok: true,
      accountName: 'alice',
      account: { name: 'alice' },
      globalProps: null,
      prices: null
    })
    await loading

    expect(apply).not.toHaveBeenCalled()
    expect(vm.accountRecord).toBeNull()
  })
})
