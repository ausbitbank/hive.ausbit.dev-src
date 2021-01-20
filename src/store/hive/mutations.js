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
  state.accounts[accountData.name] = accountData
  Vue.set(state.accounts, state.accounts[accountData.name], accountData)
}
