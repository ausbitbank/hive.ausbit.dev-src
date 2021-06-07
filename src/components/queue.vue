<template>
  <transition appear enter-active-class="animated bounceInDown" leave-active-class="animated bounceOutUp">
  <q-btn flat icon="schedule" title="Queued actions">
    <q-badge color="orange" floating>{{ queue.length }}</q-badge>
    <q-popup-proxy>
      <q-card class="q-pa-none q-ma-none">
        <q-card-section horizontal class="text-title text-bold flex-center text-center">
          Queued Actions
          <q-btn dense flat icon="play_circle" color="green" v-if="timerEnabled" @click="toggleTimer()" title="Queue is running, click to pause" />
          <q-btn dense flat icon="pause_circle" color="red" v-if="!timerEnabled" @click="toggleTimer()" title="Queue is paused, click to continue" />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-ma-none q-pa-none">
          <q-list separator dense>
            <q-item v-for="(a, index) in this.queue" :key="index" clickable dense>
              <q-item-section avatar>
                <q-avatar><q-img :src="getHiveAvatarUrl(a[0])" /></q-avatar>
                <q-avatar v-if="a[1] === 'posting'"><q-icon name="lock" title="Posting key" color="green"/></q-avatar>
                <q-avatar v-if="a[1] === 'active'"><q-icon name="lock" title="Active key" color="orange"/></q-avatar>
              </q-item-section>
              <q-item-section>
                <jsonViewer :data="a[2]" />
              </q-item-section>
              <q-item-section side>
                <q-spinner-clock v-if="index === 0 && timerEnabled" color="grey" size="md" />
                <q-btn title="Remove from queue" icon="cancel" color="red" @click="$store.commit('hive/removeFromQueue', a)" dense flat/>
                <q-btn title="push queue item" icon="check" color="orange" @click="broadcast(a)" dense flat/>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-popup-proxy>
  </q-btn>
  </transition>
</template>
<script>
import { keychain } from '@hiveio/keychain'
import smartlock from 'components/smartlock'
import jsonViewer from 'components/jsonViewer.vue'
import { openURL } from 'quasar'
export default {
  name: 'queue',
  data () {
    return {
      timerStart: 500,
      timerEnabled: true
    }
  },
  components: { jsonViewer },
  computed: {
    loggedInUser: { get () { return this.$store.state.hive.user.username } },
    loginType: { get () { return this.$store.state.hive.user.loginType } },
    queue: { get () { return this.$store.state.hive.queue } }
  },
  methods: {
    toggleTimer () {
      this.timerEnabled = !this.timerEnabled
      if (this.timerEnabled) { setTimeout(this.broadcastNext, this.timerStart) }
    },
    successfullBroadcast (action, notify = true) {
      this.$store.commit('hive/removeFromQueue', action)
      if (notify) {
        this.$q.notify({
          message: 'Successful ' + action[2][0],
          color: 'green',
          avatar: this.getHiveAvatarUrl(action[0]),
          progress: true
        })
      }
      if (this.timerEnabled && this.queue.length > 0) { setTimeout(this.broadcastNext, this.timerStart) }
    },
    broadcastNext () { if (this.queue.length > 0) { this.broadcast(this.queue[0]) } },
    broadcast (action) {
      var user = action[0]
      var keytype = action[1]
      var operation = [action[2]]
      if (this.loginType === 'smartlock') {
        if (smartlock.isAccountUnlocked(user)) {
          console.log('hive-js broadcast')
          if (keytype === 'active') {
            this.getPasswordForAction(action)
          } else if (keytype === 'posting') {
            smartlock.api.broadcastAsync(user, operation, keytype)
              .then(res => { if (res.success) { this.successfullBroadcast(action) } })
              .catch(err => console.error(err))
          }
        }
      }
      if (this.loginType === 'keychain') {
        this.broadcastKeychain(action)
      }
      if (this.loginType === 'hivesigner_popup') {
        this.broadcastHivesignerPopup(action)
      }
    },
    broadcastHivesignerPopup (action) {
      console.log(action)
      var url = 'https://www.hivesigner.com/sign/' + action[2][0] + '?'
      var params = action[2][1]
      var qs = new URLSearchParams(params)
      url = url + qs.toString()
      openURL(url)
      this.$q.notify('Opened hivesigner popup: ' + url)
      this.successfullBroadcast(action, false)
    },
    async broadcastKeychain (action) {
      var user = action[0]
      var keytype = action[1]
      var op = action[2]
      var ops = [op]
      if (op[0] === 'vote') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestVote', user, op[1].permlink, op[1].author, op[1].weight)
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } else if (op[0] === 'custom_json') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestCustomJson', user, op[1].id, keytype, op[1].json)
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } else if (op[0] === 'transfer') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestTransfer', user, op[1].to, op[1].amount.split(' ')[0], op[1].memo, op[1].amount.split(' ')[1])
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } else if (op[0] === 'comment') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestPost', user, op[1].title, op[1].body, op[1].parent_permlink, op[1].parent_author, JSON.stringify(op[1].json_metadata), op[1].permlink, JSON.stringify(op[1].comment_options))
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } else {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestBroadcast', user, ops, keytype)
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      }
    },
    getHiveAvatarUrl (user) { return 'https://images.hive.blog/u/' + user + '/avatar' },
    getPasswordForAction (action) {
      var user = action[0]
      this.$q.dialog({
        dark: true,
        title: 'Verify password for ' + user,
        message: 'Password required for ' + user,
        prompt: {
          model: '',
          type: 'password'
        },
        cancel: true,
        persistent: true
      }).onOk(data => {
        smartlock.api.broadcastAsync(user, [action[2]], 'active', data)
          .then(res => { if (res.success) { this.successfullBroadcast(action) } })
          .catch(err => console.error(err))
      }).onCancel(() => {
        // cancel
      }).onDismiss(() => {
        // triggered by both ok and cancel
      })
    }
  },
  mounted () {
    if (this.timerEnabled && this.queue.length > 0) { setTimeout(this.broadcastNext, this.timerStart) }
  }
}
</script>
