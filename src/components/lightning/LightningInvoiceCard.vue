<template>
  <div class="lightning-invoice" :class="'lightning-invoice--' + displayStatus">
    <div class="lightning-invoice__body">
      <div class="lightning-invoice__main">
        <div class="lightning-invoice__amount">
          <span class="lightning-invoice__sats">{{ amountLabel }}</span>
          <span v-if="invoice.amountSats" class="lightning-invoice__fiat">Lightning payment request</span>
        </div>

        <div class="lightning-invoice__status" role="status" aria-live="polite">
          <q-icon :name="statusIcon" size="15px" aria-hidden="true" />
          <span>{{ statusText }}</span>
          <span v-if="displayStatus === 'open' && expiresLabel" class="lightning-invoice__timer">· {{ expiresLabel }}</span>
        </div>

        <div class="lightning-invoice__memo" v-if="invoice.memo">
          {{ invoice.memo }}
        </div>

        <div class="lightning-invoice__actions">
          <q-btn
            unelevated
            no-caps
            color="amber-9"
            text-color="black"
            icon="content_copy"
            label="Copy invoice"
            :disable="!invoice.paymentRequest"
            @click="copyInvoice"
          />
          <q-btn
            flat
            no-caps
            color="amber-9"
            icon="open_in_new"
            label="Open wallet"
            type="a"
            :href="invoiceUri"
            :disable="!invoice.paymentRequest"
          />
        </div>

        <div v-if="invoice.paymentRequest" class="lightning-invoice__raw">
          <code>{{ shortInvoice }}</code>
        </div>
      </div>

      <div class="lightning-invoice__qr" v-if="qrSrc">
        <img :src="qrSrc" :alt="'QR code for ' + amountLabel + ' Lightning invoice'" width="190" height="190" />
      </div>
      <div v-else class="lightning-invoice__qr lightning-invoice__qr--empty" aria-hidden="true">
        <q-icon name="qr_code_2" size="54px" />
      </div>
    </div>

    <div v-if="displayStatus === 'paid'" class="lightning-invoice__paid">
      <q-icon name="check_circle" size="18px" aria-hidden="true" />
      Paid. The Hive transfer from @v4vapp will appear in the wallet.
    </div>
    <div v-else-if="displayStatus === 'expired'" class="lightning-invoice__notice">
      <q-icon name="schedule" size="18px" aria-hidden="true" />
      This invoice expired. Create a fresh one to keep the amount and exchange rate.
    </div>
    <div v-else-if="displayStatus === 'unknown'" class="lightning-invoice__notice">
      <q-icon name="cloud_off" size="18px" aria-hidden="true" />
      Payment status could not be checked from this browser. Check the destination wallet for the Hive transfer.
    </div>
  </div>
</template>

<script>
import { copyToClipboard } from 'quasar'
import { formatSats } from 'src/services/lightning'

export default {
  name: 'LightningInvoiceCard',
  props: {
    invoice: { type: Object, required: true },
    status: { type: String, default: 'open' }
  },
  emits: ['expired'],
  data () {
    return {
      now: Date.now()
    }
  },
  computed: {
    displayStatus () {
      if (this.status === 'paid' || this.status === 'expired' || this.status === 'unknown') return this.status
      return this.expiresAt && this.expiresAt <= this.now ? 'expired' : 'open'
    },
    amountLabel () {
      const amount = Number(this.invoice.amountSats)
      return Number.isFinite(amount) && amount > 0 ? formatSats(amount) : 'Any amount'
    },
    expiresAt () {
      const value = Number(this.invoice.expiresAt)
      if (!Number.isFinite(value) || value <= 0) return 0
      return value > 100000000000 ? value : value * 1000
    },
    expiresLabel () {
      if (!this.expiresAt) return ''
      const seconds = Math.max(0, Math.round((this.expiresAt - this.now) / 1000))
      if (seconds <= 0) return 'expired'
      const minutes = Math.floor(seconds / 60)
      const rest = String(seconds % 60).padStart(2, '0')
      return 'expires in ' + minutes + ':' + rest
    },
    statusText () {
      if (this.displayStatus === 'paid') return 'Paid'
      if (this.displayStatus === 'expired') return 'Expired'
      if (this.displayStatus === 'unknown') return 'Status unavailable'
      return 'Waiting for payment'
    },
    statusIcon () {
      if (this.displayStatus === 'paid') return 'check_circle'
      if (this.displayStatus === 'expired') return 'schedule'
      if (this.displayStatus === 'unknown') return 'cloud_off'
      return 'hourglass_top'
    },
    qrSrc () {
      const data = this.invoice.qrCodeBase64
      return data ? (data.startsWith('data:') ? data : 'data:image/png;base64,' + data) : ''
    },
    invoiceUri () {
      return this.invoice.paymentRequest ? 'lightning:' + this.invoice.paymentRequest : '#'
    },
    shortInvoice () {
      const value = String(this.invoice.paymentRequest || '')
      if (value.length <= 46) return value
      return value.slice(0, 26) + '…' + value.slice(-14)
    }
  },
  watch: {
    'invoice.paymentRequest' () {
      this.now = Date.now()
    }
  },
  mounted () {
    this.timer = setInterval(() => {
      this.now = Date.now()
      if (this.expiresAt && this.expiresAt <= this.now && this.status === 'open') this.$emit('expired')
    }, 1000)
  },
  beforeUnmount () {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    copyInvoice () {
      if (!this.invoice.paymentRequest) return
      Promise.resolve(copyToClipboard(this.invoice.paymentRequest)).then(() => {
        this.$q.notify({ message: 'Copied Lightning invoice', color: 'primary', icon: 'content_copy', timeout: 2000, position: 'top' })
      }).catch(() => {
        this.$q.notify({ message: 'Could not copy the invoice.', color: 'negative', timeout: 3000, position: 'top' })
      })
    }
  }
}
</script>

<style scoped>
.lightning-invoice {
  border: 1px solid var(--border-subtle);
  border-radius: 0.6rem;
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.lightning-invoice--paid {
  border-color: rgba(76, 175, 80, 0.45);
  background: rgba(76, 175, 80, 0.06);
}

.lightning-invoice--expired,
.lightning-invoice--unknown {
  border-color: rgba(255, 152, 0, 0.35);
  background: rgba(255, 152, 0, 0.05);
}

.lightning-invoice__body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem;
}

.lightning-invoice__main {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  flex: 1 1 auto;
}

.lightning-invoice__amount {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.lightning-invoice__sats {
  color: #ffe082;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.lightning-invoice__fiat {
  color: #78909c;
  font-size: 0.7rem;
}

.lightning-invoice__status {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #b0bec5;
  font-size: 0.72rem;
}

.lightning-invoice__timer {
  color: #78909c;
}

.lightning-invoice__memo {
  color: #90a4ae;
  font-size: 0.7rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.lightning-invoice__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}

.lightning-invoice__raw code {
  color: #546e7a;
  font-size: 0.62rem;
  overflow-wrap: anywhere;
}

.lightning-invoice__qr {
  flex: none;
}

.lightning-invoice__qr img {
  display: block;
  width: 190px;
  height: 190px;
  border-radius: 0.45rem;
  background: #fff;
  padding: 5px;
}

.lightning-invoice__qr--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 190px;
  height: 190px;
  border: 1px dashed var(--border-subtle);
  border-radius: 0.45rem;
  color: #546e7a;
}

.lightning-invoice__paid,
.lightning-invoice__notice {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.85rem;
  border-top: 1px solid var(--border-subtle);
  color: #b0bec5;
  font-size: 0.7rem;
}

.lightning-invoice__paid {
  color: #a5d6a7;
}

@media (max-width: 599px) {
  .lightning-invoice__body {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 0.6rem;
  }

  .lightning-invoice__qr {
    align-self: center;
  }

  .lightning-invoice__qr img,
  .lightning-invoice__qr--empty {
    width: 168px;
    height: 168px;
  }
}
</style>
