import { beforeEach, describe, expect, it, vi } from 'vitest'

const keychain = vi.hoisted(() => vi.fn())
vi.mock('@hiveio/keychain', () => ({ keychain }))

const { default: AccountAuthorities } = await import('../../src/components/accountAuthorities.vue')

function context ({ loginType = 'keychain' } = {}) {
  const notify = vi.fn()
  const emit = vi.fn()
  const addToQueue = vi.fn()
  const ctx = {
    account: {
      name: 'alice',
      owner: { weight_threshold: 1, key_auths: [['STMowner', 1]], account_auths: [] },
      active: { weight_threshold: 1, key_auths: [['STMactive', 1]], account_auths: [] },
      posting: { weight_threshold: 1, key_auths: [['STMposting', 1]], account_auths: [] },
      memo_key: 'STMmemo',
      json_metadata: ''
    },
    $hiveStore: { user: { username: 'alice', loginType }, addToQueue },
    $q: { notify },
    $emit: emit,
    changeOwnerAuthority: AccountAuthorities.methods.changeOwnerAuthority,
    queueAuthorityChange: AccountAuthorities.methods.queueAuthorityChange
  }
  return { ctx, notify, emit, addToQueue }
}

beforeEach(() => {
  keychain.mockReset()
})

describe('account authority editor', () => {
  it('queues active/posting account-authority changes', async () => {
    const { ctx, addToQueue, notify } = context({ loginType: 'smartlock' })
    await ctx.queueAuthorityChange('active', { add: true, target: 'bob', weight: 2 })

    expect(addToQueue).toHaveBeenCalledTimes(1)
    const [owner, authority, operation] = addToQueue.mock.calls[0][0]
    expect(owner).toBe('alice')
    expect(authority).toBe('active')
    expect(operation[0]).toBe('account_update')
    expect(operation[1].active.account_auths).toEqual([['bob', 2]])
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'positive' }))
  })

  it('uses Keychain for an owner change when the session allows it', async () => {
    const { ctx, emit } = context({ loginType: 'keychain' })
    keychain.mockResolvedValue({ success: true })
    await ctx.queueAuthorityChange('owner', { add: true, target: 'bob', weight: 2 })

    expect(keychain).toHaveBeenCalledWith(window, 'requestAddAccountAuthority', 'alice', 'bob', 'Owner', 2)
    expect(emit).toHaveBeenCalledWith('authEdited')
  })

  it('fails closed for an owner change on a non-Keychain session', async () => {
    const { ctx, emit, notify } = context({ loginType: 'smartlock' })
    await ctx.queueAuthorityChange('owner', { add: true, target: 'bob', weight: 2 })

    expect(keychain).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
  })
})
