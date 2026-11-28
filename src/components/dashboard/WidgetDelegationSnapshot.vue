<template>
  <div class="dw-delegations">
    <q-card-section class="home-panel__head">
      <div>
        <div class="home-eyebrow">Hive Power</div>
        <h2 class="home-panel__title">
          <template v-if="accountName">@{{ accountName }} delegations</template>
          <template v-else>Delegation snapshot</template>
        </h2>
      </div>
    </q-card-section>

    <dashboard-widget-state
      :state="displayState"
      :error="stateError"
      guest-title="Log in to see your delegations"
      guest-text="Outgoing and incoming Hive Power delegations, plus effective HP."
      @retry="refresh"
    />

    <template v-if="displayState === 'ready' || displayState === 'stale'">
      <p v-if="staleNotice" class="dw-delegations__notice" role="status">
        <q-icon name="cloud_off" size="16px" aria-hidden="true" />
        <span>{{ staleNotice }}</span>
      </p>

      <q-card-section class="dw-delegations__stats" role="group" aria-label="Delegation totals">
        <div class="dw-delegations__stat">
          <span class="dw-delegations__label">Delegated out</span>
          <span class="dw-delegations__value">{{ hpLabel(summary.outgoingHp) }}</span>
          <span class="dw-delegations__hint">{{ countLabel(summary.outgoing.length, 'delegation', 'delegations') }}</span>
        </div>
        <div class="dw-delegations__stat">
          <span class="dw-delegations__label">Received in</span>
          <span class="dw-delegations__value">{{ showIncoming ? hpLabel(summary.incomingHp) : '—' }}</span>
          <span class="dw-delegations__hint">{{ incomingHint }}</span>
        </div>
        <div class="dw-delegations__stat">
          <span class="dw-delegations__label">Effective HP</span>
          <span class="dw-delegations__value">{{ hpLabel(summary.effectiveHp) }}</span>
          <span class="dw-delegations__hint">Owned, received, delegated and powering down</span>
        </div>
      </q-card-section>

      <q-card-section
        v-if="showOutgoing"
        class="dw-delegations__section"
        role="region"
        aria-label="Top outgoing delegations"
      >
        <div class="dw-delegations__section-head">
          <h3 class="dw-delegations__section-title">Top outgoing</h3>
          <span class="dw-delegations__count">{{ summary.outgoing.length }}</span>
        </div>
        <ul v-if="summary.topOutgoing.length" class="dw-delegations__rows">
          <li v-for="row in summary.topOutgoing" :key="'out-' + row.name">
            <router-link :to="'/@' + row.name" class="dw-delegations__name">@{{ row.name }}</router-link>
            <span class="dw-delegations__amount">{{ row.label }}</span>
          </li>
        </ul>
        <p v-else class="dw-delegations__empty">No outgoing delegations.</p>
      </q-card-section>

      <q-card-section
        v-if="showIncoming"
        class="dw-delegations__section"
        role="region"
        aria-label="Top incoming delegations"
      >
        <div class="dw-delegations__section-head">
          <h3 class="dw-delegations__section-title">Top incoming</h3>
          <span class="dw-delegations__count">{{ summary.incoming.length }}</span>
        </div>
        <ul v-if="summary.topIncoming.length" class="dw-delegations__rows">
          <li v-for="row in summary.topIncoming" :key="'in-' + row.name">
            <router-link :to="'/@' + row.name" class="dw-delegations__name">@{{ row.name }}</router-link>
            <span class="dw-delegations__amount">{{ row.label }}</span>
          </li>
        </ul>
        <p v-else class="dw-delegations__empty">No current inbound delegations were found in recent history.</p>
        <p class="dw-delegations__note">
          <q-icon name="history" size="14px" aria-hidden="true" />
          <span>Incoming delegations are reconstructed from recent account history and verified against the delegators' current lists.</span>
        </p>
      </q-card-section>

      <q-card-section v-if="!showOutgoing && !showIncoming" class="home-panel__state">
        <q-icon name="visibility_off" size="24px" aria-hidden="true" />
        <span>Outgoing and incoming lists are both hidden in this widget's settings.</span>
      </q-card-section>

      <q-card-section class="home-panel__footer dw-delegations__footer">
        <router-link :to="delegationsPath">All delegations</router-link>
        <q-btn
          flat
          dense
          round
          icon="refresh"
          aria-label="Refresh delegation snapshot"
          title="Refresh delegation snapshot"
          :loading="loading || delegationsLoading"
          @click="refresh"
        />
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-delegations__notice {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem 1rem 0;
  color: var(--c-warning-soft);
  font-size: 0.7rem;
  line-height: 1.4;
}

.dw-delegations__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 92px), 1fr));
  gap: 0.4rem;
  padding: 0.7rem 1rem 0.25rem;
}

.dw-delegations__stat {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-delegations__label {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-delegations__value {
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.dw-delegations__hint {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  line-height: 1.3;
}

.dw-delegations__section {
  padding: 0.55rem 1rem 0;
}

.dw-delegations__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.dw-delegations__section-title {
  margin: 0;
  color: var(--c-text-subtle);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-delegations__count {
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-variant-numeric: tabular-nums;
}

.dw-delegations__rows {
  margin: 0.2rem 0 0;
  padding: 0;
  list-style: none;
}

.dw-delegations__rows li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.34rem 0;
  border-top: 1px solid var(--border-subtle);
}

.dw-delegations__rows li:first-child {
  border-top: 0;
}

.dw-delegations__name {
  overflow: hidden;
  min-width: 0;
  color: var(--c-link);
  font-size: 0.78rem;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dw-delegations__name:hover {
  color: var(--c-link-hover);
  text-decoration: underline;
}

.dw-delegations__amount {
  flex: none;
  color: var(--c-text);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dw-delegations__empty {
  margin: 0.3rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.72rem;
  line-height: 1.4;
}

.dw-delegations__note {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0.45rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.66rem;
  line-height: 1.4;
}

.dw-delegations__footer {
  align-items: center;
}

@media (max-width: 599px) {
  .dw-delegations__stats,
  .dw-delegations__section {
    padding-left: 0.7rem;
    padding-right: 0.7rem;
  }
}

@media (max-width: 340px) {
  .dw-delegations__stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { delegationSnapshotSummary } from 'src/services/delegationSnapshot'
import {
  fetchDelegationHistory,
  listOutgoingDelegations,
  resolveInboundDelegations
} from 'src/services/delegations'
import { formatHp } from 'src/services/witnesses'

export default {
  name: 'WidgetDelegationSnapshot',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' },
    showIncoming: { type: Boolean, default: false },
    showOutgoing: { type: Boolean, default: true },
    limit: { type: Number, default: 5 }
  },
  data () {
    return {
      outgoing: [],
      incoming: [],
      delegationsAccount: '',
      outgoingLoaded: false,
      inboundLoaded: false,
      delegationsLoaded: false,
      delegationsLoading: false,
      delegationError: '',
      delegationNotice: '',
      delegationToken: 0
    }
  },
  computed: {
    summary () {
      return delegationSnapshotSummary({
        account: this.accountRecord,
        outgoing: this.outgoing,
        incoming: this.incoming,
        globalProps: this.globalProps,
        limit: this.limit
      })
    },
    displayState () {
      if (!this.targetAccount) return 'guest'
      if (this.loading) {
        if (this.loaded) return this.loadError ? 'stale' : 'ready'
        return 'loading'
      }
      if (this.delegationsLoading) {
        if (this.delegationsLoaded) return this.delegationError ? 'stale' : 'ready'
        return 'loading'
      }
      if (this.loadError) return this.loaded ? 'stale' : 'error'
      if (this.delegationError) return this.delegationsLoaded ? 'stale' : 'error'
      if (!this.loaded || !this.delegationsLoaded) return 'loading'
      return 'ready'
    },
    stateError () {
      return this.loadError || this.delegationError || 'Could not load delegations right now.'
    },
    staleNotice () {
      if (this.loadError && this.loaded) return this.loadError
      if (this.delegationError && this.delegationsLoaded) return this.delegationError
      return this.delegationNotice
    },
    incomingHint () {
      if (!this.showIncoming) return 'Incoming list is turned off'
      if (!this.inboundLoaded) {
        return this.delegationsLoading ? 'Loading recent history' : 'Not available from recent history'
      }
      return this.countLabel(this.summary.incoming.length, 'delegator', 'delegators')
    },
    delegationsPath () {
      const name = this.accountName || this.targetAccount
      return name ? '/@' + name + '/delegations' : '/'
    }
  },
  watch: {
    showIncoming (value) {
      if (value && this.delegationsAccount) this.loadDelegations()
    }
  },
  methods: {
    hpLabel (value) {
      return formatHp(value, 0)
    },
    countLabel (count, singular, plural) {
      const value = Number(count) || 0
      return value + ' ' + (value === 1 ? singular : plural)
    },
    applyAccountData (result) {
      const name = result.accountName || this.targetAccount
      if (!name) return
      if (this.delegationsAccount && this.delegationsAccount !== name) this.resetDelegations()
      this.delegationsAccount = name
      // A mixin reload is either the first load, an account change or a manual
      // refresh, so both lists are refreshed here. Toggling showIncoming later
      // reuses the cached inbound result.
      this.loadDelegations({ force: true })
    },
    resetDelegations () {
      this.delegationToken += 1
      this.outgoing = []
      this.incoming = []
      this.outgoingLoaded = false
      this.inboundLoaded = false
      this.delegationsLoaded = false
      this.delegationError = ''
      this.delegationNotice = ''
    },
    async loadInbound (name) {
      const events = await fetchDelegationHistory(name, { limit: 1000 })
      return resolveInboundDelegations(name, events, { maxCandidates: 60 })
    },
    async loadDelegations ({ force = false } = {}) {
      const name = this.delegationsAccount
      if (!name) return

      const needOutgoing = force || !this.outgoingLoaded
      const needIncoming = this.showIncoming && (force || !this.inboundLoaded)
      if (!needOutgoing && !needIncoming) return

      const token = ++this.delegationToken
      this.delegationsLoading = true
      this.delegationError = ''
      this.delegationNotice = ''

      const outgoingPromise = needOutgoing
        ? listOutgoingDelegations(name, { limit: 1000 })
        : Promise.resolve(this.outgoing)
      const incomingPromise = needIncoming
        ? this.loadInbound(name)
        : Promise.resolve(this.incoming)

      const [outgoingResult, incomingResult] = await Promise.allSettled([
        outgoingPromise,
        incomingPromise
      ])
      if (token !== this.delegationToken) return

      if (needOutgoing) {
        if (outgoingResult.status === 'fulfilled') {
          this.outgoing = Array.isArray(outgoingResult.value) ? outgoingResult.value : []
          this.outgoingLoaded = true
        } else {
          console.error('Failed to load outgoing delegations for @' + name, outgoingResult.reason)
        }
      }

      if (needIncoming) {
        if (incomingResult.status === 'fulfilled') {
          this.incoming = Array.isArray(incomingResult.value) ? incomingResult.value : []
          this.inboundLoaded = true
        } else {
          console.error('Failed to load incoming delegations for @' + name, incomingResult.reason)
        }
      }

      this.delegationsLoaded = this.outgoingLoaded || this.inboundLoaded

      if (needOutgoing && outgoingResult.status === 'rejected') {
        this.delegationError = this.delegationsLoaded
          ? 'Outgoing delegations could not refresh — showing the last known list.'
          : 'Could not load delegations for @' + name + '.'
      } else if (needIncoming && incomingResult.status === 'rejected') {
        this.delegationNotice = this.inboundLoaded
          ? 'Incoming delegations could not refresh — showing the last known list.'
          : 'Incoming delegations could not be reconstructed from recent history.'
      }

      this.delegationsLoading = false
    }
  }
}
</script>
