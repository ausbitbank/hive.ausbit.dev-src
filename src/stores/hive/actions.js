import hive from '@hiveio/hive-js'

export async function getAccount (account) {
  if (!account) return
  try {
    const response = await hive.api.getAccountsAsync([account])
    if (response?.[0]) this.updateAccountData(response[0])
  } catch {
    console.error('Failed to load profile')
  }
}

export async function getAccounts (accounts) {
  if (!accounts?.length) return
  try {
    const response = await hive.api.getAccountsAsync(accounts)
    response?.forEach(account => this.updateAccountData(account))
  } catch {
    console.error('Failed to load profiles')
  }
}

export async function getGlobalProps () {
  try {
    this.updateGlobalProps(await hive.api.getDynamicGlobalPropertiesAsync())
  } catch {
    console.error('Failed to load global properties')
  }
}

export async function getCommunityInfo (username) {
  const params = { observer: this.user.username, name: username }
  try {
    this.updateCommunityInfo(await hive.api.callAsync('bridge.get_community', params))
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

export async function getFollowCount (username) {
  try {
    this.updateFollowCount(await hive.api.getFollowCountAsync(username))
  } catch {
    console.error('Failed to load follow count')
  }
}
