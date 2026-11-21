<template>
  <q-card flat bordered class="lightning-address-card" :class="{ 'lightning-address-card--compact': compact }">
    <q-card-section class="lightning-address-card__head">
      <div class="lightning-address-card__title-wrap">
        <q-avatar size="28px" class="lightning-address-card__icon">
          <img src="/statics/lightning.webp" alt="" aria-hidden="true" />
        </q-avatar>
        <div>
          <div class="lightning-eyebrow">Lightning</div>
          <h3 class="lightning-address-card__title">{{ address }}</h3>
        </div>
      </div>
      <q-badge color="amber-9" text-color="black" class="lightning-address-card__badge">v4v.app</q-badge>
    </q-card-section>

    <div class="lightning-address-card__body">
      <div class="lightning-address-card__address">
        <code>{{ address }}</code>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="content_copy"
          color="blue-grey"
          :aria-label="'Copy Lightning address ' + address"
          title="Copy Lightning address"
          @click="copyAddress"
        />
      </div>

      <div v-if="showQr" class="lightning-address-card__qr">
        <img
          v-if="!qrFailed"
          :src="qrUrl"
          :alt="'QR code for Lightning address ' + address"
          width="150"
          height="150"
          loading="lazy"
          referrerpolicy="no-referrer"
          @error="qrFailed = true"
        />
        <div v-else class="lightning-address-card__qr-fallback" role="img" :aria-label="'QR code unavailable. Lightning address ' + address">
          <q-icon name="qr_code_2" size="42px" aria-hidden="true" />
          <span>QR unavailable</span>
        </div>
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
        class="lightning-address-card__currencies"
        :aria-label="'Choose the currency received over Lightning'"
        @update:model-value="qrFailed = false"
      />

      <p v-if="!compact" class="lightning-address-card__hint">
        Any Lightning wallet can pay this address. The sender pays sats; this account receives
        {{ currency === 'hbd' ? 'HBD' : currency === 'sats' ? 'Keepsats held by v4v.app' : 'HIVE' }}
        as a Hive transfer from @v4vapp.
      </p>

      <div class="lightning-address-card__actions">
        <q-btn
          flat
          dense
          no-caps
          color="amber-9"
          icon="open_in_new"
          label="Open v4v.app"
          type="a"
          :href="openUrl"
          target="_blank"
          rel="noopener noreferrer"
        />
        <q-btn
          v-if="showReceive"
          outline
          dense
          no-caps
          color="amber-9"
          icon="bolt"
          label="Create invoice"
          @click="$emit('receive')"
        />
      </div>
    </div>
  </q-card>
</template>

<script>
import { copyToClipboard } from 'quasar'
import { lightningAddress, lightningAddressQrUrl } from 'src/services/lightning'

export default {
  name: 'LightningAddressCard',
  props: {
    account: { type: String, required: true },
    compact: { type: Boolean, default: false },
    showQr: { type: Boolean, default: true },
    showReceive: { type: Boolean, default: false },
    initialCurrency: { type: String, default: 'hive' }
  },
  emits: ['receive'],
  data () {
    return {
      currency: this.initialCurrency,
      qrFailed: false
    }
  },
  computed: {
    address () {
      return lightningAddress(this.account, this.currency)
    },
    qrUrl () {
      return lightningAddressQrUrl(this.account, this.currency)
    },
    openUrl () {
      return 'https://v4v.app'
    },
    currencyOptions () {
      return [
        { label: 'HIVE', value: 'hive' },
        { label: 'HBD', value: 'hbd' },
        { label: 'Sats', value: 'sats' }
      ]
    }
  },
  watch: {
    account () {
      this.qrFailed = false
    }
  },
  methods: {
    copyAddress () {
      Promise.resolve(copyToClipboard(this.address)).then(() => {
        this.$q.notify({ message: 'Copied ' + this.address, color: 'primary', icon: 'content_copy', timeout: 2000, position: 'top' })
      }).catch(() => {
        this.$q.notify({ message: 'Could not copy the address.', color: 'negative', timeout: 3000, position: 'top' })
      })
    }
  }
}
</script>

<style scoped>
.lightning-address-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 90% 0%, rgba(255, 193, 7, 0.08), transparent 45%),
    rgba(255, 255, 255, 0.025);
}

.lightning-address-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.8rem 0.9rem 0.55rem;
  border-bottom: 1px solid var(--border-subtle);
}

.lightning-address-card__title-wrap {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
}

.lightning-address-card__icon {
  border: 1px solid rgba(255, 193, 7, 0.35);
  background: rgba(255, 193, 7, 0.08);
}

.lightning-eyebrow {
  color: #b0a06a;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lightning-address-card__title {
  margin: 0.1rem 0 0;
  color: #f1e7c8;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.lightning-address-card__badge {
  flex: none;
  font-size: 0.58rem;
}

.lightning-address-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.7rem 0.9rem 0.8rem;
}

.lightning-address-card__address {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.4rem 0.45rem 0.4rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.45rem;
  background: rgba(0, 0, 0, 0.18);
}

.lightning-address-card__address code {
  color: #ffe082;
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.lightning-address-card__qr {
  display: flex;
  justify-content: center;
}

.lightning-address-card__qr img {
  display: block;
  width: 150px;
  height: 150px;
  border-radius: 0.45rem;
  background: #fff;
  padding: 4px;
}

.lightning-address-card__qr-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  width: 150px;
  height: 150px;
  border: 1px dashed var(--border-subtle);
  border-radius: 0.45rem;
  color: #78909c;
  font-size: 0.66rem;
}

.lightning-address-card__currencies {
  align-self: flex-start;
}

.lightning-address-card__hint {
  margin: 0;
  color: #90a4ae;
  font-size: 0.7rem;
  line-height: 1.4;
}

.lightning-address-card__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.lightning-address-card--compact .lightning-address-card__body {
  gap: 0.4rem;
  padding-top: 0.55rem;
}

.lightning-address-card--compact .lightning-address-card__qr img,
.lightning-address-card--compact .lightning-address-card__qr-fallback {
  width: 112px;
  height: 112px;
}
</style>
