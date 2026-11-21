import { hive } from 'src/services/hive'
import {
  fetchAccount,
  fetchAccounts,
  fetchCommunity,
  fetchFollowCount,
  fetchGlobalProps
} from '../../services/chainData'

export async function getAccount (account, { force = false } = {}) {
  if (!account) return
  try {
    const data = await fetchAccount(account, { force })
    if (data) this.updateAccountData(data)
  } catch {
    console.error('Failed to load profile')
  }
}

export async function getAccounts (accounts, { force = false } = {}) {
  if (!accounts?.length) return
  try {
    const response = await fetchAccounts(accounts, { force })
    response?.forEach(account => this.updateAccountData(account))
  } catch {
    console.error('Failed to load profiles')
  }
}

export async function getGlobalProps ({ force = false } = {}) {
  try {
    this.updateGlobalProps(await fetchGlobalProps({ force }))
  } catch {
    console.error('Failed to load global properties')
  }
}

export async function getCommunityInfo (username, { force = false } = {}) {
  try {
    const info = await fetchCommunity(username, this.user.username, { force })
    if (info?.name) this.updateCommunityInfo(info)
  } catch {
    console.error('Failed to get community info')
  }
}

export async function getCommunitySubscriptions (username) {
  const params = { account: username }
  try {
    this.updateCommunitySubscriptions(await hive.api.callAsync('bridge.list_all_subscriptions', params))
  } catch {
    console.error('Failed to get community subscriptions')
  }
}

export async function getFollowCount (username, { force = false } = {}) {
  try {
    this.updateFollowCount(await fetchFollowCount(username, { force }))
  } catch {
    console.error('Failed to load follow count')
  }
}
