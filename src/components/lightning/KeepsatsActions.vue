<template>
  <details class="keepsats-actions">
    <summary>Keepsats actions (on-chain)</summary>

    <p class="keepsats-actions__note">
      These queue normal Hive operations for review. Nothing is broadcast until you
      sign it in the queue, and nothing auto-sends. Conversion and payment actions
      use the active key; a deposit is an ordinary Hive/HBD transfer.
    </p>

    <q-btn-toggle
      v-model="action"
      no-caps
      dense
      unelevated
      toggle-color="orange-9"
      toggle-text-color="black"
      text-color="blue-grey-4"
      :options="actionOptions"
      aria-label="Choose a keepsats action"
    />

    <template v-if="action === 'deposit'">
      <div class="keepsats-actions__row">
        <q-btn-toggle
          v-model="depositAsset"
          no-caps
          dense
          unelevated
          toggle-color="orange-9"
          toggle-text-color="black"
          text-color="blue-grey-4"
          :options="assetOptions"
          aria-label="Deposit asset"
        />
        <q-input
          v-model.number="depositAmount"
          type="number"
          min="0"
          step="0.001"
          dense
          outlined
          label="Amount"
          aria-label="Keepsats deposit amount"
          class="keepsats-actions__amount"
        >
          <template #append><span class="keepsats-actions__suffix">{{ depositAsset }}</span></template>
        </q-input>
      </div>
      <p class="keepsats-actions__hint">
        ≈ {{ depositSatsLabel }} at the current bridge rate, before the deposit fee.
        v4vapp credits the sats after its fee; the exact amount is shown on chain.
      </p>
      <q-btn
        unelevated
        no-caps
        color="orange-9"
        text-color="black"
        icon="playlist_add"
        label="Queue deposit"
        :disable="!canDeposit"
        @click="queueDeposit"
      />
    </template>

    <template v-else-if="action === 'convert'">
      <div class="keepsats-actions__row">
        <q-input
          v-model.number="convertSats"
          type="number"
          min="1"
          step="1"
          dense
          outlined
          label="Sats to convert"
          aria-label="Sats to convert"
          class="keepsats-actions__amount"
          :hint="balanceHint"
        />
        <q-btn-toggle
          v-model="convertAsset"
          no-caps
          dense
          unelevated
          toggle-color="orange-9"
          toggle-text-color="black"
          text-color="blue-grey-4"
          :options="assetOptions"
          aria-label="Convert to asset"
        />
      </div>
      <p class="keepsats-actions__hint">
        ≈ {{ convertQuoteLabel }} at the current rate, before v4vapp's conversion fee.
      </p>
      <p v-if="convertOverBalance" class="keepsats-actions__warn">
        That is more than the balance shown above. The bridge will reject it.
      </p>
      <q-btn
        unelevated
        no-caps
        color="orange-9"
        text-color="black"
        icon="playlist_add"
        label="Queue conversion"
        :disable="!canConvert"
        @click="queueConvert"
      />
    </template>

    <template v-else-if="action === 'send'">
      <div class="keepsats-actions__row">
        <q-input
          v-model="sendAccount"
          dense
          outlined
          label="Hive account"
          aria-label="Hive account to send keepsats to"
          placeholder="name"
          class="keepsats-actions__amount"
        />
        <q-input
          v-model.number="sendSats"
          type="number"
          min="1"
          step="1"
          dense
          outlined
          label="Sats"
          aria-label="Sats to send to another account"
          class="keepsats-actions__amount"
        />
      </div>
      <q-input
        v-model="sendMemo"
        dense
        outlined
        maxlength="80"
        label="Memo (public on Hive)"
        aria-label="Keepsats transfer memo"
        hint="Optional. Do not put personal information here."
      />
      <p class="keepsats-actions__hint">
        Moves sats inside v4v.app's ledger. The recipient must already have a
        keepsats balance. This is not a Hive transfer.
      </p>
      <q-btn
        unelevated
        no-caps
        color="orange-9"
        text-color="black"
        icon="playlist_add"
        label="Queue keepsats transfer"
        :disable="!canSend"
        @click="queueSend"
      />
    </template>

    <template v-else>
      <q-input
        v-model="payTarget"
        type="textarea"
        outlined
        autogrow
        label="Lightning invoice or address"
        aria-label="Lightning invoice or address to pay from keepsats"
        placeholder="lnbc… or name@wallet.example"
        :error="Boolean(payError)"
        :error-message="payError"
        @update:model-value="onPayTarget"
      />
      <div v-if="payNeedsAmount" class="keepsats-actions__row">
        <q-input
          v-model.number="paySats"
          type="number"
          min="1"
          step="1"
          dense
          outlined
          label="Sats to send"
          aria-label="Sats to send from keepsats"
          class="keepsats-actions__amount"
        />
      </div>
      <p v-if="payDecoded" class="keepsats-actions__hint">
        <template v-if="payDecoded.amountSats">Invoice for {{ formatSats(payDecoded.amountSats) }}.</template>
        <template v-else>Amount will be {{ formatSats(paySats || 0) }}.</template>
        <template v-if="payDecoded.description"> {{ payDecoded.description }}</template>
      </p>
      <p class="keepsats-actions__hint">
        No keepsats conversion fee for a Lightning payment; only the Lightning
        routing fee applies. The invoice or address is public on chain.
      </p>
      <q-btn
        unelevated
        no-caps
        color="orange-9"
        text-color="black"
        icon="playlist_add"
        label="Queue keepsats payment"
        :disable="!canPay"
        @click="queuePay"
      />
    </template>

    <p class="keepsats-actions__custody">
      Keepsats are held by v4v.app. A failed payment is refunded by the bridge,
      not by hive.ausbit.dev. Only queue what you are prepared to spend.
    </p>
  </details>
</template>

<script>
import { decodeBolt11 } from 'src/services/bolt11'
import {
  formatSats,
  isValidHiveAccount,
  parseLightningTarget,
  satsRatesFromPrices
} from 'src/services/lightning'
import {
  KEEPSATS_SERVER_ACCOUNT,
  buildKeepsatsConvert,
  buildKeepsatsDeposit,
  buildKeepsatsTransfer
} from 'src/services/keepsats'
import { getBridgeQuote, getSatsToHive } from 'src/services/v4vapp'

const CONSENT_KEY = 'v4vapp:keepsatsConsent'

export default {
  name: 'KeepsatsActions',
  props: {
    account: { type: String, required: true },
    balanceSats: { type: Number, default: 0 }
  },
  emits: ['queued'],
  data () {
    return {
      action: 'deposit',
      actionOptions: [
        { label: 'Deposit', value: 'deposit' },
        { label: 'Convert', value: 'convert' },
        { label: 'Send', value: 'send' },
        { label: 'Pay', value: 'pay' }
      ],
      assetOptions: [
        { label: 'HBD', value: 'HBD' },
        { label: 'HIVE', value: 'HIVE' }
      ],
      depositAsset: 'HBD',
      depositAmount: 1,
      convertAsset: 'HBD',
      convertSats: null,
      convertQuote: null,
      convertQuoteBusy: false,
      sendAccount: '',
      sendSats: null,
      sendMemo: '',
      payTarget: '',
      paySats: null,
      payDecoded: null,
      payError: '',
      rates: { satsPerHive: null, satsPerHbd: null },
      quoteTimer: null
    }
  },
  computed: {
    depositSats () {
      const amount = Number(this.depositAmount)
      const rate = this.depositAsset === 'HBD' ? this.rates.satsPerHbd : this.rates.satsPerHive
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return 0
      return Math.round(amount * rate)
    },
    depositSatsLabel () {
      return this.depositSats ? formatSats(this.depositSats) : '—'
    },
    canDeposit () {
      return Boolean(this.account) && Number(this.depositAmount) > 0
    },
    balanceHint () {
      return this.balanceSats > 0
        ? 'Available: ' + formatSats(this.balanceSats)
        : 'Connect above to see the available balance'
    },
    convertOverBalance () {
      return this.balanceSats > 0 && Number(this.convertSats) > this.balanceSats
    },
    canConvert () {
      return Boolean(this.account) && Number(this.convertSats) > 0 && !this.convertQuoteBusy
    },
    convertQuoteLabel () {
      if (!this.convertQuote) return '—'
      const value = this.convertAsset === 'HBD' ? this.convertQuote.HBD : this.convertQuote.HIVE
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      return number.toFixed(3) + ' ' + this.convertAsset
    },
    payTargetParsed () {
      return parseLightningTarget(this.payTarget)
    },
    payNeedsAmount () {
      return this.payTargetParsed.type === 'address' ||
        (this.payTargetParsed.type === 'invoice' && this.payDecoded?.hasAmount === false)
    },
    canSend () {
      const target = String(this.sendAccount || '').trim().replace(/^@/, '').toLowerCase()
      return isValidHiveAccount(target) && target !== 'v4vapp' && Number(this.sendSats) > 0
    },
    canPay () {
      if (!this.account || this.payError) return false
      if (this.payTargetParsed.type === 'invoice') {
        return Boolean(this.payDecoded?.valid) && !this.payDecoded?.expired
      }
      if (this.payTargetParsed.type === 'address') {
        return Number(this.paySats) > 0
      }
      return false
    }
  },
  watch: {
    action (value) {
      if (value === 'convert') this.scheduleConvertQuote()
    },
    convertSats () {
      if (this.action === 'convert') this.scheduleConvertQuote()
    },
    convertAsset () {
      if (this.action === 'convert') this.scheduleConvertQuote()
    },
    account () {
      this.payTarget = ''
      this.paySats = null
      this.payDecoded = null
      this.payError = ''
    }
  },
  mounted () {
    this.loadRates()
  },
  beforeUnmount () {
    if (this.quoteTimer) clearTimeout(this.quoteTimer)
  },
  methods: {
    formatSats,
    async loadRates () {
      try {
        const quote = await getBridgeQuote()
        const satsHive = Number(quote?.v4vapp?.sats_Hive)
        const satsHbd = Number(quote?.v4vapp?.sats_HBD)
        if (Number.isFinite(satsHive) && Number.isFinite(satsHbd)) {
          this.rates = { satsPerHive: satsHive, satsPerHbd: satsHbd }
        } else {
          this.rates = satsRatesFromPrices(quote)
        }
      } catch {
        // Rates stay unknown; the bridge applies the live rate when it settles.
      }
    },
    scheduleConvertQuote () {
      if (this.quoteTimer) clearTimeout(this.quoteTimer)
      this.quoteTimer = setTimeout(() => this.loadConvertQuote(), 300)
    },
    async loadConvertQuote () {
      const sats = Math.round(Number(this.convertSats) || 0)
      if (!sats) {
        this.convertQuote = null
        return
      }
      this.convertQuoteBusy = true
      try {
        this.convertQuote = await getSatsToHive(sats)
      } catch {
        this.convertQuote = null
      } finally {
        this.convertQuoteBusy = false
      }
    },
    onPayTarget () {
      this.payError = ''
      this.payDecoded = null
      const parsed = this.payTargetParsed
      if (parsed.type === 'empty') return
      if (parsed.type === 'invoice') {
        const decoded = decodeBolt11(parsed.value)
        if (!decoded.valid) {
          this.payError = decoded.error
          return
        }
        if (decoded.expired) {
          this.payError = 'This invoice has already expired.'
          return
        }
        this.payDecoded = decoded
        return
      }
      if (parsed.type === 'address') {
        this.payDecoded = { valid: true, amountSats: null, hasAmount: false, description: 'Payment to ' + parsed.value }
        return
      }
      if (parsed.type === 'lnurl') {
        this.payError = 'Paste the Lightning address (name@domain) instead of an LNURL.'
        return
      }
      this.payError = 'Paste a mainnet BOLT11 invoice or a Lightning address.'
    },
    async ensureConsent () {
      try {
        if (localStorage.getItem(CONSENT_KEY) === 'yes') return true
      } catch {
        // Fall through to the dialog.
      }
      return new Promise((resolve) => {
        this.$q.dialog({
          title: 'Keepsats are custodial',
          message: 'This action moves sats held by v4v.app, not by hive.ausbit.dev. '
            + 'You still review and sign every action in the queue, and nothing auto-sends. '
            + 'If the bridge fails, it handles the refund.',
          ok: { label: 'I understand', color: 'orange-9', textColor: 'black' },
          cancel: true,
          persistent: true
        }).onOk(() => {
          try {
            localStorage.setItem(CONSENT_KEY, 'yes')
          } catch {
            // Consent is still given for this action.
          }
          resolve(true)
        }).onCancel(() => resolve(false))
      })
    },
    notifyQueued (message) {
      this.$q.notify({
        message,
        color: 'orange-9',
        textColor: 'black',
        icon: 'playlist_add',
        timeout: 5000,
        position: 'top'
      })
    },
    async queueDeposit () {
      if (!this.canDeposit) return
      if (!(await this.ensureConsent())) return
      try {
        const operation = buildKeepsatsDeposit({
          from: this.account,
          amount: Number(this.depositAmount),
          asset: this.depositAsset
        })
        this.$hiveStore.addToQueue([this.account, 'active', operation], { manualOnly: true })
        this.notifyQueued('Keepsats deposit queued for review. It will not auto-send.')
        this.$emit('queued')
      } catch (error) {
        this.$q.notify({ message: error.message, color: 'negative', timeout: 4000, position: 'top' })
      }
    },
    async queueConvert () {
      if (!this.canConvert) return
      if (!(await this.ensureConsent())) return
      try {
        const operation = buildKeepsatsConvert({
          from: this.account,
          sats: Number(this.convertSats),
          asset: this.convertAsset
        })
        this.$hiveStore.addToQueue([this.account, 'active', operation], { manualOnly: true })
        this.notifyQueued('Keepsats conversion queued for review. It will not auto-send.')
        this.$emit('queued')
      } catch (error) {
        this.$q.notify({ message: error.message, color: 'negative', timeout: 4000, position: 'top' })
      }
    },
    async queueSend () {
      if (!this.canSend) return
      if (!(await this.ensureConsent())) return
      const target = String(this.sendAccount || '').trim().replace(/^@/, '').toLowerCase()
      try {
        const operation = buildKeepsatsTransfer({
          from: this.account,
          to: target,
          sats: Number(this.sendSats),
          memo: this.sendMemo
        })
        this.$hiveStore.addToQueue([this.account, 'active', operation], { manualOnly: true })
        this.notifyQueued('Keepsats transfer queued for review. It will not auto-send.')
        this.$emit('queued')
      } catch (error) {
        this.$q.notify({ message: error.message, color: 'negative', timeout: 4000, position: 'top' })
      }
    },
    async queuePay () {
      if (!this.canPay) return
      if (!(await this.ensureConsent())) return
      const parsed = this.payTargetParsed
      const sats = this.payNeedsAmount ? Number(this.paySats) : null
      try {
        const operation = buildKeepsatsTransfer({
          from: this.account,
          to: KEEPSATS_SERVER_ACCOUNT,
          sats: Number.isFinite(sats) && sats > 0 ? sats : null,
          memo: parsed.value
        })
        this.$hiveStore.addToQueue([this.account, 'active', operation], { manualOnly: true })
        this.notifyQueued('Keepsats payment queued for review. It will not auto-send.')
        this.$emit('queued')
      } catch (error) {
        this.$q.notify({ message: error.message, color: 'negative', timeout: 4000, position: 'top' })
      }
    }
  }
}
</script>

<style scoped>
.keepsats-actions {
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.keepsats-actions summary {
  cursor: pointer;
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  font-weight: 600;
}

.keepsats-actions__note,
.keepsats-actions__hint,
.keepsats-actions__custody,
.keepsats-actions__warn {
  margin: 0.5rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  line-height: 1.45;
}

.keepsats-actions__warn {
  color: var(--c-warning-soft);
}

.keepsats-actions__custody {
  margin-top: 0.6rem;
  color: var(--c-text-faint);
}

.keepsats-actions__row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
}

.keepsats-actions__amount {
  flex: 0 1 190px;
  min-width: 150px;
}

.keepsats-actions__suffix {
  color: var(--c-text-faint);
  font-size: 0.66rem;
}

.keepsats-actions :deep(.q-btn) {
  margin-top: 0.55rem;
}
</style>
