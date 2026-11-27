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

  it('counts active pending items as needing individual review', () => {
    const ctx = context([
      ['alice', 'posting', ['vote', {}]],
      ['alice', 'active', ['transfer', {}]],
      ['alice', 'active', ['transfer', {}]]
    ], ['sent', 'pending', 'sent'])
    expect(Queue.computed.manualPendingCount.call(ctx)).toBe(1)
  })
})
