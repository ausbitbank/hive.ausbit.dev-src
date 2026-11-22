<template>
  <q-page class="delegations-page">
    <div class="delegations-wrap">
      <header class="delegations-head">
        <div>
          <h1 class="delegations-title">@{{ username }} delegations</h1>
          <p class="delegations-intro">
            Outgoing and incoming Hive Power delegations, the current effective balance and recent delegation changes.
          </p>
        </div>
        <div class="delegations-actions">
          <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" :loading="loading" @click="load" />
          <q-btn flat dense no-caps icon="person" label="Account" :to="'/@' + username" />
          <q-btn flat dense no-caps icon="account_balance_wallet" label="Wallet" :to="'/@' + username + '/wallet'" />
        </div>
      </header>

      <q-card v-if="error" flat bordered class="delegations-state delegations-state--error">
        <q-icon name="error_outline" size="2em" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="load" />
      </q-card>

      <div v-else-if="loading && !outgoing.length && !inbound.length" class="delegations-loading">
        <q-skeleton type="rect" height="96px" />
        <q-skeleton type="rect" height="180px" />
        <q-skeleton type="rect" height="180px" />
      </div>

      <template v-else>
        <section class="delegations-stats" aria-label="Delegation summary">
          <div class="delegation-stat">
            <span class="delegation-stat__label">Delegated out</span>
            <strong class="delegation-stat__value">{{ formatHp(summary.outgoingHp) }}</strong>
            <small>{{ summary.outgoingCount }} delegation{{ summary.outgoingCount === 1 ? '' : 's' }} · {{ formatPercent(summary.outgoingShare * 100) }} of owned HP</small>
          </div>
          <div class="delegation-stat">
            <span class="delegation-stat__label">Received in</span>
            <strong class="delegation-stat__value">{{ formatHp(summary.inboundHp) }}</strong>
            <small>{{ summary.inboundCount }} delegator{{ summary.inboundCount === 1 ? '' : 's' }} · {{ formatPercent(summary.inboundShare * 100) }} of effective HP</small>
          </div>
          <div class="delegation-stat">
            <span class="delegation-stat__label">Net delegation</span>
            <strong class="delegation-stat__value" :class="summary.netHp < 0 ? 'delegation-stat__value--negative' : ''">{{ formatSignedHp(summary.netHp) }}</strong>
            <small>Incoming minus outgoing</small>
          </div>
          <div class="delegation-stat">
            <span class="delegation-stat__label">Effective HP</span>
            <strong class="delegation-stat__value">{{ formatHp(effectiveHp) }}</strong>
            <small>Owned, received, delegated and powering down</small>
          </div>
        </section>

        <div class="delegations-grid">
          <section class="delegations-card" aria-labelledby="outgoing-title">
            <div class="delegations-card__head">
              <div>
                <div class="delegations-card__eyebrow">Outgoing</div>
                <h2 id="outgoing-title" class="delegations-card__title">Delegated to others</h2>
              </div>
              <q-badge color="blue-grey-9">{{ summary.outgoingCount }}</q-badge>
            </div>

            <div v-if="outgoing.length === 0" class="delegations-empty">
              <q-icon name="link_off" size="1.6em" color="grey" aria-hidden="true" />
              <span>No outgoing delegations. Hive Power stays in this account until it delegates.</span>
            </div>

            <div v-else class="delegations-table-wrap">
              <table class="delegations-table">
                <caption class="sr-only">Outgoing delegations ordered by amount</caption>
                <thead>
                  <tr>
                    <th scope="col">Delegatee</th>
                    <th scope="col" class="delegations-table__num">Amount</th>
                    <th scope="col">Since</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in outgoing" :key="row.delegatee">
                    <th scope="row"><router-link :to="'/@' + row.delegatee">@{{ row.delegatee }}</router-link></th>
                    <td class="delegations-table__num">
                      {{ formatHp(row.hp) }}
                      <span class="delegations-table__vests">{{ formatVests(row.vests) }}</span>
                    </td>
                    <td class="delegations-table__time">{{ relativeTime(row.min_delegation_time) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="delegations-card" aria-labelledby="inbound-title">
            <div class="delegations-card__head">
              <div>
                <div class="delegations-card__eyebrow">Incoming</div>
                <h2 id="inbound-title" class="delegations-card__title">Delegated to this account</h2>
              </div>
              <q-badge color="blue-grey-9">{{ summary.inboundCount }}</q-badge>
            </div>

            <div v-if="inbound.length === 0" class="delegations-empty">
              <q-icon name="link" size="1.6em" color="grey" aria-hidden="true" />
              <span>No current inbound delegations were found in the recent account history.</span>
            </div>

            <div v-else class="delegations-table-wrap">
              <table class="delegations-table">
                <caption class="sr-only">Incoming delegations ordered by amount</caption>
                <thead>
                  <tr>
                    <th scope="col">Delegator</th>
                    <th scope="col" class="delegations-table__num">Amount</th>
                    <th scope="col">Since</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in inbound" :key="row.delegator">
                    <th scope="row"><router-link :to="'/@' + row.delegator">@{{ row.delegator }}</router-link></th>
                    <td class="delegations-table__num">
                      {{ formatHp(row.hp) }}
                      <span class="delegations-table__vests">{{ formatVests(row.vests) }}</span>
                    </td>
                    <td class="delegations-table__time">{{ relativeTime(row.min_delegation_time) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="delegations-note">
              Hive has no delegatee index, so incoming delegations are reconstructed from the last
              {{ historyLimit.toLocaleString('en-US') }} account operations and verified against the most recent delegators' current lists.
            </p>
          </section>
        </div>

        <section class="delegations-card delegations-changes" aria-labelledby="changes-title">
          <div class="delegations-card__head">
            <div>
              <div class="delegations-card__eyebrow">History</div>
              <h2 id="changes-title" class="delegations-card__title">Recent delegation changes</h2>
            </div>
            <q-badge color="blue-grey-9">{{ events.length }}</q-badge>
          </div>

          <div v-if="events.length === 0" class="delegations-empty">
            <q-icon name="history" size="1.6em" color="grey" aria-hidden="true" />
            <span>No delegation operations were found in the recent history window.</span>
          </div>

          <ul v-else class="delegations-timeline">
            <li v-for="event in events.slice(0, 20)" :key="event.trxId + '-' + event.index">
              <span class="delegations-timeline__badge" :class="'delegations-timeline__badge--' + event.direction">
                {{ directionLabel(event.direction) }}
              </span>
              <div class="delegations-timeline__body">
                <div class="delegations-timeline__title">
                  <template v-if="event.direction === 'in'">
                    From <router-link :to="'/@' + event.counterparty">@{{ event.counterparty }}</router-link>
                  </template>
                  <template v-else-if="event.direction === 'out'">
                    To <router-link :to="'/@' + event.counterparty">@{{ event.counterparty }}</router-link>
                  </template>
                  <template v-else>
                    Returned to this account
                  </template>
                  <span class="delegations-timeline__amount">{{ formatHp(vestsToHp(event.vests)) }}</span>
                </div>
                <div class="delegations-timeline__meta">
                  {{ relativeTime(event.timestamp) }}
                  <template v-if="event.trxId">
                    · <router-link :to="'/tx/' + event.trxId">transaction</router-link>
                  </template>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </q-page>
</template>

<script>
import { setPageMeta } from 'src/utils/pageMeta'
import {
  fetchDelegationHistory,
  listOutgoingDelegations,
  resolveInboundDelegations,
  summarizeDelegations
} from 'src/services/delegations'
import { formatHp, relativeTime, vestsToHp as vestsToHpValue } from 'src/services/witnesses'

export default {
  name: 'DelegationsPage',
  data () {
    return {
      username: this.$route.params.username || '',
      outgoing: [],
      inbound: [],
      events: [],
      loading: true,
      error: '',
      historyLimit: 1000
    }
  },
  computed: {
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    summary () {
      return summarizeDelegations(this.outgoing, this.inbound, this.globalProps, this.account)
    },
    effectiveHp () {
      return vestsToHpValue(
        Math.max(0,
          Number(String(this.account?.vesting_shares || '0').split(' ')[0]) +
          Number(String(this.account?.received_vesting_shares || '0').split(' ')[0]) -
          Number(String(this.account?.delegated_vesting_shares || '0').split(' ')[0]) -
          Number(String(this.account?.vesting_withdraw_rate || '0').split(' ')[0])
        ),
        this.globalProps
      )
    }
  },
  watch: {
    '$route.params.username' () {
      this.username = this.$route.params.username || ''
      this.load()
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    formatHp,
    relativeTime,
    vestsToHp (vests) {
      return vestsToHpValue(vests, this.globalProps)
    },
    formatVests (vests) {
      return Number(vests || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VESTS'
    },
    formatPercent (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(1) + '%' : '0%'
    },
    formatSignedHp (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '—'
      return (number >= 0 ? '+' : '−') + formatHp(Math.abs(number))
    },
    directionLabel (direction) {
      if (direction === 'in') return 'in'
      if (direction === 'out') return 'out'
      return 'return'
    },
    updateMeta () {
      setPageMeta({
        title: '@' + this.username + ' delegations — Hive Power in and out',
        description: 'Explore incoming and outgoing Hive Power delegations for @' + this.username + ', including effective HP and recent delegation changes.',
        url: '/@' + this.username + '/delegations'
      })
    },
    async load () {
      if (!this.username) return
      this.loading = true
      this.error = ''
      this.updateMeta()

      try {
        if (!this.globalProps || this.globalProps.empty) await this.$hiveStore.getGlobalProps()
        if (this.account === undefined) await this.$hiveStore.getAccount(this.username)

        const [outgoingResult, eventsResult] = await Promise.allSettled([
          listOutgoingDelegations(this.username, { limit: 1000 }),
          fetchDelegationHistory(this.username, { limit: this.historyLimit })
        ])

        this.outgoing = outgoingResult.status === 'fulfilled' ? outgoingResult.value : []
        const events = eventsResult.status === 'fulfilled' ? eventsResult.value : []
        this.events = events

        if (outgoingResult.status !== 'fulfilled' && eventsResult.status !== 'fulfilled') {
          throw new Error('delegation load failed')
        }

        this.inbound = await resolveInboundDelegations(this.username, events, { concurrency: 4 })
      } catch {
        this.error = 'Could not load delegations for @' + this.username + '. Please try again.'
        this.$q.notify({ type: 'negative', message: 'Failed to load delegations' })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.delegations-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.delegations-wrap {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.delegations-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}

.delegations-title {
  margin: 0;
  font-size: var(--font-page-title);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.delegations-intro {
  margin: 0.35rem 0 0;
  max-width: 72ch;
  color: var(--c-text-subtle);
  font-size: 0.86rem;
}

.delegations-actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-wrap: wrap;
}

.delegations-state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--c-text-muted);
}

.delegations-state--error {
  color: var(--c-warning);
}

.delegations-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.delegations-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.delegation-stat {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.delegation-stat__label {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.delegation-stat__value {
  color: var(--c-text);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.delegation-stat__value--negative {
  color: var(--c-warning-soft);
}

.delegation-stat small {
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.3;
}

.delegations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.delegations-card {
  min-width: 0;
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.delegations-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.delegations-card__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.delegations-card__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.delegations-empty {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0;
  color: var(--c-text-subtle);
  font-size: 0.78rem;
  line-height: 1.4;
}

.delegations-table-wrap {
  overflow-x: auto;
}

.delegations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.delegations-table th,
.delegations-table td {
  padding: 0.38rem 0.2rem;
  border-top: 1px solid var(--border-subtle);
  text-align: left;
  vertical-align: top;
}

.delegations-table thead th {
  border-top: 0;
  color: var(--c-text-faint);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.delegations-table tbody th {
  font-weight: 500;
}

.delegations-table a {
  color: var(--c-link);
  text-decoration: none;
}

.delegations-table a:hover {
  text-decoration: underline;
}

.delegations-table__num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.delegations-table__vests {
  display: block;
  color: var(--c-text-faint);
  font-size: 0.62rem;
}

.delegations-table__time {
  color: var(--c-text-subtle);
  font-size: 0.72rem;
  white-space: nowrap;
}

.delegations-note {
  margin: 0.55rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.68rem;
  line-height: 1.4;
}

.delegations-changes {
  margin-top: 0;
}

.delegations-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.delegations-timeline li {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.4rem 0;
  border-top: 1px solid var(--border-subtle);
}

.delegations-timeline li:first-child {
  border-top: 0;
}

.delegations-timeline__badge {
  flex: none;
  min-width: 3.1rem;
  padding: 0.08rem 0.35rem;
  border-radius: var(--radius-pill);
  font-size: 0.62rem;
  text-align: center;
  text-transform: uppercase;
}

.delegations-timeline__badge--in {
  background: color-mix(in srgb, var(--c-positive) 16%, transparent);
  color: var(--c-positive);
}

.delegations-timeline__badge--out {
  background: color-mix(in srgb, var(--c-warning) 16%, transparent);
  color: var(--c-warning-soft);
}

.delegations-timeline__badge--return {
  background: color-mix(in srgb, var(--c-link) 16%, transparent);
  color: var(--c-link-hover);
}

.delegations-timeline__body {
  min-width: 0;
}

.delegations-timeline__title {
  color: var(--c-text-soft);
  font-size: 0.78rem;
}

.delegations-timeline__title a {
  color: var(--c-link);
  text-decoration: none;
}

.delegations-timeline__title a:hover {
  text-decoration: underline;
}

.delegations-timeline__amount {
  margin-left: 0.35rem;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
}

.delegations-timeline__meta {
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.delegations-timeline__meta a {
  color: var(--c-link);
}

@media (max-width: 599px) {
  .delegations-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>
