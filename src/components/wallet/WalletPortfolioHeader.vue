<template>
  <q-card flat bordered class="wallet-card wallet-portfolio">
    <q-card-section class="wallet-portfolio__head">
      <div class="wallet-portfolio__identity">
        <div class="wallet-eyebrow">Wallet portfolio</div>
        <h2 class="wallet-portfolio__title">Portfolio</h2>
        <div class="wallet-portfolio__sub">HIVE, Hive Power, HBD and savings for @{{ accountName }}</div>
      </div>

      <div class="wallet-portfolio__actions">
        <q-btn v-if="loggedIn" no-caps outline color="primary" icon="send" label="Send" aria-label="Send HIVE or HBD">
          <q-menu>
            <q-list bordered separator role="group">
              <q-item clickable @click="$emit('send-hive')">
                <q-item-section avatar><q-icon name="send" color="primary" /></q-item-section>
                <q-item-section>Send HIVE</q-item-section>
                <q-item-section side><q-badge color="orange-9" text-color="black">active</q-badge></q-item-section>
              </q-item>
              <q-item clickable @click="$emit('send-hbd')">
                <q-item-section avatar><q-icon name="send" color="primary" /></q-item-section>
                <q-item-section>Send HBD</q-item-section>
                <q-item-section side><q-badge color="orange-9" text-color="black">active</q-badge></q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn v-if="loggedIn" no-caps outline color="green" icon="arrow_upward" label="Power up" aria-label="Power up HIVE" @click="$emit('power-up')" />
        <q-btn flat round dense icon="refresh" aria-label="Refresh wallet" title="Refresh wallet" :loading="refreshing" @click="$emit('refresh')" />
      </div>
    </q-card-section>

    <div class="wallet-portfolio__value">
      <div class="wallet-portfolio__total" :title="pricesReady ? 'Total value of liquid, staked and saved balances' : 'Prices are still loading'">
        <template v-if="pricesReady">{{ totalLabel }}</template>
        <template v-else>—</template>
      </div>
      <div class="wallet-portfolio__chips">
        <span v-if="changePercent !== null" class="wallet-chip" :class="changePercent >= 0 ? 'wallet-chip--up' : 'wallet-chip--down'">
          <q-icon :name="changePercent >= 0 ? 'arrow_upward' : 'arrow_downward'" aria-hidden="true" />
          {{ Math.abs(changePercent).toFixed(2) }}% · 24h
        </span>
        <span v-else class="wallet-chip">24h change unavailable</span>
        <span class="wallet-chip" title="Hive Power annual percentage rate">
          <q-icon name="bolt" aria-hidden="true" />
          {{ hiveApr !== null ? hiveApr.toFixed(2) + '%' : '—' }} HP APR
        </span>
        <span class="wallet-chip" title="HBD savings annual percentage rate">
          <q-icon name="savings" aria-hidden="true" />
          {{ hbdApr ? hbdApr.toFixed(2) + '%' : '0.00%' }} HBD APR
        </span>
      </div>
    </div>

    <q-card-section class="wallet-portfolio__footer">
      <nav class="wallet-jump" aria-label="Wallet sections">
        <router-link
          v-for="tab in tabs"
          :key="tab.section"
          class="wallet-jump__link"
          :class="{ 'wallet-jump__link--active': tab.section === activeSection }"
          :to="{ path: $route.path, hash: '#' + tab.section }"
          :aria-current="tab.section === activeSection ? 'location' : undefined"
        >{{ tab.label }}</router-link>
      </nav>
      <span v-if="loggedIn" class="wallet-portfolio__note">
        <q-icon name="key" aria-hidden="true" />
        Wallet actions are queued with the required active key; rewards use your posting key.
      </span>
    </q-card-section>
  </q-card>
</template>

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

.wallet-portfolio__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 1rem 1.1rem 0.5rem;
}

.wallet-portfolio__title {
  margin: 0.12rem 0 0;
  color: #e4eaed;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
}

.wallet-portfolio__sub {
  margin-top: 0.2rem;
  color: #90a4ae;
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.wallet-portfolio__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.wallet-portfolio__value {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: 0 1.1rem 0.9rem;
}

.wallet-portfolio__total {
  color: #e4eaed;
  font-size: clamp(1.9rem, 3.4vw, 2.6rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.wallet-portfolio__chips {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.wallet-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.03);
  color: #b0bec5;
  font-size: 0.72rem;
  white-space: nowrap;
}

.wallet-chip--up {
  border-color: rgba(76, 175, 80, 0.35);
  color: #81c784;
}

.wallet-chip--down {
  border-color: rgba(239, 83, 80, 0.35);
  color: #e57373;
}

.wallet-portfolio__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  flex-wrap: wrap;
  padding: 0.55rem 1.1rem 0.65rem;
  border-top: 1px solid var(--border-subtle);
}

.wallet-jump {
  display: flex;
  align-items: center;
  gap: 0.35rem 0.85rem;
  flex-wrap: wrap;
}

.wallet-jump__link {
  padding: 0;
  border: 0;
  background: none;
  color: #4fc3f7;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.wallet-jump__link:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.wallet-jump__link--active {
  color: #e4eaed;
  text-decoration: underline;
  text-decoration-color: #4fc3f7;
  text-underline-offset: 4px;
}

.wallet-portfolio__note {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: #78909c;
  font-size: 0.7rem;
}

@media (max-width: 599px) {
  .wallet-portfolio__head,
  .wallet-portfolio__value {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-portfolio__footer {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .wallet-portfolio__total {
    font-size: 1.9rem;
  }
}
</style>

<script>
import { formatUsd } from 'src/services/wallet'

export default {
  name: 'WalletPortfolioHeader',
  props: {
    accountName: { type: String, required: true },
    totalUsd: { type: Number, default: 0 },
    pricesReady: { type: Boolean, default: false },
    changePercent: { type: Number, default: null },
    hiveApr: { type: Number, default: null },
    hbdApr: { type: Number, default: 0 },
    loggedIn: { type: Boolean, default: false },
    refreshing: { type: Boolean, default: false },
    hasMagi: { type: Boolean, default: false }
  },
  emits: ['refresh', 'send-hive', 'send-hbd', 'power-up', 'navigate'],
  computed: {
    // Rendered in page order; each one is a #hash the wallet page scrolls to,
    // so refresh and back keep the last navigation.
    tabs () {
      const tabs = [
        { section: 'overview', label: 'Overview' },
        { section: 'recent', label: 'Recent' },
        { section: 'activity', label: 'Activity' },
        { section: 'pending', label: 'Pending' },
        { section: 'tokens', label: 'Tokens' }
      ]
      if (this.hasMagi) tabs.push({ section: 'magi', label: 'Magi' })
      return tabs
    },
    totalLabel () {
      return formatUsd(this.totalUsd)
    },
    activeSection () {
      return String(this.$route.hash || '').replace(/^#/, '')
    }
  }
}
</script>
