<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @hide="onHide"
  >
    <q-card class="lightning-pay">
      <q-card-section class="lightning-pay__head">
        <div class="lightning-pay__title-wrap">
          <q-avatar size="32px" class="lightning-pay__icon">
            <img src="/statics/lightning.png" alt="" aria-hidden="true" />
          </q-avatar>
          <div>
            <div class="lightning-eyebrow">Lightning</div>
            <h2 class="lightning-pay__title">Pay a Lightning invoice with Hive</h2>
          </div>
        </div>
        <q-btn flat dense round icon="close" aria-label="Close Lightning payment dialog" @click="$emit('update:modelValue', false)" />
      </q-card-section>

      <q-card-section class="lightning-pay__body">
        <template v-if="step === 'input'">
          <p class="lightning-pay__lede">
            Paste a mainnet BOLT11 invoice or a Lightning address (name@domain). The payment is
            sent as HIVE or HBD to <strong>@v4vapp</strong>, which pays the invoice.
          </p>

          <q-input
            v-model="input"
            type="textarea"
            outlined
            autogrow
            label="Lightning invoice or address"
            aria-label="Lightning invoice or address"
            placeholder="lnbc… or name@wallet.example"
            :error="Boolean(decodeError)"
            :error-message="decodeError"
            @update:model-value="onInput"
          >
            <template #append>
              <q-btn flat dense round icon="content_paste" aria-label="Paste from clipboard" title="Paste" @click="paste" />
            </template>
          </q-input>

          <div class="lightning-pay__hint">
            <q-icon name="info_outline" size="15px" aria-hidden="true" />
            Only mainnet invoices (lnbc…) are accepted. Testnet and regtest invoices are rejected.
          </div>

          <div class="lightning-pay__actions">
            <q-btn flat no-caps color="grey" label="Cancel" @click="$emit('update:modelValue', false)" />
            <q-btn
              unelevated
              no-caps
              color="amber-9"
              text-color="black"
              icon="search"
              label="Review payment"
              :disable="!canReview"
              @click="review"
            />
          </div>
        </template>

        <template v-else-if="step === 'review'">
          <button class="lightning-pay__back" type="button" @click="backToInput">
            <q-icon name="arrow_back" size="15px" aria-hidden="true" />
            Change invoice
          </button>

          <div class="lightning-pay__invoice">
            <div class="lightning-pay__invoice-top">
              <div>
                <div class="lightning-pay__invoice-label">{{ isAddress ? 'Lightning address' : 'Lightning invoice' }}</div>
                <div class="lightning-pay__invoice-value">{{ displayTarget }}</div>
              </div>
              <q-badge :color="expired ? 'orange-9' : 'amber-9'" text-color="black">
                {{ expired ? 'Expired' : (quoteSource === 'bridge' ? 'Live quote' : 'Estimated') }}
              </q-badge>
            </div>

            <div v-if="isAmountless" class="lightning-pay__sats-input">
              <q-input
                v-model="manualSats"
                type="number"
                min="1"
                step="1"
                dense
                outlined
                label="Amount to send (sats)"
                aria-label="Amount to send in sats"
                @update:model-value="onManualSats"
              />
              <div class="lightning-pay__presets" role="group" aria-label="Common sats amounts">
                <q-btn v-for="preset in presets" :key="preset" flat dense no-caps :label="preset.toLocaleString()" @click="setSats(preset)" />
              </div>
            </div>

            <div class="lightning-pay__summary-row">
              <span>Invoice amount</span>
              <strong>{{ formatSats(amountSats) }}</strong>
            </div>
            <div class="lightning-pay__summary-row">
              <span>Bridge fee <small>({{ feePercentLabel }} + {{ formatSats(quote?.fixed || 0) }})</small></span>
              <strong>{{ formatSats(quote?.feeSats || 0) }}</strong>
            </div>
            <div class="lightning-pay__summary-row lightning-pay__summary-row--total">
              <span>Total sats leaving</span>
              <strong>{{ formatSats(quote?.totalSats || 0) }}</strong>
            </div>

            <div v-if="decoded?.description" class="lightning-pay__description">
              <span>Description</span>
              <p>{{ decoded.description }}</p>
            </div>
            <div v-if="decoded?.expiresAt" class="lightning-pay__description">
              <span>Invoice expiry</span>
              <p>{{ expiryLabel }}</p>
            </div>
          </div>

          <div v-if="quoteError" class="lightning-pay__error" role="alert">
            <q-icon name="error_outline" size="16px" aria-hidden="true" />
            <span>{{ quoteError }}</span>
          </div>

          <div v-if="bridgeBlocked" class="lightning-pay__hint lightning-pay__hint--warn">
            <q-icon name="cloud_off" size="15px" aria-hidden="true" />
            Live bridge quotes are unavailable from this browser. The HBD/HIVE cost is estimated
            from market prices; the bridge still processes the transfer on chain.
          </div>

          <div class="lightning-pay__asset">
            <div class="lightning-pay__asset-label">Pay with</div>
            <q-btn-toggle
              v-model="asset"
              no-caps
              dense
              unelevated
              toggle-color="amber-9"
              text-color="blue-grey-4"
              :options="assetOptions"
              :aria-label="'Choose the asset to spend'"
            />
            <div class="lightning-pay__balance">
              Available: <strong>{{ formatAsset(balance) }}</strong>
              <template v-if="cost !== null"> · cost <strong>{{ formatAsset(cost) }}</strong></template>
            </div>
          </div>

          <div v-if="insufficient" class="lightning-pay__error" role="alert">
            <q-icon name="account_balance_wallet" size="16px" aria-hidden="true" />
            <span>Not enough {{ asset }} in the wallet for this payment.</span>
          </div>

          <div class="lightning-pay__warning">
            <q-icon name="warning_amber" size="16px" aria-hidden="true" />
            <span>
              This sends {{ asset }} to @v4vapp. If the Lightning payment fails, the bridge refunds
              the deposit to this account, minus its fee. Anyone can see the amount and memo on chain.
            </span>
          </div>

          <div class="lightning-pay__actions">
            <q-btn flat no-caps color="grey" label="Cancel" @click="$emit('update:modelValue', false)" />
            <q-btn
              unelevated
              no-caps
              color="amber-9"
              text-color="black"
              icon="playlist_add"
              label="Queue payment"
              :disable="!canQueue"
              @click="queue"
            />
          </div>
        </template>

        <template v-else>
          <div class="lightning-pay__queued" role="status" aria-live="polite">
            <q-icon name="check_circle" size="26px" aria-hidden="true" />
            <div>
              <strong>Payment queued for review.</strong>
              <p>
                It is marked <strong>Review</strong> in the signing queue and will not auto-send.
                Open the queue in the header, check the invoice and send it with your active key.
              </p>
            </div>
          </div>

          <div class="lightning-pay__queued-details">
            <span>{{ formatSats(quote?.totalSats || 0) }} · {{ formatAsset(cost) }} to @v4vapp</span>
            <span v-if="isAddress">{{ displayTarget }} · {{ formatSats(amountSats) }}</span>
            <span v-else>Invoice {{ shortHash }}</span>
          </div>

          <div class="lightning-pay__actions">
            <q-btn unelevated no-caps color="amber-9" text-color="black" label="Done" @click="$emit('update:modelValue', false)" />
          </div>
        </template>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { getHivePrices } from 'src/services/prices'
import { decodeBolt11 } from 'src/services/bolt11'
import {
  ceilAmount,
  formatSats,
  lightningMemo,
  normalizeFeePolicy,
  parseLightningTarget,
  quoteSatsPayment,
  satsRatesFromPrices
} from 'src/services/lightning'
import {
  bridgeFeePolicy,
  getBridgeState,
  getBridgeStatus,
  getSatsToHive
} from 'src/services/v4vapp'

export default {
  name: 'LightningPayDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    account: { type: String, required: true },
    liquidHive: { type: Number, default: 0 },
    liquidHbd: { type: Number, default: 0 }
  },
  emits: ['update:modelValue', 'queued'],
  data () {
    return {
      input: '',
      target: null,
      decoded: null,
      decodeError: '',
      manualSats: '',
      step: 'input',
      busy: false,
      quote: null,
      quoteError: '',
      quoteSource: 'estimated',
      bridgeBlocked: false,
      asset: 'HBD',
      presets: [1000, 5000, 10000, 21000]
    }
  },
  computed: {
    isAddress () {
      return this.target?.type === 'address'
    },
    isAmountless () {
      return this.isAddress || (Boolean(this.decoded?.valid) && this.decoded?.hasAmount === false)
    },
    amountSats () {
      if (this.isAmountless) {
        const value = Number(this.manualSats)
        return Number.isFinite(value) && value > 0 ? value : 0
      }
      return Number(this.decoded?.amountSats) || 0
    },
    expired () {
      return Boolean(this.decoded?.expired) || (this.decoded?.expiresAt && this.decoded.expiresAt <= Date.now())
    },
    canReview () {
      if (this.busy) return false
      const parsed = parseLightningTarget(this.input)
      if (parsed.type === 'invoice') return true
      return parsed.type === 'address'
    },
    canQueue () {
      return this.quote?.valid &&
        !this.quoteError &&
        !this.expired &&
        !this.insufficient &&
        this.cost !== null &&
        this.cost > 0
    },
    cost () {
      if (!this.quote) return null
      const value = this.asset === 'HBD' ? this.quote.hbd : this.quote.hive
      return ceilAmount(value, 3)
    },
    balance () {
      return this.asset === 'HBD' ? Number(this.liquidHbd) || 0 : Number(this.liquidHive) || 0
    },
    insufficient () {
      return this.cost !== null && this.cost > this.balance
    },
    assetOptions () {
      return [
        { label: 'HBD', value: 'HBD' },
        { label: 'HIVE', value: 'HIVE' }
      ]
    },
    feePercentLabel () {
      const percent = Number(this.quote?.percent)
      return Number.isFinite(percent) ? (Math.round(percent * 1000) / 10) + '%' : '2.9%'
    },
    displayTarget () {
      if (this.isAddress) return this.target?.value || ''
      const value = String(this.decoded?.raw || '')
      return value.length <= 58 ? value : value.slice(0, 34) + '…' + value.slice(-16)
    },
    expiryLabel () {
      if (!this.decoded?.expiresAt) return ''
      const date = new Date(this.decoded.expiresAt)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString()
    },
    shortHash () {
      const hash = String(this.decoded?.paymentHash || '')
      return hash ? hash.slice(0, 12) + '…' : ''
    }
  },
  watch: {
    modelValue (open) {
      if (open) this.reset()
    }
  },
  beforeUnmount () {
    if (this.quoteTimer) clearTimeout(this.quoteTimer)
  },
  methods: {
    formatSats,
    formatAsset (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return number.toLocaleString('en-US', { maximumFractionDigits: 3, minimumFractionDigits: 3 }) + ' ' + this.asset
    },
    reset () {
      this.input = ''
      this.target = null
      this.decoded = null
      this.decodeError = ''
      this.manualSats = ''
      this.step = 'input'
      this.busy = false
      this.quote = null
      this.quoteError = ''
      this.quoteSource = 'estimated'
      this.bridgeBlocked = false
      this.asset = 'HBD'
      if (this.quoteTimer) clearTimeout(this.quoteTimer)
    },
    onInput () {
      this.decodeError = ''
      this.decoded = null
      this.target = null
      this.quote = null
    },
    onManualSats () {
      this.quote = null
      this.quoteError = ''
      if (this.quoteTimer) clearTimeout(this.quoteTimer)
      this.quoteTimer = setTimeout(() => {
        if (this.target) this.loadQuote()
      }, 300)
    },
    setSats (value) {
      this.manualSats = value
      this.onManualSats()
    },
    async paste () {
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          this.input = text.trim()
          this.onInput()
          this.review()
        }
      } catch {
        this.$q.notify({ message: 'Clipboard access was blocked. Paste manually.', color: 'orange', timeout: 3000, position: 'top' })
      }
    },
    async review () {
      const parsed = parseLightningTarget(this.input)
      this.target = parsed
      this.decodeError = ''
      this.quote = null
      this.quoteError = ''

      if (parsed.type === 'invoice') {
        const decoded = decodeBolt11(parsed.value)
        if (!decoded.valid) {
          this.decodeError = decoded.error
          return
        }
        this.decoded = decoded
        if (decoded.expired) {
          this.decodeError = 'This invoice has already expired.'
          return
        }
        this.step = 'review'
        await this.loadQuote()
        return
      }

      if (parsed.type === 'address') {
        this.decoded = {
          valid: true,
          amountSats: null,
          description: 'Payment to ' + parsed.value,
          raw: parsed.value
        }
        this.step = 'review'
        this.$nextTick(() => this.loadQuote())
        return
      }

      if (parsed.type === 'lnurl') {
        this.decodeError = 'Paste the Lightning address (name@domain) instead of an LNURL.'
        return
      }

      this.decodeError = 'Paste a mainnet BOLT11 invoice or a Lightning address.'
    },
    backToInput () {
      this.step = 'input'
      this.quote = null
      this.quoteError = ''
      this.decoded = null
      this.target = null
    },
    async loadQuote () {
      const amount = this.amountSats
      if (!amount) {
        this.quote = null
        this.quoteError = ''
        return
      }
      this.busy = true
      this.quoteError = ''
      try {
        const [pricesResult, statusResult] = await Promise.allSettled([
          getHivePrices(),
          getBridgeStatus()
        ])
        const prices = pricesResult.status === 'fulfilled' ? pricesResult.value : {}
        const status = statusResult.status === 'fulfilled' ? statusResult.value : null
        const policy = status ? bridgeFeePolicy(status) : normalizeFeePolicy({})
        const rates = satsRatesFromPrices(prices)
        let quote = quoteSatsPayment({
          amountSats: amount,
          satsPerHive: rates.satsPerHive,
          satsPerHbd: rates.satsPerHbd,
          policy,
          source: 'estimated'
        })
        if (!quote.valid) {
          this.quote = quote
          this.quoteError = quote.error
          return
        }

        this.quoteSource = 'estimated'
        this.bridgeBlocked = !status || getBridgeState().state === 'blocked'
        if (!quote.hbd && !quote.hive) {
          this.quote = quote
          this.quoteError = 'Could not read a Hive/HBD price to estimate the cost.'
          return
        }

        if (status) {
          try {
            const fixed = await getSatsToHive(quote.totalSats)
            if (fixed && Number(fixed.HBD) > 0) {
              quote = { ...quote, hbd: Number(fixed.HBD), hive: Number(fixed.HIVE) || quote.hive, source: 'bridge' }
              this.quoteSource = 'bridge'
              this.bridgeBlocked = false
            }
          } catch {
            this.bridgeBlocked = true
            this.quoteSource = 'estimated'
          }
        }

        this.quote = quote
      } catch (error) {
        this.quote = null
        this.quoteError = error?.message || 'Could not estimate the Hive cost.'
      } finally {
        this.busy = false
      }
    },
    queue () {
      if (!this.canQueue) return
      let memo
      try {
        memo = lightningMemo(this.isAddress ? this.target.value : this.decoded.raw, {
          hbd: this.asset === 'HBD'
        })
      } catch (error) {
        this.quoteError = error.message
        return
      }
      this.$hiveStore.addToQueue([
        this.account,
        'active',
        ['transfer', {
          from: this.account,
          to: 'v4vapp',
          amount: this.cost.toFixed(3) + ' ' + this.asset,
          memo
        }]
      ], { manualOnly: true })

      this.step = 'queued'
      this.$emit('queued', {
        sats: this.quote.totalSats,
        cost: this.cost,
        asset: this.asset,
        memo
      })
      this.$q.notify({
        message: 'Lightning payment queued for review. It will not auto-send.',
        color: 'amber-9',
        textColor: 'black',
        icon: 'bolt',
        timeout: 5000,
        position: 'top'
      })
    },
    onHide () {
      this.busy = false
    }
  }
}
</script>

<style scoped>
.lightning-pay {
  width: 640px;
  max-width: 94vw;
  background: #1d1d1d;
}

.lightning-pay__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.lightning-pay__title-wrap {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.lightning-pay__icon {
  border: 1px solid rgba(255, 193, 7, 0.35);
  background: rgba(255, 193, 7, 0.08);
}

.lightning-eyebrow {
  color: #b0a06a;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lightning-pay__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
}

.lightning-pay__body {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.9rem 1rem 1rem;
}

.lightning-pay__lede {
  margin: 0;
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.45;
}

.lightning-pay__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.4;
}

.lightning-pay__hint--warn {
  padding: 0.45rem 0.55rem;
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 0.4rem;
  background: rgba(255, 152, 0, 0.05);
  color: #ffcc80;
}

.lightning-pay__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  flex-wrap: wrap;
  padding-top: 0.2rem;
}

.lightning-pay__back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: #90a4ae;
  font-size: 0.7rem;
  cursor: pointer;
}

.lightning-pay__back:hover {
  color: #ffe082;
}

.lightning-pay__invoice {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.55rem;
  background: rgba(0, 0, 0, 0.18);
}

.lightning-pay__invoice-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.lightning-pay__invoice-label {
  color: #b0a06a;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lightning-pay__invoice-value {
  color: #ffe082;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.lightning-pay__summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  color: #90a4ae;
  font-size: 0.74rem;
}

.lightning-pay__summary-row strong {
  color: #e4eaed;
  font-variant-numeric: tabular-nums;
}

.lightning-pay__summary-row small {
  color: #78909c;
  font-size: 0.64rem;
}

.lightning-pay__summary-row--total {
  padding-top: 0.3rem;
  border-top: 1px solid var(--border-subtle);
  color: #cfd8dc;
}

.lightning-pay__summary-row--total strong {
  color: #ffe082;
}

.lightning-pay__description {
  display: flex;
  gap: 0.5rem;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.35;
}

.lightning-pay__description > span {
  flex: none;
  min-width: 78px;
}

.lightning-pay__description p {
  margin: 0;
  color: #90a4ae;
  overflow-wrap: anywhere;
}

.lightning-pay__sats-input {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lightning-pay__presets {
  display: flex;
  gap: 0.15rem;
  flex-wrap: wrap;
}

.lightning-pay__asset {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.55rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
}

.lightning-pay__asset-label {
  color: #78909c;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.lightning-pay__balance {
  color: #78909c;
  font-size: 0.7rem;
}

.lightning-pay__balance strong {
  color: #b0bec5;
}

.lightning-pay__error {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid rgba(255, 152, 0, 0.35);
  border-radius: 0.45rem;
  background: rgba(255, 152, 0, 0.06);
  color: #ffcc80;
  font-size: 0.72rem;
  line-height: 1.4;
}

.lightning-pay__warning {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: #a1887f;
  font-size: 0.68rem;
  line-height: 1.4;
}

.lightning-pay__queued {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.7rem;
  border: 1px solid rgba(76, 175, 80, 0.4);
  border-radius: 0.5rem;
  background: rgba(76, 175, 80, 0.07);
  color: #c8e6c9;
  font-size: 0.76rem;
}

.lightning-pay__queued p {
  margin: 0.2rem 0 0;
  color: #a5d6a7;
  font-size: 0.7rem;
  line-height: 1.4;
}

.lightning-pay__queued-details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: #78909c;
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}
</style>
