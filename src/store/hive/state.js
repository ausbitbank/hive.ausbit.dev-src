import { SessionStorage, LocalStorage } from 'quasar'
import { v4 as uuidv4 } from 'uuid'
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
    },
    has: {
      meta: {
        name: 'hive.ausbit.dev',
        description: 'A Hive block explorer and toolkit',
        icon: 'https://hive.ausbit.dev/statics/hive.svg'
      },
      auth: {
        username: '',
        token: undefined,
        expire: undefined,
        key: undefined
      },
      uid: uuidv4()
    }
  }
}
