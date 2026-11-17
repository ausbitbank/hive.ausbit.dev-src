import { LocalStorage, SessionStorage } from 'quasar'

export const DEFAULT_SETTINGS = {
  darkBackground: true,
  voteWeightPost: 100,
  voteWeightComment: 100,
  beneficiary: [{ account: 'ausbitbank', weight: 1000 }],
  apiNode: 'https://api.hive.blog',
  ahNode: 'https://api.hive.blog',
  heApiNode: 'https://herpc.dtools.dev'
}

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
      settings: LocalStorage.getItem('settings') || { ...DEFAULT_SETTINGS }
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
