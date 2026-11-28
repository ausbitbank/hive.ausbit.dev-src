<template>
  <div class="dw-whealth">
    <dashboard-widget-state
      :state="state"
      :error="loadError"
      guest-title="Log in to see your witness health"
      guest-text="Check the witnesses you vote for: signing keys, price feeds and versions."
      @retry="retryAll"
    />

    <template v-if="state === 'ready' || state === 'stale'">
      <q-card-section class="dw-whealth__body">
        <div class="dw-whealth__hero">
          <q-icon
            :name="witnessesError && !witnesses.length ? 'cloud_off' : summary.notHealthy ? 'warning' : 'verified_user'"
            size="25px"
            :class="witnessesError && !witnesses.length ? 'is-warn' : summary.notHealthy ? 'is-warn' : 'is-good'"
            aria-hidden="true"
          />
          <div>
            <div class="dw-whealth__title">
              <template v-if="witnessesLoading && !witnesses.length">Checking witness health…</template>
              <template v-else-if="witnessesError && !witnesses.length">Witness health unavailable</template>
              <template v-else-if="!summary.total && summary.votesUsed">Voted witnesses are not in the ranked list</template>
              <template v-else>{{ summary.notHealthy ? summary.notHealthy + ' need attention' : 'All voted witnesses healthy' }}</template>
            </div>
            <div class="dw-whealth__sub">
              <template v-if="witnessesError">
                {{ witnessesError }}
                <button type="button" class="dw-whealth__retry" @click="loadWitnesses(true)">Retry</button>
              </template>
              <template v-else>
                {{ summary.votesUsed }} of {{ summary.votesMax }} votes · weight {{ summary.weightLabel }}
              </template>
            </div>
          </div>
        </div>

        <dl class="dw-whealth__stats">
          <div>
            <dt>Healthy</dt>
            <dd class="is-good">{{ summary.ok }}</dd>
          </div>
          <div>
            <dt>Warning</dt>
            <dd :class="{ 'is-warn': summary.warning }">{{ summary.warning }}</dd>
          </div>
          <div>
            <dt>Critical</dt>
            <dd :class="{ 'is-bad': summary.critical }">{{ summary.critical }}</dd>
          </div>
          <div>
            <dt>Stale feeds</dt>
            <dd :class="{ 'is-warn': summary.staleFeeds }">{{ summary.staleFeeds }}</dd>
          </div>
        </dl>

        <div class="dw-whealth__slate">
          <span class="dw-whealth__slate-label">Vote slate</span>
          <div class="dw-whealth__bar" role="img" :aria-label="summary.votesUsed + ' of ' + summary.votesMax + ' witness votes used'">
            <span class="dw-whealth__bar-fill" :style="{ width: slatePercent + '%' }"></span>
          </div>
          <span class="dw-whealth__slate-count">{{ summary.votesUsed }}/{{ summary.votesMax }}</span>
        </div>

        <p v-if="summary.missing" class="dw-whealth__note">
          {{ summary.missing }} voted witness{{ summary.missing === 1 ? '' : 'es' }} are not in the ranked list.
        </p>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link to="/witnesses">Review votes</router-link>
        <router-link :to="'/@' + accountName + '/witness'">Witness tools</router-link>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-whealth__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.7rem;
}

.dw-whealth__hero {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.dw-whealth__hero .is-good {
  color: var(--c-positive);
}

.dw-whealth__hero .is-warn {
  color: var(--c-warning);
}

.dw-whealth__title {
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.dw-whealth__sub {
  margin-top: 0.1rem;
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.dw-whealth__retry {
  margin-left: 0.25rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-link);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.dw-whealth__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  margin: 0;
}

.dw-whealth__stats > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.dw-whealth__stats dt {
  color: var(--c-text-subtle);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-whealth__stats dd {
  margin: 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-whealth__stats dd.is-good {
  color: var(--c-positive);
}

.dw-whealth__stats dd.is-warn {
  color: var(--c-warning-soft);
}

.dw-whealth__stats dd.is-bad {
  color: var(--c-negative);
}

.dw-whealth__slate {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.dw-whealth__slate-label,
.dw-whealth__slate-count {
  flex: none;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.dw-whealth__bar {
  flex: 1;
  overflow: hidden;
  height: 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 8%, transparent);
}

.dw-whealth__bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--c-link), var(--c-link-hover));
}

.dw-whealth__note {
  margin: 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
}

@media (max-width: 479px) {
  .dw-whealth__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<script>
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { fetchWitnessesByVote } from 'src/services/chainData'
import { voteHealthSummary } from 'src/services/dashboardWidgets'

export default {
  name: 'WidgetWitnessHealth',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' }
  },
  data () {
    return {
      witnesses: [],
      witnessesLoading: false,
      witnessesError: ''
    }
  },
  computed: {
    summary () {
      return voteHealthSummary(this.witnesses, this.accountRecord, this.globalProps)
    },
    slatePercent () {
      return Math.min(100, (this.summary.votesUsed / this.summary.votesMax) * 100)
    }
  },
  created () {
    this.loadWitnesses()
  },
  methods: {
    retryAll () {
      this.refresh()
      this.loadWitnesses(true)
    },
    async loadWitnesses (force = false) {
      this.witnessesLoading = true
      this.witnessesError = ''
      try {
        const list = await fetchWitnessesByVote(200, { force })
        this.witnesses = Array.isArray(list) ? list : []
      } catch (error) {
        console.error('Failed to load witnesses for the witness-health widget', error)
        this.witnessesError = 'Could not load the witness list.'
      } finally {
        this.witnessesLoading = false
      }
    }
  }
}
</script>
