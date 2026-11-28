// Per-witness voter sampling and segmentation.
//
// `database_api.list_witness_votes` is ordered by witness/account, so one call
// returns a witness's voters. Stake and account age are not part of that
// response, so the component samples a bounded number of voter accounts and
// builds HP and age bands. The UI labels the sample size; this is not a claim
// about every voter.

import { getApiConfig, rpcRequest } from './api'
import { HIVE_API_NODES } from './hiveNodes'
import { fetchAccounts } from './chainData'
import { accountEffectiveVests, vestsToHp } from './witnesses'
import moment from '../utils/time'

const DAY_MS = 24 * 60 * 60 * 1000

export const HP_BANDS = [
  { id: 'under-100', label: '< 100 HP', min: 0, max: 100 },
  { id: '100-1k', label: '100–1k HP', min: 100, max: 1000 },
  { id: '1k-10k', label: '1k–10k HP', min: 1000, max: 10000 },
  { id: '10k-100k', label: '10k–100k HP', min: 10000, max: 100000 },
  { id: '100k-plus', label: '100k+ HP', min: 100000, max: Infinity }
]

export const AGE_BANDS = [
  { id: 'under-1y', label: '< 1 year', min: 0, max: 365 },
  { id: '1-3y', label: '1–3 years', min: 365, max: 1095 },
  { id: '3-5y', label: '3–5 years', min: 1095, max: 1825 },
  { id: '5y-plus', label: '5+ years', min: 1825, max: Infinity }
]

function bandFor (value, bands) {
  return bands.find(band => value >= band.min && value < band.max) || bands[bands.length - 1]
}

function timeValue (value) {
  if (!value) return null
  const parsed = moment.utc(value)
  return parsed.isValid() ? parsed.valueOf() : null
}

/**
 * `database_api.list_witness_votes` is not implemented consistently by every
 * public node. api.hive.blog currently answers with an OpenAPI-shaped stub, so
 * validate the body and try the other configured nodes before giving up.
 */
async function requestWitnessVotes (params, options) {
  const response = await rpcRequest('database_api.list_witness_votes', params, options)
  if (Array.isArray(response?.votes)) return response.votes

  const current = getApiConfig().node
  for (const node of HIVE_API_NODES) {
    if (node === current) continue
    try {
      const fallback = await rpcRequest('database_api.list_witness_votes', params, {
        ...options,
        node,
        retries: 0
      })
      if (Array.isArray(fallback?.votes)) return fallback.votes
    } catch {
      // Try the next known node.
    }
  }
  return []
}

export async function fetchWitnessVoters (owner, options = {}) {
  if (!owner) return []
  const max = Math.max(1, Math.min(5000, Number(options.limit) || 1000))
  const pageSize = 1000
  const voters = []
  let start = ''
  while (voters.length < max) {
    const votes = await requestWitnessVotes({
      start: [owner, start],
      limit: Math.min(pageSize, max - voters.length),
      order: 'by_witness_account'
    }, options)
    // `list_witness_votes` paginates past the requested witness. Keep only
    // this witness's rows and stop at the boundary instead of attributing the
    // next witness's voters to this one.
    const target = String(owner).toLowerCase()
    const matching = votes.filter(vote => {
      const witness = String(vote?.witness || '').toLowerCase()
      return !witness || witness === target
    })
    const page = matching
      .map(vote => vote?.account)
      .filter(Boolean)
    if (!page.length) break
    for (const name of page) {
      if (!voters.includes(name)) voters.push(name)
      if (voters.length >= max) break
    }
    const lastVote = votes[votes.length - 1]
    const lastWitness = String(lastVote?.witness || '').toLowerCase()
    if (lastWitness && lastWitness !== target) break
    const next = page[page.length - 1]
    if (votes.length < pageSize || !next || next === start) break
    start = next
  }
  return voters
}

export async function fetchWitnessVoterSample (owner, options = {}) {
  const voters = await fetchWitnessVoters(owner, options)
  const accountLimit = Math.max(1, Math.min(5000, Number(options.accountLimit) || 250))
  const names = voters.slice(0, accountLimit)
  const accounts = names.length ? await fetchAccounts(names) : []
  return { voters, accounts, sampledNames: names.length }
}

/**
 * Segment a voter sample into effective-HP and account-age bands.
 */
export function voterSegments (voters, accounts, globalProps, options = {}) {
  const now = options.now ? Number(new Date(options.now)) : Date.now()
  const accountMap = new Map((Array.isArray(accounts) ? accounts : [])
    .filter(account => account?.name)
    .map(account => [account.name, account]))

  const rows = (Array.isArray(voters) ? voters : [])
    .map(voter => {
      const name = typeof voter === 'string' ? voter : voter?.account || voter?.voter
      if (!name) return null
      const account = accountMap.get(name)
      if (!account) return { voter: name, known: false, hp: 0, ageDays: null }
      const hp = vestsToHp(accountEffectiveVests(account), globalProps)
      const created = timeValue(account.created)
      return {
        voter: name,
        known: true,
        hp,
        ageDays: created === null ? null : Math.max(0, (now - created) / DAY_MS)
      }
    })
    .filter(Boolean)

  const known = rows.filter(row => row.known)
  const hpBands = HP_BANDS.map(band => ({ ...band, count: 0, hp: 0, share: 0 }))
  const ageBands = AGE_BANDS.map(band => ({ ...band, count: 0, hp: 0, share: 0 }))

  for (const row of known) {
    const hpBand = hpBands.find(band => row.hp >= band.min && row.hp < band.max)
    const ageBand = row.ageDays === null ? null : bandFor(row.ageDays, ageBands)
    if (hpBand) {
      hpBand.count += 1
      hpBand.hp += row.hp
    }
    if (ageBand) {
      ageBand.count += 1
      ageBand.hp += row.hp
    }
  }

  const knownCount = known.length
  for (const band of [...hpBands, ...ageBands]) {
    band.share = knownCount ? band.count / knownCount : 0
  }

  const sorted = known.slice().sort((a, b) => b.hp - a.hp)
  const totalHp = sorted.reduce((sum, row) => sum + row.hp, 0)
  const topTenCount = Math.max(1, Math.ceil(sorted.length * 0.1))
  const topTenHp = sorted.slice(0, topTenCount).reduce((sum, row) => sum + row.hp, 0)
  const median = sorted.length
    ? (sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2].hp
        : (sorted[sorted.length / 2 - 1].hp + sorted[sorted.length / 2].hp) / 2)
    : 0

  return {
    voters: rows,
    knownCount,
    unknownCount: rows.length - knownCount,
    totalVoters: rows.length,
    totalHp,
    medianHp: median,
    topTenShare: totalHp > 0 ? topTenHp / totalHp : 0,
    topVoters: sorted.slice(0, 8),
    hpBands,
    ageBands,
    oldestVoter: sorted.slice().sort((a, b) => (b.ageDays || 0) - (a.ageDays || 0))[0] || null
  }
}
