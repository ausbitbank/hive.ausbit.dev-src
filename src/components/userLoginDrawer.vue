<template>
  <q-drawer v-model="drawerState" side="right" overlay elevated>
    <div v-if="loggedInUser">
      <q-list bordered padding class="rounded-borders text-primary">
        <q-item-label header class="text-h5">
          Logged in as {{ loggedInUser }}
        </q-item-label>
        <q-item clickable :to="getAccountLink(loggedInUser)">
          <q-item-section avatar><q-icon name="perm_identity" /></q-item-section>
          <q-item-section>Profile</q-item-section>
        </q-item>
        <q-item :to="getWalletLink(loggedInUser)">
          <q-item-section avatar><q-icon name="account_balance" /></q-item-section>
          <q-item-section>Wallet</q-item-section>
        </q-item>
        <q-item>
          <q-btn label="Logout" color="red" @click="loggedInUser = null" icon="exit_to_app" class="text-center hvr" push/>
        </q-item>
      </q-list>
      <!-- <notifications /> -->
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
        <q-btn dense push class="hvr" @click="checkLogin(user)"><q-avatar><q-img :src="getHiveAvatarUrl(user)" /></q-avatar> {{ user }}</q-btn>
      </q-item>
    </q-list>
  </q-drawer>
</template>
<style>
a:link { color: #1d8ce0; font-weight: bold; text-decoration: none; }
a:visited { color: #1d8ce0; }
</style>
<script>
// import { keychain, isKeychainInstalled, hasKeychainBeenUsed } from '@hiveio/keychain'
import { keychain } from '@hiveio/keychain'
// import notifications from 'components/notifications.vue'
export default {
  name: 'userLoginDrawer',
  props: ['drawerState'],
  // components: { notifications },
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
      set (val) { this.$store.commit('hive/updateLoggedInUser', val) }
    }
  },
  methods: {
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getAccountLink (user) { return '/@' + user },
    getWalletLink (user) { return '/@' + user + '/wallet' },
    async checkLogin (user) {
      const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestSignBuffer', user, 'hive.ausbit.dev login for ' + user, 'Posting')
      if (success) {
        this.loggedInUser = user
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
    }
  },
  mounted () {
    /* if (this.$q.localStorage.getItem('savedUsers') === null) {
      this.savedUsers = []
    } else {
      this.savedUsers = this.$q.localStorage.getItem('savedUsers')
    } */
  }
}
</script>
