<template>
  <section id="lightning" class="wallet-section" aria-labelledby="wallet-lightning-title">
    <q-card flat bordered class="wallet-card wallet-lightning">
      <q-card-section class="wallet-card__head">
        <div>
          <div class="wallet-eyebrow">Sats bridge</div>
          <h2 id="wallet-lightning-title" class="wallet-card__title">Lightning</h2>
        </div>

        <div class="wallet-lightning__actions">
          <q-btn
            outline
            dense
            no-caps
            color="primary"
            icon="bolt"
            :label="loggedIn ? 'Receive sats' : 'Tip with Lightning'"
            @click="receiveOpen = true"
          />
          <q-btn
            v-if="loggedIn"
            outline
            dense
            no-caps
            color="primary"
            icon="send"
            label="Pay invoice"
            @click="payOpen = true"
          />
          <q-btn
            flat
            dense
            round
            icon="open_in_new"
            :to="'/@' + account + '/lightning'"
            aria-label="Open the Lightning page"
            title="Open the Lightning page"
          />
        </div>
      </q-card-section>

      <p class="wallet-lightning__intro">
        <template v-if="loggedIn">
          Receive sats as HIVE or HBD, or pay any Lightning invoice with the HIVE/HBD in this
          wallet. Payments queue for review and never auto-send.
        </template>
        <template v-else>
          Any Lightning wallet can pay @{{ account }}. The bridge settles the payment as a Hive
          transfer from @v4vapp.
        </template>
      </p>

      <div class="wallet-lightning__body">
        <ul class="wallet-lightning__addresses" aria-label="Lightning addresses">
          <li
            v-for="option in addressOptions"
            :key="option.id"
            class="wallet-lightning__address"
            :class="{ 'is-active': qrCurrency === option.id }"
          >
            <button
              type="button"
              class="wallet-lightning__address-main"
              :aria-pressed="qrCurrency === option.id ? 'true' : 'false'"
              :title="'Show the ' + option.label + ' QR code'"
              @click="qrCurrency = option.id"
            >
              <span class="wallet-lightning__address-label">{{ option.label }}</span>
              <code>{{ option.address }}</code>
            </button>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="content_copy"
              color="blue-grey-4"
              :aria-label="'Copy ' + option.label + ' Lightning address'"
              title="Copy address"
              @click="copyAddress(option)"
            />
          </li>
        </ul>

        <figure class="wallet-lightning__qr">
          <img
            v-if="!qrFailed"
            :src="qrUrl"
            :alt="'QR code for Lightning address ' + qrAddress"
            width="132"
            height="132"
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="qrFailed = true"
          />
          <div v-else class="wallet-lightning__qr-fallback" role="img" :aria-label="'QR code unavailable. Lightning address ' + qrAddress">
            <q-icon name="qr_code_2" size="38px" aria-hidden="true" />
            <span>QR unavailable</span>
          </div>
          <figcaption>Scan to pay @{{ account }} as {{ qrLabel }}</figcaption>
        </figure>
      </div>

      <div class="wallet-lightning__foot">
        <span class="wallet-lightning__note">
          Bridged by <a href="https://v4v.app" target="_blank" rel="noopener noreferrer">v4v.app</a>.
          Keep invoices at {{ preferredSatsLabel }} sats or more; the fixed {{ feeFixedLabel }} sat
          fee eats small amounts. Keepsats are held by v4v.app, not by hive.ausbit.dev.
        </span>
        <q-btn
          flat
          dense
          no-caps
          color="primary"
          icon="history"
          label="Lightning activity"
          class="wallet-lightning__activity"
          @click="$emit('navigate')"
        />
      </div>
    </q-card>

    <lightning-receive-dialog
      v-if="receiveOpen"
      v-model="receiveOpen"
      :account="account"
      default-currency="hbd"
      :default-amount="loggedIn ? 1 : 5"
      @paid="$emit('paid')"
    />
    <lightning-pay-dialog
      v-if="loggedIn && payOpen"
      v-model="payOpen"
      :account="account"
      :liquid-hive="liquidHive"
      :liquid-hbd="liquidHbd"
      @queued="$emit('queued')"
    />
  </section>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { copyToClipboard } from 'quasar'
import { lightningAddress, lightningAddressQrUrl, normalizeFeePolicy } from 'src/services/lightning'
import { bridgeFeePolicy, getBridgeStatus } from 'src/services/v4vapp'

export default {
  name: 'LightningWalletPanel',
  components: {
    LightningReceiveDialog: defineAsyncComponent(() => import('components/lightning/LightningReceiveDialog.vue')),
    LightningPayDialog: defineAsyncComponent(() => import('components/lightning/LightningPayDialog.vue'))
  },
  props: {
    account: { type: String, required: true },
    loggedIn: { type: Boolean, default: false },
    liquidHive: { type: Number, default: 0 },
    liquidHbd: { type: Number, default: 0 }
  },
  emits: ['navigate', 'paid', 'queued'],
  data () {
    return {
      receiveOpen: false,
      payOpen: false,
      qrCurrency: 'hive',
      qrFailed: false,
      feePolicy: normalizeFeePolicy({})
    }
  },
  computed: {
    feeFixedLabel () {
      return Number(this.feePolicy.fixed || 0).toLocaleString('en-US')
    },
    preferredSatsLabel () {
      return Math.max(1000, Number(this.feePolicy.minSats) || 0).toLocaleString('en-US')
    },
    addressOptions () {
      return [
        { id: 'hive', label: 'HIVE', address: lightningAddress(this.account, 'hive') },
        { id: 'hbd', label: 'HBD', address: lightningAddress(this.account, 'hbd') },
        { id: 'sats', label: 'Sats', address: lightningAddress(this.account, 'sats') }
      ]
    },
    qrAddress () {
      return lightningAddress(this.account, this.qrCurrency)
    },
    qrLabel () {
      return this.addressOptions.find(option => option.id === this.qrCurrency)?.label || 'HIVE'
    },
    qrUrl () {
      return lightningAddressQrUrl(this.account, this.qrCurrency)
    }
  },
  watch: {
    account () {
      this.qrFailed = false
    },
    qrCurrency () {
      this.qrFailed = false
    }
  },
  mounted () {
    this.loadFeePolicy()
  },
  methods: {
    async loadFeePolicy () {
      try {
        const status = await getBridgeStatus()
        if (status?.config) this.feePolicy = bridgeFeePolicy(status)
      } catch {
        // Keep the labelled defaults.
      }
    },
    copyAddress (option) {
      Promise.resolve(copyToClipboard(option.address)).then(() => {
        this.$q.notify({ message: 'Copied ' + option.address, color: 'primary', icon: 'content_copy', timeout: 2000, position: 'top' })
      }).catch(() => {
        this.$q.notify({ message: 'Could not copy the address.', color: 'negative', timeout: 3000, position: 'top' })
      })
    }
  }
}
</script>

<style scoped>
.wallet-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.025);
}

.wallet-eyebrow {
  color: #78909c;
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.wallet-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid var(--border-subtle);
}

.wallet-card__title {
  margin: 0.12rem 0 0;
  color: #e4eaed;
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.25;
}

.wallet-lightning__actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.wallet-lightning__intro {
  max-width: 78ch;
  margin: 0.55rem 1rem 0;
  color: #90a4ae;
  font-size: 0.76rem;
  line-height: 1.45;
}

.wallet-lightning__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 1rem;
  padding: 0.75rem 1rem 0.85rem;
}

.wallet-lightning__addresses {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wallet-lightning__address {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.15rem 0.3rem 0.15rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
  transition: border-color 120ms ease, background-color 120ms ease;
}

.wallet-lightning__address:hover,
.wallet-lightning__address.is-active {
  border-color: rgba(79, 195, 247, 0.35);
  background: rgba(79, 195, 247, 0.05);
}

.wallet-lightning__address-main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.wallet-lightning__address-label {
  color: #78909c;
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.wallet-lightning__address-main code {
  max-width: 100%;
  overflow: hidden;
  color: #cfd8dc;
  font-family: monospace;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wallet-lightning__address.is-active .wallet-lightning__address-main code {
  color: #e4eaed;
}

.wallet-lightning__qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
}

.wallet-lightning__qr img {
  display: block;
  width: 132px;
  height: 132px;
  border-radius: var(--radius-sm);
  background: #fff;
  padding: 4px;
}

.wallet-lightning__qr-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  width: 132px;
  height: 132px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: #78909c;
  font-size: 0.64rem;
}

.wallet-lightning__qr figcaption {
  max-width: 132px;
  color: #78909c;
  font-size: 0.62rem;
  line-height: 1.3;
  text-align: center;
}

.wallet-lightning__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
  padding: 0.55rem 1rem 0.65rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-lightning__note {
  max-width: 78ch;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.4;
}

.wallet-lightning__note a {
  color: #4fc3f7;
}

.wallet-lightning__activity {
  flex: none;
}

@media (max-width: 699px) {
  .wallet-lightning__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .wallet-lightning__qr {
    justify-self: center;
  }
}

@media (max-width: 599px) {
  .wallet-card__head,
  .wallet-lightning__intro,
  .wallet-lightning__body,
  .wallet-lightning__foot {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-lightning__intro {
    margin-left: 0.8rem;
    margin-right: 0.8rem;
  }

  .wallet-lightning__address-main code {
    font-size: 0.72rem;
  }
}
</style>
