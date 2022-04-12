import Vue from 'vue'
import { SessionStorage, LocalStorage } from 'quasar'
export function updateLoggedInUser (state, username) {
  state.user.username = username
  SessionStorage.set('loggedInUser', username)
}
export function updateLoginType (state, type) {
  state.user.loginType = type
  SessionStorage.set('loginType', type)
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

export async function addToQueue (state, newItem) {
  state.queue.push(newItem)
}
export async function removeFromQueue (state, itemToRemove) {
  state.queue = state.queue.filter(a => a !== itemToRemove)
}

export async function clearQueue (state) {
  state.queue = []
}

export async function updateFollowCount (state, followCount) {
  var a = followCount.account
  delete followCount.account
  Vue.set(state.followCounts, a, followCount)
}
