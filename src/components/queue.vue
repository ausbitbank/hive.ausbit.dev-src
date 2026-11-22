<template>
  <transition appear enter-active-class="animated bounceInDown" leave-active-class="animated bounceOutUp">
    <q-btn flat icon="schedule" :aria-label="queueButtonLabel" :title="queueButtonLabel">
      <q-badge v-if="badgeCount > 0" color="orange" floating>{{ badgeCount }}</q-badge>
      <q-popup-proxy>
        <q-card flat bordered class="home-card home-panel queue-panel">
          <q-card-section class="home-panel__head">
            <div>
              <div class="home-eyebrow">Signing queue</div>
              <h2 class="home-panel__title">Action queue</h2>
            </div>
            <div class="home-panel__actions">
              <q-btn
                flat
                dense
                round
                :icon="autoSigningAvailable && timerEnabled ? 'pause_circle' : 'play_circle'"
                :color="autoSigningAvailable && timerEnabled ? 'green' : 'orange'"
                :aria-label="autoSendLabel"
                :title="autoSendLabel"
                :disable="offline || !autoSigningAvailable"
                @click="toggleTimer"
              />
              <q-btn
                flat
                dense
                round
                icon="refresh"
                color="primary"
                aria-label="Refresh queue status"
                title="Refresh queue status"
                @click="refreshQueueMeta"
              />
            </div>
          </q-card-section>

          <div class="queue-summary">
            <span class="queue-chip queue-chip--pending">Queued {{ counts.pending }}</span>
            <span v-if="counts.failed" class="queue-chip queue-chip--failed">Failed {{ counts.failed }}</span>
            <span v-if="counts.sent" class="queue-chip queue-chip--sent">Sent {{ counts.sent }}</span>
            <span class="queue-auto" :class="{ 'queue-auto--paused': !timerEnabled || !autoSigningAvailable }">
              <q-icon :name="autoSigningAvailable && timerEnabled ? 'bolt' : 'pause'" size="13px" aria-hidden="true" />
              Auto-send {{ !autoSigningAvailable ? 'off' : (timerEnabled ? 'on' : 'paused') }}
            </span>
          </div>

          <div v-if="loginType === 'hiveauth'" class="queue-auto-note">
            HiveAuth asks for phone approval for each action. Use Keychain or SmartLock for auto-send.
          </div>

          <div v-if="offline" class="queue-offline">
            <data-notice
              variant="offline"
              message="Offline — reviewing is available, signing is blocked until the connection returns."
            />
          </div>

          <div class="queue-toolbar">
            <q-btn
              no-caps
              dense
              outline
              color="primary"
              icon="send"
              label="Send all"
              :loading="bulkSending"
              :disable="offline || !canSendAll"
              @click="sendAll"
            />
            <q-btn
              no-caps
              dense
              outline
              color="green"
              icon="done_all"
              label="Clear sent"
              :disable="counts.sent === 0"
              @click="clearCompleted"
            />
            <q-btn
              no-caps
              dense
              flat
              color="red"
              icon="delete_sweep"
              label="Clear queue"
              :disable="queue.length === 0"
              @click="confirmClearAll"
            />
          </div>

          <q-separator />

          <div v-if="queue.length === 0" class="home-panel__state">
            <q-icon name="playlist_add_check" size="26px" color="grey" aria-hidden="true" />
            <span>No queued actions. Actions you vote, post, transfer or trade will appear here for review.</span>
          </div>

          <q-scroll-area v-else class="queue-scroll" :thumb-style="{ width: '5px', borderRadius: '5px', opacity: 0.25, backgroundColor: 'var(--c-link)' }">
            <q-list separator>
              <q-item v-for="(action, index) in queue" :key="actionKey(action, index)" class="queue-item">
                <q-item-section avatar>
                  <q-avatar size="30px">
                    <q-img :src="avatarUrl(action[0])" :alt="'Avatar of @' + action[0]" />
                  </q-avatar>
                </q-item-section>

                <q-item-section>
                  <div class="queue-item__top">
                    <span class="queue-item__title">{{ operationLabel(action) }}</span>
                    <q-badge :color="keyFor(action).color" text-color="black">
                      {{ keyFor(action).shortLabel }} key
                    </q-badge>
                    <q-badge :color="statusFor(metaFor(index).status).color" text-color="black">
                      {{ statusFor(metaFor(index).status).label }}
                    </q-badge>
                    <q-badge v-if="metaFor(index).manualOnly" color="orange" text-color="black" title="This action must be reviewed and sent individually">
                      Review
                    </q-badge>
                  </div>

                  <div class="queue-item__summary">{{ operationSummary(action) }}</div>

                  <div class="queue-item__meta">
                    <span>@{{ action[0] }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ timeAgo(metaFor(index).addedAt) }}</span>
                    <template v-if="metaFor(index).txId">
                      <span aria-hidden="true">·</span>
                      <span>tx {{ shortTx(metaFor(index).txId) }}</span>
                    </template>
                  </div>

                  <div v-if="metaFor(index).error" class="queue-item__error" role="status">
                    <q-icon name="error_outline" size="14px" aria-hidden="true" />
                    {{ metaFor(index).error }}
                  </div>

                  <q-expansion-item dense icon="code" label="Details" class="queue-details">
                    <jsonViewer :data="action[2]" />
                  </q-expansion-item>
                </q-item-section>

                <q-item-section side class="queue-item__actions">
                  <q-btn
                    v-if="canBroadcast(metaFor(index).status)"
                    flat
                    dense
                    round
                    :icon="metaFor(index).status === 'failed' ? 'refresh' : 'send'"
                    :color="metaFor(index).status === 'failed' ? 'orange' : 'primary'"
                    :aria-label="(metaFor(index).status === 'failed' ? 'Retry ' : 'Broadcast ') + operationLabel(action)"
                    :title="metaFor(index).status === 'failed' ? 'Retry action' : 'Broadcast now'"
                    :loading="metaFor(index).status === 'broadcasting'"
                    :disable="offline || broadcastingIndex !== null"
                    @click="manualBroadcast(index)"
                  />
                  <q-spinner-dots v-if="metaFor(index).status === 'broadcasting'" color="primary" size="20px" aria-label="Broadcasting" />
                  <q-btn
                    v-if="canRemove(metaFor(index).status)"
                    flat
                    dense
                    round
                    icon="cancel"
                    color="red"
                    :aria-label="'Remove ' + operationLabel(action) + ' from queue'"
                    title="Remove from queue"
                    @click="removeItem(index)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>

          <q-card-section class="home-panel__footer queue-footer">
            <span><strong>Posting key</strong> · votes, comments and notifications</span>
            <span><strong>Active key</strong> · funds and account authority</span>
          </q-card-section>
        </q-card>
      </q-popup-proxy>
    </q-btn>
  </transition>
</template>

<script>
import { keychain } from '@hiveio/keychain'
import moment from 'src/utils/time'
import smartlock from 'components/smartlock/index.js'
import { defineAsyncComponent } from 'vue'
const jsonViewer = defineAsyncComponent(() => import('components/jsonViewer.vue'))
import {
  QUEUE_STATUS,
  canBroadcast,
  canRemove,
  keyRequirement,
  nextActionableIndex,
  normalizeQueueMeta,
  operationLabel,
  operationSummary,
  postMetadataArgument,
  queueBadgeCount,
  queueCounts,
  statusMeta
} from 'src/services/queue'
import { invalidateOperationCaches } from 'src/services/cacheInvalidation'
import DataNotice from 'components/ui/DataNotice.vue'
import { hiveAvatarUrl } from 'src/utils/avatar'

let hiveauthPromise = null
function loadHiveAuth () {
  return (hiveauthPromise ||= import('src/services/hiveauth').then(module => module.default))
}

export default {
  name: 'queue',
  components: { jsonViewer, DataNotice },
  data () {
    return {
      timerStart: 500,
      timerEnabled: true,
      bulkSending: false,
      broadcastingIndex: null,
      broadcastTimer: null
    }
  },
  computed: {
    loggedInUser () { return this.$hiveStore.user.username },
    loginType () { return this.$hiveStore.user.loginType },
    offline () {
      return this.$online ? !this.$online.online : (typeof navigator !== 'undefined' && navigator.onLine === false)
    },
    queue () { return this.$hiveStore.queue },
    queueMeta () { return this.$hiveStore.queueMeta },
    smartlockTimeoutMs () {
      const minutes = Number(this.$hiveStore.user?.settings?.smartlockSessionMinutes)
      return (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60 * 1000
    },
    normalizedMeta () {
      return normalizeQueueMeta(this.queue, this.queueMeta)
    },
    counts () {
      return queueCounts(this.normalizedMeta)
    },
    badgeCount () {
      return queueBadgeCount(this.normalizedMeta)
    },
    autoSigningAvailable () {
      return this.loginType !== 'hiveauth'
    },
    autoSendLabel () {
      if (!this.autoSigningAvailable) return 'Auto-send unavailable with HiveAuth'
      return this.timerEnabled ? 'Pause auto-send' : 'Resume auto-send'
    },
    canSendAll () {
      if (!this.autoSigningAvailable) return false
      return this.normalizedMeta.some((entry, index) => {
        return !entry.manualOnly && canBroadcast(entry.status) && this.queue[index]
      })
    },
    manualPendingCount () {
      return this.normalizedMeta.filter(entry => entry.manualOnly && canBroadcast(entry.status)).length
    },
    queueButtonLabel () {
      const active = this.badgeCount
      return active > 0 ? active + ' queued action' + (active === 1 ? '' : 's') : 'Action queue'
    }
  },
  watch: {
    'queue.length' () {
      this.scheduleNext()
    },
    loginType (value) {
      if (value === 'hiveauth') {
        this.timerEnabled = false
        this.bulkSending = false
        this.clearBroadcastTimer()
      }
    }
  },
  mounted () {
    if (this.loginType === 'hiveauth') this.timerEnabled = false
    if (this.$hiveStore.queueRestored) {
      const count = this.$hiveStore.restoredQueueCount || this.queue.length
      this.$q.notify({
        message: 'Restored ' + count + ' queued action' + (count === 1 ? '' : 's') + '. Auto-send is paused.',
        color: 'orange',
        icon: 'restore',
        position: 'top',
        timeout: 6000
      })
      // Never auto-broadcast operations restored from a previous session.
      this.timerEnabled = false
      this.$hiveStore.acknowledgeQueueRestored()
    }
    if (this.timerEnabled) this.scheduleNext()
  },
  beforeUnmount () {
    this.clearBroadcastTimer()
  },
  methods: {
    operationLabel,
    operationSummary,
    keyFor: keyRequirement,
    statusFor: statusMeta,
    canBroadcast,
    canRemove,
    metaFor (index) {
      return this.normalizedMeta[index] || { status: QUEUE_STATUS.PENDING, error: '', txId: '', addedAt: Date.now() }
    },
    actionKey (action, index) {
      return (action?.[0] || 'action') + '-' + index
    },
    avatarUrl (user) {
      return hiveAvatarUrl(user || 'null')
    },
    shortTx (txId) {
      const text = String(txId || '')
      return text.length > 12 ? text.slice(0, 8) + '…' + text.slice(-4) : text
    },
    timeAgo (value) {
      return value ? moment.utc(value).fromNow() : 'just now'
    },
    refreshQueueMeta () {
      this.$hiveStore.queueMeta = normalizeQueueMeta(this.queue, this.queueMeta)
      this.$q.notify({ message: 'Queue status refreshed.', color: 'primary', icon: 'refresh', timeout: 1500 })
    },
    clearBroadcastTimer () {
      if (this.broadcastTimer) {
        clearTimeout(this.broadcastTimer)
        this.broadcastTimer = null
      }
    },
    scheduleNext () {
      this.clearBroadcastTimer()
      if (!this.autoSigningAvailable) return
      if (!this.timerEnabled && !this.bulkSending) return
      if (nextActionableIndex(this.normalizedMeta, { auto: true }) < 0) {
        if (this.manualPendingCount > 0) {
          this.$q.notify({
            message: this.manualPendingCount + ' Lightning payment' + (this.manualPendingCount === 1 ? '' : 's') + ' need individual review. Open the queue and press send.',
            color: 'orange',
            icon: 'bolt',
            position: 'top',
            timeout: 5000
          })
        }
        if (this.bulkSending) {
          this.bulkSending = false
          if (this.manualPendingCount === 0) {
            this.$q.notify({ message: 'All queued actions have been sent.', color: 'green', icon: 'done_all', timeout: 2500 })
          }
        }
        return
      }
      this.broadcastTimer = setTimeout(() => this.broadcastNext(), this.timerStart)
    },
    toggleTimer () {
      if (!this.autoSigningAvailable) {
        this.$q.notify({
          message: 'HiveAuth needs phone approval for each action. Use Keychain or SmartLock for auto-send.',
          color: 'orange',
          icon: 'pause',
          position: 'top',
          timeout: 4000
        })
        return
      }
      this.timerEnabled = !this.timerEnabled
      if (this.timerEnabled) {
        this.scheduleNext()
      } else {
        this.clearBroadcastTimer()
        this.$q.notify({ message: 'Auto-send paused. Queued actions stay available.', color: 'orange', icon: 'pause', timeout: 2000 })
      }
    },
    broadcastNext () {
      if (!this.autoSigningAvailable) return
      const index = nextActionableIndex(this.normalizedMeta, { auto: true })
      if (index >= 0) this.broadcastAt(index, { auto: true })
    },
    manualBroadcast (index) {
      this.broadcastAt(index, { auto: false })
    },
    async broadcastAt (index, { auto = false } = {}) {
      if (this.broadcastingIndex !== null) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.$hiveStore.setQueueStatus(index, QUEUE_STATUS.FAILED, 'You are offline. Reconnect and retry.')
        this.$q.notify({ message: 'You are offline. Reconnect before broadcasting.', color: 'orange', icon: 'cloud_off', position: 'top', timeout: 5000 })
        this.timerEnabled = false
        this.bulkSending = false
        return
      }
      const action = this.queue[index]
      if (!action) return
      const status = this.metaFor(index).status
      if (!canBroadcast(status)) return

      this.broadcastingIndex = index
      this.$hiveStore.setQueueStatus(index, QUEUE_STATUS.BROADCASTING)
      this.clearBroadcastTimer()

      try {
        const result = await this.sendAction(action, { auto })
        if (result.success) {
          this.$hiveStore.setQueueStatus(index, QUEUE_STATUS.SENT)
          this.$hiveStore.setQueueTxId(index, result.txId)
          invalidateOperationCaches(action[2], { signer: action[0] })
          this.$q.notify({
            message: 'Sent ' + operationLabel(action) + '.',
            color: 'green',
            avatar: this.avatarUrl(action[0]),
            icon: 'check_circle',
            position: 'top',
            progress: true
          })
          this.refreshAfterAction(action)
        } else {
          this.$hiveStore.setQueueStatus(index, QUEUE_STATUS.FAILED, result.error || 'Broadcast failed.')
          this.$q.notify({
            message: result.error || 'Broadcast failed.',
            color: 'red',
            icon: 'error',
            position: 'top',
            timeout: 6000
          })
          this.timerEnabled = false
          this.bulkSending = false
        }
      } catch (error) {
        const message = error?.message || 'Broadcast failed.'
        this.$hiveStore.setQueueStatus(index, QUEUE_STATUS.FAILED, message)
        this.$q.notify({ message, color: 'red', icon: 'error', position: 'top', timeout: 6000 })
        this.timerEnabled = false
        this.bulkSending = false
      } finally {
        this.broadcastingIndex = null
        this.scheduleNext()
      }
    },
    async sendAction (action, { auto }) {
      const user = action[0]
      const keyType = action[1]
      const operation = JSON.parse(JSON.stringify(action[2]))

      if (this.loginType === 'keychain') {
        return this.sendWithKeychain(user, keyType, operation)
      }
      if (this.loginType === 'smartlock') {
        return this.sendWithSmartlock(user, keyType, operation, { auto })
      }
      if (this.loginType === 'hiveauth') {
        return this.sendWithHiveAuth(user, keyType, operation, { auto })
      }
      return { success: false, error: 'Log in with Keychain, SmartLock or HiveAuth before broadcasting.' }
    },
    async sendWithKeychain (user, keyType, operation) {
      let result
      if (operation[0] === 'vote') {
        result = await keychain(window, 'requestVote', user, operation[1].permlink, operation[1].author, operation[1].weight)
      } else if (operation[0] === 'comment') {
        const isEdit = operation[1]._edit === true
        const commentOptions = operation[1].comment_options
        delete operation[1].comment_options
        // Queue-only edit marker; not a field of the on-chain operation.
        delete operation[1]._edit

        if (isEdit) {
          // Edits must be broadcast as a bare `comment` operation. requestPost
          // always appends a `comment_options` operation with a default
          // 100000 HBD payout cap, which the chain rejects on an edit with
          // "A comment cannot accept a greater payout".
          result = await keychain(window, 'requestBroadcast', user, [operation], keyType)
        } else if (operation[1].parent_author) {
          // Replies and container comments (Snaps, Waves, Moments) are plain
          // comments. Send the exact operation through requestBroadcast:
          // requestPost adds post-only comment_options that a comment cannot
          // carry, and some Keychain versions reject the whole request.
          result = await keychain(window, 'requestBroadcast', user, [operation], keyType)
        } else {
          result = await keychain(
            window,
            'requestPost',
            user,
            operation[1].title,
            operation[1].body,
            operation[1].parent_permlink,
            operation[1].parent_author,
            postMetadataArgument(operation[1].json_metadata),
            operation[1].permlink,
            commentOptions ? JSON.stringify(commentOptions) : null
          )
        }
      } else {
        result = await keychain(window, 'requestBroadcast', user, [operation], keyType)
      }
      return this.normalizeKeychainResult(result)
    },
    normalizeKeychainResult (result) {
      if (!result) return { success: false, error: 'Keychain did not respond.' }
      if (result.success) {
        return {
          success: true,
          txId: result.result?.id || result.tx_id || result.txId || ''
        }
      }
      if (result.cancel) return { success: false, error: 'Cancelled in Keychain.' }
      if (result.notInstalled) return { success: false, error: 'Hive Keychain extension is not installed.' }
      if (result.notActive) return { success: false, error: 'Allow Hive Keychain to access this site.' }
      return { success: false, error: result.message || result.msg || result.error || 'Keychain did not approve the action.' }
    },
    async sendWithHiveAuth (user, keyType, operation, { auto } = {}) {
      if (auto) {
        return {
          success: false,
          error: 'HiveAuth needs phone approval for each action. Pause auto-send, or use Keychain/SmartLock.'
        }
      }
      try {
        const hiveauth = await loadHiveAuth()
        const operations = hiveauth.normalizeBroadcastOperation(operation)
        const result = await hiveauth.broadcast(user, keyType, operations)
        return { success: true, txId: result?.txId || '' }
      } catch (error) {
        return {
          success: false,
          error: error?.message || 'HiveAuth did not broadcast the action.'
        }
      }
    },
    async sendWithSmartlock (user, keyType, operation, { auto }) {
      if (keyType === 'posting') {
        if (!smartlock.isAccountUnlocked(user, this.smartlockTimeoutMs)) {
          if (auto) {
            return { success: false, error: 'SmartLock is locked. Unlock it and press retry.' }
          }
          const password = await this.promptPassword(user, 'Unlock SmartLock')
          await smartlock.unlockAccount(user, password, false)
        }
        const result = await smartlock.api.broadcastAsync(user, [operation], 'posting')
        return {
          success: Boolean(result?.success),
          txId: result?.result?.id || '',
          error: result?.success ? '' : 'SmartLock did not broadcast the action.'
        }
      }

      if (auto) {
        return {
          success: false,
          error: 'Active-key actions need confirmation. Pause auto-send and press send.'
        }
      }
      const password = await this.promptPassword(user, 'Confirm active key')
      const result = await smartlock.api.broadcastAsync(user, [operation], 'active', password)
      return {
        success: Boolean(result?.success),
        txId: result?.result?.id || '',
        error: result?.success ? '' : 'SmartLock did not broadcast the action.'
      }
    },
    promptPassword (user, title) {
      return new Promise((resolve, reject) => {
        this.$q.dialog({
          title,
          message: 'Enter the SmartLock password for @' + user + '. The password is only used to decrypt the key for this action.',
          prompt: { model: '', type: 'password' },
          cancel: true,
          persistent: true
        }).onOk(resolve).onCancel(() => reject(new Error('Cancelled by user.')))
      })
    },
    refreshAfterAction (action) {
      const op = action[2]
      if (['claim_reward_balance', 'account_update', 'account_update2', 'withdraw_vesting'].includes(op[0])) {
        this.$hiveStore.getAccount(op[1].account, { force: true })
      }
      if (['transfer', 'transfer_to_savings', 'transfer_from_savings', 'transfer_to_vesting', 'cancel_transfer_from_savings'].includes(op[0])) {
        this.$hiveStore.getAccount(op[1].from, { force: true })
      }
      if (['convert', 'collateralized_convert', 'limit_order_cancel', 'limit_order_create'].includes(op[0])) {
        this.$hiveStore.getAccount(op[1].owner, { force: true })
      }
      if (['account_witness_vote', 'account_witness_proxy', 'witness_update'].includes(op[0])) {
        const witnessAccount = op[1].account || op[1].owner
        if (witnessAccount) this.$hiveStore.getAccount(witnessAccount, { force: true })
      }
      if (op[0] === 'custom_json' && op[1]?.id === 'notify') {
        this.$hiveStore.markNotificationsReadLocally()
      }
    },
    sendAll () {
      if (!this.canSendAll) return
      this.$hiveStore.resetFailedQueueStatuses()
      this.bulkSending = true
      this.timerEnabled = true
      this.clearBroadcastTimer()
      this.broadcastNext()
    },
    clearCompleted () {
      const count = this.counts.sent
      this.$hiveStore.clearCompletedQueue()
      this.$q.notify({ message: 'Cleared ' + count + ' sent action' + (count === 1 ? '' : 's') + '.', color: 'primary', icon: 'done_all', timeout: 2000 })
    },
    confirmClearAll () {
      this.$q.dialog({
        title: 'Clear the action queue?',
        message: 'This removes every queued action, including failed and sent items. It does not cancel anything already broadcast.',
        cancel: true,
        persistent: true
      }).onOk(() => {
        this.$hiveStore.clearQueue()
        this.bulkSending = false
        this.clearBroadcastTimer()
        this.$q.notify({ message: 'Action queue cleared.', color: 'orange', icon: 'delete_sweep', timeout: 2000 })
      })
    },
    removeItem (index) {
      this.$hiveStore.removeQueueItemAt(index)
    }
  }
}
</script>

<style scoped>
.queue-panel {
  width: 470px;
  max-width: 94vw;
  background: var(--c-surface-1);
}

.queue-summary {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding: 0.55rem 0.9rem 0.2rem;
}

.queue-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-text-muted);
  font-size: 0.66rem;
  white-space: nowrap;
}

.queue-chip--pending {
  border-color: color-mix(in srgb, var(--c-link) 35%, transparent);
  color: var(--c-link-hover);
}

.queue-chip--failed {
  border-color: color-mix(in srgb, var(--c-negative) 40%, transparent);
  color: var(--c-negative);
}

.queue-chip--sent {
  border-color: color-mix(in srgb, var(--c-positive) 35%, transparent);
  color: var(--c-positive);
}

.queue-auto {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: auto;
  color: var(--c-positive);
  font-size: 0.66rem;
  white-space: nowrap;
}

.queue-auto--paused {
  color: var(--c-warning);
}

.queue-auto-note {
  padding: 0.35rem 0.9rem 0;
  color: var(--c-warning);
  font-size: 0.7rem;
  line-height: 1.4;
}

.queue-offline {
  padding: 0.45rem 0.9rem 0;
}

.queue-toolbar {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  padding: 0.45rem 0.9rem 0.6rem;
}

.queue-scroll {
  height: 52vh;
  max-height: 510px;
  min-height: 120px;
}

.queue-item {
  align-items: flex-start;
}

.queue-item__top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding-top: 0.15rem;
}

.queue-item__title {
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
}

.queue-item__summary {
  margin-top: 0.1rem;
  color: var(--c-text-muted);
  font-size: 0.74rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.queue-item__meta {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
  color: var(--c-text-faint);
  font-size: 0.66rem;
}

.queue-item__error {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  margin-top: 0.2rem;
  color: var(--c-warning);
  font-size: 0.7rem;
  line-height: 1.35;
}

.queue-item__actions {
  padding-top: 0.25rem;
}

.queue-details {
  margin: 0.1rem 0 0 -0.4rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.queue-footer {
  flex-wrap: wrap;
  gap: 0.2rem 0.7rem;
}

.queue-footer strong {
  color: var(--c-text-soft);
  font-weight: 600;
}
</style>
