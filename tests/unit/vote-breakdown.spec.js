import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import VotesDialog from '../../src/components/votesDialog.vue'
import { normalizeVotes, normalizeVote, voteDirection } from '../../src/services/voteBreakdown'

const global = {
  plugins: [[Quasar, {}]],
  stubs: { RouterLink: { template: '<a><slot /></a>' } },
  directives: { 'close-popup': () => {} }
}

describe('vote breakdown normalisation', () => {
  it('drops entries that cannot be rendered', () => {
    expect(normalizeVotes(undefined)).toEqual([])
    expect(normalizeVotes(null)).toEqual([])
    expect(normalizeVotes('not-a-list')).toEqual([])
    expect(normalizeVotes([null, {}, { voter: '' }, { voter: 'alice' }])).toEqual([
      { voter: 'alice', rshares: 0, percent: null, reputation: null, time: '' }
    ])
  })

  it('coerces string numbers from condenser and bridge rows', () => {
    expect(normalizeVote({ voter: 'alice', rshares: '123', percent: '5000', reputation: '42000000000000', time: '2026-01-01T00:00:00' }))
      .toEqual({ voter: 'alice', rshares: 123, percent: 5000, reputation: 42000000000000, time: '2026-01-01T00:00:00' })
  })

  it('classifies by rshares, then by percent', () => {
    expect(voteDirection({ rshares: 5 })).toBe(1)
    expect(voteDirection({ rshares: '-5' })).toBe(-1)
    expect(voteDirection({ rshares: 0, percent: -10000 })).toBe(-1)
    expect(voteDirection({ rshares: '0', percent: '0' })).toBe(0)
    expect(voteDirection(null)).toBe(0)
  })
})

describe('votes dialog resilience', () => {
  it('renders with no vote list instead of throwing', () => {
    const wrapper = mount(VotesDialog, { props: { votes: undefined }, global })
    expect(wrapper.find('.votes-dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('No votes have been cast on this post yet.')
  })

  it('ignores malformed vote rows', () => {
    const wrapper = mount(VotesDialog, {
      props: { votes: [null, { voter: 'alice', rshares: '123', percent: '5000' }] },
      global
    })
    expect(wrapper.findAll('.votes-grid__item')).toHaveLength(1)
    expect(wrapper.text()).toContain('@alice')
    expect(wrapper.text()).toContain('+50%')
  })
})
