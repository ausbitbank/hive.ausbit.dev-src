<template>
  <section class="wallet-section" aria-labelledby="wallet-lightning-title">
    <div class="wallet-section__head">
      <div>
        <div class="wallet-eyebrow">Sats bridge</div>
        <h2 id="wallet-lightning-title" class="wallet-section__title">Lightning</h2>
      </div>
      <span class="wallet-section__hint">Receive sats as HIVE/HBD or pay any Lightning invoice</span>
    </div>

    <div class="lightning-wallet-grid">
      <lightning-address-card :account="account" compact :show-qr="true" />

      <q-card flat bordered class="lightning-wallet-card">
        <q-card-section class="lightning-wallet-card__body">
          <div class="lightning-wallet-card__copy">
            <h3 class="lightning-wallet-card__title">{{ loggedIn ? 'Your Lightning wallet' : 'Support this account with sats' }}</h3>
            <p>
              <template v-if="loggedIn">
                Create an invoice to receive sats as HIVE or HBD, or pay a Lightning invoice with
                the HBD/HIVE in this wallet. Payments queue for review and never auto-send.
              </template>
              <template v-else>
                Any Lightning wallet can pay this account's address. The bridge settles the payment
                as a Hive transfer from @v4vapp.
              </template>
            </p>
          </div>

          <div class="lightning-wallet-card__actions">
            <q-btn
              unelevated
              no-caps
              color="amber-9"
              text-color="black"
              icon="bolt"
              :label="loggedIn ? 'Receive sats' : 'Tip with Lightning'"
              @click="receiveOpen = true"
            />
            <q-btn
              v-if="loggedIn"
              outline
              no-caps
              color="amber-9"
              icon="send"
              label="Pay a Lightning invoice"
              @click="payOpen = true"
            />
            <q-btn
              flat
              no-caps
              color="blue-grey-4"
              icon="receipt_long"
              label="Lightning activity"
              @click="$emit('navigate')"
            />
          </div>

          <p class="lightning-wallet-card__note">
            Bridged by <a href="https://v4v.app" target="_blank" rel="noopener noreferrer">v4v.app</a>.
            A fixed ~50 sat fee applies; small invoices are expensive. Keepsats are held by
            v4v.app, not by hive.ausbit.dev.
          </p>
        </q-card-section>
      </q-card>
    </div>

    <lightning-receive-dialog
      v-if="receiveOpen"
      v-model="receiveOpen"
      :account="account"
      :default-currency="loggedIn ? 'hbd' : 'hbd'"
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
import LightningAddressCard from 'components/lightning/LightningAddressCard.vue'

export default {
  name: 'LightningWalletPanel',
  components: {
    LightningAddressCard,
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
      payOpen: false
    }
  }
}
</script>

<style scoped>
.lightning-wallet-grid {
  display: grid;
  grid-template-columns: minmax(250px, 0.8fr) minmax(0, 1.2fr);
  gap: var(--space-3);
  align-items: stretch;
}

.lightning-wallet-card {
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at 96% 0%, rgba(255, 193, 7, 0.07), transparent 42%),
    rgba(255, 255, 255, 0.025);
}

.lightning-wallet-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  height: 100%;
  padding: var(--space-3) var(--space-4);
}

.lightning-wallet-card__copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lightning-wallet-card__title {
  margin: 0;
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
}

.lightning-wallet-card__copy p {
  margin: 0;
  color: #90a4ae;
  font-size: 0.74rem;
  line-height: 1.45;
}

.lightning-wallet-card__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 0.4rem;
}

.lightning-wallet-card__note {
  margin: 0;
  color: #78909c;
  font-size: 0.66rem;
  line-height: 1.4;
}

.lightning-wallet-card__note a {
  color: #ffe082;
}

@media (max-width: 760px) {
  .lightning-wallet-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
