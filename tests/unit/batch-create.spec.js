import { beforeEach, describe, expect, it, vi } from 'vitest'

const keychain = vi.hoisted(() => vi.fn())
const fetchGlobalProps = vi.hoisted(() => vi.fn())
vi.mock('@hiveio/keychain', () => ({ keychain }))
vi.mock('src/services/chainData', () => ({ fetchGlobalProps }))

const { default: BatchCreate } = await import('../../src/pages/batchCreate.vue')

const GLOBAL_PROPS = {
  total_vesting_fund_hive: '200000000.000 HIVE',
  total_vesting_shares: '400000000000.000000 VESTS'
}

function claim (name, state = 'ready') {
  return {
    payload: { u: name, o: 'STMowner', a: 'STMactive', p: 'STMposting', m: 'STMmemo', n: 'nonce' },
    state
  }
}

function context ({ claims = [claim('alice1'), claim('alice2')], delegation = {} } = {}) {
  const notify = vi.fn()
  return {
    loggedInUser: 'ausbitbank',
    loginType: 'keychain',
    claims,
    creatableClaims: claims.filter(entry => entry.state === 'ready'),
    pendingClaimed: 10,
    hasEnoughHiveForBatch: true,
    accountCreationFee: '3.000 HIVE',
    accountCreationFeeAmount: 3,
    delegation: { hpEnabled: true, hpAmount: 5, rcEnabled: true, rcAmount: 5, ...delegation },
    txId: '',
    batchedNames: [],
    rcSigned: false,
    signing: false,
    rcSigning: false,
    startPolling: vi.fn(),
    baseOperation: entry => ({
      new_account_name: entry.payload.u,
      owner: { weight_threshold: 1, key_auths: [['STMowner', 1]], account_auths: [] },
      active: { weight_threshold: 1, key_auths: [['STMactive', 1]], account_auths: [] },
      posting: { weight_threshold: 1, key_auths: [['STMposting', 1]], account_auths: [] },
      memo_key: 'STMmemo',
      json_metadata: '{}',
      extensions: []
    }),
    get rcCandidates () {
      if (!this.batchedNames.length) return []
      const wanted = new Set(this.batchedNames)
      return this.claims.filter(entry => wanted.has(entry.payload.u) && entry.state === 'created')
    },
    $q: {
      notify,
      dialog: () => ({
        onOk (callback) { callback(); return this },
        onCancel () { return this }
      })
    }
  }
}

beforeEach(() => {
  keychain.mockReset()
  fetchGlobalProps.mockReset()
  fetchGlobalProps.mockResolvedValue(GLOBAL_PROPS)
})

describe('batch account creation delegation', () => {
  it('keeps HP inside the active creation transaction, one per account', async () => {
    keychain.mockResolvedValue({ success: true, result: { id: 'batchtx' } })
    const ctx = context()

    await BatchCreate.methods.signBatch.call(ctx, 'token')

    expect(keychain).toHaveBeenCalledTimes(1)
    const [windowArg, method, account, operations, authority] = keychain.mock.calls[0]
    expect(windowArg).toBe(window)
    expect(method).toBe('requestBroadcast')
    expect(account).toBe('ausbitbank')
    expect(authority).toBe('active')
    expect(operations.map(operation => operation[0])).toEqual([
      'create_claimed_account',
      'delegate_vesting_shares',
      'create_claimed_account',
      'delegate_vesting_shares'
    ])
    expect(operations[0][1]).toMatchObject({ creator: 'ausbitbank', new_account_name: 'alice1' })
    expect(operations[1][1]).toMatchObject({ delegator: 'ausbitbank', delegatee: 'alice1' })
    expect(ctx.batchedNames).toEqual(['alice1', 'alice2'])
    expect(ctx.startPolling).toHaveBeenCalledTimes(1)
  })

  it('aborts before signing when HP conversion is unavailable', async () => {
    fetchGlobalProps.mockResolvedValue(null)
    const ctx = context()

    await BatchCreate.methods.signBatch.call(ctx, 'token')

    expect(keychain).not.toHaveBeenCalled()
    expect(ctx.batchedNames).toEqual([])
    expect(ctx.startPolling).not.toHaveBeenCalled()
    expect(ctx.$q.notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'negative',
      caption: 'Nothing was broadcast.'
    }))
  })

  it('does not start RC or polling when the creation signature is rejected', async () => {
    keychain.mockResolvedValue({ success: false, message: 'Rejected' })
    const ctx = context()

    await BatchCreate.methods.signBatch.call(ctx, 'token')

    expect(ctx.batchedNames).toEqual([])
    expect(ctx.startPolling).not.toHaveBeenCalled()
    expect(ctx.$q.notify).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Rejected',
      color: 'negative'
    }))
  })

  it('signs RC as a separate posting transaction only after accounts exist', async () => {
    keychain.mockResolvedValue({ success: true })
    const ctx = context({
      claims: [claim('alice1', 'created'), claim('alice2', 'created'), claim('alice3', 'blocked')],
      delegation: { hpEnabled: false, rcEnabled: true, rcAmount: 5 }
    })
    ctx.batchedNames = ['alice1', 'alice2']

    await BatchCreate.methods.signRcDelegation.call(ctx)

    expect(keychain).toHaveBeenCalledTimes(1)
    const [, method, account, operations, authority] = keychain.mock.calls[0]
    expect(method).toBe('requestBroadcast')
    expect(account).toBe('ausbitbank')
    expect(authority).toBe('posting')
    expect(operations).toHaveLength(2)
    expect(operations.every(operation => operation[0] === 'custom_json')).toBe(true)
    expect(operations.map(operation => JSON.parse(operation[1].json)[1].delegatees[0])).toEqual(['alice1', 'alice2'])
    expect(ctx.rcSigned).toBe(true)
  })

  it('leaves RC retryable and never signs for accounts that were not created', async () => {
    const ctx = context({
      claims: [claim('alice1', 'blocked')],
      delegation: { hpEnabled: false, rcEnabled: true, rcAmount: 5 }
    })
    ctx.batchedNames = ['alice1']

    await BatchCreate.methods.signRcDelegation.call(ctx)

    expect(keychain).not.toHaveBeenCalled()
    expect(ctx.rcSigned).toBe(false)
  })

  it('keeps the accounts created when the RC signature is rejected', async () => {
    keychain.mockResolvedValue({ success: false, cancel: true })
    const ctx = context({
      claims: [claim('alice1', 'created')],
      delegation: { hpEnabled: false, rcEnabled: true, rcAmount: 5 }
    })
    ctx.batchedNames = ['alice1']

    await BatchCreate.methods.signRcDelegation.call(ctx)

    expect(ctx.rcSigned).toBe(false)
    expect(ctx.$q.notify).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Cancelled in Keychain.',
      color: 'negative'
    }))
  })
})
