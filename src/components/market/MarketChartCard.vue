<template>
  <q-card flat bordered class="home-card home-panel market-chart-card">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">
          <q-icon name="show_chart" size="14px" aria-hidden="true" />
          Price chart
        </div>
        <h2 class="home-panel__title">HIVE market chart</h2>
      </div>
      <div class="home-panel__actions">
        <a
          :href="externalChartUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="home-panel__link"
        >Open on TradingView</a>
      </div>
    </q-card-section>

    <div class="market-chart__toolbar">
      <q-select
        :model-value="pair"
        :options="pairOptions"
        dense
        outlined
        emit-value
        map-options
        options-dense
        class="market-chart__pair"
        aria-label="Trading pair"
        @update:model-value="$emit('update:pair', $event)"
      >
        <template #prepend>
          <q-icon name="currency_exchange" size="18px" aria-hidden="true" />
        </template>
      </q-select>

      <q-btn-toggle
        :model-value="interval"
        :options="intervalOptions"
        dense
        no-caps
        toggle-color="primary"
        color="grey-9"
        text-color="grey-4"
        class="market-chart__intervals"
        aria-label="Chart interval"
        @update:model-value="$emit('update:interval', $event)"
      />
    </div>

    <div class="market-chart__body">
      <trading-view-widget :options="chartOptions" />
    </div>

    <q-card-section class="home-panel__footer">
      <span>{{ pairLabel }} · {{ pairVenue }} · {{ intervalLabel }}</span>
      <span>Chart by TradingView · prices may be delayed</span>
    </q-card-section>
  </q-card>
</template>

<script>
import TradingViewWidget from 'components/TradingViewWidget.vue'
import {
  CHART_INTERVALS,
  TRADING_PAIRS,
  tradingPair,
  tradingViewChartUrl
} from 'src/services/market'

export default {
  name: 'MarketChartCard',
  components: { TradingViewWidget },
  props: {
    pair: { type: String, required: true },
    interval: { type: String, required: true },
    pairs: { type: Array, default: () => TRADING_PAIRS },
    intervals: { type: Array, default: () => CHART_INTERVALS }
  },
  emits: ['update:pair', 'update:interval'],
  computed: {
    pairOptions () {
      return this.pairs.map(item => ({
        value: item.value,
        label: item.label + ' · ' + item.venue
      }))
    },
    intervalOptions () {
      return this.intervals.map(item => ({ value: item.value, label: item.label }))
    },
    activePair () {
      return tradingPair(this.pair)
    },
    pairLabel () {
      return this.activePair?.label || 'HIVE / USDT'
    },
    pairVenue () {
      return this.activePair?.venue || 'Binance'
    },
    intervalLabel () {
      return this.intervals.find(item => item.value === this.interval)?.label || '4H'
    },
    externalChartUrl () {
      return tradingViewChartUrl(this.pair)
    },
    chartOptions () {
      return {
        symbol: this.pair,
        interval: this.interval,
        theme: 'dark',
        style: 8,
        locale: 'en',
        timezone: 'Etc/UTC',
        withdateranges: true,
        details: true,
        hide_top_toolbar: false,
        hide_side_toolbar: true,
        allow_symbol_change: false,
        save_image: false,
        toolbar_bg: '#1d1d1d',
        watchlist: this.pairs.map(item => item.value)
      }
    }
  }
}
</script>

<style scoped>
.market-chart-card {
  min-width: 0;
}

.market-chart__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.market-chart__pair {
  flex: 1 1 210px;
  min-width: 0;
  max-width: 320px;
}

.market-chart__intervals {
  flex: 0 0 auto;
}

.market-chart__body {
  min-width: 0;
  padding: 0.35rem;
}

@media (max-width: 599px) {
  .market-chart__toolbar {
    padding: 0.55rem 0.7rem;
  }

  .market-chart__pair {
    flex-basis: 100%;
    max-width: none;
  }

  .market-chart__intervals {
    width: 100%;
  }

  .market-chart__intervals :deep(.q-btn) {
    flex: 1;
  }

  .market-chart__body {
    padding: 0.2rem;
  }
}
</style>
