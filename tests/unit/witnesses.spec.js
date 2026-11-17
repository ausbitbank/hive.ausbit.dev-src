import { describe, expect, it } from 'vitest'
import {
  DISABLED_SIGNING_KEY,
  accountVoteWeight,
  aggregateWitnessHealth,
  buildWitnessUpdate,
  cliWalletCommand,
  filterWitnesses,
  formFromWitness,
  formatHp,
  relativeTime,
  sortWitnesses,
  validateProxy,
  validateWitnessForm,
  versionMatches,
  voteImpact,
  witnessHealth,
  witnessProxyQueueItem,
  witnessStatus,
  witnessUpdateQueueItem,
  witnessVoteQueueItem,
  witnessVotesHp
} from '../../src/services/witnesses'

const GLOBAL_PROPS = {
  total_vesting_shares: '1000000000.000000 VESTS',
  total_vesting_fund_hive: '1000000.000 HIVE',
  head_block_number: 1000
}

const NOW = Date.parse('2026-11-18T12:00:00Z')

function witness (overrides = {}) {
  return {
    owner: 'alice',
    url: 'https://alice.example',
    votes: '1000000000000',
    running_version: '1.28.8',
    hardfork_version_vote: '1.28.0',
    signing_key: 'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4',
    last_hbd_exchange_update: '2026-11-18T10:00:00',
    last_confirmed_block_num: 995,
    total_missed: 2,
    created: '2024-01-01T00:00:00',
    props: { hbd_interest_rate: 1000, maximum_block_size: 65536, account_creation_fee: '3.000 HIVE' },
    hbd_exchange_rate: { base: '0.400 HBD', quote: '1.000 HIVE' },
    ...overrides
  }
}

describe('witness vote weight', () => {
  it('converts micro-VESTS approval to HP', () => {
    expect(witnessVotesHp('1000000000000', GLOBAL_PROPS)).toBe(1000)
  })

  it('uses effective HP after delegations and withdrawals', () => {
    const account = {
      vesting_shares: '1000.000000 VESTS',
      received_vesting_shares: '500.000000 VESTS',
      delegated_vesting_shares: '200.000000 VESTS',
      vesting_withdraw_rate: '50.000000 VESTS',
      witness_votes: ['alice', 'bob']
    }

    const weight = accountVoteWeight(account, GLOBAL_PROPS)

    expect(weight.hp).toBeCloseTo(1.25)
    expect(weight.networkHp).toBe(1000000)
    expect(weight.votesUsed).toBe(2)
    expect(weight.votesLeft).toBe(28)
  })

  it('formats HP with thousands separators', () => {
    expect(formatHp(1234567.8)).toBe('1,234,568 HP')
  })

  it('formats past timestamps as ago and future timestamps as in', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    expect(relativeTime('2026-11-18T11:40:00Z', now)).toBe('20 minutes ago')
    expect(relativeTime('2026-11-18T12:20:00Z', now)).toBe('in 20 minutes')
    expect(relativeTime('2026-11-18T11:59:40Z', now)).toBe('just now')
  })
})

describe('witnessHealth', () => {
  it('returns no warnings for a healthy signing witness', () => {
    expect(witnessHealth(witness({ total_missed: 0 }), {
      globalProps: GLOBAL_PROPS,
      hardforkVersion: '1.28.9',
      now: NOW
    })).toEqual([])
  })

  it('flags disabled signing keys, stale feeds, version mismatch and missed slots', () => {
    const warnings = witnessHealth(witness({
      signing_key: DISABLED_SIGNING_KEY,
      last_hbd_exchange_update: '2026-11-15T00:00:00',
      running_version: '1.27.0',
      last_confirmed_block_num: 900,
      total_missed: 12
    }), {
      globalProps: GLOBAL_PROPS,
      hardforkVersion: '1.28.9',
      now: NOW
    })

    expect(warnings.map(item => item.id)).toEqual([
      'signing-disabled',
      'stale-price-feed',
      'missed-blocks',
      'version-mismatch'
    ])
    expect(witnessStatus(warnings)).toBe('critical')
    expect(warnings[0].severity).toBe('critical')
  })

  it('does not warn solely for the cumulative missed-block counter', () => {
    const warnings = witnessHealth(witness({ total_missed: 4 }), {
      globalProps: GLOBAL_PROPS,
      hardforkVersion: '1.28.9',
      now: NOW
    })

    expect(warnings).toEqual([])
    expect(witnessStatus(warnings)).toBe('ok')
  })

  it('does not flag a missed slot for backup witnesses that are not scheduled', () => {
    const warnings = witnessHealth(witness({ last_confirmed_block_num: 500, total_missed: 0 }), {
      globalProps: GLOBAL_PROPS,
      hardforkVersion: '1.28.9',
      now: NOW,
      scheduled: false
    })

    expect(warnings).toEqual([])
  })

  it('compares only the major/minor version for mismatches', () => {
    expect(versionMatches('1.28.8', '1.28.9')).toBe(true)
    expect(versionMatches('1.27.0', '1.28.9')).toBe(false)
    expect(versionMatches('', '1.28.9')).toBe(true)
  })

  it('aggregates witness health by status and warning type', () => {
    const rows = [
      { health: witnessHealth(witness({ total_missed: 0 }), { globalProps: GLOBAL_PROPS, hardforkVersion: '1.28.9', now: NOW }) },
      { health: witnessHealth(witness({ last_hbd_exchange_update: '2026-11-15T00:00:00' }), { globalProps: GLOBAL_PROPS, hardforkVersion: '1.28.9', now: NOW }) },
      { health: witnessHealth(witness({ signing_key: DISABLED_SIGNING_KEY }), { globalProps: GLOBAL_PROPS, hardforkVersion: '1.28.9', now: NOW }) }
    ]

    expect(aggregateWitnessHealth(rows, { now: NOW })).toMatchObject({
      total: 3,
      ok: 1,
      warning: 1,
      critical: 1,
      disabled: 1,
      staleFeeds: 1
    })
  })
})

describe('search, filter and sort', () => {
  const list = [
    { owner: 'alpha', rank: 1, votes: '300', total_missed: 0, running_version: '1.28.8', url: 'https://alpha.example', health: [] },
    { owner: 'bravo', rank: 2, votes: '200', total_missed: 9, running_version: '1.27.0', url: 'https://bravo.example', health: [{ id: 'version-mismatch', severity: 'warning' }] },
    { owner: 'charlie', rank: 3, votes: '100', total_missed: 1, running_version: '1.28.8', url: 'https://charlie.example', health: [{ id: 'signing-disabled', severity: 'critical' }] }
  ]

  it('searches name, URL and version', () => {
    expect(filterWitnesses(list, { search: 'bravo' }).map(item => item.owner)).toEqual(['bravo'])
    expect(filterWitnesses(list, { search: 'alpha.example' }).map(item => item.owner)).toEqual(['alpha'])
    expect(filterWitnesses(list, { search: '1.28.8' }).map(item => item.owner)).toEqual(['alpha', 'charlie'])
  })

  it('filters to my votes and health warnings', () => {
    expect(filterWitnesses(list, { myVotesOnly: true, votedNames: new Set(['charlie']) }).map(item => item.owner)).toEqual(['charlie'])
    expect(filterWitnesses(list, { warningsOnly: true }).map(item => item.owner)).toEqual(['bravo', 'charlie'])
  })

  it('sorts by votes, missed blocks and rank', () => {
    expect(sortWitnesses(list, 'votes', 'desc').map(item => item.owner)).toEqual(['alpha', 'bravo', 'charlie'])
    expect(sortWitnesses(list, 'votes', 'asc').map(item => item.owner)).toEqual(['charlie', 'bravo', 'alpha'])
    expect(sortWitnesses(list, 'missed', 'desc').map(item => item.owner)).toEqual(['bravo', 'charlie', 'alpha'])
    expect(sortWitnesses(list, 'rank', 'asc').map(item => item.owner)).toEqual(['alpha', 'bravo', 'charlie'])
  })
})

describe('vote impact calculator', () => {
  const list = Array.from({ length: 25 }, (_, index) => ({
    owner: 'w' + (index + 1),
    votes: String((25 - index) * 1e12)
  }))

  it('models additional approval and the top-20 gap', () => {
    const impact = voteImpact(list, 'w21', 1001, GLOBAL_PROPS)

    expect(impact.currentHp).toBe(5000)
    expect(impact.afterHp).toBe(6001)
    expect(impact.cutoffHp).toBe(6000)
    expect(impact.gapHp).toBe(0)
    expect(impact.projectedRank).toBe(20)
    expect(impact.entersTopTwenty).toBe(true)
  })
})

describe('witness forms and queue items', () => {
  const validForm = {
    url: 'https://witness.example',
    signingKey: 'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4',
    accountCreationFee: '3.000 HIVE',
    maximumBlockSize: 65536,
    hbdInterestPercent: 10,
    subsidyBudget: 797,
    subsidyDecay: 347321
  }

  it('validates URLs, signing keys and numeric ranges', () => {
    expect(validateWitnessForm(validForm)).toEqual({ valid: true, errors: {} })
    expect(validateWitnessForm({ ...validForm, url: 'not a url' }).valid).toBe(false)
    expect(validateWitnessForm({ ...validForm, signingKey: 'STMxxx' }).errors.signingKey).toBeTruthy()
    expect(validateWitnessForm({ ...validForm, maximumBlockSize: 10 }).errors.maximumBlockSize).toBeTruthy()
    expect(validateWitnessForm({ ...validForm, hbdInterestPercent: 150 }).errors.hbdInterestPercent).toBeTruthy()
  })

  it('converts the HBD percent back to chain basis points', () => {
    const payload = buildWitnessUpdate({ owner: 'alice', form: validForm })

    expect(payload).toMatchObject({
      owner: 'alice',
      url: 'https://witness.example',
      block_signing_key: validForm.signingKey,
      props: {
        account_creation_fee: '3.000 HIVE',
        maximum_block_size: 65536,
        hbd_interest_rate: 1000,
        account_subsidy_budget: 797,
        account_subsidy_decay: 347321
      }
    })
  })

  it('builds active-authority queue items for votes, proxies and updates', () => {
    expect(witnessVoteQueueItem('alice', 'bob', true)).toEqual([
      'alice', 'active', ['account_witness_vote', { account: 'alice', witness: 'bob', approve: true }]
    ])
    expect(witnessProxyQueueItem('alice', 'Bob')).toEqual([
      'alice', 'active', ['account_witness_proxy', { account: 'alice', proxy: 'bob' }]
    ])
    const payload = buildWitnessUpdate({ owner: 'alice', form: validForm })
    expect(witnessUpdateQueueItem('alice', payload)).toEqual(['alice', 'active', ['witness_update', payload]])
  })

  it('validates proxy names and rejects self-proxy', () => {
    expect(validateProxy('helper', 'alice')).toEqual({ valid: true, value: 'helper', error: '' })
    expect(validateProxy('', 'alice').valid).toBe(true)
    expect(validateProxy('alice', 'alice').valid).toBe(false)
    expect(validateProxy('Not A Name!', 'alice').valid).toBe(false)
  })

  it('renders a cli_wallet command and hydrates a form from a witness', () => {
    const payload = buildWitnessUpdate({ owner: 'alice', form: validForm })
    expect(cliWalletCommand(payload)).toContain('update_witness "alice" "https://witness.example"')
    expect(cliWalletCommand(payload)).toContain('"hbd_interest_rate":1000')

    expect(formFromWitness(witness())).toMatchObject({
      url: 'https://alice.example',
      hbdInterestPercent: 10,
      maximumBlockSize: 65536,
      accountCreationFee: '3.000 HIVE'
    })
  })
})
