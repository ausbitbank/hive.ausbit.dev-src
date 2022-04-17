import { SessionStorage, LocalStorage } from 'quasar'
export default function () {
  return {
    user: {
      username: SessionStorage.getItem('loggedInUser') || null,
      loginType: SessionStorage.getItem('loginType') || null,
      lastUpdateTime: null,
      following: [],
      followers: [],
      communities: SessionStorage.getItem('communitySubscriptions') || [],
      state: {},
      notifications: SessionStorage.getItem('notifications') || [],
      unreadNotificationCount: 0,
      settings: LocalStorage.getItem('settings') || {
        darkBackground: true,
        voteWeightPost: 100,
        voteWeightComment: 100,
        beneficiary: [{ account: 'ausbitbank', weight: 1000 }],
        apiNode: 'https://rpc.ausbit.dev',
        ahNode: 'https://api.hive.blog',
        heApiNode: 'https://api.hive-engine.com/rpc'
      }
    },
    queue: [],
    accounts: {},
    followCounts: {},
    posts: {},
    communityInfo: {},
    globalProps: {
      empty: true
    }
  }
}
