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
    newKey: { active: { key: '', weight: 1 }, posting: { key: '', weight: 1 } },
    ownerEditBlocked: AccountAuthorities.methods.ownerEditBlocked,
    queueKeyChange: AccountAuthorities.methods.queueKeyChange,
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

  it('queues active/posting key changes and refuses owner key edits', () => {
    const key = 'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4'
    const { ctx, addToQueue, notify } = context({ loginType: 'smartlock' })
    ctx.queueKeyChange('posting', { add: true, key, weight: 2 })

    expect(addToQueue).toHaveBeenCalledTimes(1)
    const [, authority, operation] = addToQueue.mock.calls[0][0]
    expect(authority).toBe('active')
    expect(operation[0]).toBe('account_update')
    expect(operation[1].posting.key_auths).toContainEqual([key, 2])
    expect(ctx.newKey.posting.key).toBe('')
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'positive' }))

    addToQueue.mockClear()
    ctx.queueKeyChange('owner', { add: true, key, weight: 1 })
    expect(addToQueue).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'negative' }))
  })

  it('never sends owner changes to Keychain or the queue from any session', async () => {
    for (const loginType of ['keychain', 'smartlock', 'hiveauth']) {
      keychain.mockReset()
      const { ctx, emit, notify, addToQueue } = context({ loginType })
      await ctx.queueAuthorityChange('owner', { add: true, target: 'bob', weight: 2 })

      expect(keychain, loginType).not.toHaveBeenCalled()
      expect(addToQueue, loginType).not.toHaveBeenCalled()
      expect(emit, loginType).not.toHaveBeenCalled()
      expect(notify, loginType).toHaveBeenCalledWith(expect.objectContaining({
        type: 'negative',
        message: expect.stringContaining('read-only')
      }))
    }
  })
})
