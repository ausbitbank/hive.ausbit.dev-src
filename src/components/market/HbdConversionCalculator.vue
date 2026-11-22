<template>
  <q-card flat bordered class="home-card home-panel hbd-converter">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">
          <q-icon name="swap_horiz" size="14px" aria-hidden="true" />
          Calculator
        </div>
        <h3 class="home-panel__title">HIVE ↔ HBD converter</h3>
      </div>
      <q-badge color="blue-grey-8" text-color="white">Estimate only</q-badge>
    </q-card-section>

    <div class="hbd-converter__body">
      <div class="hbd-converter__controls">
        <q-select
          v-model="direction"
          :options="directions"
          dense
          outlined
          emit-value
          map-options
          options-dense
          label="Direction"
          aria-label="Conversion direction"
        />
        <q-select
          v-model="source"
          :options="sources"
          dense
          outlined
          emit-value
          map-options
          options-dense
          label="Price source"
          aria-label="Conversion price source"
        />
      </div>

      <div class="hbd-converter__amount">
        <q-input
          v-model="amount"
          type="number"
          min="0"
          step="0.001"
          inputmode="decimal"
          dense
          outlined
          label="Amount"
          :suffix="inputUnit"
          aria-label="Amount to convert"
        />
        <q-btn
          flat
          dense
          round
          icon="swap_vert"
          aria-label="Swap conversion direction"
          title="Swap direction"
          @click="swap"
        />
      </div>

      <div class="hbd-converter__result" aria-live="polite">
        <span class="hbd-converter__result-label">Estimated receive</span>
        <span class="hbd-converter__result-value">{{ outputLabel }}</span>
        <span class="hbd-converter__result-usd">{{ outputUsdLabel }}</span>
      </div>

      <dl class="hbd-converter__meta">
        <div class="hbd-converter__meta-row">
          <dt>Rate</dt>
          <dd>{{ rateLabel }}</dd>
        </div>
        <div class="hbd-converter__meta-row">
          <dt>Price source</dt>
          <dd>{{ sourceHint }}</dd>
        </div>
      </dl>

      <p v-if="!hasPrice" class="hbd-converter__note hbd-converter__note--warning">
        <q-icon name="warning" size="14px" aria-hidden="true" />
        Waiting for a market or median price.
      </p>
      <p v-else class="hbd-converter__note">
        <q-icon name="info" size="14px" aria-hidden="true" />
        Chain conversions settle over about 3.5 days at the median price. Review the
        transaction in your wallet before broadcasting with the active key.
      </p>

      <div class="hbd-converter__actions">
        <router-link :to="walletLink" class="hbd-converter__link">Open wallet conversions</router-link>
        <router-link to="/market" class="hbd-converter__link">Internal market</router-link>
      </div>
    </div>
  </q-card>
</template>

<script>
import {
  CONVERSION_DIRECTIONS,
  CONVERSION_SOURCES,
  conversionQuote,
  formatAmount,
  formatConversionRate,
  roundAmount
} from 'src/services/market'
import { formatUsd } from 'src/services/home'

export default {
  name: 'HbdConversionCalculator',
  props: {
    internalPrice: { type: Number, default: null },
    medianPrice: { type: Number, default: null },
    hiveUsd: { type: Number, default: null },
    hbdUsd: { type: Number, default: null },
    loggedIn: { type: Boolean, default: false },
    username: { type: String, default: '' }
  },
  data () {
    return {
      direction: 'hive-to-hbd',
      source: 'market',
      amount: 1000,
      directions: CONVERSION_DIRECTIONS,
      sources: CONVERSION_SOURCES
    }
  },
  computed: {
    activePrice () {
      const value = this.source === 'median' ? this.medianPrice : this.internalPrice
      const number = Number(value)
      return Number.isFinite(number) && number > 0 ? number : null
    },
    hasPrice () {
      return this.activePrice !== null
    },
    quote () {
      return conversionQuote({
        amount: this.amount,
        direction: this.direction,
        price: this.activePrice
      })
    },
    inputUnit () {
      return this.direction === 'hive-to-hbd' ? 'HIVE' : 'HBD'
    },
    outputUnit () {
      return this.direction === 'hive-to-hbd' ? 'HBD' : 'HIVE'
    },
    outputLabel () {
      return formatAmount(this.quote.output) + ' ' + this.outputUnit
    },
    outputUsdLabel () {
      const usd = Number(this.outputUnit === 'HBD' ? this.hbdUsd : this.hiveUsd)
      if (!Number.isFinite(usd) || !this.quote.valid) return '—'
      return '≈ ' + formatUsd(this.quote.output * usd)
    },
    rateLabel () {
      return formatConversionRate(this.direction, this.activePrice)
    },
    sourceHint () {
      if (this.source === 'median') return 'Witness median feed (HBD per HIVE)'
      return 'Hive internal market (HBD per HIVE)'
    },
    walletLink () {
      return this.loggedIn && this.username
        ? '/@' + encodeURIComponent(this.username) + '/wallet'
        : '/market'
    }
  },
  methods: {
    swap () {
      const next = this.direction === 'hive-to-hbd' ? 'hbd-to-hive' : 'hive-to-hbd'
      this.amount = roundAmount(this.quote.output, 3)
      this.direction = next
    }
  }
}
</script>

<style scoped>
.hbd-converter__body {
  padding: 0.8rem 1rem 0.75rem;
}

.hbd-converter__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.hbd-converter__amount {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: var(--space-2);
}

.hbd-converter__amount :deep(.q-field) {
  flex: 1;
}

.hbd-converter__result {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  margin-top: var(--space-3);
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.hbd-converter__result-label {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.hbd-converter__result-value {
  color: var(--c-text);
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.hbd-converter__result-usd {
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.hbd-converter__meta {
  margin: 0.55rem 0 0;
}

.hbd-converter__meta-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.32rem 0;
  border-top: 1px solid var(--border-subtle);
}

.hbd-converter__meta-row dt {
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.hbd-converter__meta-row dd {
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.76rem;
  font-weight: 600;
  text-align: right;
}

.hbd-converter__note {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0.55rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.45;
}

.hbd-converter__note--warning {
  color: var(--c-warning);
}

.hbd-converter__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  margin-top: 0.7rem;
  font-size: 0.76rem;
  font-weight: 600;
}

.hbd-converter__link {
  color: var(--c-link);
  text-decoration: none;
}

.hbd-converter__link:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

@media (max-width: 599px) {
  .hbd-converter__controls {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
