<template>
  <q-page class="pos-page">
    <div class="pos-shell">
      <header class="pos-head">
        <div class="pos-head__text">
          <div class="pos-eyebrow">Lightning point of sale</div>
          <h1 class="pos-head__title">@{{ account }}</h1>
          <p class="pos-lede">
            The customer pays sats from any Lightning wallet. @v4vapp settles
            {{ receiveLabel }} to the merchant. No login and no keys on this page.
          </p>
        </div>
        <div class="pos-head__actions">
          <q-btn outline no-caps color="primary" icon="bolt" :to="'/@' + account + '/lightning'" label="Lightning page" />
          <q-btn flat no-caps color="grey" icon="person" :to="'/@' + account" label="Profile" />
        </div>
      </header>

      <q-card v-if="!validAccount" flat bordered class="pos-card pos-invalid">
        <q-icon name="error_outline" size="2em" aria-hidden="true" />
        <h2>That is not a valid Hive account</h2>
        <p>Open <code>/@account/pos</code> with a real account name.</p>
      </q-card>

      <div v-else class="pos-grid">
        <section class="pos-card pos-entry" aria-labelledby="pos-amount-title">
          <div class="pos-card__head">
            <div>
              <div class="pos-card__eyebrow">Step 1</div>
              <h2 id="pos-amount-title" class="pos-card__title">Amount</h2>
            </div>
            <q-btn-toggle
              v-model="currency"
              no-caps
              dense
              unelevated
              toggle-color="amber-9"
              toggle-text-color="black"
              text-color="blue-grey-4"
              :options="currencyOptions"
              aria-label="Point of sale currency"
            />
          </div>

          <div class="pos-amount" aria-live="polite" aria-atomic="true">
            <span class="pos-amount__value">{{ displayAmount }}</span>
            <span class="pos-amount__currency">{{ currency.toUpperCase() }}</span>
          </div>

          <div class="pos-keypad" role="group" aria-label="Amount keypad">
            <button
              v-for="key in keypad"
              :key="key.value"
              type="button"
              class="pos-key"
              :aria-label="key.label"
              @click="press(key.value)"
            >
              <q-icon v-if="key.value === 'backspace'" name="backspace" size="20px" aria-hidden="true" />
              <template v-else>{{ key.value }}</template>
            </button>
            <button type="button" class="pos-key pos-key--clear" aria-label="Clear amount" @click="press('clear')">Clear</button>
          </div>

          <q-input
            v-model="memo"
            dense
            outlined
            maxlength="80"
            counter
            label="Note (public on Hive)"
            aria-label="Payment note, public on Hive"
            hint="Optional. Do not put personal information here."
            class="pos-memo"
          />

          <div class="pos-receive">
            <span class="pos-receive__label">Merchant receives</span>
            <q-btn-toggle
              v-model="receiveCurrency"
              no-caps
              dense
              unelevated
              toggle-color="amber-9"
              toggle-text-color="black"
              text-color="blue-grey-4"
              :options="receiveOptions"
              aria-label="Currency the merchant receives"
            />
          </div>

          <p class="pos-hint">
            The customer pays sats. A fixed {{ feeFixedLabel }} sat bridge fee applies
            to small payments; the live quote wins when the bridge is reachable.
          </p>

          <div v-if="error && !fallback" class="pos-error" role="alert">
            <q-icon name="error_outline" size="16px" aria-hidden="true" />
            <span>{{ error }}</span>
          </div>

          <q-btn
            unelevated
            no-caps
            color="amber-9"
            text-color="black"
            icon="qr_code_2"
            label="Create invoice"
            class="pos-create"
            :loading="busy"
            :disable="!canCreate"
            @click="create"
          />
        </section>

        <section class="pos-card pos-invoice" aria-labelledby="pos-invoice-title">
          <div class="pos-card__head">
            <div>
              <div class="pos-card__eyebrow">Step 2</div>
              <h2 id="pos-invoice-title" class="pos-card__title">Invoice</h2>
            </div>
            <span class="pos-card__status" :class="'pos-card__status--' + status">{{ statusLabel }}</span>
          </div>

          <template v-if="invoice">
            <lightning-invoice-card :invoice="invoice" :status="status" @expired="onExpired" />

            <div v-if="status === 'paid'" class="pos-paid" role="status">
              <q-icon name="check_circle" size="24px" aria-hidden="true" />
              <div>
                <strong>Paid. {{ formatSats(invoice.amountSats) }}.</strong>
                <p>@v4vapp will send {{ receiveLabel }} to @{{ account }}. Check the wallet for the Hive transfer.</p>
              </div>
            </div>

            <div v-if="status === 'unknown'" class="pos-warn" role="alert">
              <q-icon name="cloud_off" size="16px" aria-hidden="true" />
              <span>Live status checks are unavailable. The customer may still have paid; watch the merchant wallet for a transfer from @v4vapp.</span>
            </div>

            <div class="pos-invoice__actions">
              <q-btn
                unelevated
                no-caps
                color="amber-9"
                text-color="black"
                :icon="status === 'paid' ? 'add' : 'refresh'"
                :label="status === 'paid' ? 'New sale' : 'New invoice'"
                @click="reset"
              />
              <span class="pos-invoice__hint">Each sale gets a fresh, single-use invoice.</span>
            </div>
          </template>

          <div v-else class="pos-empty">
            <q-icon name="qr_code_2" size="48px" aria-hidden="true" />
            <p>Enter an amount and create the first invoice. The QR code appears here.</p>
            <lightning-address-card v-if="fallback" :account="account" compact :show-qr="true" />
            <p v-if="fallback" class="pos-empty__fallback">
              The bridge could not create an invoice. The address above still works;
              the customer enters the amount in their wallet.
            </p>
          </div>

          <div v-if="session.count" class="pos-session" aria-live="polite">
            <span>This session</span>
            <strong>{{ session.count }} {{ session.count === 1 ? 'sale' : 'sales' }} · {{ formatSats(session.sats) }}</strong>
            <small>Local to this page. Not a server-side ledger.</small>
          </div>
        </section>
      </div>

      <footer class="pos-foot">
        <span>No login. No keys. Invoices expire; never reuse a QR code.</span>
        <a href="https://v4v.app" target="_blank" rel="noopener noreferrer">Bridged by v4v.app</a>
      </footer>
    </div>
  </q-page>
</template>

<script>
import { pollWhileVisible } from 'src/services/polling'
import { formatSats, isValidHiveAccount, normalizeFeePolicy } from 'src/services/lightning'
import {
  POS_CURRENCIES,
  posAmount,
  posCurrency,
  posInvoiceMessage,
  posKeypad,
  posSessionTotals
} from 'src/services/pos'
import {
  bridgeFeePolicy,
  checkInvoice,
  createInvoice,
  getBridgeStatus,
  isBridgeUnavailable
} from 'src/services/v4vapp'
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'
import LightningInvoiceCard from 'components/lightning/LightningInvoiceCard.vue'
import { setPageMeta } from 'src/utils/pageMeta'

const KEYPAD = [
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '.', label: 'Decimal point' },
  { value: '0', label: '0' },
  { value: 'backspace', label: 'Backspace' }
]

export default {
  name: 'AccountPos',
  components: { LightningAddressCard, LightningInvoiceCard },
  data () {
    return {
      currency: 'sats',
      receiveCurrency: 'hbd',
      amount: '',
      memo: '',
      invoice: null,
      status: 'open',
      busy: false,
      error: '',
      fallback: false,
      poller: null,
      pollFailures: 0,
      policy: normalizeFeePolicy({}),
      sales: [],
      keypad: KEYPAD
    }
  },
  computed: {
    account () {
      return String(this.$route.params.account || '').trim().replace(/^@/, '').toLowerCase()
    },
    validAccount () {
      return isValidHiveAccount(this.account)
    },
    currencyOptions () {
      return POS_CURRENCIES.map(entry => ({ label: entry.label, value: entry.value }))
    },
    receiveOptions () {
      return [
        { label: 'HBD', value: 'hbd' },
        { label: 'HIVE', value: 'hive' }
      ]
    },
    decimals () {
      return posCurrency(this.currency).decimals
    },
    displayAmount () {
      return this.amount || '0'
    },
    canCreate () {
      return this.validAccount && posAmount(this.amount) > 0 && !this.busy && !this.invoice
    },
    receiveLabel () {
      return this.receiveCurrency === 'hive' ? 'HIVE' : 'HBD'
    },
    feeFixedLabel () {
      return Number(this.policy.fixed || 0).toLocaleString('en-US')
    },
    session () {
      return posSessionTotals(this.sales)
    },
    statusLabel () {
      if (this.status === 'paid') return 'Paid'
      if (this.status === 'expired') return 'Expired'
      if (this.status === 'unknown') return 'Status unavailable'
      return this.invoice ? 'Waiting' : 'No invoice'
    }
  },
  watch: {
    currency () {
      this.amount = ''
      this.error = ''
      this.fallback = false
    },
    '$route.params.account' () {
      this.stopPolling()
      this.invoice = null
      this.status = 'open'
      this.amount = ''
      this.memo = ''
      this.error = ''
      this.fallback = false
      this.sales = []
      if (this.validAccount) this.setMeta()
    }
  },
  mounted () {
    this.loadPolicy()
    this.setMeta()
    window.addEventListener('keydown', this.onKeydown)
  },
  beforeUnmount () {
    this.stopPolling()
    window.removeEventListener('keydown', this.onKeydown)
  },
  methods: {
    formatSats,
    setMeta () {
      if (!this.validAccount) return
      setPageMeta({
        title: '@' + this.account + ' Lightning point of sale — banksia.io',
        description: 'Accept Lightning payments as HBD or HIVE for @' + this.account + '. Create a fresh invoice for each sale; no login or keys.',
        url: '/@' + this.account + '/pos'
      })
    },
    async loadPolicy () {
      try {
        const status = await getBridgeStatus()
        if (status) this.policy = bridgeFeePolicy(status)
      } catch {
        // Defaults stay visible.
      }
    },
    press (key) {
      this.amount = this.keypadValue(key)
    },
    keypadValue (key) {
      return posKeypad(this.amount, key, { decimals: this.decimals })
    },
    onKeydown (event) {
      const target = event.target
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return
      if (/^[0-9.]$/.test(event.key)) {
        this.press(event.key)
        event.preventDefault()
        return
      }
      if (event.key === 'Backspace') {
        this.press('backspace')
        event.preventDefault()
        return
      }
      if (event.key === 'Escape') {
        this.reset()
        return
      }
      if (event.key === 'Enter') {
        if (this.invoice) this.reset()
        else if (this.canCreate) this.create()
      }
    },
    async create () {
      if (!this.canCreate) return
      this.busy = true
      this.error = ''
      this.fallback = false
      this.stopPolling()
      try {
        const invoice = await createInvoice({
          account: this.account,
          amount: posAmount(this.amount),
          currency: this.currency,
          receiveCurrency: this.receiveCurrency,
          message: posInvoiceMessage(this.memo),
          expiry: 900,
          includeQr: true
        })
        this.invoice = invoice
        this.status = 'open'
        this.pollFailures = 0
        this.startPolling()
      } catch (error) {
        this.fallback = isBridgeUnavailable(error)
        this.error = this.fallback ? '' : (error?.message || 'Could not create a Lightning invoice.')
        this.invoice = null
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
          this.sales.push({ at: Date.now(), sats: Number(this.invoice.amountSats) || 0 })
        } else if (result.status === 'expired') {
          this.stopPolling()
        }
      } catch (error) {
        this.pollFailures += 1
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
    reset () {
      this.stopPolling()
      this.invoice = null
      this.status = 'open'
      this.amount = ''
      this.memo = ''
      this.error = ''
      this.fallback = false
      this.busy = false
    }
  }
}
</script>

<style scoped>
.pos-page {
  padding: var(--space-4) var(--space-3) 4rem;
}

.pos-shell {
  width: min(1100px, 100%);
  margin: 0 auto;
}

.pos-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.pos-head__text {
  min-width: 0;
}

.pos-eyebrow {
  color: var(--c-warning);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pos-head__title {
  margin: 0.15rem 0 0;
  color: var(--c-text);
  font-size: 1.8rem;
  line-height: 1.1;
}

.pos-lede {
  max-width: 56ch;
  margin: 0.4rem 0 0;
  color: var(--c-text-subtle);
  font-size: 0.86rem;
  line-height: 1.5;
}

.pos-head__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.pos-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.pos-card {
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.pos-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.pos-card__eyebrow {
  color: var(--c-warning);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pos-card__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1.1rem;
}

.pos-card__status {
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pos-card__status--paid {
  border-color: color-mix(in srgb, var(--c-positive) 50%, transparent);
  color: var(--c-positive);
}

.pos-card__status--expired,
.pos-card__status--unknown {
  border-color: color-mix(in srgb, var(--c-warning) 40%, transparent);
  color: var(--c-warning-soft);
}

.pos-amount {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.4rem;
  margin: 0.7rem 0;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--c-shadow) 25%, transparent);
  overflow-wrap: anywhere;
}

.pos-amount__value {
  color: var(--c-warning-soft);
  font-size: 2.2rem;
  font-weight: 700;
  line-height: 1.1;
}

.pos-amount__currency {
  color: var(--c-text-faint);
  font-size: 0.82rem;
  text-transform: uppercase;
}

.pos-keypad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}

.pos-key {
  min-height: 52px;
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
  color: var(--c-text);
  font-size: 1.15rem;
  font-weight: 650;
  cursor: pointer;
}

.pos-key:hover {
  border-color: color-mix(in srgb, var(--c-warning) 45%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
}

.pos-key:focus-visible {
  outline: 2px solid var(--c-warning);
  outline-offset: 2px;
}

.pos-key--clear {
  grid-column: 1 / -1;
  min-height: 40px;
  color: var(--c-warning-soft);
  font-size: 0.8rem;
}

.pos-memo {
  margin-top: 0.7rem;
}

.pos-receive {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}

.pos-receive__label {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
}

.pos-hint,
.pos-foot {
  margin: 0.6rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.45;
}

.pos-create {
  width: 100%;
  margin-top: 0.65rem;
}

.pos-error,
.pos-warn {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.55rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--c-warning) 6%, transparent);
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.pos-paid {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-top: 0.6rem;
  padding: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--c-positive) 45%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--c-positive) 7%, transparent);
  color: var(--c-positive-soft);
  font-size: 0.76rem;
}

.pos-paid p {
  margin: 0.2rem 0 0;
  color: var(--c-positive);
  font-size: 0.7rem;
}

.pos-invoice__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.6rem;
}

.pos-invoice__hint {
  color: var(--c-text-faint);
  font-size: 0.66rem;
}

.pos-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.4rem 0.6rem;
  border: 1px dashed var(--border-subtle);
  border-radius: 0.6rem;
  color: var(--c-text-faint);
  text-align: center;
  font-size: 0.74rem;
}

.pos-empty p {
  margin: 0;
  max-width: 40ch;
  line-height: 1.45;
}

.pos-empty__fallback {
  color: var(--c-warning-soft);
}

.pos-session {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: 0.7rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-subtle);
  font-size: 0.7rem;
}

.pos-session strong {
  color: var(--c-warning-soft);
}

.pos-session small {
  color: var(--c-text-faint);
  font-size: 0.62rem;
}

.pos-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-4);
  color: var(--c-text-faint);
  font-size: 0.66rem;
}

.pos-foot a {
  color: var(--c-warning-soft);
}

.pos-invalid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 2rem 1rem;
  text-align: center;
}

.pos-invalid h2 {
  margin: 0;
  font-size: 1rem;
}

.pos-invalid p {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

@media (max-width: 899px) {
  .pos-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .pos-amount__value {
    font-size: 1.8rem;
  }
}
</style>
