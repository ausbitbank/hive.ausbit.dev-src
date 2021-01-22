<template>
  <q-btn flat dense round aria-label="Login" class="hvr q-ml-md">
    <q-avatar>
      <q-img :src="userAvatar"/>
    </q-avatar>
    <span class="q-ma-sm">{{ loggedInUser }}</span>
    <q-popup-proxy>
      <q-card flat bordered>
      <div v-if="loggedInUser">
        <q-list bordered class="rounded-borders text-primary">
          <q-item clickable :to="linkFeed(loggedInUser)">
            <q-item-section avatar><q-icon name="rss_feed" color="orange" /></q-item-section>
            <q-item-section>Feed</q-item-section>
          </q-item>
          <q-item clickable :to="linkBlog(loggedInUser)">
            <q-item-section avatar><q-icon name="menu_book" color="purple" /></q-item-section>
            <q-item-section>Blog</q-item-section>
          </q-item>
          <q-item clickable :to="linkBlog(loggedInUser)">
            <q-item-section avatar><q-icon name="library_books" color="deep_purple" /></q-item-section>
            <q-item-section>Posts</q-item-section>
          </q-item>
          <q-item clickable :to="linkReplies(loggedInUser)">
            <q-item-section avatar><q-icon name="comment" color="blue-grey" /></q-item-section>
            <q-item-section>Replies</q-item-section>
          </q-item>
          <q-item clickable :to="getAccountLink(loggedInUser)">
            <q-item-section avatar><q-icon name="perm_identity" color="indigo" /></q-item-section>
            <q-item-section>Profile</q-item-section>
          </q-item>
          <q-item :to="getWalletLink(loggedInUser)">
            <q-item-section avatar><q-icon name="account_balance" color="green" /></q-item-section>
            <q-item-section>Wallet</q-item-section>
          </q-item>
          <q-item>
            <q-btn label="Logout" color="red" @click="loggedInUser = ''" icon="exit_to_app" class="text-center hvr" push/>
          </q-item>
        </q-list>
      </div>
      <q-list v-else>
        <q-item-label header class="text-h5 text-center">
            Login with Hive Account
          </q-item-label>
        <q-item>
          <q-input label="username" v-model="username" />
        </q-item>
        <q-item v-if="username !== ''">
          <q-btn dense push color="primary" label="Login with Hive-Keychain" icon="img:statics/hive-keychain.svg" @click="checkLogin(username)"/>
        </q-item>
        <q-item>
          <q-item-section>
            <q-btn icon="img:statics/member.png" push label="'Member ?" title="Save your username to the local browser storage for faster future logins" @click="rememberLogin = !rememberLogin">
              <q-checkbox v-model="rememberLogin" />
            </q-btn>
          </q-item-section>
        </q-item>
        <q-item v-for="user in savedUsers" :key="user.index">
          <q-chip outline class="hvr" size="md" removable @remove="removeSavedUser(user)" clickable @click="rememberLogin = true; checkLogin(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" /></q-avatar> {{ user }}</q-chip>
        </q-item>
      </q-list>
      </q-card>
    </q-popup-proxy>
  </q-btn>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
// import { keychain, isKeychainInstalled, hasKeychainBeenUsed } from '@hiveio/keychain'
import { keychain } from '@hiveio/keychain'
export default {
  name: 'userLogin',
  props: [],
  components: {},
  data () {
    return {
      username: '',
      savedUsers: this.$q.localStorage.getItem('savedUsers') || [],
      rememberLogin: false
    }
  },
  computed: {
    loggedInUser: {
      get () { return this.$store.state.hive.user.username },
      set (val) {
        this.$store.commit('hive/updateLoggedInUser', val)
        if (this.rememberLogin) {
          this.$q.sessionStorage.set('loggedInUser', val)
        }
      }
    },
    userAvatar: function () {
      if (this.loggedInUser !== '') {
        return 'https://images.hive.blog/u/' + this.loggedInUser + '/avatar'
      } else {
        return 'https://images.hive.blog/u/null/avatar'
      }
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    removeSavedUser (user) {
      this.savedUsers.splice(this.savedUsers.indexOf(user), 1)
      this.$q.localStorage.set('savedUsers', this.savedUsers)
    },
    async checkLogin (user) {
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestSignBuffer', user, 'hive.ausbit.dev login for ' + user, 'Posting')
      if (success) {
        this.loggedInUser = user
        this.$q.sessionStorage.set('loggedInUser', user)
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
    linkFeed (username) { return '/@' + username + '/feed' }
  },
  mounted () {
    if (this.$q.sessionStorage.getItem('loggedInUser')) {
      this.loggedInUser = this.$q.sessionStorage.getItem('loggedInUser')
    }
    /* if (this.$q.localStorage.getItem('savedUsers') === null) {
      this.savedUsers = []
    } else {
      this.savedUsers = this.$q.localStorage.getItem('savedUsers')
    } */
  }
}
</script>
