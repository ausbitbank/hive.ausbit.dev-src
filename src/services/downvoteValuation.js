// Valuation inputs for the downvote transparency page.
//
// A vote history row carries only the signed weight, so a dollar estimate also
// needs the voter's current stake/mana plus the post reward fund and price
// feed. Fetching those is separate from the raw history so the table can render
// even when a node is missing one of the supporting reads.

import { fetchAccounts, fetchMedianHistoryPrice, fetchRewardFund } from './chainData'

/** Voter accounts are cached; the reward fund and feed are repriced often. */
export const DOWNVOTE_VALUE_VOTER_CAP = 500

function normalizeNames (voters) {
  const seen = new Set()
  const names = []
  for (const voter of Array.isArray(voters) ? voters : []) {
    const name = String(voter || '').trim().toLowerCase()
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
    if (names.length >= DOWNVOTE_VALUE_VOTER_CAP) break
  }
  return names
}

/**
 * Resolve voter accounts, the post reward fund and the median price feed.
 *
 * Every input is optional: a failed read leaves that value null and the page
 * shows "—" instead of inventing a dollar amount.
 */
export async function fetchDownvoteValuation (voters, { force = false } = {}) {
  const names = normalizeNames(voters)
  const [accountsResult, fundResult, medianResult] = await Promise.allSettled([
    names.length ? fetchAccounts(names, { force }) : Promise.resolve([]),
    fetchRewardFund('post', { force }),
    fetchMedianHistoryPrice({ force })
  ])

  const accounts = {}
  if (accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value)) {
    for (const account of accountsResult.value) {
      const name = String(account?.name || '').trim().toLowerCase()
      if (name) accounts[name] = account
    }
  }

  return {
    accounts,
    rewardFund: fundResult.status === 'fulfilled' ? fundResult.value : null,
    medianHistory: medianResult.status === 'fulfilled' ? medianResult.value : null,
    unavailableVoters: Math.max(0, names.length - Object.keys(accounts).length),
    rewardFundUnavailable: fundResult.status !== 'fulfilled' || !fundResult.value,
    priceUnavailable: medianResult.status !== 'fulfilled' || !medianResult.value
  }
}
