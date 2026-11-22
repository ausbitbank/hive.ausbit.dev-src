<template>
  <div class="dw-gov">
    <q-card-section class="dw-gov__head">
      <div>
        <div class="dw-gov__eyebrow">DHF</div>
        <h2 class="dw-gov__title">Governance watch</h2>
      </div>
      <q-btn
        flat
        round
        dense
        icon="refresh"
        aria-label="Refresh governance data"
        title="Refresh governance data"
        :loading="loading"
        @click="reload"
      />
    </q-card-section>

    <dashboard-widget-state v-if="state === 'loading'" state="loading" />

    <dashboard-widget-state
      v-else-if="state === 'error'"
      state="error"
      :error="loadError || 'Governance data is unavailable right now.'"
      @retry="reload"
    />

    <template v-else>
      <q-card-section v-if="state === 'stale' && loadError" class="dw-gov__warn" role="status">
        <q-icon name="warning" size="15px" aria-hidden="true" />
        <span>{{ loadError }}</span>
      </q-card-section>

      <q-card-section v-if="!summary.hasProposals" class="home-panel__state">
        <q-icon name="account_balance" size="22px" aria-hidden="true" />
        <span>No DHF proposals are available right now.</span>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="reload" />
      </q-card-section>

      <template v-else>
        <q-card-section class="dw-gov__body">
          <section v-if="showBudget" class="dw-gov__budget" aria-label="DHF daily budget">
            <div class="dw-gov__budget-top">
              <div>
                <span class="dw-gov__label">Daily budget</span>
                <span class="dw-gov__big">
                  {{ summary.hasFund ? formatHbd(summary.dailyBudget) : '—' }}<small v-if="summary.hasFund"> HBD</small>
                </span>
              </div>
              <div class="dw-gov__budget-committed">
                <span class="dw-gov__label">Committed</span>
                <span class="dw-gov__value">{{ formatHbd(summary.dailyCommitted) }} HBD/day</span>
              </div>
            </div>
            <dl class="dw-gov__facts">
              <div>
                <dt>30-day projection</dt>
                <dd>{{ formatHbd(summary.projected30Days) }} HBD</dd>
              </div>
              <div>
                <dt title="Daily budget minus funded commitments">Daily headroom</dt>
                <dd>{{ summary.hasFund ? formatHbd(summary.dailyGap) + ' HBD' : '—' }}</dd>
              </div>
              <div>
                <dt>Unfunded requests</dt>
                <dd>{{ formatHbd(summary.dailyUnfunded) }} HBD/day</dd>
              </div>
              <div>
                <dt>Return threshold</dt>
                <dd>{{ formatHbd(summary.returnHp) }} HP</dd>
              </div>
            </dl>
          </section>

          <dl class="dw-gov__counts" aria-label="Proposal counts">
            <div>
              <dt>Active</dt>
              <dd>{{ summary.activeCount }}</dd>
            </div>
            <div>
              <dt>Funded</dt>
              <dd class="is-good">{{ summary.fundedCount }}</dd>
            </div>
            <div>
              <dt>Unfunded</dt>
              <dd>{{ summary.unfundedCount }}</dd>
            </div>
          </dl>

          <p v-if="summary.outlierCount" class="dw-gov__note">
            {{ summary.outlierCount }} active request{{ summary.outlierCount === 1 ? '' : 's' }}
            ask for implausible daily pay and are excluded from the funding totals.
          </p>

          <section class="dw-gov__section" aria-labelledby="dw-gov-expiring">
            <div class="dw-gov__section-head">
              <h3 id="dw-gov-expiring" class="dw-gov__section-title">Ending soon</h3>
              <span class="dw-gov__section-count">{{ summary.expiringSoonCount }} within 30 days</span>
            </div>
            <ul v-if="summary.expiring.length" class="dw-gov__list">
              <li v-for="row in summary.expiring" :key="row.id" class="dw-gov__row">
                <router-link :to="row.url" class="dw-gov__subject">{{ row.subject }}</router-link>
                <span class="dw-gov__badge" :class="row.funded ? 'is-good' : 'is-muted'">
                  {{ row.funded ? 'Funded' : 'Below return' }}
                </span>
                <span class="dw-gov__row-meta">
                  {{ row.daysLeft === 0 ? 'Ends today' : row.daysLeft + 'd left' }}
                  · <template v-if="row.outlier">Outlier request</template><template v-else>{{ formatHbd(row.dailyPayHbd) }} HBD/day</template>
                  <span v-if="row.voted" class="dw-gov__voted">· Voted</span>
                </span>
              </li>
            </ul>
            <p v-else class="dw-gov__note">No active proposals end in the next 30 days.</p>
          </section>

          <section v-if="watchlist.length" class="dw-gov__section" aria-labelledby="dw-gov-watchlist">
            <div class="dw-gov__section-head">
              <h3 id="dw-gov-watchlist" class="dw-gov__section-title">Watchlist</h3>
              <span class="dw-gov__section-count">{{ summary.watchlist.length }} tracked</span>
            </div>
            <ul v-if="summary.watchlist.length" class="dw-gov__list">
              <li v-for="row in summary.watchlist" :key="row.id" class="dw-gov__row">
                <router-link :to="row.url" class="dw-gov__subject">{{ row.subject }}</router-link>
                <span class="dw-gov__badge" :class="row.funded ? 'is-good' : 'is-muted'">
                  {{ row.funded ? 'Funded' : 'Below return' }}
                </span>
                <span class="dw-gov__row-meta">
                  <template v-if="row.phase === 'expired'">Ended</template>
                  <template v-else-if="row.daysLeft === 0">Ends today</template>
                  <template v-else>{{ row.daysLeft }}d left</template>
                  · <template v-if="row.outlier">Outlier request</template><template v-else>{{ formatHbd(row.dailyPayHbd) }} HBD/day</template>
                  <span v-if="row.voted" class="dw-gov__voted">· Voted</span>
                </span>
              </li>
            </ul>
            <p v-else class="dw-gov__note">None of the watched proposals are listed anymore.</p>
          </section>

          <div v-if="showVoteExpiry && signedIn" class="dw-gov__vote" :class="{ 'is-warn': summary.voteExpiry.expiring }" role="status">
            <q-icon name="how_to_vote" size="18px" aria-hidden="true" />
            <div class="dw-gov__vote-copy">
              <span v-if="summary.voteExpiry.available">{{ summary.voteExpiry.label }}</span>
              <span v-else>Vote expiry is unavailable right now.</span>
              <span class="dw-gov__vote-links">
                <router-link to="/proposals">Review proposals</router-link>
                <router-link to="/witnesses">Review witnesses</router-link>
              </span>
            </div>
          </div>
        </q-card-section>

        <q-card-section class="home-panel__footer dw-gov__footer">
          <router-link to="/proposals">Proposals</router-link>
          <router-link to="/witnesses">Witnesses</router-link>
          <q-btn flat dense no-caps size="sm" color="primary" icon="refresh" label="Refresh" :loading="loading" @click="reload" />
        </q-card-section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.dw-gov {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dw-gov__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.2rem;
}

.dw-gov__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dw-gov__title {
  margin: 0.05rem 0 0;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
}

.dw-gov__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.55rem;
}

.dw-gov__warn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 1rem;
  color: var(--c-warning);
  font-size: 0.72rem;
}

.dw-gov__budget {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-gov__budget-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dw-gov__label {
  display: block;
  color: var(--c-text-subtle);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-gov__big {
  color: var(--c-text);
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.dw-gov__big small {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  font-weight: 500;
}

.dw-gov__budget-committed {
  text-align: right;
}

.dw-gov__value {
  color: var(--c-text);
  font-size: 0.82rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-gov__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 0.6rem;
  margin: 0;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-subtle);
}

.dw-gov__facts > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  min-width: 0;
}

.dw-gov__facts dt {
  color: var(--c-text-faint);
  font-size: 0.63rem;
}

.dw-gov__facts dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.7rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.dw-gov__counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3rem;
  margin: 0;
}

.dw-gov__counts > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-gov__counts dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-gov__counts dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-gov__counts dd.is-good {
  color: var(--c-positive);
}

.dw-gov__section {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.dw-gov__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.dw-gov__section-title {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dw-gov__section-count {
  color: var(--c-text-faint);
  font-size: 0.64rem;
}

.dw-gov__list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dw-gov__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.1rem 0.45rem;
  padding: 0.35rem 0;
  border-top: 1px solid var(--border-subtle);
}

.dw-gov__subject {
  overflow: hidden;
  color: var(--c-text);
  font-size: 0.76rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-gov__subject:hover {
  color: var(--c-link-hover);
}

.dw-gov__badge {
  align-self: start;
  padding: 0.08rem 0.38rem;
  border-radius: var(--radius-pill);
  font-size: 0.58rem;
  font-weight: 600;
  white-space: nowrap;
}

.dw-gov__badge.is-good {
  background: color-mix(in srgb, var(--c-positive) 14%, transparent);
  color: var(--c-positive);
}

.dw-gov__badge.is-muted {
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
  color: var(--c-text-subtle);
}

.dw-gov__row-meta {
  grid-column: 1 / -1;
  overflow: hidden;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
}

.dw-gov__voted {
  color: var(--c-link);
}

.dw-gov__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

.dw-gov__vote {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--c-link) 28%, transparent);
  border-radius: var(--radius-sm);
  color: var(--c-text);
  background: color-mix(in srgb, var(--c-link) 6%, transparent);
}

.dw-gov__vote.is-warn {
  border-color: color-mix(in srgb, var(--c-warning) 40%, transparent);
  background: color-mix(in srgb, var(--c-warning) 8%, transparent);
}

.dw-gov__vote-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-gov__vote-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  font-size: 0.66rem;
  font-weight: 600;
}

.dw-gov__vote-links a {
  color: var(--c-link);
  text-decoration: none;
}

.dw-gov__vote-links a:hover {
  color: var(--c-link-hover);
}

.dw-gov__footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
}

@media (max-width: 479px) {
  .dw-gov__facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .dw-gov__budget-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .dw-gov__budget-committed {
    text-align: left;
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { fetchAccount, fetchGlobalProps } from 'src/services/chainData'
import { formatHbd, getVoterVoteIds, listProposals } from 'src/services/proposals'
import { parseAsset } from 'src/services/network'
import { governanceWatchSummary } from 'src/services/governanceWatch'

export default {
  name: 'WidgetGovernanceWatch',
  components: { DashboardWidgetState },
  props: {
    limit: { type: Number, default: 4 },
    watchlist: { type: Array, default: () => [] },
    showBudget: { type: Boolean, default: true },
    showVoteExpiry: { type: Boolean, default: true }
  },
  data () {
    return {
      proposals: [],
      fund: null,
      account: null,
      globalProps: null,
      votedIds: new Set(),
      loading: true,
      loaded: false,
      loadError: ''
    }
  },
  computed: {
    signedIn () {
      return this.$hiveStore.user.username || ''
    },
    state () {
      if (this.loading && !this.loaded) return 'loading'
      if (!this.loaded) return 'error'
      return this.loadError ? 'stale' : 'ready'
    },
    fundHbdBalance () {
      return parseAsset(this.fund?.hbd_balance)
    },
    summary () {
      return governanceWatchSummary({
        proposals: this.proposals,
        account: this.account,
        globalProps: this.globalProps,
        fundHbdBalance: this.fundHbdBalance,
        watchlist: this.watchlist,
        limit: this.limit,
        votedIds: this.votedIds
      })
    }
  },
  watch: {
    signedIn () {
      this.reload()
    }
  },
  created () {
    this.reload()
  },
  methods: {
    formatHbd,
    async reload () {
      if (!this.loaded) this.loading = true
      this.loadError = ''
      const signed = this.signedIn
      const results = await Promise.allSettled([
        listProposals(),
        fetchAccount('hive.fund'),
        fetchGlobalProps(),
        signed ? fetchAccount(signed) : Promise.resolve(null),
        signed ? getVoterVoteIds(signed) : Promise.resolve(new Set())
      ])
      const [proposalsResult, fundResult, propsResult, accountResult, votedResult] = results

      if (proposalsResult.status === 'fulfilled') {
        this.proposals = Array.isArray(proposalsResult.value) ? proposalsResult.value : []
        this.loaded = true
      } else if (this.loaded) {
        this.loadError = 'Refresh failed — showing the last good numbers.'
      } else {
        this.loadError = 'DHF proposals are unavailable right now.'
      }

      if (fundResult.status === 'fulfilled') this.fund = fundResult.value || null
      if (propsResult.status === 'fulfilled') this.globalProps = propsResult.value || null
      if (accountResult.status === 'fulfilled') this.account = accountResult.value || null
      if (votedResult.status === 'fulfilled') {
        this.votedIds = votedResult.value instanceof Set
          ? votedResult.value
          : new Set(Array.isArray(votedResult.value) ? votedResult.value : [])
      }

      this.loading = false
    }
  }
}
</script>
