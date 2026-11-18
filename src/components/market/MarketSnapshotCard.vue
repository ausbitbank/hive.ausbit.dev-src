<template>
  <q-card flat bordered class="home-card home-panel market-snapshot">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Snapshot</div>
        <h2 class="home-panel__title">HIVE and HBD</h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh market snapshot"
        title="Refresh market snapshot"
        :loading="loading"
        @click="$emit('refresh')"
      />
    </q-card-section>

    <div class="market-snapshot__body">
      <dl class="market-snapshot__list">
        <div class="market-snapshot__row">
          <dt>HIVE price</dt>
          <dd>{{ hiveUsdLabel }}</dd>
        </div>
        <div class="market-snapshot__row">
          <dt>HIVE 24h</dt>
          <dd :class="changeClass">{{ changeLabel }}</dd>
        </div>
        <div class="market-snapshot__row">
          <dt>HBD price</dt>
          <dd>
            {{ hbdUsdLabel }}
            <q-badge
              v-if="peg && peg.primary"
              :color="peg.primary.color"
              text-color="black"
              class="market-snapshot__badge"
            >{{ peg.primary.label }}</q-badge>
          </dd>
        </div>
        <div class="market-snapshot__row">
          <dt>Internal HIVE</dt>
          <dd>{{ internalPriceLabel }} <span class="market-snapshot__unit">HBD</span></dd>
        </div>
        <div class="market-snapshot__row">
          <dt>Spread</dt>
          <dd>{{ spreadLabel }}</dd>
        </div>
        <div class="market-snapshot__row">
          <dt>24h volume</dt>
          <dd>{{ volumeLabel }}</dd>
        </div>
      </dl>

      <div class="market-snapshot__links">
        <router-link to="/market">Trade on the internal market</router-link>
        <router-link to="/markets#hbd-tools">HBD peg and converter</router-link>
      </div>
    </div>

    <q-card-section class="home-panel__footer">
      <span>External prices via CoinGecko</span>
      <span v-if="updatedLabel">{{ updatedLabel }}</span>
    </q-card-section>
  </q-card>
</template>

<script>
import {
  formatPrice,
  formatSignedPercent,
  formatVolume
} from 'src/services/market'
import { changeClass as marketChangeClass, formatUsd } from 'src/services/home'

export default {
  name: 'MarketSnapshotCard',
  props: {
    stats: { type: Object, default: () => ({}) },
    prices: { type: Object, default: null },
    peg: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    updatedLabel: { type: String, default: '' }
  },
  emits: ['refresh'],
  computed: {
    hiveUsd () {
      const price = Number(this.prices?.hive?.usd)
      return Number.isFinite(price) && price > 0 ? price : null
    },
    hiveUsdLabel () {
      if (this.hiveUsd !== null) return formatUsd(this.hiveUsd)
      // The internal market quotes HBD per HIVE; with HBD near $1 it is a
      // useful fallback while the external price request is unavailable.
      if (this.stats?.mid) return '≈ ' + formatUsd(this.stats.mid)
      return '—'
    },
    change () {
      const external = Number(this.prices?.hive?.usd_24h_change)
      if (Number.isFinite(external)) return external
      return Number.isFinite(this.stats?.change) ? this.stats.change : null
    },
    changeLabel () {
      return this.change === null ? '—' : formatSignedPercent(this.change)
    },
    changeClass () {
      return marketChangeClass(this.change)
    },
    hbdUsdLabel () {
      const price = Number(this.prices?.hive_dollar?.usd)
      if (Number.isFinite(price) && price > 0) return formatUsd(price)
      if (this.peg?.primary?.price) return formatUsd(this.peg.primary.price)
      return '—'
    },
    internalPriceLabel () {
      return this.stats?.latest ? formatPrice(this.stats.latest) : '—'
    },
    spreadLabel () {
      if (this.stats?.spread === null || this.stats?.spread === undefined) return '—'
      if (!this.stats.spreadPercent) return formatPrice(this.stats.spread)
      return formatPrice(this.stats.spread) + ' · ' + this.stats.spreadPercent.toFixed(2) + '%'
    },
    volumeLabel () {
      if (!this.stats?.hiveVolume && !this.stats?.hbdVolume) return '—'
      return formatVolume(this.stats.hiveVolume) + ' HIVE · ' + formatVolume(this.stats.hbdVolume) + ' HBD'
    }
  }
}
</script>

<style scoped>
.market-snapshot__body {
  padding: var(--space-1) var(--space-4) var(--space-2);
}

.market-snapshot__list {
  margin: 0;
}

.market-snapshot__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 7px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.market-snapshot__row:last-child {
  border-bottom: 0;
}

.market-snapshot__row dt {
  color: #78909c;
  font-size: 0.72rem;
}

.market-snapshot__row dd {
  margin: 0;
  color: #e4eaed;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.market-snapshot__unit {
  color: #78909c;
  font-size: 0.68rem;
  font-weight: 500;
}

.market-snapshot__badge {
  margin-left: 0.15rem;
}

.market-snapshot__links {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.65rem 0 0.15rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.market-snapshot__links a {
  color: #4fc3f7;
  text-decoration: none;
}

.market-snapshot__links a:hover {
  color: #81d4fa;
  text-decoration: underline;
}

.is-up {
  color: #66bb6a;
}

.is-down {
  color: #ef5350;
}

.is-flat {
  color: #90a4ae;
}
</style>
