import hive from '@hiveio/hive-js'
export async function getAccount (context, account) {
  if (account !== null) {
    hive.api.getAccountsAsync([account])
      .then((response) => {
        if (response[0] === undefined) {
        } else {
          context.commit('updateAccountData', response[0])
        }
      })
      .catch(() => { console.error('Failed to load profile') })
  }
}

export async function getGlobalProps (context) {
  hive.api.getDynamicGlobalPropertiesAsync()
    .then((response) => { context.commit('updateGlobalProps', response) })
    .catch(() => { console.error('Failed to load global properties') })
}

export async function getCommunityInfo (context, username) {
  var params = { observer: context.state.loggedInUser, name: username }
  hive.api.callAsync('bridge.get_community', params)
    .then(response => { context.commit('updateCommunityInfo', response) })
    .catch(() => { console.error('Failed to get community info') })
}

export async function getCommunitySubscriptions (context, username) {
  var params = { account: username }
  hive.api.callAsync('bridge.list_all_subscriptions', params)
    .then(response => { context.commit('updateCommunitySubscriptions', response) })
    .catch(() => { console.error('Failed to get community subscriptions') })
}
