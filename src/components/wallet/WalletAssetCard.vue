<template>
  <q-card flat bordered class="wallet-asset">
    <q-card-section class="wallet-asset__body">
      <div class="wallet-asset__head">
        <q-avatar size="30px" class="wallet-asset__icon">
          <img v-if="logoSrc" :src="logoSrc" :alt="''" aria-hidden="true" />
          <q-icon v-else :name="icon" aria-hidden="true" />
        </q-avatar>
        <div class="wallet-asset__label">
          <h3>{{ label }}</h3>
          <q-badge v-if="badge" class="wallet-asset__badge" :color="badgeColor">{{ badge }}</q-badge>
        </div>
      </div>

      <div class="wallet-asset__balance">
        {{ tidyNumber(balance, 3) }} <span>{{ symbol }}</span>
      </div>

      <div class="wallet-asset__usd">
        <template v-if="pricesReady">{{ usdLabel }}</template>
        <template v-else>USD value loading…</template>
      </div>

      <p class="wallet-asset__hint">{{ hint }}</p>

      <div v-if="loggedIn && actions.length" class="wallet-asset__actions">
        <q-btn
          no-caps
          dense
          outline
          color="primary"
          icon="tune"
          label="Manage"
          :title="'Manage ' + label + ' (active key required)'"
          :aria-label="'Manage ' + label"
        >
          <q-menu>
            <q-list bordered separator role="group" style="min-width: 220px">
              <q-item
                v-for="action in actions"
                :key="action.id"
                clickable
                :aria-label="action.label + ' using ' + action.authority + ' key'"
                @click="$emit('action', action.id)"
              >
                <q-item-section avatar><q-icon :name="action.icon" /></q-item-section>
                <q-item-section>{{ action.label }}</q-item-section>
                <q-item-section side>
                  <q-badge :color="action.authority === 'posting' ? 'green-9' : 'orange-9'" :text-color="action.authority === 'posting' ? 'white' : 'black'">{{ action.authority }}</q-badge>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.wallet-asset {
  height: 100%;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.025);
}

.wallet-asset__body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  height: 100%;
  padding: 0.8rem 0.85rem;
}

.wallet-asset__head {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
}

.wallet-asset__icon {
  flex: none;
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.04);
}

.wallet-asset__label {
  min-width: 0;
}

.wallet-asset__label h3 {
  margin: 0;
  color: #b0bec5;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1.25;
  text-transform: uppercase;
}

.wallet-asset__badge {
  margin-top: 0.2rem;
  font-size: 0.6rem;
}

.wallet-asset__balance {
  margin-top: 0.45rem;
  color: #e4eaed;
  font-size: 1.18rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.wallet-asset__balance span {
  color: #90a4ae;
  font-size: 0.78rem;
  font-weight: 500;
}

.wallet-asset__usd {
  color: #78909c;
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

.wallet-asset__hint {
  margin: 0.25rem 0 0;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.35;
}

.wallet-asset__actions {
  margin-top: auto;
  padding-top: 0.55rem;
}

@media (max-width: 599px) {
  .wallet-asset__body {
    padding: 0.65rem 0.7rem;
  }

  .wallet-asset__balance {
    font-size: 1.05rem;
  }

  .wallet-asset__hint {
    font-size: 0.64rem;
  }
}
</style>

<script>
import { formatUsd, tidyNumber } from 'src/services/wallet'

export default {
  name: 'WalletAssetCard',
  props: {
    label: { type: String, required: true },
    symbol: { type: String, required: true },
    balance: { type: Number, default: 0 },
    usd: { type: Number, default: 0 },
    pricesReady: { type: Boolean, default: false },
    badge: { type: String, default: '' },
    badgeColor: { type: String, default: 'green-9' },
    hint: { type: String, default: '' },
    icon: { type: String, default: 'account_balance_wallet' },
    logoSrc: { type: String, default: '' },
    loggedIn: { type: Boolean, default: false },
    actions: { type: Array, default: () => [] }
  },
  emits: ['action'],
  methods: {
    tidyNumber
  },
  computed: {
    usdLabel () {
      return formatUsd(this.usd)
    }
  }
}
</script>
