<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @hide="onHide"
  >
    <q-card class="lightning-dialog">
      <q-card-section class="lightning-dialog__head">
        <div class="lightning-dialog__title-wrap">
          <q-avatar size="32px" class="lightning-dialog__icon">
            <img src="/statics/lightning.webp" alt="" aria-hidden="true" />
          </q-avatar>
          <div>
            <div class="lightning-eyebrow">Lightning</div>
            <h2 class="lightning-dialog__title">{{ dialogTitle }}</h2>
          </div>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close Lightning receive dialog" @click="$emit('update:modelValue', false)" />
      </q-card-section>

      <q-card-section class="lightning-dialog__body">
        <template v-if="!invoice">
          <p class="lightning-dialog__lede">
            Create a Lightning invoice for <strong>@{{ account }}</strong>.
            <template v-if="intent === 'zap'">
              A Lightning wallet pays sats; the author receives {{ receiveLabel }}.
            </template>
            <template v-else>
              A Lightning wallet pays sats; the bridge sends {{ receiveLabel }} to the Hive account.
            </template>
          </p>

          <div v-if="presets.length" class="lightning-dialog__presets" role="group" aria-label="Common zap amounts">
            <q-btn
              v-for="preset in presets"
              :key="preset"
              flat
              dense
              no-caps
              color="amber-9"
              :label="presetLabel(preset)"
              @click="setPreset(preset)"
            />
          </div>

          <div class="lightning-dialog__row">
            <q-select
              v-model="currency"
              :options="currencyOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              dense
              outlined
              label="Amount in"
              aria-label="Invoice amount currency"
              class="lightning-dialog__field"
              @update:model-value="onCurrencyChange"
            />
            <q-input
              v-model="amount"
              type="number"
              min="0"
              step="any"
              dense
              outlined
              label="Amount"
              aria-label="Invoice amount"
              class="lightning-dialog__field lightning-dialog__field--amount"
            >
              <template #append><span class="lightning-dialog__suffix">{{ currency.toUpperCase() }}</span></template>
            </q-input>
          </div>

          <div class="lightning-dialog__row">
            <q-select
              v-model="receiveCurrency"
              :options="receiveOptions"
              option-label="label"
              option-value="value"
              emit-value
              map-options
              dense
              outlined
              label="Receive as"
              aria-label="Currency received on Hive"
              class="lightning-dialog__field"
            />
            <div class="lightning-dialog__fee-note">
              <q-icon name="info_outline" size="15px" aria-hidden="true" />
              The sender pays sats. Small invoices lose a fixed {{ feeFixedLabel }} sat bridge fee.
            </div>
          </div>

          <q-input
            v-model="note"
            dense
            outlined
            maxlength="280"
            counter
            label="Message (public on Hive)"
            aria-label="Message included with the Hive transfer"
            hint="Keep it short and free of personal information."
          />

          <div v-if="error && !fallback" class="lightning-dialog__error" role="alert">
            <q-icon name="error_outline" size="16px" aria-hidden="true" />
            <span>{{ error }}</span>
          </div>

          <div v-if="fallback" class="lightning-dialog__fallback">
            <div class="lightning-dialog__fallback-head">
              <q-icon :name="failureIcon" size="16px" aria-hidden="true" />
              <strong>{{ failureTitle }}</strong>
            </div>
            <p>{{ failureMessage }}</p>
            <lightning-address-card :account="account" compact :show-qr="true" />
          </div>

          <div class="lightning-dialog__actions">
            <q-btn flat no-caps color="grey" label="Cancel" @click="$emit('update:modelValue', false)" />
            <q-btn
              unelevated
              no-caps
              color="amber-9"
              text-color="black"
              icon="bolt"
              label="Create invoice"
              :loading="busy"
              :disable="!canCreate"
              @click="create"
            />
          </div>
        </template>

        <template v-else>
          <lightning-invoice-card
            :invoice="invoice"
            :status="status"
            @expired="onExpired"
          />

          <div v-if="status === 'paid'" class="lightning-dialog__success" role="status" aria-live="polite">
            <q-icon name="celebration" size="22px" aria-hidden="true" />
            <div>
              <strong>Payment received.</strong>
              <p>The bridge will send {{ receiveLabel }} to @{{ account }} in a Hive transfer. It should appear in the wallet within a few blocks.</p>
            </div>
          </div>

          <div v-if="status === 'unknown'" class="lightning-dialog__error" role="alert">
            <q-icon name="cloud_off" size="16px" aria-hidden="true" />
            <span>{{ statusUnknownText }}</span>
            <q-btn flat dense no-caps color="amber-9" label="Retry" @click="startPolling" />
          </div>

          <div class="lightning-dialog__actions">
            <q-btn
              flat
              no-caps
              color="grey"
              icon="refresh"
              label="New invoice"
              :disable="busy"
              @click="resetInvoice"
            />
            <q-btn
              v-if="status === 'paid' || status === 'expired' || status === 'unknown'"
              unelevated
              no-caps
              color="amber-9"
              text-color="black"
              label="Done"
              @click="$emit('update:modelValue', false)"
            />
            <q-btn
              v-else
              flat
              no-caps
              color="amber-9"
              icon="open_in_new"
              label="Open v4v.app"
              type="a"
              :href="openUrl"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
        </template>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { pollWhileVisible } from 'src/services/polling'
import { normalizeFeePolicy } from 'src/services/lightning'
import {
  BRIDGE_STATES,
  bridgeFeePolicy,
  checkInvoice,
  createInvoice,
  getBridgeState,
  getBridgeStatus,
  isBridgeUnavailable
} from 'src/services/v4vapp'
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'
import LightningInvoiceCard from 'components/lightning/LightningInvoiceCard.vue'

export default {
  name: 'LightningReceiveDialog',
  components: { LightningAddressCard, LightningInvoiceCard },
  props: {
    modelValue: { type: Boolean, default: false },
    account: { type: String, required: true },
    defaultCurrency: { type: String, default: 'hbd' },
    defaultAmount: { type: [Number, String], default: null },
    defaultReceiveCurrency: { type: String, default: '' },
    defaultNote: { type: String, default: 'Tip from hive.ausbit.dev' },
    intent: { type: String, default: 'receive' },
    presets: { type: Array, default: () => [] }
  },
  emits: ['update:modelValue', 'paid'],
  data () {
    return {
      currency: this.defaultCurrency,
      amount: this.defaultAmount !== null && this.defaultAmount !== undefined
        ? this.defaultAmount
        : (this.defaultCurrency === 'sats' ? 1000 : 1),
      receiveCurrency: this.defaultReceiveCurrency || this.defaultReceiveFor(this.defaultCurrency),
      note: this.defaultNote,
      busy: false,
      error: '',
      fallback: false,
      failureState: '',
      feePolicy: normalizeFeePolicy({}),
      invoice: null,
      status: 'open',
      poller: null,
      pollFailures: 0
    }
  },
  computed: {
    currencyOptions () {
      return [
        { label: 'HBD', value: 'hbd' },
        { label: 'HIVE', value: 'hive' },
        { label: 'USD', value: 'usd' },
        { label: 'Sats', value: 'sats' }
      ]
    },
    receiveOptions () {
      return [
        { label: 'HBD', value: 'hbd' },
        { label: 'HIVE', value: 'hive' },
        { label: 'Keepsats (v4v.app)', value: 'sats' }
      ]
    },
    receiveLabel () {
      if (this.receiveCurrency === 'hbd') return 'HBD'
      if (this.receiveCurrency === 'hive') return 'HIVE'
      return 'Keepsats'
    },
    canCreate () {
      return Boolean(this.account) && Number(this.amount) > 0 && !this.busy
    },
    openUrl () {
      return 'https://v4v.app'
    },
    dialogTitle () {
      return this.intent === 'zap' ? 'Zap @' + this.account : 'Receive sats as ' + this.receiveLabel
    },
    feeFixedLabel () {
      return Number(this.feePolicy.fixed || 0).toLocaleString('en-US')
    },
    failureTitle () {
      if (this.failureState === BRIDGE_STATES.OFFLINE) return 'You are offline'
      if (this.failureState === BRIDGE_STATES.TIMEOUT) return 'The bridge did not respond'
      if (this.failureState === BRIDGE_STATES.DEGRADED) return 'The bridge is busy'
      if (this.failureState === BRIDGE_STATES.BLOCKED) return 'This browser could not reach the bridge'
      return 'Live invoice unavailable'
    },
    failureMessage () {
      if (this.failureState === BRIDGE_STATES.OFFLINE) {
        return 'Reconnect to create a live invoice. The Lightning address below still works and can be paid as soon as the sender is online.'
      }
      if (this.failureState === BRIDGE_STATES.TIMEOUT || this.failureState === BRIDGE_STATES.DEGRADED) {
        return 'The bridge is slow or rate-limiting right now. Try again in a moment, or use the address below and let the sender enter the amount.'
      }
      if (this.failureState === BRIDGE_STATES.BLOCKED) {
        return 'The bridge API was blocked before it answered — usually an extension, VPN or intermediary. The Lightning address below still works: ask the sender to enter the amount in their wallet, or open v4v.app.'
      }
      return 'The bridge could not create an invoice. The Lightning address below still works, or try again.'
    },
    failureIcon () {
      if (this.failureState === BRIDGE_STATES.OFFLINE) return 'wifi_off'
      if (this.failureState === BRIDGE_STATES.BLOCKED) return 'shield'
      return 'cloud_off'
    },
    statusUnknownText () {
      if (this.failureState === BRIDGE_STATES.OFFLINE) {
        return 'You are offline, so the payment status could not be checked. The invoice may still be paid; reconnect and retry, or watch the Hive wallet for a transfer from @v4vapp.'
      }
      if (this.failureState === BRIDGE_STATES.BLOCKED) {
        return 'This browser could not read the payment status — usually an extension, VPN or intermediary. The invoice may still be paid; watch the Hive wallet for a transfer from @v4vapp.'
      }
      return 'Live status checks are unavailable right now. The invoice may still be paid; watch the Hive wallet for a transfer from @v4vapp.'
    }
  },
  watch: {
    modelValue (open) {
      if (open) {
        this.resetForm()
        this.loadFeePolicy()
      } else {
        this.stopPolling()
        this.resetInvoice()
      }
    },
    account () {
      this.resetForm()
    }
  },
  beforeUnmount () {
    this.stopPolling()
  },
  methods: {
    defaultReceiveFor (currency) {
      if (currency === 'hbd' || currency === 'usd') return 'hbd'
      if (currency === 'hive') return 'hive'
      return 'sats'
    },
    async loadFeePolicy () {
      try {
        const status = await getBridgeStatus()
        if (status) this.feePolicy = bridgeFeePolicy(status)
      } catch {
        // Keep the last known/default policy; the create call reports reality.
      }
    },
    onCurrencyChange (value) {
      this.receiveCurrency = this.defaultReceiveFor(value)
      this.fallback = false
      this.failureState = ''
      this.error = ''
    },
    presetLabel (value) {
      const number = Number(value) || 0
      return number >= 1000 ? (number / 1000) + 'k' : String(number)
    },
    setPreset (value) {
      this.currency = 'sats'
      this.amount = value
      if (!this.receiveCurrency) this.receiveCurrency = 'hbd'
      this.error = ''
      this.fallback = false
    },
    resetForm () {
      if (this.invoice) return
      this.currency = this.defaultCurrency
      this.amount = this.defaultAmount !== null && this.defaultAmount !== undefined
        ? this.defaultAmount
        : (this.defaultCurrency === 'sats' ? 1000 : 1)
      this.receiveCurrency = this.defaultReceiveCurrency || this.defaultReceiveFor(this.defaultCurrency)
      this.note = this.defaultNote
      this.error = ''
      this.fallback = false
      this.failureState = ''
      this.busy = false
    },
    resetInvoice () {
      this.stopPolling()
      this.invoice = null
      this.status = 'open'
      this.error = ''
      this.fallback = false
      this.failureState = ''
      this.busy = false
    },
    async create () {
      if (!this.canCreate) return
      this.busy = true
      this.error = ''
      this.fallback = false
      this.failureState = ''
      try {
        const invoice = await createInvoice({
          account: this.account,
          amount: Number(this.amount),
          currency: this.currency,
          receiveCurrency: this.receiveCurrency,
          message: this.note,
          expiry: 600,
          includeQr: true
        })
        this.invoice = invoice
        this.status = 'open'
        this.pollFailures = 0
        this.startPolling()
      } catch (error) {
        this.failureState = getBridgeState().state
        this.fallback = isBridgeUnavailable(error)
        this.error = this.fallback ? '' : (error?.message || 'Could not create a Lightning invoice.')
      } finally {
        this.busy = false
      }
    },
    startPolling () {
      this.stopPolling()
      this.pollFailures = 0
      this.poller = pollWhileVisible(() => this.check(), 2500)
      this.poller.start()
    },
    stopPolling () {
      if (this.poller) this.poller.stop()
      this.poller = null
    },
    async check () {
      if (!this.invoice || this.status === 'paid' || this.status === 'expired') {
        this.stopPolling()
        return
      }
      try {
        const result = await checkInvoice(this.invoice.rHash)
        this.pollFailures = 0
        this.status = result.status
        if (result.status === 'paid') {
          this.stopPolling()
          this.$emit('paid', { invoice: this.invoice, status: result })
        } else if (result.status === 'expired') {
          this.stopPolling()
        }
      } catch (error) {
        this.pollFailures += 1
        this.failureState = getBridgeState().state
        // One dropped poll should not hide a payable invoice. Stop after a few
        // failures and let the user retry, or keep watching the Hive wallet.
        if (this.pollFailures < 3) return
        this.status = 'unknown'
        this.stopPolling()
        this.error = error?.message || ''
      }
    },
    onExpired () {
      if (this.status === 'open') {
        this.status = 'expired'
        this.stopPolling()
      }
    },
    onHide () {
      this.stopPolling()
    }
  }
}
</script>

<style scoped>
.lightning-dialog {
  width: 620px;
  max-width: 94vw;
  background: var(--c-surface-1);
}

.lightning-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.lightning-dialog__title-wrap {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.lightning-dialog__icon {
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
}

.lightning-eyebrow {
  color: var(--c-warning);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lightning-dialog__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
}

.lightning-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.9rem 1rem 1rem;
}

.lightning-dialog__lede {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}

.lightning-dialog__presets {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  padding: 0.15rem 0;
}

.lightning-dialog__row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lightning-dialog__field {
  flex: 1 1 180px;
  min-width: 150px;
}

.lightning-dialog__field--amount {
  flex: 0 1 180px;
}

.lightning-dialog__suffix {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.lightning-dialog__fee-note {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1 1 220px;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.35;
}

.lightning-dialog__error {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--c-warning) 6%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.72rem;
  line-height: 1.4;
}

.lightning-dialog__fallback {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.lightning-dialog__fallback-head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-warning-soft);
  font-size: 0.74rem;
}

.lightning-dialog__fallback p {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  line-height: 1.4;
}

.lightning-dialog__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding-top: 0.2rem;
}

.lightning-dialog__success {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-positive) 40%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--c-positive) 7%, transparent);
  color: var(--c-positive-soft);
  font-size: 0.74rem;
}

.lightning-dialog__success p {
  margin: 0.2rem 0 0;
  color: var(--c-positive);
  font-size: 0.7rem;
  line-height: 1.4;
}
</style>
