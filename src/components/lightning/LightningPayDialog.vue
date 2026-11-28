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
            <img src="/statics/lightning.webp" alt="" aria-hidden="true" />
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
            Paste a mainnet BOLT11 invoice to pay it, or a Lightning address (name@domain) to send
            sats to that address. The payment is sent as HIVE or HBD to <strong>@v4vapp</strong>,
            which pays the invoice or address.
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
              <div class="lightning-pay__amount-head">
                <span class="lightning-pay__amount-label">Amount</span>
                <q-btn-toggle
                  v-model="amountUnit"
                  no-caps
                  dense
                  unelevated
                  toggle-color="amber-9"
                  toggle-text-color="black"
                  text-color="blue-grey-4"
                  :options="amountUnitOptions"
                  aria-label="Choose the amount unit"
                  @update:model-value="onUnitChange"
                />
              </div>
              <q-input
                v-model="manualSats"
                type="number"
                min="0"
                :step="amountUnit === 'sats' ? 1 : 'any'"
                dense
                outlined
                :label="amountInputLabel"
                :aria-label="amountInputLabel"
                @update:model-value="onManualSats"
              >
                <template v-if="amountUnit !== 'sats'" #append>
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="amber-9"
                    label="Use full balance"
                    :disable="!assetBalance"
                    @click="useFullBalance"
                  />
                </template>
              </q-input>
              <div v-if="amountUnit !== 'sats'" class="lightning-pay__spend-hint">
                Liquid {{ amountUnit.toUpperCase() }}: <strong>{{ formatAsset(assetBalance) }}</strong>
              </div>
              <div v-if="amountUnit !== 'sats' && quote?.valid" class="lightning-pay__conversion">
                <q-icon name="bolt" size="14px" aria-hidden="true" />
                <span>
                  {{ formatAsset(quote.spend) }} total = {{ formatSats(quote.amountSats) }} invoice
                  + {{ formatSats(quote.bridgeFeeSats ?? quote.feeSats) }} fee
                  + {{ formatSats(quote.bufferSats || 0) }} routing buffer (returned) at {{ rateLabel }}.
                </span>
              </div>
              <div v-else-if="amountUnit !== 'sats' && amountError" class="lightning-pay__conversion lightning-pay__conversion--warn">
                <q-icon name="info_outline" size="14px" aria-hidden="true" />
                <span>{{ amountError }}</span>
              </div>
              <div v-if="amountUnit === 'sats'" class="lightning-pay__presets" role="group" aria-label="Common sats amounts">
                <q-btn v-for="preset in presets" :key="preset" flat dense no-caps :label="preset.toLocaleString()" @click="setSats(preset)" />
              </div>
            </div>

            <div class="lightning-pay__summary-row">
              <span>Invoice amount</span>
              <strong>{{ formatSats(amountSats) }}</strong>
            </div>
            <div class="lightning-pay__summary-row">
              <span>Bridge fee <small>({{ feePercentLabel }} + {{ formatSats(quote?.fixed || 0) }})</small></span>
              <strong>{{ formatSats(quote?.bridgeFeeSats ?? quote?.feeSats ?? 0) }}</strong>
            </div>
            <div v-if="quote?.bufferSats" class="lightning-pay__summary-row">
              <span>Routing buffer <small>(returned as change)</small></span>
              <strong>{{ formatSats(quote.bufferSats) }}</strong>
            </div>
            <div class="lightning-pay__summary-row lightning-pay__summary-row--total">
              <span>Total sent</span>
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

          <div v-if="isAddress" class="lightning-pay__hint lightning-pay__hint--warn">
            <q-icon name="info_outline" size="15px" aria-hidden="true" />
            <span>
              An address payment sends sats to that address. Some addresses (for example a
              Bitrefill address) top up an account balance rather than paying a specific invoice.
              banksia.io resolves the address to a BOLT11 invoice before queuing, so v4vapp pays
              that invoice instead of re-resolving the address. Paste the BOLT11 invoice instead
              when you are paying for an order.
            </span>
          </div>

          <div v-if="quoteError" class="lightning-pay__error" role="alert">
            <q-icon name="error_outline" size="16px" aria-hidden="true" />
            <span>{{ quoteError }}</span>
          </div>

          <div v-if="bridgeIssue" class="lightning-pay__hint lightning-pay__hint--warn">
            <q-icon :name="bridgeIssueIcon" size="15px" aria-hidden="true" />
            <span>{{ bridgeIssueText }}</span>
          </div>

          <div class="lightning-pay__asset">
            <div class="lightning-pay__asset-label">Pay with</div>
            <q-btn-toggle
              v-model="asset"
              no-caps
              dense
              unelevated
              toggle-color="amber-9"
              toggle-text-color="black"
              text-color="blue-grey-4"
              :options="assetOptions"
              :disable="assetLocked"
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
            <span v-if="isAddress">
              This sends {{ asset }} to @v4vapp, which pays the BOLT11 invoice resolved from the
              address. If the Lightning payment fails, the bridge refunds the deposit to this
              account, minus its fee. Anyone can see the amount and memo on chain.
            </span>
            <span v-else>
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
              :loading="busy"
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
            <span v-if="isAddress">{{ displayTarget }} · {{ formatSats(amountSats) }}<template v-if="shortHash"> · {{ shortHash }}</template></span>
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
  normalizeAmountUnit,
  normalizeFeePolicy,
  parseLightningTarget,
  quoteSatsPayment,
  quoteSpendPayment,
  roundAmount,
  satsRatesFromBridgeQuote,
  satsRatesFromPrices
} from 'src/services/lightning'
import {
  BRIDGE_STATES,
  bridgeFeePolicy,
  getBridgeQuote,
  getBridgeState,
  getBridgeStatus,
  getSatsToHive,
  resolveLightningAddress
} from 'src/services/v4vapp'

export default {
  name: 'LightningPayDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    account: { type: String, required: true },
    liquidHive: { type: Number, default: 0 },
    liquidHbd: { type: Number, default: 0 },
    initialInput: { type: String, default: '' },
    initialSats: { type: Number, default: 0 },
    initialAmount: { type: [Number, String], default: 0 },
    initialCurrency: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'queued'],
  data () {
    return {
      input: this.initialInput || '',
      target: null,
      decoded: null,
      decodeError: '',
      manualSats: '',
      amountUnit: 'sats',
      rates: { satsPerHive: null, satsPerHbd: null },
      step: 'input',
      busy: false,
      quote: null,
      quoteError: '',
      quoteSource: 'estimated',
      bridgeIssue: '',
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
    amountUnitOptions () {
      return [
        { label: 'sats', value: 'sats' },
        { label: 'HBD', value: 'hbd' },
        { label: 'HIVE', value: 'hive' }
      ]
    },
    amountInputLabel () {
      if (this.amountUnit === 'hbd') return 'Total to spend (HBD)'
      if (this.amountUnit === 'hive') return 'Total to spend (HIVE)'
      return 'Amount to send (sats)'
    },
    assetLocked () {
      return this.isAmountless && this.amountUnit !== 'sats'
    },
    rateLabel () {
      const rate = this.amountUnit === 'hive' ? this.rates.satsPerHive : this.rates.satsPerHbd
      return Number(rate) > 0 ? '1 ' + this.amountUnit.toUpperCase() + ' ≈ ' + Math.round(rate) + ' sats' : 'the live rate'
    },
    amountError () {
      if (this.busy || this.amountUnit === 'sats' || !(Number(this.manualSats) > 0)) return ''
      const rate = this.amountUnit === 'hive' ? this.rates.satsPerHive : this.rates.satsPerHbd
      if (Number(rate) > 0) return ''
      return 'Could not read a ' + this.amountUnit.toUpperCase() + ' price to convert the amount.'
    },
    amountSats () {
      if (!this.isAmountless) return Number(this.decoded?.amountSats) || 0
      if (this.amountUnit === 'sats') {
        const value = Number(this.manualSats)
        return Number.isFinite(value) && value > 0 ? value : 0
      }
      return Number(this.quote?.amountSats) || 0
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
      if (this.assetLocked) return roundAmount(this.quote.spend ?? this.manualSats, 3)
      const value = this.asset === 'HBD' ? this.quote.hbd : this.quote.hive
      return ceilAmount(value, 3)
    },
    balance () {
      return this.asset === 'HBD' ? Number(this.liquidHbd) || 0 : Number(this.liquidHive) || 0
    },
    assetBalance () {
      return this.amountUnit === 'hive' ? Number(this.liquidHive) || 0 : Number(this.liquidHbd) || 0
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
    bridgeIssueIcon () {
      if (this.bridgeIssue === BRIDGE_STATES.OFFLINE) return 'wifi_off'
      if (this.bridgeIssue === BRIDGE_STATES.BLOCKED) return 'shield'
      return 'cloud_off'
    },
    bridgeIssueText () {
      if (this.bridgeIssue === BRIDGE_STATES.OFFLINE) {
        return 'You are offline. The HBD/HIVE cost is estimated from the last known market prices; queueing still works and nothing is sent until you review and sign it.'
      }
      if (this.bridgeIssue === BRIDGE_STATES.BLOCKED) {
        return 'This browser could not reach the bridge API — usually an extension, VPN or intermediary. The cost is estimated from market prices; the transfer still works on chain.'
      }
      return 'Live bridge quotes are unavailable right now. The HBD/HIVE cost is estimated from market prices; the transfer still works on chain.'
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
      if (open) this.openWithInput()
    },
    initialInput (value) {
      if (!this.modelValue) return
      this.reset()
      this.input = value || ''
      if (this.input) this.$nextTick(() => this.review())
    }
  },
  mounted () {
    if (this.modelValue) this.openWithInput()
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
    openWithInput () {
      this.reset()
      if (this.input) this.$nextTick(() => this.review())
    },
    reset () {
      const initialAmount = Number(this.initialAmount)
      this.input = this.initialInput || ''
      this.amountUnit = normalizeAmountUnit(this.initialCurrency, 'sats')
      this.manualSats = initialAmount > 0
        ? String(initialAmount)
        : (this.initialSats > 0 ? String(this.initialSats) : '')
      this.rates = { satsPerHive: null, satsPerHbd: null }
      this.target = null
      this.decoded = null
      this.decodeError = ''
      this.step = 'input'
      this.busy = false
      this.quote = null
      this.quoteError = ''
      this.quoteSource = 'estimated'
      this.bridgeIssue = ''
      this.asset = this.amountUnit === 'hive' ? 'HIVE' : 'HBD'
      if (this.quoteTimer) clearTimeout(this.quoteTimer)
    },
    onInput () {
      this.decodeError = ''
      this.decoded = null
      this.target = null
      this.quote = null
    },
    onUnitChange () {
      // Switching units must not reinterpret "1000 sats" as "1000 HBD".
      this.manualSats = ''
      this.quote = null
      this.quoteError = ''
      if (this.amountUnit === 'hive') this.asset = 'HIVE'
      else if (this.amountUnit === 'hbd') this.asset = 'HBD'
      if (this.quoteTimer) clearTimeout(this.quoteTimer)
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
    useFullBalance () {
      const amount = roundAmount(this.assetBalance, 3)
      if (!(amount > 0)) return
      this.manualSats = String(amount)
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
      if (!this.amountSats && this.amountUnit === 'sats') {
        this.quote = null
        this.quoteError = ''
        return
      }
      this.busy = true
      this.quoteError = ''
      try {
        const [pricesResult, statusResult, bridgeQuoteResult] = await Promise.allSettled([
          getHivePrices(),
          getBridgeStatus(),
          getBridgeQuote()
        ])
        const prices = pricesResult.status === 'fulfilled' ? pricesResult.value : {}
        const status = statusResult.status === 'fulfilled' ? statusResult.value : null
        const bridgeQuote = bridgeQuoteResult.status === 'fulfilled' ? bridgeQuoteResult.value : null
        const policy = status ? bridgeFeePolicy(status) : normalizeFeePolicy({})
        const marketRates = satsRatesFromPrices(prices)
        const bridgeRates = satsRatesFromBridgeQuote(bridgeQuote)
        const quoteRates = satsRatesFromPrices(bridgeQuote)
        this.rates = {
          satsPerHive: bridgeRates.satsPerHive ?? quoteRates.satsPerHive ?? marketRates.satsPerHive,
          satsPerHbd: bridgeRates.satsPerHbd ?? quoteRates.satsPerHbd ?? marketRates.satsPerHbd
        }
        // For a HBD/HIVE amount the entered value is the total wallet debit,
        // so the recipient invoice is only known after the fee is solved.
        const exactSpend = this.isAmountless && this.amountUnit !== 'sats'
        const amount = this.amountSats
        if (!exactSpend && !amount) {
          this.quote = null
          this.quoteError = this.amountError || ''
          return
        }
        let quote
        if (exactSpend) {
          quote = quoteSpendPayment({
            spendAmount: this.manualSats,
            asset: this.amountUnit,
            satsPerHive: this.rates.satsPerHive,
            satsPerHbd: this.rates.satsPerHbd,
            policy,
            source: 'estimated'
          })
        } else {
          quote = quoteSatsPayment({
            amountSats: amount,
            satsPerHive: this.rates.satsPerHive,
            satsPerHbd: this.rates.satsPerHbd,
            policy,
            source: 'estimated'
          })
        }
        if (!quote.valid) {
          this.quote = quote
          this.quoteError = quote.error
          return
        }

        this.quoteSource = 'estimated'
        this.bridgeIssue = status ? '' : getBridgeState().state

        // The bridge returns the authoritative HBD/HIVE cost. Prefer it over
        // the market-price estimate, and use it on its own when the price feed
        // is rate limited or unreachable.
        if (status) {
          try {
            const fixed = await getSatsToHive(quote.totalSats)
            const bridgeHbd = Number(fixed?.HBD)
            const bridgeHive = Number(fixed?.HIVE)
            const hbd = Number.isFinite(bridgeHbd) && bridgeHbd > 0 ? bridgeHbd : quote.hbd
            const hive = Number.isFinite(bridgeHive) && bridgeHive > 0 ? bridgeHive : quote.hive
            if (hbd || hive) {
              quote = { ...quote, hbd, hive, source: 'bridge' }
              this.quoteSource = 'bridge'
              this.bridgeIssue = ''
            }
          } catch {
            this.bridgeIssue = getBridgeState().state || BRIDGE_STATES.DEGRADED
            this.quoteSource = 'estimated'
          }
        }

        if (!quote.hbd && !quote.hive) {
          this.quote = quote
          this.quoteError = 'Could not read a Hive/HBD price to estimate the cost.'
          return
        }

        this.quote = quote
      } catch (error) {
        this.quote = null
        this.quoteError = error?.message || 'Could not estimate the Hive cost.'
      } finally {
        this.busy = false
      }
    },
    async queue () {
      if (!this.canQueue) return
      this.busy = true
      this.quoteError = ''
      let memo
      try {
        let invoice = this.decoded?.raw
        if (this.isAddress) {
          // Resolve to a fixed invoice. If the bridge only sees the address it
          // re-resolves it at settlement; a failed lookup there becomes a
          // keepsats deposit. A BOLT11 invoice either pays or is refunded.
          const resolved = await resolveLightningAddress(this.target.value, this.quote.amountSats)
          const decoded = decodeBolt11(resolved.paymentRequest)
          if (!decoded.valid) throw new Error(decoded.error)
          if (decoded.expired) throw new Error('The address provider returned an expired invoice.')
          if (!decoded.hasAmount) throw new Error('The address provider returned an invoice without an amount. Try again.')
          if (decoded.amountSats > this.quote.amountSats + 1) {
            throw new Error('The address provider returned a larger invoice than quoted. Try again.')
          }
          invoice = resolved.paymentRequest
          this.decoded = { ...decoded, raw: invoice }
        }
        memo = lightningMemo(invoice)
      } catch (error) {
        this.quoteError = error?.message || 'Could not resolve this Lightning address.'
        this.busy = false
        return
      }
      this.busy = false
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
  background: var(--c-surface-1);
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
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
}

.lightning-eyebrow {
  color: var(--c-warning);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lightning-pay__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
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
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  line-height: 1.45;
}

.lightning-pay__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.4;
}

.lightning-pay__hint--warn {
  padding: 0.45rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 30%, transparent);
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--c-warning) 5%, transparent);
  color: var(--c-warning-soft);
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
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  cursor: pointer;
}

.lightning-pay__back:hover {
  color: var(--c-warning-soft);
}

.lightning-pay__invoice {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--c-shadow) 18%, transparent);
}

.lightning-pay__invoice-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.lightning-pay__invoice-label {
  color: var(--c-warning);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lightning-pay__invoice-value {
  color: var(--c-warning-soft);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.lightning-pay__summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--c-text-subtle);
  font-size: 0.74rem;
}

.lightning-pay__summary-row strong {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
}

.lightning-pay__summary-row small {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

.lightning-pay__summary-row--total {
  padding-top: 0.3rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-soft);
}

.lightning-pay__summary-row--total strong {
  color: var(--c-warning-soft);
}

.lightning-pay__description {
  display: flex;
  gap: 0.5rem;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.35;
}

.lightning-pay__description > span {
  flex: none;
  min-width: 78px;
}

.lightning-pay__description p {
  margin: 0;
  color: var(--c-text-subtle);
  overflow-wrap: anywhere;
}

.lightning-pay__sats-input {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.lightning-pay__amount-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lightning-pay__amount-label {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.lightning-pay__spend-hint {
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.lightning-pay__spend-hint strong {
  color: var(--c-text-muted);
}

.lightning-pay__conversion {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  color: var(--c-warning-soft);
  font-size: 0.68rem;
  line-height: 1.4;
}

.lightning-pay__conversion--warn {
  color: var(--c-text-faint);
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
  color: var(--c-text-faint);
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.lightning-pay__balance {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.lightning-pay__balance strong {
  color: var(--c-text-muted);
}

.lightning-pay__error {
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

.lightning-pay__warning {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: var(--c-warning);
  font-size: 0.68rem;
  line-height: 1.4;
}

.lightning-pay__queued {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.7rem;
  border: 1px solid color-mix(in srgb, var(--c-positive) 40%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--c-positive) 7%, transparent);
  color: var(--c-positive-soft);
  font-size: 0.76rem;
}

.lightning-pay__queued p {
  margin: 0.2rem 0 0;
  color: var(--c-positive);
  font-size: 0.7rem;
  line-height: 1.4;
}

.lightning-pay__queued-details {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}
</style>
