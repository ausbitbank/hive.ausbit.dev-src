import Vue from 'vue'
import { SessionStorage, LocalStorage } from 'quasar'
export function updateLoggedInUser (state, username) {
  state.user.username = username
  LocalStorage.set('loggedInUser', username)
}
export function updateNotifications (state, notifications) {
  state.user.notifications = notifications
  SessionStorage.set('notifications', notifications)
}
export function updateUnreadNotificationCount (state, count) {
  state.user.unreadNotificationCount = count
  SessionStorage.set('unreadNotificationCount', count)
}
export function updateAccountData (state, accountData) {
  Vue.set(state.accounts, accountData.name, accountData)
}

export function updateGlobalProps (state, props) {
  Vue.set(state, 'globalProps', props)
}

export function updateCommunityInfo (state, communityInfo) {
  Vue.set(state.communityInfo, communityInfo.name, communityInfo)
}

export function updateCommunitySubscriptions (state, communitySubscriptions) {
  Vue.set(state.user, 'communities', communitySubscriptions)
  SessionStorage.set('communitySubscriptions', communitySubscriptions)
}

export function updateSettings (state, settings) {
  state.user.settings = settings
  LocalStorage.set('settings', settings)
}
