<template>
  <section class="wallet-pending-strip" aria-labelledby="wallet-attention-title">
    <div class="wallet-pending-strip__head">
      <h3 id="wallet-attention-title">
        <q-icon :name="hasPending ? 'notification_important' : 'check_circle'" :color="hasPending ? 'orange' : 'green'" aria-hidden="true" />
        {{ hasPending ? 'Needs attention' : 'Nothing pending' }}
      </h3>
      <q-btn v-if="hasPending" flat dense no-caps color="primary" label="Review pending" icon-right="arrow_forward" @click="$emit('navigate')" />
      <span v-else class="wallet-pending-strip__clear">No power-downs, withdrawals, orders, conversions or unclaimed rewards.</span>
    </div>

    <div v-if="hasPending" class="wallet-pending-strip__chips">
      <button v-if="powerdownHp > 0" type="button" class="wallet-attention" @click="$emit('navigate')">
        <q-icon name="arrow_circle_down" color="orange" aria-hidden="true" />
        <span>Power down</span>
        <strong>{{ tidyNumber(powerdownHp) }} HIVE/week</strong>
      </button>
      <button v-if="savingsCount > 0" type="button" class="wallet-attention" @click="$emit('navigate')">
        <q-icon name="savings" color="orange" aria-hidden="true" />
        <span>Savings withdrawals</span>
        <strong>{{ savingsCount }}</strong>
      </button>
      <button v-if="conversionCount > 0" type="button" class="wallet-attention" @click="$emit('navigate')">
        <q-icon name="cached" color="blue" aria-hidden="true" />
        <span>Conversions</span>
        <strong>{{ conversionCount }}</strong>
      </button>
      <button v-if="orderCount > 0" type="button" class="wallet-attention" @click="$emit('navigate')">
        <q-icon name="store" color="orange" aria-hidden="true" />
        <span>Open orders</span>
        <strong>{{ orderCount }}</strong>
      </button>
      <button v-if="rewardsUsd > 0" type="button" class="wallet-attention" @click="$emit('navigate')">
        <q-icon name="stars" color="amber" aria-hidden="true" />
        <span>Pending rewards</span>
        <strong>{{ usdLabel(rewardsUsd) }}</strong>
      </button>
      <button v-if="pendingInterest > 0.01" type="button" class="wallet-attention" @click="$emit('navigate')">
        <q-icon name="trending_up" color="green" aria-hidden="true" />
        <span>HBD interest</span>
        <strong>{{ tidyNumber(pendingInterest, 3) }} HBD</strong>
        <q-badge v-if="claimable" color="green-9">claimable</q-badge>
      </button>
    </div>
  </section>
</template>

<style scoped>
.wallet-pending-strip {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.wallet-pending-strip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.wallet-pending-strip__head h3 {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.82rem;
  font-weight: 600;
}

.wallet-pending-strip__clear {
  color: var(--c-text-faint);
  font-size: 0.75rem;
}

.wallet-pending-strip__chips {
  display: flex;
  align-items: stretch;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.wallet-attention {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-muted);
  font: inherit;
  font-size: 0.73rem;
  cursor: pointer;
}

.wallet-attention:hover {
  border-color: color-mix(in srgb, var(--c-link) 45%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.wallet-attention strong {
  color: var(--c-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 599px) {
  .wallet-pending-strip__chips {
    flex-direction: column;
  }

  .wallet-attention {
    justify-content: flex-start;
    width: 100%;
  }
}
</style>

<script>
import { formatUsd, tidyNumber } from 'src/services/wallet'

export default {
  name: 'WalletPendingStrip',
  props: {
    powerdownHp: { type: Number, default: 0 },
    savingsCount: { type: Number, default: 0 },
    conversionCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    rewardsUsd: { type: Number, default: 0 },
    pendingInterest: { type: Number, default: 0 },
    claimable: { type: Boolean, default: false }
  },
  emits: ['navigate'],
  computed: {
    hasPending () {
      return this.powerdownHp > 0 ||
        this.savingsCount > 0 ||
        this.conversionCount > 0 ||
        this.orderCount > 0 ||
        this.rewardsUsd > 0 ||
        this.pendingInterest > 0.01
    }
  },
  methods: {
    tidyNumber,
    usdLabel (value) {
      return formatUsd(value)
    }
  }
}
</script>
