<template>
  <div class="dw-ke">
    <q-card-section class="home-panel__head dw-ke__head">
      <div>
        <div class="home-eyebrow">Context · not a score</div>
        <h2 class="home-panel__title">
          <template v-if="accountLabel">@{{ accountLabel }} accountability</template>
          <template v-else>Accountability view</template>
        </h2>
      </div>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        aria-label="Refresh accountability view"
        title="Refresh accountability view"
        :loading="loading || historyLoading"
        @click="refresh"
      />
    </q-card-section>

    <dashboard-widget-state
      :state="state"
      :error="stateError"
      guest-title="Log in to see this accountability view"
      guest-text="A contextual reward-retention ratio with its reward sources and limits, never a badge or ranking."
      @retry="refresh"
    />

    <template v-if="state === 'ready' || state === 'stale'">
      <p v-if="historyError" class="dw-ke__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ historyError }}</span>
      </p>

      <p v-if="summary.estimated" class="dw-ke__notice" role="status">
        <q-icon name="timeline" size="16px" aria-hidden="true" />
        <span>Estimated from the last {{ sampledLabel }} of reward history, scaled to {{ summary.windowDays }} days.</span>
      </p>

      <q-card-section class="dw-ke__hero">
        <div class="dw-ke__hero-main">
          <span class="dw-ke__hero-label">
            Kept-reward ratio
            <span v-if="summary.estimated" class="dw-ke__estimate-badge">estimated</span>
          </span>
          <strong class="dw-ke__hero-value">{{ summary.ratioLabel }}</strong>
          <span class="dw-ke__hero-sub">{{ summary.formula }}</span>
        </div>
        <dl class="dw-ke__hero-facts">
          <div>
            <dt>Counted rewards</dt>
            <dd>{{ rewardsLabel }}</dd>
          </div>
          <div>
            <dt>Staked HP</dt>
            <dd>{{ hpLabel(summary.stakedHp) }}</dd>
          </div>
          <div>
            <dt>Window</dt>
            <dd>{{ summary.windowDays }} days</dd>
          </div>
          <div v-if="summary.estimated || summary.coverageDays < summary.windowDays">
            <dt>Covered</dt>
            <dd>{{ sampledLabel }}</dd>
          </div>
        </dl>
      </q-card-section>

      <div v-if="!summary.hasRewards" class="dw-ke__empty">
        <q-icon name="receipt_long" size="22px" aria-hidden="true" />
        <div>
          <strong>No reward income {{ summary.estimated ? 'in the sampled history' : 'in this window' }}.</strong>
          <span>The ratio needs at least one counted reward. Try a longer window or refresh.</span>
        </div>
      </div>

      <q-card-section v-else-if="showBreakdown" class="dw-ke__breakdown">
        <h3 class="dw-ke__breakdown-title">Where the counted rewards came from</h3>
        <ul>
          <li v-for="source in summary.sources" :key="source.id">
            <span class="dw-ke__source">{{ source.label }}</span>
            <span class="dw-ke__source-value">{{ sourceLabel(source) }}</span>
          </li>
        </ul>
      </q-card-section>

      <div class="dw-ke__limits">
        <h3>Read this carefully</h3>
        <ul>
          <li v-for="limitation in summary.limitations" :key="limitation">{{ limitation }}</li>
        </ul>
      </div>

      <p v-if="summary.annualised !== null" class="dw-ke__annual">
        {{ summary.annualisedLabel }} — shown only to make the window comparable, not as a target or a forecast.
        <template v-if="summary.estimated">
          This rate is calculated from the {{ sampledLabel }} actually covered, not from the requested window.
        </template>
      </p>

      <q-card-section class="home-panel__footer dw-ke__footer">
        <router-link :to="'/@' + summary.accountName">Open @{{ summary.accountName }}</router-link>
        <router-link :to="'/@' + summary.accountName + '/wallet'">Wallet</router-link>
        <span>{{ historyLoading ? 'Reading history…' : 'Context, not a ranking' }}</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-ke {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-ke__head {
  align-items: flex-start;
}

.dw-ke__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-ke__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.7rem;
  padding-bottom: 0.4rem;
}

.dw-ke__hero-main {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.dw-ke__hero-label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-ke__estimate-badge {
  padding: 0 0.25rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--c-warning-soft);
  font-size: 0.58rem;
  letter-spacing: 0.02em;
  text-transform: none;
}

.dw-ke__hero-value {
  color: var(--c-text);
  font-size: 1.55rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-ke__hero-sub {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.35;
}

.dw-ke__hero-facts {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0;
  min-width: 0;
}

.dw-ke__hero-facts > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.72rem;
}

.dw-ke__hero-facts dt {
  color: var(--c-text-subtle);
}

.dw-ke__hero-facts dd {
  margin: 0;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dw-ke__empty {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.4rem 1rem 0.6rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.4;
}

.dw-ke__empty .q-icon {
  color: var(--c-text-faint);
  flex: none;
}

.dw-ke__empty strong {
  display: block;
  color: var(--c-text);
}

.dw-ke__empty span {
  display: block;
}

.dw-ke__breakdown {
  padding-top: 0.2rem;
  padding-bottom: 0.4rem;
}

.dw-ke__breakdown-title,
.dw-ke__limits h3 {
  margin: 0 0 0.25rem;
  color: var(--c-text-soft);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-ke__breakdown ul {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-ke__breakdown li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  padding-top: 0.2rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.74rem;
}

.dw-ke__breakdown li:first-child {
  padding-top: 0;
  border-top: 0;
}

.dw-ke__source {
  color: var(--c-text-subtle);
}

.dw-ke__source-value {
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dw-ke__limits {
  margin: 0 1rem 0.45rem;
  padding: 0.5rem 0.6rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
}

.dw-ke__limits ul {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-ke__annual {
  margin: 0;
  padding: 0 1rem 0.45rem;
  color: var(--c-text-faint);
  font-size: 0.67rem;
  line-height: 1.4;
}

.dw-ke__footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 599px) {
  .dw-ke__hero {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }

  .dw-ke__limits {
    margin-left: 0.7rem;
    margin-right: 0.7rem;
  }

  .dw-ke__annual {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}
</style>

<script>
import { markRaw } from 'vue'
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { fetchAccountRewardHistory } from 'src/services/chainData'
import { keRatioSummary } from 'src/services/keRatio'
import { formatUsd, tidyNumber } from 'src/services/wallet'

export default {
  name: 'WidgetKeRatio',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    windowDays: { type: Number, default: 90 },
    showBreakdown: { type: Boolean, default: true }
  },
  data () {
    return {
      history: [],
      historyMeta: {},
      historyAccount: '',
      historyLoading: false,
      historyError: '',
      requestToken: 0,
      forceNext: false
    }
  },
  computed: {
    accountLabel () {
      return this.summary.accountName || this.accountName
    },
    historyTruncated () {
      return Boolean(this.historyMeta.truncated)
    },
    summary () {
      return keRatioSummary({
        history: this.history,
        account: this.accountRecord,
        globalProps: this.globalProps,
        prices: this.prices,
        windowDays: this.windowDays,
        historyTruncated: this.historyTruncated
      })
    },
    sampledLabel () {
      const days = Number(this.summary.coverageDays)
      if (!Number.isFinite(days) || days <= 0) return '0 days'
      if (days < 1) return Math.max(1, Math.round(days * 24)) + ' hours'
      return days.toFixed(days < 10 ? 1 : 0) + ' days'
    },
    rewardsLabel () {
      if (this.summary.totalHiveValue <= 0) return '—'
      const hiveUsd = Number(this.prices?.hive?.usd)
      const label = Number.isFinite(hiveUsd) && hiveUsd > 0
        ? formatUsd(this.summary.totalHiveValue * hiveUsd)
        : tidyNumber(this.summary.totalHiveValue) + ' HIVE'
      return this.summary.estimated ? '≈ ' + label : label
    },
    state () {
      if (!this.targetAccount) return 'guest'
      if (this.loading && this.loaded) return this.loadError ? 'stale' : 'ready'
      if (this.loading) return 'loading'
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      if (!this.loaded) return 'loading'
      if (this.historyLoading && !this.history.length) return 'loading'
      if (this.historyError && !this.history.length) return 'error'
      return 'ready'
    },
    stateError () {
      return this.loadError || this.historyError
    }
  },
  watch: {
    windowDays () {
      if (!this.targetAccount) return
      // Rows from the old window cannot be combined with the new one.
      this.resetHistory(this.historyAccount || this.targetAccount)
      this.loadHistory(this.targetAccount)
    }
  },
  methods: {
    hpLabel (value) {
      return tidyNumber(value) + ' HP'
    },
    sourceLabel (source) {
      const parts = []
      if (source.hive > 0) parts.push(tidyNumber(source.hive) + ' HIVE')
      if (source.hbd > 0) parts.push(tidyNumber(source.hbd) + ' HBD')
      if (!parts.length) return '—'
      return (this.summary.estimated ? '≈ ' : '') + parts.join(' + ')
    },
    refresh () {
      if (!this.targetAccount) return
      this.forceNext = true
      this.reload()
    },
    applyAccountData (result) {
      const force = this.forceNext
      this.forceNext = false
      this.loadHistory(result.accountName || this.targetAccount, { force })
    },
    resetHistory (name) {
      this.historyAccount = name
      this.history = []
      this.historyMeta = {}
    },
    async loadHistory (name, { force = false } = {}) {
      if (!name) {
        this.resetHistory('')
        this.historyError = ''
        return
      }
      if (this.historyAccount && this.historyAccount !== name) this.resetHistory(name)
      else this.historyAccount = name

      const token = ++this.requestToken
      const requestKey = name + ':' + this.windowDays
      // Abort only when the request itself changed. A manual refresh of the same
      // key joins the in-flight read; aborting it would reject the joined call.
      if (this._historyController && this._historyRequestKey !== requestKey) {
        this._historyController.abort()
      }
      if (!this._historyController || this._historyRequestKey !== requestKey) {
        this._historyController = new AbortController()
        this._historyRequestKey = requestKey
      }
      const controller = this._historyController
      this.historyLoading = true
      this.historyError = ''
      try {
        const result = await fetchAccountRewardHistory(name, {
          windowDays: this.windowDays,
          force,
          signal: controller.signal
        })
        if (token !== this.requestToken) return
        const { rows, ...meta } = result
        // History rows are immutable here; skipping Vue's deep proxy matters
        // because a capped witness read can hold 10,000 entries.
        this.history = markRaw(Array.isArray(rows) ? rows : [])
        this.historyMeta = meta
        if (result.failed) {
          this.historyError = 'Reward history is incomplete: ' + result.failed +
            ' Showing the pages that loaded.'
        }
      } catch (error) {
        if (token !== this.requestToken || error?.name === 'AbortError') return
        console.error('Failed to load accountability history', error)
        // Keep the last good rows so a flaky node does not blank the card.
        this.historyError = this.history.length
          ? 'Could not refresh reward history. Showing the last loaded values.'
          : 'Reward history is unavailable, so this view cannot be computed.'
      } finally {
        if (token === this.requestToken) {
          this.historyLoading = false
          if (this._historyController === controller) this._historyController = null
        }
      }
    }
  }
}
</script>
