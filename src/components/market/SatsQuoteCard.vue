<template>
  <q-card flat bordered class="home-card home-panel sats-quote">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">
          <q-icon name="bolt" size="14px" aria-hidden="true" />
          Bitcoin
        </div>
        <h3 class="home-panel__title">Sats quote</h3>
      </div>
      <q-badge v-if="badge.label" :color="badge.color" text-color="black">{{ badge.label }}</q-badge>
    </q-card-section>

    <div class="sats-quote__body">
      <p class="sats-quote__intro">
        The bridge's live rate for moving between sats and Hive. Lightning payments
        settle as HIVE or HBD from @v4vapp.
      </p>

      <dl class="sats-quote__list">
        <div v-for="row in rows" :key="row.key" class="sats-quote__row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>

      <div class="sats-quote__converter">
        <q-input
          v-model.number="satsInput"
          type="number"
          min="1"
          step="1"
          dense
          outlined
          label="Sats"
          aria-label="Sats to convert"
          @update:model-value="scheduleQuote"
        />
        <span class="sats-quote__result" aria-live="polite">{{ conversionLabel }}</span>
      </div>

      <p class="sats-quote__note">
        Estimates use the bridge's mid-market quote; its conversion fee is deducted
        when the payment settles. <router-link to="/lightning">Open Lightning</router-link>
      </p>
    </div>

    <q-card-section class="home-panel__footer">
      <span>{{ ageLabel }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" :loading="loading" @click="load" />
    </q-card-section>
  </q-card>
</template>

<script>
import { formatSats, satsRatesFromPrices } from 'src/services/lightning'
import { getBridgeQuote, getBridgeStatus, getSatsToHive } from 'src/services/v4vapp'

export default {
  name: 'SatsQuoteCard',
  data () {
    return {
      quote: null,
      status: null,
      loading: false,
      error: '',
      satsInput: 1000,
      conversion: null,
      timer: null
    }
  },
  computed: {
    rates () {
      if (!this.quote) return { satsPerHive: null, satsPerHbd: null }
      const hive = Number(this.quote?.v4vapp?.sats_Hive)
      const hbd = Number(this.quote?.v4vapp?.sats_HBD)
      if (Number.isFinite(hive) && Number.isFinite(hbd)) {
        return { satsPerHive: hive, satsPerHbd: hbd }
      }
      return satsRatesFromPrices(this.quote)
    },
    rows () {
      return [
        { key: 'hive', label: '1 HIVE', value: this.rateLabel(this.rates.satsPerHive) },
        { key: 'hbd', label: '1 HBD', value: this.rateLabel(this.rates.satsPerHbd) },
        {
          key: 'sats',
          label: '1,000 sats',
          value: this.quote
            ? this.conversionValue(1000)
            : '—'
        }
      ]
    },
    badge () {
      if (this.error) return { label: 'Unavailable', color: 'orange-9' }
      if (!this.quote) return { label: '', color: 'grey' }
      if (this.quote.stale === true) return { label: 'Stale', color: 'orange-9' }
      return { label: 'Live', color: 'green' }
    },
    ageLabel () {
      if (!this.quote) return 'Quote unavailable'
      const age = Number(this.quote.quote_age_s)
      if (!Number.isFinite(age)) return 'Quote age unknown'
      return 'Quote ' + Math.round(age) + 's old'
    },
    conversionLabel () {
      if (!Number(this.satsInput)) return 'Enter sats to convert'
      return this.conversionValue(this.satsInput)
    }
  },
  mounted () {
    this.load()
  },
  beforeUnmount () {
    if (this.timer) clearTimeout(this.timer)
  },
  methods: {
    rateLabel (value) {
      const rate = Number(value)
      return Number.isFinite(rate) && rate > 0 ? '≈ ' + formatSats(Math.round(rate)) : '—'
    },
    conversionValue (sats) {
      const amount = Number(sats)
      const hive = Number(this.conversion?.HIVE)
      const hbd = Number(this.conversion?.HBD)
      if (Number.isFinite(hbd) && hbd > 0 && Number.isFinite(hive) && hive > 0) {
        return '≈ ' + hbd.toFixed(3) + ' HBD · ' + hive.toFixed(3) + ' HIVE'
      }
      // Before the fixed quote arrives, use the mid-market rates.
      const hbdRate = Number(this.rates.satsPerHbd)
      const hiveRate = Number(this.rates.satsPerHive)
      const parts = []
      if (hbdRate > 0) parts.push((amount / hbdRate).toFixed(3) + ' HBD')
      if (hiveRate > 0) parts.push((amount / hiveRate).toFixed(3) + ' HIVE')
      return parts.length ? '≈ ' + parts.join(' · ') : '—'
    },
    async load () {
      this.loading = true
      this.error = ''
      try {
        const [quoteResult, statusResult] = await Promise.allSettled([
          getBridgeQuote({ force: true }),
          getBridgeStatus()
        ])
        this.quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null
        this.status = statusResult.status === 'fulfilled' ? statusResult.value : null
        if (!this.quote) this.error = 'The bridge quote is unavailable.'
      } catch (error) {
        this.error = error?.message || 'The bridge quote is unavailable.'
      } finally {
        this.loading = false
        this.scheduleQuote()
      }
    },
    scheduleQuote () {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.loadConversion(), 300)
    },
    async loadConversion () {
      const sats = Math.round(Number(this.satsInput) || 0)
      if (!sats) {
        this.conversion = null
        return
      }
      try {
        this.conversion = await getSatsToHive(sats)
      } catch {
        this.conversion = null
      }
    }
  }
}
</script>

<style scoped>
.sats-quote__body {
  padding: 0.75rem 1rem 0.7rem;
}

.sats-quote__intro {
  margin: 0 0 0.4rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.45;
}

.sats-quote__list {
  margin: 0;
}

.sats-quote__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.4rem 0;
  border-top: 1px solid var(--border-subtle);
}

.sats-quote__row dt {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.sats-quote__row dd {
  margin: 0;
  color: var(--c-warning-soft);
  font-size: 0.78rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sats-quote__converter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
}

.sats-quote__converter :deep(.q-field) {
  flex: 0 1 130px;
}

.sats-quote__result {
  color: var(--c-text);
  font-size: 0.74rem;
  font-weight: 600;
}

.sats-quote__note {
  margin: 0.5rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.45;
}

.sats-quote__note a {
  color: var(--c-warning-soft);
}
</style>
