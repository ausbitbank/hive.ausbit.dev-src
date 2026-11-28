import { describe, expect, it } from 'vitest'
import Queue from '../../src/components/queue.vue'

const methods = Queue.methods

function context (queue, statuses = queue.map(() => 'pending')) {
  return {
    queue,
    normalizedMeta: statuses.map(status => ({ status })),
    timerEnabled: true,
    bulkSending: false
  }
}

describe('queue auto-send selection', () => {
  it('sends posting actions but skips active actions for manual review', () => {
    const ctx = context([
      ['alice', 'posting', ['vote', {}]],
      ['alice', 'active', ['transfer', {}]],
      ['alice', 'posting', ['comment', {}]]
    ])
    expect(methods.nextAutoIndex.call(ctx)).toBe(0)

    const activeOnly = context([['alice', 'active', ['transfer', {}]]])
    expect(methods.nextAutoIndex.call(activeOnly)).toBe(-1)

    const finished = context(
      [['alice', 'posting', ['vote', {}]], ['alice', 'active', ['transfer', {}]]],
      ['sent', 'pending']
    )
    expect(methods.nextAutoIndex.call(finished)).toBe(-1)
  })

  it('stops at a pending active item instead of skipping a dependent posting action', () => {
    const dependent = context([
      ['alice', 'active', ['create_claimed_account', {}]],
      ['alice', 'posting', ['custom_json', { id: 'rc' }]],
      ['alice', 'active', ['delegate_vesting_shares', {}]]
    ])
    expect(methods.nextAutoIndex.call(dependent)).toBe(-1)
    dependent.nextAutoIndex = () => methods.nextAutoIndex.call(dependent)
    expect(Queue.computed.canSendAll.call(dependent)).toBe(false)
  })

  it('does not leave Send all loading when only active items remain', () => {
    const ctx = context([['alice', 'active', ['transfer', {}]]])
    ctx.nextAutoIndex = () => methods.nextAutoIndex.call(ctx)
    ctx.canSendAll = Queue.computed.canSendAll.call(ctx)
    methods.sendAll.call(ctx)
    expect(ctx.bulkSending).toBe(false)
  })

  it('counts active pending items as needing individual review', () => {
    const ctx = context([
      ['alice', 'posting', ['vote', {}]],
      ['alice', 'active', ['transfer', {}]],
      ['alice', 'active', ['transfer', {}]]
    ], ['sent', 'pending', 'sent'])
    expect(Queue.computed.manualPendingCount.call(ctx)).toBe(1)
  })
})
