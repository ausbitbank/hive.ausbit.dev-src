<template>
  <q-page class="flex q-pa-md flex-center">
    <q-card flat bordered class="text-center">
      <q-card-section>
        <h3 class="text-center text-bold text-h5">Create new HIVE account</h3>
        <div><i>New accounts can be created by any user on the Hive network.</i></div>
        <div><b>If you're new here:</b> use an onboarding service like <a href="https://hiveonboard.com/?ref=ausbitbank">hiveonboard</a> (<a href="https://signup.hive.io/">or others</a>) to get started.</div>
        <div><b>If you have an account already:</b> you can directly create new accounts with the form below</div>
      </q-card-section>
      <q-card-section>
      <q-card flat bordered>
        <q-card-section>
          <q-input label="New account username" v-model="newUsername" bottom-slots :error-message="this.$hive.utils.validateAccountName(this.newUsername)" :error="this.$hive.utils.validateAccountName(this.newUsername) !== null" v-if="availableUsername === false || availableUsername === null"/>
          <div v-if="availableUsername === false" class="text-h5 text-center">
            <q-icon name="error" color="red" size="md" /> Account <router-link :to="linkAccount(newUsername)">{{ newUsername }}</router-link> is already registered</div>
          <div v-if="availableUsername === true" class="text-h5 text-center">
            <b>{{ newUsername }}</b> is available!<br />
            <q-btn dense icon="refresh" color="primary" v-if="keys" @click="checkUsernameAvailable(newUsername) && init()" />
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions class="text-center">
          <q-btn flat label="Choose another username" icon="arrow_back" color="primary" @click="newUsername='';keys=null;confirmedSaved=false" v-if="availableUsername === true" />
          <q-btn flat label="Check username availability" icon="search" color="primary" @click="keys=null;checkUsernameAvailable(newUsername)" v-if="!availableUsername && !keys" :disable="$hive.utils.validateAccountName(newUsername) !== null" />
          <q-btn flat label="Generate Keys" icon="enhanced_encryption" color="orange" v-if="availableUsername && !keys" @click="genKeys()" />
        </q-card-actions>
      </q-card>
      <q-card flat bordered v-if="keys">
        <q-card-section header class="text-center text-h5 text-bold text-red">
          <q-icon name="warning" /> Save a copy of these keys!
        </q-card-section>
        <q-card-section>
          <json-viewer :data="keys" />
          <q-checkbox label="I have saved my keys in a secure location" v-model="confirmedSaved" />
        </q-card-section>
        <q-card-actions class="text-center">
          <q-btn dense color="primary" icon="content_copy" label="Copy" @click="copy(JSON.stringify(keys))" />
          <q-btn dense color="primary" icon="save" label="Save" @click="saveKeys()" />
          <q-btn dense color="red" icon="person_add" label="Create with token" @click="claimAccountWithToken()" :title="!loggedInUser ? 'You need to login to use this' : 'Broadcast account creation to blockchain'" :disable="!loggedInUser || account.pending_claimed_accounts === 0 || !confirmedSaved" v-if="account.pending_claimed_accounts > 0" />
          <q-btn dense color="red" icon="person_add" label="Create for 3 HIVE" @click="claimAccountWithHive()" :title="!loggedInUser ? 'You need to login to use this' : 'Broadcast account creation to blockchain'" :disable="!loggedInUser || !confirmedSaved" v-if="parseFloat(account.balance.split(' ')[0]) > 3"/>
          <q-btn dense label="Import keys to keychain" color="primary" icon="img:statics/hive-keychain.svg" @click="importToKeychain()" />
        </q-card-actions>
      </q-card>
      </q-card-section>
      <q-card-section v-if="loggedInUser && account">
        {{ loggedInUser }} has <q-badge :color="account.pending_claimed_accounts > 0 ? 'primary' : 'red'">{{ account.pending_claimed_accounts }}</q-badge> account creation tokens available<br />
        And enough liquid HIVE to purchase <q-badge :color="parseFloat(account.balance.split(' ')[0]) > 3 ? 'primary' : 'red'">{{ (parseFloat(account.balance.split(' ')[0]) / 3).toFixed(0) }}</q-badge> accounts (at 3 HIVE each)
        <rc :username="loggedInUser" :showAccountClaimsOnly="true" />
      </q-card-section>
    </q-card>
  </q-page>
</template>
<script>
import { copyToClipboard, exportFile } from 'quasar'
import { keychain } from '@hiveio/keychain'
export default {
  name: 'createAccountPage',
  components: {
    jsonViewer: () => import('components/jsonViewer.vue'),
    rc: () => import('components/rc.vue')
  },
  data () {
    return {
      newUsername: '',
      availableUsername: null,
      keys: null,
      roles: ['active', 'owner', 'posting', 'memo'],
      confirmedSaved: false
    }
  },
  watch: {
    newUsername: function () { this.availableUsername = null },
    loggedInUser: function () { this.init() }
  },
  computed: {
    globalProps: function () { return this.$store.state.hive.globalProps },
    loggedInUser: function () { return this.$store.state.hive.user.username },
    account: function () { return this.$store.state.hive.accounts[this.loggedInUser] || null }
  },
  methods: {
    checkUsernameAvailable (username) {
      this.availableUsername = null
      this.$hive.api.getAccountsAsync([username])
        .then(response => { if (response.length === 0) { this.availableUsername = true } else { this.availableUsername = false } })
        .error(err => { this.availableUsername = null; this.console.error(err.cause.data) })
    },
    genKeys () {
      var password = this.$hive.formatter.createSuggestedPassword()
      this.keys = { username: this.newUsername, password: password }
      this.keys.owner = this.$hive.auth.toWif(this.newUsername, password, 'owner')
      this.keys.active = this.$hive.auth.toWif(this.newUsername, password, 'active')
      this.keys.posting = this.$hive.auth.toWif(this.newUsername, password, 'posting')
      this.keys.memo = this.$hive.auth.toWif(this.newUsername, password, 'memo')
    },
    copy (i) { copyToClipboard(i); this.$q.notify('Copied keys to clipboard') },
    linkAccount (account) { return '/@' + account },
    claimAccountWithToken () {
      var op = {
        creator: this.loggedInUser,
        new_account_name: this.newUsername,
        owner: { weight_threshold: 1, account_auths: [], key_auths: [[this.$hive.auth.wifToPublic(this.keys.owner), 1]] },
        active: { weight_threshold: 1, account_auths: [], key_auths: [[this.$hive.auth.wifToPublic(this.keys.active), 1]] },
        posting: { weight_threshold: 1, account_auths: [], key_auths: [[this.$hive.auth.wifToPublic(this.keys.posting), 1]] },
        memo_key: this.$hive.auth.wifToPublic(this.keys.memo),
        json_metadata: '',
        extensions: []
      }
      var tx = ['create_claimed_account', op]
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', tx])
    },
    claimAccountWithHive () {
      var op = {
        fee: '3.000 HIVE',
        creator: this.loggedInUser,
        new_account_name: this.newUsername,
        owner: { weight_threshold: 1, account_auths: [], key_auths: [[this.$hive.auth.wifToPublic(this.keys.owner), 1]] },
        active: { weight_threshold: 1, account_auths: [], key_auths: [[this.$hive.auth.wifToPublic(this.keys.active), 1]] },
        posting: { weight_threshold: 1, account_auths: [], key_auths: [[this.$hive.auth.wifToPublic(this.keys.posting), 1]] },
        memo_key: this.$hive.auth.wifToPublic(this.keys.memo),
        json_metadata: '',
        extensions: []
      }
      var tx = ['account_create', op]
      this.$store.commit('hive/addToQueue', [this.loggedInUser, 'active', tx])
    },
    async importToKeychain () {
      const { success, msg } = await keychain(window, 'requestAddAccount', this.keys.username, { active: this.keys.active, posting: this.keys.posting, memo: this.keys.memo })
      if (success) { this.$q.notify('Imported active, posting & memo keys to hive-keychain') }
      if (msg) { this.$q.notify(msg) }
    },
    saveKeys () {
      if (this.keys) {
        var status = exportFile(this.keys.username + '-HiveKeys.txt', this.keys)
        if (status === true) { this.$q.notify('Downloaded ' + this.keys.username + '-HiveKeys.txt') } else { this.$q.notify(Error + ':' + status) }
      }
    },
    init () {
      if (this.loggedInUser && this.account === undefined) { this.$store.dispatch('hive/getAccount', this.loggedInUser) }
    }
  },
  mounted () {
    document.title = 'Create new Hive account'
  }
}
</script>
