import { SessionStorage } from 'quasar'
export default function () {
  return {
    user: {
      username: SessionStorage.getItem('loggedInUser') || null,
      following: [],
      followers: [],
      state: {},
      notifications: SessionStorage.getItem('notifications') || [],
      unreadNotificationCount: 0
    },
    accounts: {}
  }
}
