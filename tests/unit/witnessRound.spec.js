import { describe, expect, it } from 'vitest'
import { witnessRoundSummary } from '../../src/services/witnessRound'

const NOW = Date.parse('2026-11-18T12:00:00Z')

function names (count, prefix = 'w') {
  return Array.from({ length: count }, (_, index) => prefix + index)
}

function schedule (list, size = list.length) {
  return {
    num_scheduled_witnesses: size,
    current_shuffled_witnesses: list
  }
}

function props (headBlock, currentWitness = '') {
  return {
    head_block_number: headBlock,
    current_witness: currentWitness
  }
}

describe('witnessRoundSummary', () => {
  const round = names(21)
  const roundSchedule = schedule(round)

  it('lists the current producer first and the upcoming producers in order', () => {
    const summary = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(100, 'w16'),
      limit: 4,
      now: NOW
    })

    expect(summary.available).toBe(true)
    expect(summary.roundSize).toBe(21)
    expect(summary.headBlock).toBe(100)
    expect(summary.currentWitness).toBe('w16')
    expect(summary.position).toBe(16)
    expect(summary.next.map(row => row.name)).toEqual(['w16', 'w17', 'w18', 'w19'])
    expect(summary.next.map(row => row.slot)).toEqual([16, 17, 18, 19])
    expect(summary.next.map(row => row.inBlocks)).toEqual([0, 1, 2, 3])
    expect(summary.next.map(row => row.current)).toEqual([true, false, false, false])
    expect(summary.updatedAt).toBe(NOW)
  })

  it('wraps around the end of the round', () => {
    const summary = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(103, 'w19'),
      limit: 4,
      now: NOW
    })

    expect(summary.position).toBe(19)
    expect(summary.next.map(row => row.name)).toEqual(['w19', 'w20', 'w0', 'w1'])
    expect(summary.next.map(row => row.slot)).toEqual([19, 20, 0, 1])
    expect(summary.next.map(row => row.inBlocks)).toEqual([0, 1, 2, 3])
  })

  it('finds the configured account next slot and current slot', () => {
    const upcoming = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(100, 'w16'),
      account: '@w17',
      limit: 2,
      now: NOW
    })
    expect(upcoming.accountInRound).toBe(true)
    expect(upcoming.accountNext).toEqual({ name: 'w17', inBlocks: 1, slot: 17 })

    const wrapping = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(103, 'w19'),
      account: 'w0',
      now: NOW
    })
    expect(wrapping.accountNext).toEqual({ name: 'w0', inBlocks: 2, slot: 0 })

    const current = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(100, 'w16'),
      account: 'w16',
      now: NOW
    })
    expect(current.accountNext).toEqual({ name: 'w16', inBlocks: 0, slot: 16 })
  })

  it('returns null for an account outside the round', () => {
    const summary = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(100, 'w16'),
      account: 'alice',
      now: NOW
    })

    expect(summary.accountInRound).toBe(false)
    expect(summary.accountNext).toBeNull()
  })

  it('supports a short schedule and repeats it when the limit exceeds the round', () => {
    const short = names(5)
    const summary = witnessRoundSummary({
      schedule: schedule(short, 5),
      globalProps: props(7, 'w2'),
      limit: 6,
      now: NOW
    })

    expect(summary.roundSize).toBe(5)
    expect(summary.position).toBe(2)
    expect(summary.next.map(row => row.name)).toEqual(['w2', 'w3', 'w4', 'w0', 'w1', 'w2'])
    expect(summary.next.map(row => row.slot)).toEqual([2, 3, 4, 0, 1, 2])
    expect(summary.next.map(row => row.inBlocks)).toEqual([0, 1, 2, 3, 4, 5])
    expect(summary.next.map(row => row.current)).toEqual([true, false, false, false, false, false])
  })

  it('supports a schedule longer than the consensus round', () => {
    const long = names(40)
    const summary = witnessRoundSummary({
      schedule: schedule(long, 40),
      globalProps: props(100, 'w20'),
      limit: 3,
      now: NOW
    })

    expect(summary.roundSize).toBe(40)
    expect(summary.position).toBe(20)
    expect(summary.next.map(row => row.name)).toEqual(['w20', 'w21', 'w22'])
  })

  it('maps witness records to missed block counts', () => {
    const summary = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(100, 'w16'),
      witnesses: [
        { owner: 'w16', total_missed: 5 },
        { owner: 'w17', total_missed: '2' },
        { owner: '', total_missed: 9 },
        { owner: 'w18' }
      ],
      now: NOW
    })

    expect(summary.missedById).toEqual({ w16: 5, w17: 2, w18: 0 })
  })

  it('handles missing schedule, properties and witnesses', () => {
    const summary = witnessRoundSummary({ now: NOW })

    expect(summary.available).toBe(false)
    expect(summary.roundSize).toBe(21)
    expect(summary.headBlock).toBe(0)
    expect(summary.currentWitness).toBe('')
    expect(summary.position).toBe(0)
    expect(summary.next).toEqual([])
    expect(summary.accountNext).toBeNull()
    expect(summary.accountInRound).toBe(false)
    expect(summary.missedById).toEqual({})
    expect(summary.updatedAt).toBe(NOW)
  })

  it('is unavailable without a chain head or a shuffled list', () => {
    const noProps = witnessRoundSummary({ schedule: roundSchedule, now: NOW })
    expect(noProps.available).toBe(false)
    expect(noProps.next).toEqual([])
    expect(noProps.accountInRound).toBe(false)

    const noSchedule = witnessRoundSummary({ globalProps: props(100, 'w16'), now: NOW })
    expect(noSchedule.available).toBe(false)
    expect(noSchedule.next).toEqual([])

    const empty = witnessRoundSummary({
      schedule: schedule([], 21),
      globalProps: props(100, 'w16'),
      now: NOW
    })
    expect(empty.available).toBe(false)
    expect(empty.next).toEqual([])
  })

  it('falls back to the caller clock and honours a zero limit', () => {
    const summary = witnessRoundSummary({
      schedule: roundSchedule,
      globalProps: props(100, 'w16'),
      limit: 0
    })

    expect(summary.next).toEqual([])
    expect(summary.updatedAt).toBeGreaterThan(0)
  })
})
