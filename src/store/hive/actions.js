import hive from '@hiveio/hive-js'
export async function getAccount (context, account) {
  hive.api.getAccountsAsync([account])
    .then((response) => {
      if (response[0] === undefined) {
      } else {
        context.commit('updateAccountData', response[0])
      }
    })
    .catch(() => {
      console.error('Failed to load profile')
    })
}

export async function getGlobalProps (context) {
  hive.api.getDynamicGlobalPropertiesAsync()
    .then((response) => {
      context.commit('updateGlobalProps', response)
    })
    .catch(() => {
      console.log('Failed to load global properties')
    })
}
