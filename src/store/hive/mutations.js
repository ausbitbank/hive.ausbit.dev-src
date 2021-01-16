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
