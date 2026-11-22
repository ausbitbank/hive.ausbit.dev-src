<template>
  <q-card flat bordered class="home-card home-panel savings-apr-card">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">
          <q-icon name="savings" size="14px" aria-hidden="true" />
          Yield
        </div>
        <h3 class="home-panel__title">HBD savings APR</h3>
      </div>
      <q-badge :color="apr === null ? 'grey' : apr > 0 ? 'green' : 'orange'" text-color="black">
        {{ apr === null ? 'Loading' : 'Paid monthly' }}
      </q-badge>
    </q-card-section>

    <div class="savings-apr__body">
      <div class="savings-apr__rate">
        <span class="savings-apr__number">{{ aprLabel }}</span>
        <span class="savings-apr__unit">APR</span>
      </div>
      <p class="savings-apr__intro">
        Set by witness consensus and paid from the HBD interest pool. Savings stays
        denominated in HBD, with a three-day withdrawal window.
      </p>

      <dl class="savings-apr__list">
        <div class="savings-apr__row">
          <dt>1,000 HBD earns</dt>
          <dd>{{ formatAmount(projection.annual) }} HBD / year</dd>
        </div>
        <div class="savings-apr__row">
          <dt>Monthly estimate</dt>
          <dd>{{ formatAmount(projection.monthly) }} HBD</dd>
        </div>
      </dl>
    </div>

    <q-card-section class="home-panel__footer">
      <span>Interest is applied to HBD savings balances</span>
      <router-link to="/hbd">How HBD works</router-link>
    </q-card-section>
  </q-card>
</template>

<script>
import { formatAmount, savingsProjection } from 'src/services/market'

export default {
  name: 'SavingsAprCard',
  props: {
    apr: { type: Number, default: null }
  },
  computed: {
    aprLabel () {
      return this.apr === null ? '—' : this.apr.toFixed(2) + '%'
    },
    projection () {
      return savingsProjection({ apr: this.apr, balance: 1000 })
    }
  },
  methods: {
    formatAmount
  }
}
</script>

<style scoped>
.savings-apr__body {
  padding: 0.8rem 1rem 0.7rem;
}

.savings-apr__rate {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.savings-apr__number {
  color: var(--c-positive);
  font-size: 1.9rem;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.savings-apr__unit {
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.savings-apr__intro {
  margin: 0.4rem 0 0.55rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.45;
}

.savings-apr__list {
  margin: 0;
}

.savings-apr__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.4rem 0;
  border-top: 1px solid var(--border-subtle);
}

.savings-apr__row dt {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.savings-apr__row dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
