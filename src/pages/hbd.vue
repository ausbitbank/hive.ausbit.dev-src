<template>
  <q-page class="hbd-page">
    <div class="hbd-shell">
      <page-header
        eyebrow="Stablecoin"
        title="Hive Backed Dollars"
        :live="!loading && propsReady"
        intro="HBD is Hive's dollar-pegged asset. Track the debt ratio, print rate, redemption conditions and savings yield, then compare the internal market with the median feed."
      >
        <template #actions>
          <q-btn no-caps outline color="primary" icon="show_chart" label="Markets" to="/markets#hbd-tools" />
          <q-btn no-caps outline color="primary" icon="swap_horiz" label="HBD stabilizer" to="/hbdstabilizer" />
          <q-btn flat round dense icon="refresh" aria-label="Refresh HBD data" title="Refresh HBD data" :loading="loading" @click="load({ force: true })" />
        </template>
      </page-header>

      <empty-state
        v-if="loadError && !propsReady"
        icon="error_outline"
        title="HBD data unavailable"
        :message="loadError"
        action-label="Retry"
        action-icon="refresh"
        @action="load({ force: true })"
      />

      <skeleton v-else-if="loading && !propsReady" :rows="5" label="Loading HBD data" />

      <template v-else>
        <div v-if="loadError" class="hbd-warning" role="status">
          <q-icon name="warning" size="15px" aria-hidden="true" />
          {{ loadError }}
          <q-btn flat dense no-caps color="primary" label="Retry" @click="load({ force: true })" />
        </div>

        <div class="ui-stat-grid">
          <stat-card
            label="HBD debt ratio"
            :value="debt.ratio === null ? '—' : formatPercent(debt.ratio, 2)"
            icon="account_balance"
            :status-label="debt.status.label"
            :status-color="debt.status.color"
            :progress="debt.ratio === null ? null : debt.ratio / debt.hardLimit"
            :aria-label="'HBD debt ratio ' + (debt.ratio === null ? 'unavailable' : formatPercent(debt.ratio, 2))"
            :hint="'Treasury-excluded HBD vs HIVE market cap · hard limit ' + debt.hardLimit + '%'"
          />
          <stat-card
            label="HIVE median price"
            :value="medianLabel"
            icon="price_change"
            hint="3.5-day witness median, used by chain conversions"
          />
          <stat-card
            label="HBD savings APR"
            :value="hbdApr === null ? '—' : hbdApr.toFixed(2) + '%'"
            icon="savings"
            :status-label="hbdApr ? 'Paid monthly' : 'No yield'"
            :status-color="hbdApr ? 'green' : 'orange'"
            :hint="'1,000 HBD ≈ ' + formatAmount(projection.annual, 2) + ' HBD/year'"
          />
          <stat-card
            label="Internal HIVE price"
            :value="internalHiveLabel"
            icon="store"
            :status-label="internalHbdLabel === '—' ? '' : 'HBD ' + internalHbdLabel"
            status-color="blue-grey-4"
            hint="Hive internal market, latest trade"
          />
          <stat-card
            label="HBD supply"
            :value="formatCompactNumber(debt.hbd, 1)"
            unit="HBD"
            icon="toll"
            :hint="'Excludes the @hive.fund treasury balance'"
          />
          <stat-card
            label="Print rate"
            :value="printRateLabel"
            icon="print"
            :status-label="printRate === 100 ? 'Full' : 'Reduced'"
            :status-color="printRate === 100 ? 'green' : 'orange'"
            hint="Share of HBD rewards the chain is printing"
          />
        </div>

        <div class="hbd-grid">
          <q-card flat bordered class="home-card home-panel">
            <q-card-section class="home-panel__head">
              <div>
                <div class="home-eyebrow">Redemption</div>
                <h2 class="home-panel__title">Haircut conditions</h2>
              </div>
              <q-badge :color="debt.status.color" text-color="black">{{ debt.status.label }}</q-badge>
            </q-card-section>
            <div class="hbd-copy">
              <p v-if="!haircutActive">
                Normal conditions apply. Each HBD can be redeemed for $1.00 of HIVE at the
                3.5-day median price. The current median is <strong>{{ medianLabel }}</strong>.
              </p>
              <p v-else>
                Debt is above the {{ debt.hardLimit }}% hard limit. Redemptions use the haircut
                formula below instead of the full $1.00 value.
              </p>
              <dl class="hbd-facts">
                <div class="hbd-facts__row">
                  <dt>HBD market cap (excl. treasury)</dt>
                  <dd>{{ formatCompactNumber(debt.hbd, 2) }} HBD</dd>
                </div>
                <div class="hbd-facts__row">
                  <dt>HIVE supply valued in HBD</dt>
                  <dd>{{ formatCompactNumber(debt.hiveAsHbd, 2) }} HBD</dd>
                </div>
                <div class="hbd-facts__row">
                  <dt>Haircut threshold price</dt>
                  <dd>{{ haircutPrice === null ? '—' : '$' + haircutPrice.toFixed(4) }}</dd>
                </div>
                <div class="hbd-facts__row">
                  <dt>Internal HBD implication</dt>
                  <dd>{{ internalHbdLabel }}</dd>
                </div>
              </dl>
              <p class="hbd-note">
                <q-icon name="info" size="14px" aria-hidden="true" />
                Debt ratio = HBD excluding treasury / (HBD excluding treasury + HIVE supply × median price).
              </p>
            </div>
            <q-card-section class="home-panel__footer">
              <span>@hive.fund treasury HBD is excluded</span>
              <router-link to="/hbdstabilizer">HBD stabilizer</router-link>
            </q-card-section>
          </q-card>

          <q-card flat bordered class="home-card home-panel">
            <q-card-section class="home-panel__head">
              <div>
                <div class="home-eyebrow">Yield</div>
                <h2 class="home-panel__title">HBD savings</h2>
              </div>
              <q-badge :color="hbdApr ? 'green' : 'orange'" text-color="black">{{ hbdApr ? 'Paid monthly' : 'No yield' }}</q-badge>
            </q-card-section>
            <div class="hbd-copy">
              <div class="hbd-apr">{{ hbdApr === null ? '—' : hbdApr.toFixed(2) + '%' }} <span>APR</span></div>
              <p>
                The savings rate is set by witness consensus and paid from the HBD interest pool.
                Savings stays denominated in HBD with a three-day withdrawal window.
              </p>
              <dl class="hbd-facts">
                <div class="hbd-facts__row">
                  <dt>1,000 HBD earns</dt>
                  <dd>{{ formatAmount(projection.annual, 2) }} HBD / year</dd>
                </div>
                <div class="hbd-facts__row">
                  <dt>Monthly estimate</dt>
                  <dd>{{ formatAmount(projection.monthly, 2) }} HBD</dd>
                </div>
              </dl>
              <router-link :to="walletLink" class="hbd-link">Open wallet savings</router-link>
            </div>
            <q-card-section class="home-panel__footer">
              <span>Interest is applied to HBD savings balances</span>
              <router-link to="/markets#hbd-tools">APR tools</router-link>
            </q-card-section>
          </q-card>
        </div>

        <q-card flat bordered class="home-card home-panel hbd-get-card">
          <q-card-section class="home-panel__head">
            <div>
              <div class="home-eyebrow">Get HBD</div>
              <h2 class="home-panel__title">Where to acquire HBD</h2>
            </div>
          </q-card-section>
          <div class="hbd-get-grid">
            <div class="hbd-get-item">
              <h3>Earn it</h3>
              <p>Publish original content and receive HBD as part of your post rewards.</p>
              <router-link to="/created">Browse posts</router-link>
            </div>
            <div class="hbd-get-item">
              <h3>Trade on-chain</h3>
              <p>Use the internal market or convert HIVE and HBD from your wallet.</p>
              <router-link to="/market">Internal market</router-link>
              <router-link :to="walletLink">Wallet conversions</router-link>
            </div>
          </div>
          <q-card-section class="home-panel__footer">
            <span>Median feed · internal market · savings APR</span>
            <span v-if="updatedLabel">{{ updatedLabel }}</span>
          </q-card-section>
        </q-card>
      </template>
    </div>
  </q-page>
</template>

<script>
import moment from 'src/utils/time'
import VueTimers from 'src/mixins/timers.js'
import PageHeader from 'components/ui/PageHeader.vue'
import StatCard from 'components/ui/StatCard.vue'
import EmptyState from 'components/ui/EmptyState.vue'
import Skeleton from 'components/ui/Skeleton.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchAccount, fetchMedianHistoryPrice, fetchTicker } from 'src/services/chainData'
import { formatCompactNumber } from 'src/services/home'
import { formatAmount, savingsApr, savingsProjection } from 'src/services/market'
import { hbdDebtRatio, medianPrice } from 'src/services/network'

export default {
  name: 'HbdPage',
  components: { PageHeader, StatCard, EmptyState, Skeleton },
  mixins: [VueTimers],
  timers: {
    refreshHbd: { time: 60000, autostart: true, repeat: true, immediate: true }
  },
  data () {
    return {
      medianHistory: null,
      ticker: null,
      fund: null,
      loading: true,
      loadError: '',
      lastUpdated: null
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    propsReady () {
      const props = this.globalProps
      return Boolean(props && props.current_supply && props.current_hbd_supply && props.hbd_interest_rate !== undefined)
    },
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    medianHiveUsd () {
      return medianPrice(this.medianHistory).hiveUsd
    },
    medianLabel () {
      return this.medianHiveUsd > 0 ? '$' + this.medianHiveUsd.toFixed(4) : '—'
    },
    treasuryHbd () {
      return this.fund?.hbd_balance || 0
    },
    debt () {
      return hbdDebtRatio({
        hbdSupply: this.globalProps?.current_hbd_supply,
        hiveSupply: this.globalProps?.current_supply,
        hiveUsd: this.medianHiveUsd,
        treasuryHbd: this.treasuryHbd
      })
    },
    haircutActive () {
      return this.debt.ratio !== null && this.debt.ratio >= this.debt.hardLimit
    },
    haircutPrice () {
      if (!this.propsReady || this.medianHiveUsd <= 0 || this.debt.hbd <= 0) return null
      const hiveSupply = Number(this.globalProps.current_supply.split(' ')[0])
      if (!Number.isFinite(hiveSupply) || hiveSupply <= 0) return null
      return (this.debt.hbd * (1 - this.debt.hardLimit / 100)) / ((this.debt.hardLimit / 100) * hiveSupply)
    },
    hbdApr () {
      return savingsApr(this.globalProps)
    },
    projection () {
      return savingsProjection({ apr: this.hbdApr, balance: 1000 })
    },
    internalHiveUsd () {
      const latest = Number(this.ticker?.latest)
      return Number.isFinite(latest) && latest > 0 ? latest : null
    },
    internalHiveLabel () {
      return this.internalHiveUsd === null ? '—' : '$' + this.internalHiveUsd.toFixed(4)
    },
    internalHbdUsd () {
      if (this.internalHiveUsd === null || this.medianHiveUsd <= 0) return null
      return this.medianHiveUsd / this.internalHiveUsd
    },
    internalHbdLabel () {
      return this.internalHbdUsd === null ? '—' : '$' + this.internalHbdUsd.toFixed(4)
    },
    printRate () {
      const rate = Number(this.globalProps?.hbd_print_rate)
      return Number.isFinite(rate) ? rate / 100 : 100
    },
    printRateLabel () {
      return this.printRate.toFixed(2) + '%'
    },
    walletLink () {
      return this.loggedInUser
        ? '/@' + encodeURIComponent(this.loggedInUser) + '/wallet'
        : '/market'
    },
    updatedLabel () {
      return this.lastUpdated ? moment.utc(this.lastUpdated).fromNow() : ''
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive Backed Dollars (HBD) — debt ratio, APR and peg',
      description: 'Track Hive Backed Dollars: debt ratio, print rate, haircut threshold, savings APR, median price and internal-market peg.',
      url: '/hbd'
    })
  },
  methods: {
    formatAmount,
    formatCompactNumber,
    formatPercent (value, digits) {
      return Number(value).toFixed(digits) + '%'
    },
    refreshHbd () {
      return this.load({ force: true })
    },
    async load ({ force = false } = {}) {
      this.loading = true
      this.loadError = ''
      try {
        const [median, ticker, fund] = await Promise.allSettled([
          fetchMedianHistoryPrice({ force }),
          fetchTicker({ force }),
          fetchAccount('hive.fund', { force }),
          this.$hiveStore.getGlobalProps({ force })
        ])
        if (median.status === 'fulfilled') this.medianHistory = median.value
        if (ticker.status === 'fulfilled') this.ticker = ticker.value
        if (fund.status === 'fulfilled') this.fund = fund.value
        if (!this.propsReady) {
          this.loadError = 'The chain did not return global properties. Please retry.'
        } else if (median.status === 'rejected' || ticker.status === 'rejected') {
          this.loadError = 'Some HBD data could not be loaded. Showing the latest available values.'
        } else {
          this.loadError = ''
        }
        this.lastUpdated = Date.now()
      } catch {
        this.loadError = 'Could not load HBD data. Please retry.'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.hbd-page {
  min-width: 0;
  padding-bottom: var(--space-6);
}

.hbd-shell {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.ui-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
  align-items: stretch;
  gap: var(--space-3);
}

.hbd-warning {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
  padding: 0.4rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--c-warning) 35%, transparent);
  border-radius: var(--radius-sm);
  color: var(--c-warning);
  font-size: 0.75rem;
}

.hbd-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.hbd-copy {
  padding: 0.8rem 1rem 0.8rem;
}

.hbd-copy p {
  margin: 0 0 0.65rem;
  color: var(--c-text-subtle);
  font-size: 0.81rem;
  line-height: 1.55;
}

.hbd-copy strong {
  color: var(--c-text);
}

.hbd-apr {
  color: var(--c-positive);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.hbd-apr span {
  color: var(--c-text-subtle);
  font-size: 0.76rem;
  letter-spacing: 0.05em;
}

.hbd-facts {
  margin: 0;
}

.hbd-facts__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.38rem 0;
  border-top: 1px solid var(--border-subtle);
}

.hbd-facts__row dt {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.hbd-facts__row dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.hbd-note {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0.7rem 0 0 !important;
  color: var(--c-text-faint) !important;
  font-size: 0.72rem !important;
}

.hbd-link {
  display: inline-block;
  color: var(--c-link);
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
}

.hbd-link:hover {
  text-decoration: underline;
}

.hbd-get-card {
  margin-top: var(--space-4);
}

.hbd-get-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-4);
  padding: 0.9rem 1rem 1rem;
}

.hbd-get-item h3 {
  margin: 0 0 0.25rem;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.hbd-get-item p {
  margin: 0 0 0.4rem;
  color: var(--c-text-faint);
  font-size: 0.76rem;
  line-height: 1.45;
}

.hbd-get-item a {
  display: block;
  color: var(--c-link);
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
}

.hbd-get-item a + a {
  margin-top: 0.25rem;
}

.hbd-get-item a:hover {
  text-decoration: underline;
}

@media (max-width: 799px) {
  .hbd-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 599px) {
  .hbd-shell {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>
