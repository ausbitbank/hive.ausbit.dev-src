<template>
  <q-btn flat dense round no-caps aria-label="Login" class="q-ml-md text-capitalize">
    <q-avatar>
      <q-img :src="userAvatar" v-if="loggedInUser !== '' && loggedInUser !== null" />
      <q-icon name="login" color="primary" title="Login" v-else />
    </q-avatar>
    <span class="q-ml-xs">{{ loggedInUser }}</span>
    <q-popup-proxy>
      <q-card flat bordered>
      <div v-if="loggedInUser">
        <transition appear enter-active-class="animated fadeInDown" leave-active-class="animated fadeOutUp">
        <q-list dense bordered class="text-primary text-center">
          <q-item clickable :to="linkFeed(loggedInUser)">
            <q-item-section avatar><q-icon name="rss_feed" color="orange" /></q-item-section>
            <q-item-section class="text-orange">Feed</q-item-section>
          </q-item>
          <q-item clickable :to="linkBlog(loggedInUser)">
            <q-item-section avatar><q-icon name="menu_book" color="purple" /></q-item-section>
            <q-item-section class="text-purple">Blog</q-item-section>
          </q-item>
          <q-item clickable :to="linkPosts(loggedInUser)">
            <q-item-section avatar><q-icon name="library_books" color="deep-purple" /></q-item-section>
            <q-item-section class="text-deep-purple">Posts</q-item-section>
          </q-item>
          <q-item clickable :to="linkCommunities(loggedInUser)">
            <q-item-section avatar><q-icon name="forum" color="teal" /></q-item-section>
            <q-item-section class="text-teal">Communities</q-item-section>
          </q-item>
          <q-item clickable :to="linkReplies(loggedInUser)">
            <q-item-section avatar><q-icon name="comment" color="blue-grey" /></q-item-section>
            <q-item-section class="text-blue-grey">Replies</q-item-section>
          </q-item>
          <q-item clickable :to="getAccountLink(loggedInUser)">
            <q-item-section avatar><q-icon name="perm_identity" color="indigo" /></q-item-section>
            <q-item-section class="text-indigo">Profile</q-item-section>
          </q-item>
          <q-item :to="getWalletLink(loggedInUser)">
            <q-item-section avatar><q-icon name="account_balance" color="green" /></q-item-section>
            <q-item-section class="text-green">Wallet</q-item-section>
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
            <q-linear-progress dark stripe rounded size="20px" :value="votePower" color="blue" class="q-mt-none" title="Vote Power %">
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
        <q-item>
          <userSearchBox @selectUsername="setUsername" label="Username" class="text-center" />
        </q-item>
        <q-item dense v-if="username !== ''">
          <q-btn-group rounded>
          <q-btn rounded label="Hive-Keychain" icon="img:statics/hive-keychain.svg" @click="checkLoginKeychain(username)" v-if="!$q.platform.is.electron"/>
          <q-btn v-if="false" rounded label="HiveSigner" icon="img:statics/hivesigner.svg" @click="loginType = 'hivesigner_popup'; login(username)" />
          <q-btn rounded label="SmartLock" icon="lock">
            <q-popup-proxy>
              <q-card class="q-pa-lg rounded-borders">
                <q-input v-model="username" label="Username" />
                <q-input v-model="postkey" label="Posting Key" filled type="password" :rules="[val => !!val || 'Field is required']"/>
                <q-input v-model="activekey" label="Active Key (optional)" filled type="password" />
                <q-input v-model="memokey" label="Memo Key (optional)" filled type="password" />
                <q-input v-model="password" label="Unlock Password" filled type="password" :rules="[val => !!val || 'Field is required']"/>
                <q-btn flat glossy dense label="Save and login" icon="save" color="primary" @click="smartLockImportAccount()"/>
              </q-card>
            </q-popup-proxy>
          </q-btn>
          </q-btn-group>
        </q-item>
        <q-item>
          <q-item-section>
            <q-btn icon="img:statics/member.png" flat  label="'Member ?" title="Save your username to the local browser storage for faster future logins" @click="rememberLogin = !rememberLogin">
              <q-checkbox v-model="rememberLogin" />
            </q-btn>
          </q-item-section>
        </q-item>
        <div class="text-center">
        <div v-if="savedUsers.length > 0">Hive-Keychain logins</div>
        <q-item v-for="user in savedUsers" :key="user.index">
          <q-item-section>
            <q-chip outline size="md" removable @remove="removeSavedUser(user)" clickable @click="rememberLogin = true; checkLoginKeychain(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" /></q-avatar> {{ user }}</q-chip>
          </q-item-section>
        </q-item>
        <div v-if="savedUsersSmartLock.length > 0">SmartLock logins</div>
        <q-item v-for="user in savedUsersSmartLock" :key="user.index">
          <q-item-section>
            <q-chip outline size="md" removable @remove="smartLockRemoveAccount(user)" clickable @click="rememberLogin = true; checkLoginSmartLock(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" /></q-avatar> {{ user }}</q-chip>
          </q-item-section>
          <q-item-section side v-if="false">
            <q-btn dense flat glossy v-if="smartLockUnlockStatus(user)" icon="no_encryption" color="green" @click="smartLockLockAccount(user)" />
            <q-btn dense flat glossy v-else color="red" icon="lock" @click="checkLoginSmartLock(user)" />
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
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
// import { keychain, isKeychainInstalled, hasKeychainBeenUsed } from '@hiveio/keychain'
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
      postkey: '',
      activekey: '',
      memokey: '',
      password: ''
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username },
      set (val) {
        this.$store.commit('hive/updateLoggedInUser', val)
        if (this.rememberLogin) { this.$q.sessionStorage.set('loggedInUser', val) }
      }
    },
    loginType: {
      get () { return this.$store.state.hive.user.loginType },
      set (val) {
        this.$store.commit('hive/updateLoginType', val)
      }
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
        return this.$store.state.hive.accounts[this.loggedInUser]
      }
    }
  },
  methods: {
    setUsername (user) { this.username = user },
    smartLockRemoveAccount (user) {
      smartlock.removeAccount(user)
      this.savedUsersSmartLock = smartlock.allAccounts()
    },
    smartLockImportAccount () {
      smartlock.importAccount(this.username, this.password, this.postkey, this.activekey, this.memokey)
      // this.username, this.postkey, this.activekey, this.memokey, this.password = ''
      this.savedUsersSmartLock = smartlock.allAccounts()
      this.checkLoginSmartLock(this.username)
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
      // smartlock.unlockAccount(user, password, keepUnlocked)
      if (smartlock.isAccountUnlocked(user)) {
        this.loggedInUser = user
        this.$q.sessionStorage.set('loggedInUser', user)
        this.loginType = 'smartlock'
      } else {
        this.getPasswordPrompt(user)
      }
    },
    getPasswordPrompt (user) {
      this.$q.dialog({
        dark: true,
        title: 'Account ' + user + ' is locked',
        message: 'Enter your password to unlock account ' + user,
        prompt: {
          model: '',
          type: 'password'
        },
        cancel: true,
        persistent: true
      }).onOk(data => {
        smartlock.unlockAccount(user, data, true)
          .then(res => this.checkLoginSmartLock(user))
          .catch(this.checkLoginSmartLock(user))
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
      this.$store.dispatch('hive/getAccount', this.loggedInUser)
    },
    logout () {
      this.smartLockLockAccount(this.loggedInUser)
      this.loggedInUser = ''
      this.loginType = ''
    }
  },
  mounted () {
    if (this.$q.sessionStorage.getItem('loggedInUser')) {
      this.login(this.$q.sessionStorage.getItem('loggedInUser'))
    }
  }
}
</script>
