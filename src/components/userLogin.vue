<template>
  <span>
  <q-btn flat dense round no-caps :aria-label="loggedInUser ? 'Account menu for ' + loggedInUser : 'Login'" :title="loggedInUser ? 'Account menu for ' + loggedInUser : 'Login'" class="text-capitalize">
    <q-avatar>
      <q-img :src="userAvatar" :alt="loggedInUser ? 'Avatar of @' + loggedInUser : 'Login'" v-if="loggedInUser !== '' && loggedInUser !== null" />
      <q-icon name="login" color="primary" title="Login" v-else />
    </q-avatar>
    <span class="q-ml-xs gt-xs">{{ loggedInUser }}</span>
    <q-popup-proxy @before-show="refreshSmartlockStatus">
      <q-card flat bordered class="login-card">
      <div v-if="loggedInUser">
        <transition appear enter-active-class="animated fadeInDown" leave-active-class="animated fadeOutUp">
        <q-list dense bordered class="text-primary text-center" role="navigation" aria-label="Account menu">
          <q-item v-if="loginType === 'smartlock'" class="login-smartlock-status">
            <q-item-section avatar>
              <q-icon :name="smartlockUnlocked ? 'lock_open' : 'lock'" :color="smartlockUnlocked ? 'green' : 'orange'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ smartlockUnlocked ? 'SmartLock unlocked' : 'SmartLock locked' }}</q-item-label>
              <q-item-label caption>
                Posting key {{ smartlockUnlocked ? 'in memory' : 'not available' }} · auto-locks after {{ smartlockTimeout }} min idle
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                v-if="smartlockUnlocked"
                dense
                flat
                no-caps
                color="orange"
                label="Lock"
                aria-label="Lock SmartLock now"
                @click.stop="lockSmartlock"
              />
              <q-btn
                v-else
                dense
                flat
                no-caps
                color="green"
                label="Unlock"
                aria-label="Unlock SmartLock"
                @click.stop="unlockSmartlock"
              />
            </q-item-section>
          </q-item>
          <q-item v-else-if="loginType === 'keychain'">
            <q-item-section avatar><q-icon name="key" color="blue" /></q-item-section>
            <q-item-section>
              <q-item-label>Hive Keychain connected</q-item-label>
              <q-item-label caption>Keys stay in the extension. Approve each posting or active action in Keychain.</q-item-label>
            </q-item-section>
          </q-item>
          <q-item clickable :to="linkFeed(loggedInUser)">
            <q-item-section avatar><q-icon name="rss_feed" color="orange" /></q-item-section>
            <q-item-section class="text-orange">Feed</q-item-section>
          </q-item>
          <q-item clickable :to="linkBlog(loggedInUser)">
            <q-item-section avatar><q-icon name="menu_book" color="purple" /></q-item-section>
            <q-item-section class="text-purple-3">Blog</q-item-section>
          </q-item>
          <q-item clickable :to="linkPosts(loggedInUser)">
            <q-item-section avatar><q-icon name="library_books" color="deep-purple" /></q-item-section>
            <q-item-section class="text-deep-purple-3">Posts</q-item-section>
          </q-item>
          <q-item clickable :to="linkCommunities(loggedInUser)">
            <q-item-section avatar><q-icon name="forum" color="teal" /></q-item-section>
            <q-item-section class="text-teal">Communities</q-item-section>
          </q-item>
          <q-item clickable :to="linkReplies(loggedInUser)">
            <q-item-section avatar><q-icon name="comment" color="blue-grey" /></q-item-section>
            <q-item-section class="text-blue-grey-3">Replies</q-item-section>
          </q-item>
          <q-item clickable :to="getAccountLink(loggedInUser)">
            <q-item-section avatar><q-icon name="perm_identity" color="indigo" /></q-item-section>
            <q-item-section class="text-indigo-3">Profile</q-item-section>
          </q-item>
          <q-item :to="getWalletLink(loggedInUser)">
            <q-item-section avatar><q-icon name="account_balance" color="green" /></q-item-section>
            <q-item-section class="text-green">Wallet</q-item-section>
          </q-item>
          <q-item to="/market">
            <q-item-section avatar><q-icon name="store" color="orange" /></q-item-section>
            <q-item-section class="text-orange">Market</q-item-section>
          </q-item>
          <q-item to="/witness" v-if="account !== undefined && account.witness_votes.includes(loggedInUser)">
            <q-item-section avatar><q-icon name="admin_panel_settings" color="deep-orange-6" /></q-item-section>
            <q-item-section class="text-deep-orange-6">Witness</q-item-section>
          </q-item>
          <q-item clickable @click="settingsDialog = !settingsDialog">
            <q-item-section avatar><q-icon name="settings" color="grey" /></q-item-section>
            <q-item-section class="text-grey">Settings</q-item-section>
          </q-item>
          <q-item clickable @click="logout()">
            <q-item-section avatar><q-icon name="exit_to_app" color="red" class="hvr" /></q-item-section>
            <q-item-section class="text-red">Logout</q-item-section>
          </q-item>
          <q-item>
            <q-linear-progress dark stripe rounded size="20px" :value="votePower" color="blue" class="q-mt-none" title="Vote Power %" aria-label="Voting power">
              <div class="absolute-full flex flex-center">
                  <q-badge color="black" text-color="primary">VP {{ votePower }} %</q-badge>
              </div>
            </q-linear-progress>
          </q-item>
        </q-list>
        </transition>
      </div>
      <q-list dense v-else>
        <q-item-label header class="text-center">
            Login as:
          </q-item-label>
        <q-item class="login-key-guide">
          <q-item-section>
            <div class="login-key-guide__title">Which key do you need?</div>
            <div class="login-key-guide__row">
              <q-icon name="lock" color="green" size="16px" aria-hidden="true" />
              <span><strong>Posting key</strong> — votes, comments, follows and notification read markers. It cannot move funds.</span>
            </div>
            <div class="login-key-guide__row">
              <q-icon name="lock" color="orange" size="16px" aria-hidden="true" />
              <span><strong>Active key</strong> — transfers, power, savings, market orders and witness/authority changes.</span>
            </div>
            <div class="login-key-guide__row">
              <q-icon name="key" color="blue" size="16px" aria-hidden="true" />
              <span><strong>Keychain</strong> keeps keys in the browser extension and asks for approval on each action.</span>
            </div>
          </q-item-section>
        </q-item>
        <q-item>
          <userSearchBox @selectUsername="setUsername" label="Username" class="text-center" />
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-method">
          <q-btn flat no-caps label="Hive-Keychain" icon="img:/statics/hive-keychain.svg" @click="checkLoginKeychain(username)" />
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-method">
          <q-btn flat no-caps label="SmartLock" icon="lock">
            <q-popup-proxy>
              <q-card class="q-pa-lg rounded-borders login-smartlock-card">
                <div class="login-smartlock-card__title">Import keys into SmartLock</div>
                <p class="login-smartlock-card__hint">
                  Keys are encrypted locally with your unlock password. The posting key stays in memory while unlocked; the active key asks for the password each time it is used.
                </p>
                <q-input v-model="username" label="Username" />
                <q-input v-model="postkey" label="Posting key (required)" filled type="password" :rules="[val => !!val || 'Field is required']"/>
                <q-input v-model="activekey" label="Active key (optional)" filled type="password" />
                <q-input v-model="memokey" label="Memo key (optional)" filled type="password" />
                <q-input v-model="password" label="Unlock password (8+ characters)" filled type="password" :rules="[val => !!val && val.length >= 8 || 'At least 8 characters']"/>
                <q-btn flat glossy dense no-caps label="Save and log in" icon="save" color="primary" @click="smartLockImportAccount()"/>
              </q-card>
            </q-popup-proxy>
          </q-btn>
        </q-item>
        <q-item dense v-if="username !== '' && username !== null" class="login-timeout-item">
          <q-item-section>
            <div class="login-timeout">
              <q-icon name="lock_clock" size="15px" aria-hidden="true" />
              SmartLock auto-locks after {{ smartlockTimeout }} minutes idle. Change this in Settings.
            </div>
          </q-item-section>
        </q-item>
        <q-item v-if="username !== '' && username !== null">
          <q-item-section>
            <q-btn icon="img:/statics/member.png" flat label="Remember me" title="Save your username to local storage for faster future logins" @click="rememberLogin = !rememberLogin">
              <q-checkbox v-model="rememberLogin" />
            </q-btn>
            <div class="text-caption text-grey-5">Saves only your username on this device. It never stores your posting, active or memo keys; SmartLock needs your password again after a reload.</div>
          </q-item-section>
        </q-item>
        <div class="text-center">
        <div v-if="savedUsers.length > 0">Hive-Keychain logins</div>
        <q-item v-for="user in savedUsers" :key="user.index">
          <q-item-section>
            <q-chip outline size="md" removable @remove="removeSavedUser(user)" clickable @click="rememberLogin = true; checkLoginKeychain(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" :alt="'Avatar of @' + user" /></q-avatar> {{ user }}</q-chip>
          </q-item-section>
        </q-item>
        <div v-if="savedUsersSmartLock.length > 0">SmartLock logins</div>
        <q-item v-for="user in savedUsersSmartLock" :key="user.index">
          <q-item-section>
            <q-chip outline size="md" removable @remove="smartLockRemoveAccount(user)" clickable @click="rememberLogin = true; checkLoginSmartLock(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" :alt="'Avatar of @' + user" /></q-avatar> {{ user }}</q-chip>
          </q-item-section>
        </q-item>
        </div>
      </q-list>
      </q-card>
    </q-popup-proxy>
    <q-dialog v-model="settingsDialog">
      <settings />
    </q-dialog>
  </q-btn>
  </span>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<style scoped>
.login-card {
  width: 360px;
  max-width: 94vw;
  background: #1d1d1d;
}

.login-key-guide {
  margin: 0.15rem 0.35rem 0.35rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
  text-align: left;
}

.login-key-guide__title {
  margin-bottom: 0.35rem;
  color: #cfd8dc;
  font-size: 0.76rem;
  font-weight: 600;
}

.login-key-guide__row {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: #90a4ae;
  font-size: 0.7rem;
  line-height: 1.4;
}

.login-key-guide__row + .login-key-guide__row {
  margin-top: 0.28rem;
}

.login-key-guide__row strong {
  color: #cfd8dc;
  font-weight: 600;
}

.login-method {
  justify-content: center;
}

.login-smartlock-status {
  text-align: left;
  background: rgba(255, 255, 255, 0.025);
}

.login-smartlock-status :deep(.q-item__label) {
  text-align: left;
}

.login-smartlock-card {
  width: 360px;
  max-width: 92vw;
}

.login-smartlock-card__title {
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
}

.login-smartlock-card__hint {
  margin: 0.35rem 0 0.6rem;
  color: #90a4ae;
  font-size: 0.72rem;
  line-height: 1.4;
  text-align: center;
}

.login-timeout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.15rem 0.3rem;
  color: #78909c;
  font-size: 0.68rem;
  text-align: center;
}

@media (max-width: 599px) {
  .login-key-guide {
    margin: 0.15rem 0.1rem 0.3rem;
  }
}
</style>
<script>
import smartlock from 'components/smartlock/index.js'
import { keychain } from '@hiveio/keychain'
import settings from 'components/settings.vue'
import userSearchBox from 'components/userSearchBox.vue'

export default {
  name: 'userLogin',
  props: [],
  components: { settings, userSearchBox },
  data () {
    return {
      username: '',
      savedUsers: this.$q.localStorage.getItem('savedUsers') || [],
      savedUsersSmartLock: smartlock.allAccounts(),
      rememberLogin: false,
      settingsDialog: false,
      smartlockUnlocked: false,
      postkey: '',
      activekey: '',
      memokey: '',
      password: ''
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$hiveStore.user.username },
      set (val) {
        this.$hiveStore.updateLoggedInUser(val)
        if (this.rememberLogin) { this.$q.sessionStorage.set('loggedInUser', val) }
      }
    },
    loginType: {
      get () { return this.$hiveStore.user.loginType },
      set (val) {
        this.$hiveStore.updateLoginType(val)
      }
    },
    smartlockTimeout () {
      const minutes = Number(this.$hiveStore.user?.settings?.smartlockSessionMinutes)
      return Number.isFinite(minutes) && minutes > 0 ? minutes : 15
    },
    smartlockTimeoutMs () {
      return this.smartlockTimeout * 60 * 1000
    },
    userAvatar: function () {
      if (this.loggedInUser !== '') {
        return 'https://images.hive.blog/u/' + this.loggedInUser + '/avatar'
      } else {
        return 'https://images.hive.blog/u/null/avatar'
      }
    },
    votePower: function () {
      if (this.account !== undefined) {
        var secondsago = (new Date() - new Date(this.account.last_vote_time + 'Z')) / 1000
        var vpow = this.account.voting_power + (10000 * secondsago / 432000)
        return parseFloat(Math.min(vpow / 100, 100).toFixed(2))
      } else {
        return null
      }
    },
    account: {
      cache: false,
      get () {
        return this.$hiveStore.accounts[this.loggedInUser]
      }
    }
  },
  methods: {
    setUsername (user) { this.username = user },
    smartLockRemoveAccount (user) {
      smartlock.removeAccount(user)
      this.savedUsersSmartLock = smartlock.allAccounts()
      if (this.loggedInUser === user) this.smartlockUnlocked = false
    },
    smartLockImportAccount () {
      smartlock.importAccount(this.username, this.password, this.postkey, this.activekey, this.memokey)
        .then(() => {
          this.savedUsersSmartLock = smartlock.allAccounts()
          this.checkLoginSmartLock(this.username)
        })
        .catch(error => {
          this.$q.notify({ type: 'negative', message: error?.message || 'Could not import the SmartLock account' })
        })
    },
    refreshSmartlockStatus () {
      this.smartlockUnlocked = this.loggedInUser && this.loginType === 'smartlock'
        ? smartlock.isAccountUnlocked(this.loggedInUser, this.smartlockTimeoutMs)
        : false
    },
    lockSmartlock () {
      if (!this.loggedInUser) return
      smartlock.lockAccount(this.loggedInUser)
      this.smartlockUnlocked = false
      this.$q.notify({
        message: 'SmartLock locked. The posting key was removed from memory.',
        color: 'orange',
        icon: 'lock',
        position: 'top'
      })
    },
    unlockSmartlock () {
      if (!this.loggedInUser) return
      this.getPasswordPrompt(this.loggedInUser)
    },
    smartLockLockAccount (user) {
      smartlock.lockAccount(user)
    },
    smartLockUnlockStatus (user) {
      return smartlock.isAccountUnlocked(user)
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    removeSavedUser (user) {
      this.savedUsers.splice(this.savedUsers.indexOf(user), 1)
      this.$q.localStorage.set('savedUsers', this.savedUsers)
    },
    checkLoginSmartLock (user) {
      if (smartlock.isAccountUnlocked(user, this.smartlockTimeoutMs)) {
        this.loggedInUser = user
        this.$q.sessionStorage.set('loggedInUser', user)
        this.loginType = 'smartlock'
        this.smartlockUnlocked = true
      } else {
        this.smartlockUnlocked = false
        this.getPasswordPrompt(user)
      }
    },
    getPasswordPrompt (user) {
      this.$q.dialog({
        dark: true,
        title: 'Account ' + user + ' is locked',
        message: 'Enter your password to unlock account ' + user + '. Unlocked keys are kept in memory only, so you will need your password again after a page reload.',
        prompt: {
          model: '',
          type: 'password'
        },
        cancel: true,
        persistent: true
      }).onOk(data => {
        smartlock.unlockAccount(user, data, false)
          .then(() => {
            this.smartlockUnlocked = true
            this.checkLoginSmartLock(user)
          })
          .catch(() => this.$q.notify({ type: 'negative', message: 'Could not unlock ' + user }))
      }).onCancel(() => {
        // cancel
      }).onDismiss(() => {
        // triggered by both ok and cancel
      })
    },
    async checkLoginKeychain (user) {
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestSignBuffer', user, 'hive.ausbit.dev login for ' + user, 'Posting')
      if (success) {
        this.loggedInUser = user
        this.$q.sessionStorage.set('loggedInUser', user)
        this.loginType = 'keychain'
        if (this.rememberLogin) {
          if (!this.savedUsers.includes(this.loggedInUser)) {
            this.$q.localStorage.set('savedUsers', this.savedUsers.concat([this.loggedInUser]))
            this.savedUsers = this.$q.localStorage.getItem('savedUsers')
          }
        }
      }
      if (!cancel) {
        if (notActive) {
          console.error('Please allow Keychain to access this website')
        } else if (notInstalled) { // alert('Please install Keychain')
          console.error('Keychain not available')
        } else {
          console.info(msg)
        }
      }
    },
    linkBlog (username) { return '/@' + username + '/blog' },
    linkPosts (username) { return '/@' + username + '/posts' },
    linkComments (username) { return '/@' + username + '/comments' },
    linkReplies (username) { return '/@' + username + '/replies' },
    linkFeed (username) { return '/@' + username + '/feed' },
    linkCommunities (username) { return '/@' + username + '/communities' },
    login (username) {
      this.loggedInUser = username
      this.$hiveStore.getAccount(this.loggedInUser, { force: true })
    },
    logout () {
      this.smartLockLockAccount(this.loggedInUser)
      this.smartlockUnlocked = false
      this.loggedInUser = ''
      this.loginType = ''
      this.$hiveStore.clearNotificationsState()
    }
  },
  mounted () {
    if (this.$q.sessionStorage.getItem('loggedInUser')) {
      this.login(this.$q.sessionStorage.getItem('loggedInUser'))
      this.refreshSmartlockStatus()
    }
  }
}
</script>
