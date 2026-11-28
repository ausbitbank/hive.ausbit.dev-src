<template>
  <div class="dw-ops">
    <q-card-section class="home-panel__head dw-ops__head">
      <div>
        <div class="home-eyebrow">Live operations</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }}</template>
          <template v-else>Operations</template>
        </h2>
        <div class="dw-ops__filters">{{ filterSummary }}</div>
      </div>
      <div class="home-panel__actions">
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh operations"
          title="Refresh operations"
          :loading="loading"
          @click="loadOperations()"
        />
        <q-btn
          v-if="accountName"
          flat
          dense
          round
          icon="open_in_new"
          aria-label="Open the account activity page"
          title="Open account activity"
          :to="accountPath"
        />
      </div>
    </q-card-section>

    <dashboard-widget-state
      v-if="!accountName"
      state="guest"
      guest-title="Give this widget an account"
      guest-text="Add an account in the widget settings, or log in to follow your own operations."
    />

    <template v-else>
      <div v-if="error" class="dw-ops__state" role="status">
        <q-icon name="cloud_off" size="20px" color="orange" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" label="Retry" @click="loadOperations()" />
      </div>

      <div v-else-if="loading && !entries.length" class="dw-ops__skeleton" aria-label="Loading operations">
        <div v-for="i in 5" :key="i" class="dw-ops__skeleton-row">
          <q-skeleton type="circle" size="24px" />
          <div class="dw-ops__skeleton-body">
            <q-skeleton type="text" width="42%" />
            <q-skeleton type="text" width="70%" />
          </div>
        </div>
      </div>

      <div v-else-if="!entries.length" class="dw-ops__state">
        <q-icon name="inbox" size="22px" aria-hidden="true" />
        <span>No matching operations in recent history.</span>
      </div>

      <ol v-else class="dw-ops__list">
        <li v-for="entry in rows" :key="entry.magi ? 'magi-' + entry.id : entry.index" class="dw-ops__row" :class="{ 'dw-ops__row--magi': entry.magi }">
          <q-icon :name="iconFor(entry.filter)" size="17px" class="dw-ops__icon" aria-hidden="true" />
          <div class="dw-ops__text">
            <span class="dw-ops__label">{{ entry.label }}</span>
            <span class="dw-ops__summary">{{ entry.summary }}</span>
          </div>
          <router-link v-if="entry.block" :to="'/b/' + entry.block" class="dw-ops__block" :aria-label="'Open block ' + entry.block">
            #{{ entry.block.toLocaleString('en-US') }}
          </router-link>
          <time class="dw-ops__time" :datetime="entry.timestamp">{{ entry.time }}</time>
        </li>
      </ol>

      <q-card-section class="home-panel__footer dw-ops__footer">
        <span>{{ pollingLabel }}</span>
        <span v-if="updatedLabel">Updated {{ updatedLabel }}</span>
        <span v-else>&nbsp;</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-ops {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dw-ops__head {
  align-items: flex-start;
}

.dw-ops__filters {
  margin-top: 0.15rem;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  line-height: 1.35;
}

.dw-ops__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-ops__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.48rem 1rem;
  border-top: 1px solid var(--border-subtle);
}

.dw-ops__row:first-child {
  border-top: 0;
}

.dw-ops__row--magi .dw-ops__icon {
  color: var(--c-accent);
}

.dw-ops__row--magi .dw-ops__label::after {
  content: 'Magi';
  margin-left: 0.35rem;
  padding: 0.02rem 0.3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--c-accent) 16%, transparent);
  color: var(--c-link-visited);
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  vertical-align: 1px;
}

.dw-ops__icon {
  flex: none;
  color: var(--c-link);
}

.dw-ops__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.dw-ops__label {
  color: var(--c-text);
  font-size: 0.78rem;
  font-weight: 600;
}

.dw-ops__summary {
  overflow: hidden;
  color: var(--c-text-subtle);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-ops__block,
.dw-ops__time {
  flex: none;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
  white-space: nowrap;
}

.dw-ops__block:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.dw-ops__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 1.1rem 0.9rem;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
}

.dw-ops__skeleton {
  display: flex;
  flex-direction: column;
}

.dw-ops__skeleton-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border-subtle);
}

.dw-ops__skeleton-row:first-child {
  border-top: 0;
}

.dw-ops__skeleton-body {
  flex: 1;
}

.dw-ops__footer {
  margin-top: auto;
}

@media (max-width: 599px) {
  .dw-ops__block {
    display: none;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { apiGetAccountHistory } from 'src/services/api'
import { filterLabel, filterOperations, latestOperations } from 'src/services/operationsFeed'
import { fetchMagiAccount } from 'src/services/magi'
import { pollWhileVisible } from 'src/services/polling'
import moment from 'src/utils/time'

const ICONS = {
  transfers: 'swap_horiz',
  market: 'storefront',
  witness: 'how_to_vote',
  votes: 'thumb_up',
  comments: 'forum',
  custom: 'bolt',
  governance: 'account_balance'
}

function stringList (value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export default {
  name: 'WidgetOperations',
  components: { DashboardWidgetState },
  props: {
    account: { type: String, default: '' },
    filters: { type: Array, default: () => [] },
    jsonIds: { type: [Array, String], default: () => [] },
    limit: { type: Number, default: 8 },
    pollSeconds: { type: Number, default: 30 },
    includeMagi: { type: Boolean, default: false }
  },
  data () {
    return {
      entries: [],
      magiEntries: [],
      loading: false,
      error: '',
      magiError: '',
      updatedAt: 0,
      nowTick: Date.now(),
      accountName: '',
      poller: null,
      clockTimer: null,
      requestToken: 0
    }
  },
  computed: {
    signedInUser () {
      return this.$hiveStore.user.username || ''
    },
    targetAccount () {
      const explicit = String(this.account || '').replace(/^@/, '').trim()
      return explicit || this.signedInUser
    },
    filterSummary () {
      const label = filterLabel(this.filters)
      const ids = stringList(this.jsonIds)
      const base = ids.length ? label + ' · ids: ' + ids.join(', ') : label
      return this.includeMagi ? base + ' · Magi' : base
    },
    pollingLabel () {
      const seconds = Number(this.pollSeconds)
      return seconds > 0 ? 'Refreshes every ' + seconds + 's' : 'Manual refresh'
    },
    updatedLabel () {
      if (!this.updatedAt) return ''
      return moment.utc(this.updatedAt).from(moment.utc(this.nowTick))
    },
    // Re-derive the relative times when the clock ticks so the footer and row
    // labels keep moving instead of freezing at "a few seconds ago".
    rows () {
      const now = moment.utc(this.nowTick)
      return this.entries.map(entry => ({
        ...entry,
        time: entry.timestamp ? moment.utc(entry.timestamp).from(now) : ''
      }))
    },
    accountPath () {
      return '/@' + this.accountName + '?filter=all'
    }
  },
  watch: {
    targetAccount () {
      this.requestToken += 1
      this.entries = []
      this.accountName = ''
      this.updatedAt = 0
      this.loadOperations()
      this.restartPolling()
    },
    filters () {
      this.loadOperations()
    },
    jsonIds () {
      this.loadOperations()
    },
    limit () {
      this.loadOperations()
    },
    pollSeconds () {
      this.restartPolling()
      if (Number(this.pollSeconds) > 0) this.loadOperations()
    },
    includeMagi () {
      this.loadOperations()
    }
  },
  mounted () {
    if (this.targetAccount) this.loadOperations()
    this.restartPolling()
    this.startClock()
  },
  beforeUnmount () {
    this.requestToken += 1
    this.stopPolling()
    this.stopClock()
  },
  methods: {
    iconFor (filter) {
      return ICONS[filter] || 'receipt_long'
    },
    async loadOperations () {
      const token = ++this.requestToken
      const name = this.targetAccount
      if (!name) {
        this.loading = false
        return
      }
      this.loading = true
      this.error = ''
      try {
        const pageSize = Math.max(100, Math.min(1000, Number(this.limit) * 8))
        const [history, magi] = await Promise.all([
          // Account history is a live view: bypass any intermediary HTTP cache
          // so the refresh button and poller always read the current page.
          apiGetAccountHistory(name, -1, pageSize, { cache: 'no-store' }),
          this.includeMagi ? fetchMagiAccount(name, { limit: 20 }).catch(() => null) : Promise.resolve(null)
        ])
        if (token !== this.requestToken) return
        const filtered = filterOperations(history, {
          filters: this.filters,
          jsonIds: stringList(this.jsonIds)
        })
        this.accountName = name
        this.magiEntries = magi?.transactions?.map(row => ({ ...row, magi: true })) || []
        this.magiError = this.includeMagi && !magi ? 'Magi Network unavailable' : ''
        const merged = filtered.concat(this.includeMagi ? this.magiEntries : [])
        // Account history arrives oldest-to-newest; the widget wants the latest
        // operations, so sort before slicing rather than showing the page head.
        this.entries = latestOperations(merged, { limit: this.limit })
        this.updatedAt = Date.now()
        this.nowTick = this.updatedAt
      } catch (error) {
        if (token !== this.requestToken) return
        console.error('Failed to load account operations', error)
        this.error = 'Could not load recent operations for @' + name + '.'
      } finally {
        if (token === this.requestToken) this.loading = false
      }
    },
    restartPolling () {
      this.stopPolling()
      const seconds = Number(this.pollSeconds)
      if (!seconds || seconds < 5) return
      this.poller = pollWhileVisible(() => this.loadOperations(), seconds * 1000, { immediate: false })
      this.poller.start()
    },
    stopPolling () {
      if (this.poller) {
        this.poller.stop()
        this.poller = null
      }
    },
    startClock () {
      this.stopClock()
      this.clockTimer = setInterval(() => {
        this.nowTick = Date.now()
      }, 30000)
    },
    stopClock () {
      if (this.clockTimer) {
        clearInterval(this.clockTimer)
        this.clockTimer = null
      }
    }
  }
}
</script>
