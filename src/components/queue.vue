<template>
  <transition appear enter-active-class="animated bounceInDown" leave-active-class="animated bounceOutUp">
  <q-btn flat icon="schedule" title="Queued actions" aria-label="Queued actions">
    <q-badge color="orange" floating>{{ queue.length }}</q-badge>
    <q-popup-proxy>
      <q-card flat bordered class="q-pa-sm q-ma-none">
        <q-card-section horizontal class="text-title text-bold flex-center text-center">
          {{ queue.length }} Queued Actions
          <q-btn dense flat icon="play_circle" color="green" v-if="timerEnabled" @click="toggleTimer()" title="Queue is running, click to pause" aria-label="Pause queue timer" />
          <q-btn dense flat icon="pause_circle" color="orange" v-if="!timerEnabled" @click="toggleTimer()" title="Queue is paused, click to continue" aria-label="Resume queue timer" />
          <q-btn dense flat icon="cancel" color="red" title="Cancel queued actions" aria-label="Cancel queued actions" @click="$hiveStore.clearQueue()" v-if="queue.length > 0"/>
        </q-card-section>
        <q-separator v-if="queue.length > 0" />
        <q-card-section class="q-ma-none q-pa-none" v-if="queue.length > 0">
          <q-list separator dense>
            <q-item v-for="(a, index) in queue" :key="index" clickable dense>
              <q-item-section avatar>
                <q-avatar><q-img :src="getHiveAvatarUrl(a[0])" alt="Account avatar" /></q-avatar>
                <q-avatar v-if="a[1] === 'posting'"><q-icon name="lock" title="Posting key" color="green"/></q-avatar>
                <q-avatar v-if="a[1] === 'active'"><q-icon name="lock" title="Active key" color="orange"/></q-avatar>
              </q-item-section>
              <q-item-section>
                <jsonViewer :data="a[2]" />
              </q-item-section>
              <q-item-section side>
                <q-spinner-clock v-if="index === 0 && timerEnabled" color="grey" size="md" />
                <q-btn title="Remove from queue" icon="cancel" color="red" @click="$hiveStore.removeFromQueue(a)" dense flat/>
                <q-btn title="Broadcast" icon="send" color="orange" @click="broadcast(a)" dense flat/>
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
import smartlock from 'components/smartlock/index.js'
import jsonViewer from 'components/jsonViewer.vue'
export default {
  name: 'queue',
  data () {
    return {
      timerStart: 500,
      timerEnabled: true,
      pastQueue: []
    }
  },
  components: { jsonViewer },
  computed: {
    loggedInUser: function () { return this.$hiveStore.user.username },
    loginType: function () { return this.$hiveStore.user.loginType },
    queue: function () { return this.$hiveStore.queue },
    globalProps: function () { return this.$hiveStore.globalProps }
  },
  methods: {
    toggleTimer () {
      this.timerEnabled = !this.timerEnabled
      if (this.timerEnabled) { setTimeout(this.broadcastNext, this.timerStart) }
    },
    successfullBroadcast (action, notify = true) {
      this.$hiveStore.removeFromQueue(action)
      this.pastQueue.push(action)
      console.log(this.pastQueue)
      if (notify) {
        this.$q.notify({
          message: 'Sent ' + action[2][0],
          color: 'green',
          avatar: this.getHiveAvatarUrl(action[0]),
          icon: 'check_circle',
          position: 'top',
          progress: true
        })
      }
      if (this.timerEnabled && this.queue.length > 0) { setTimeout(this.broadcastNext, this.timerStart) }
      if (['claim_reward_balance', 'account_update', 'account_update2', 'withdraw_vesting'].includes(action[2][0])) { this.$hiveStore.getAccount(action[2][1].account) }
      if (['transfer', 'transfer_to_savings', 'transfer_from_savings', 'transfer_to_vesting', 'cancel_transfer_from_savings'].includes(action[2][0])) { this.$hiveStore.getAccount(action[2][1].from) }
      if (['convert', 'collateralized_convert', 'limit_order_cancel', 'limit_order_create'].includes(action[2][0])) { this.$hiveStore.getAccount(action[2][1].owner) }
      if (['account_witness_vote', 'account_witness_proxy', 'witness_update'].includes(action[2][0])) {
        const witnessAccount = action[2][1].account || action[2][1].owner
        if (witnessAccount) this.$hiveStore.getAccount(witnessAccount)
      }
    },
    broadcastNext () { if (this.queue.length > 0) { this.broadcast(this.queue[0]) } },
    broadcast (action) {
      var user = action[0]
      var keytype = action[1]
      var operation = [JSON.parse(JSON.stringify(action[2]))]
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
    },
    async broadcastKeychain (action) {
      var user = action[0]
      var keytype = action[1]
      var op = JSON.parse(JSON.stringify(action[2]))
      var ops = [op]
      if (op[0] === 'vote') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestVote', user, op[1].permlink, op[1].author, op[1].weight)
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      }
      /* if (op[0] === 'custom_json') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestCustomJson', user, op[1].id, keytype, op[1].json)
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } /* else if (op[0] === 'transfer') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestTransfer', user, op[1].to, op[1].amount.split(' ')[0], op[1].memo, op[1].amount.split(' ')[1])
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } } */
      if (op[0] === 'comment') {
        var co = op[1].comment_options
        delete op[1].comment_options
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestPost', user, op[1].title, op[1].body, op[1].parent_permlink, op[1].parent_author, JSON.stringify(op[1].json_metadata), op[1].permlink, JSON.stringify(co))
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      /* } else if (op[0] === 'transfer_to_vesting') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestPowerUp', user, op[1].to, op[1].amount.split(' ')[0])
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } else if (op[0] === 'withdraw_vesting') {
        var hiveToPowerUp = this.vestToHive(parseInt(op[1].vesting_shares) / 1000000)
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestPowerDown', user, hiveToPowerUp)
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } }
      } else if (op[0] === 'delegate_vesting_shares') {
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestDelegation', user, op[1].delegatee, op[1].vesting_shares.split(' ')[0], 'VESTS')
        if (success) { this.successfullBroadcast(action) }
        if (cancel) { this.$q.notify('Cancelled by user') }
        if (!cancel) { if (notActive) { this.$q.notify('Please allow keychain to access this website') } else if (notInstalled) { this.$q.notify('Keychain not available') } else { console.info(msg) } } */
      } else { // Generic broadcast */
        const { success, msg, cancel, notInstalled, notActive } = await keychain(window, 'requestBroadcast', user, JSON.parse(JSON.stringify(ops)), keytype)
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
    },
    vestToHive (vests) {
      if (this.globalProps) {
        return this.$hive.formatter.vestToHive(vests, this.globalProps.total_vesting_shares, this.globalProps.total_vesting_fund_hive).toFixed(3)
      } else {
        return null
      }
    }
  },
  mounted () {
    if (this.$hiveStore.queueRestored) {
      const count = this.$hiveStore.restoredQueueCount || this.queue.length
      this.$q.notify({
        message: 'Restored ' + count + ' queued action' + (count === 1 ? '' : 's') + '. Press play to resume broadcasting.',
        color: 'orange',
        icon: 'restore',
        position: 'top',
        timeout: 6000
      })
      // Never auto-broadcast operations restored from a previous session.
      this.timerEnabled = false
      this.$hiveStore.acknowledgeQueueRestored()
    }
    if (this.globalProps.empty) { this.$hiveStore.getGlobalProps() }
    if (this.timerEnabled && this.queue.length > 0) { setTimeout(this.broadcastNext, this.timerStart) }
  }
}
</script>
