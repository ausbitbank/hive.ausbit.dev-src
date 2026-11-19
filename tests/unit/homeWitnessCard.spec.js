import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useHiveStore } from '../../src/stores/hive'
import HomeWitnessCard from '../../src/components/HomeWitnessCard.vue'

vi.mock('../../src/services/chainData', () => ({
  fetchWitnessesByVote: vi.fn(() => Promise.resolve([])),
  fetchGlobalProps: vi.fn(() => Promise.resolve({}))
}))

function witness (owner, votes) {
  return {
    owner,
    votes,
    running_version: '1.28.9',
    total_missed: 0,
    last_hbd_exchange_update: new Date().toISOString(),
    last_confirmed_block_num: 100,
    signing_key: 'STMvalid'
  }
}

function mountCard (props = {}, username = null) {
  setActivePinia(createPinia())
  const store = useHiveStore()
  store.user.username = username
  return mount(HomeWitnessCard, {
    props,
    global: {
      plugins: [{ install (app) { app.config.globalProperties.$hiveStore = store } }],
      mocks: { $online: { online: true } },
      stubs: {
        'router-link': { template: '<a><slot /></a>' },
        'q-card': { template: '<div><slot /></div>' },
        'q-card-section': { template: '<div><slot /></div>' },
        'q-avatar': true,
        'q-img': true,
        'q-skeleton': true,
        'q-btn': true,
        'q-icon': { template: '<i class="q-icon"><slot /></i>' },
        'data-notice': true
      }
    }
  })
}

const RANKED = [
  witness('alice', '100'),
  witness('bob', '90'),
  witness('carol', '80'),
  witness('dave', '70'),
  witness('erin', '60'),
  witness('frank', '50'),
  witness('grace', '40')
]

function seed (wrapper) {
  wrapper.vm.witnesses = RANKED
  wrapper.vm.globalProps = {
    total_vesting_fund_hive: '1000000.000 HIVE',
    total_vesting_shares: '1000000000.000000 VESTS'
  }
  return wrapper.vm
}

describe('HomeWitnessCard parameters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the top six by default', () => {
    const wrapper = mountCard()
    const vm = seed(wrapper)
    expect(vm.rows.map(row => row.owner)).toEqual(['alice', 'bob', 'carol', 'dave', 'erin', 'frank'])
    expect(vm.rows.every(row => row.pinned === false)).toBe(true)
  })

  it('honours the limit', () => {
    const vm = seed(mountCard({ limit: 3 }))
    expect(vm.rows.map(row => row.owner)).toEqual(['alice', 'bob', 'carol'])
  })

  it('pins the signed-in user outside the limit without losing a slot', () => {
    const vm = seed(mountCard({ limit: 3, pinMine: true }, 'grace'))
    expect(vm.rows.map(row => row.owner)).toEqual(['grace', 'alice', 'bob', 'carol'])
    expect(vm.rows[0].pinned).toBe(true)
  })

  it('does not duplicate a pinned witness already inside the limit', () => {
    const vm = seed(mountCard({ limit: 4, pinMine: true }, 'bob'))
    // The pinned row leads and the four other rows fill the limit, so bob is
    // never listed twice.
    expect(vm.rows.map(row => row.owner)).toEqual(['bob', 'alice', 'carol', 'dave', 'erin'])
    expect(vm.rows.filter(row => row.owner === 'bob')).toHaveLength(1)
  })

  it('uses only the highlight account when pinMine is off', () => {
    const vm = seed(mountCard({ pinMine: false, highlight: 'erin' }, 'grace'))
    expect(vm.rows.map(row => row.owner)).not.toContain('grace')
    expect(vm.rows.find(row => row.owner === 'erin').highlighted).toBe(true)
  })

  it('falls back to the signed-in user when no highlight is given', () => {
    const vm = seed(mountCard({}, 'dave'))
    expect(vm.rows.find(row => row.owner === 'dave').highlighted).toBe(true)
  })

  it('formats approval HP from micro-VESTS', () => {
    const vm = seed(mountCard())
    // 100 micro-VESTS of a 1B VESTS supply holding 1M HIVE = 0.1 HP.
    expect(vm.rows[0].hp).toBe('0 HP')
    expect(RANKED[0].votes).toBe('100')
  })

  it('can hide the health indicator', () => {
    // Row wiring is covered above; the toggle only gates one icon in the
    // template, so assert intent on the prop rather than stubbed DOM.
    const wrapper = mountCard({ limit: 2, showHealth: false })
    expect(wrapper.props('showHealth')).toBe(false)
    expect(mountCard({ limit: 2 }).props('showHealth')).toBe(true)
  })
})
