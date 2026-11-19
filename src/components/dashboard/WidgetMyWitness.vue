<template>
  <div class="dw-mywitness">
    <dashboard-widget-state
      :state="state"
      :error="loadError"
      guest-title="Log in to see your witness"
      guest-text="Your witness rank, approval and the gap to the top 20."
      @retry="reload"
    />

    <template v-if="state === 'ready' || state === 'stale'">
      <q-card-section v-if="position.found" class="dw-mywitness__body">
        <div class="dw-mywitness__head">
          <div class="dw-mywitness__rank">
            <span class="dw-mywitness__rank-number">#{{ position.rank }}</span>
            <span class="dw-mywitness__rank-total">of {{ position.total }}</span>
          </div>
          <span class="dw-mywitness__badge" :class="position.inTopTwenty ? 'is-good' : 'is-warn'">
            <q-icon :name="position.inTopTwenty ? 'verified' : 'trending_up'" size="14px" aria-hidden="true" />
            {{ position.inTopTwenty ? 'Electing blocks' : 'Outside top 20' }}
          </span>
        </div>

        <dl class="dw-mywitness__stats">
          <div>
            <dt>Approval</dt>
            <dd>{{ position.hpLabel }}</dd>
          </div>
          <div>
            <dt>Missed blocks</dt>
            <dd>{{ position.missed.toLocaleString('en-US') }}</dd>
          </div>
          <div class="dw-mywitness__wide">
            <dt>{{ position.inTopTwenty ? 'Standing' : 'To enter the top 20' }}</dt>
            <dd>{{ position.gapLabel }}</dd>
          </div>
        </dl>

        <div class="dw-mywitness__bar" role="img" :aria-label="'Approval stake is ' + Math.round(position.progress) + '% of the top-20 cut-off'">
          <span class="dw-mywitness__bar-fill" :style="{ width: position.progress + '%' }"></span>
        </div>

        <p class="dw-mywitness__note">
          Price feed updated {{ feedLabel }}.
        </p>
      </q-card-section>

      <q-card-section v-else-if="witnessesLoaded" class="home-panel__state">
        <q-icon name="info" size="22px" aria-hidden="true" />
        <span>@{{ accountName }} does not run a witness.</span>
        <router-link to="/witness" class="home-panel__link">Run one</router-link>
      </q-card-section>

      <q-card-section class="home-panel__footer">
        <router-link :to="'/@' + accountName + '/witness'">Witness settings</router-link>
        <span>Top-20 cut-off {{ cutoffLabel }}</span>
      </q-card-section>
    </template>
  </div>
</template>

<style scoped>
.dw-mywitness__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-top: 0.7rem;
}

.dw-mywitness__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dw-mywitness__rank-number {
  color: #e4eaed;
  font-size: 1.45rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dw-mywitness__rank-total {
  margin-left: 0.3rem;
  color: #78909c;
  font-size: 0.72rem;
}

.dw-mywitness__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.16rem 0.5rem;
  border-radius: var(--radius-pill);
  font-size: 0.68rem;
  font-weight: 600;
}

.dw-mywitness__badge.is-good {
  background: rgba(102, 187, 106, 0.14);
  color: #a5d6a7;
}

.dw-mywitness__badge.is-warn {
  background: rgba(255, 183, 77, 0.14);
  color: #ffcc80;
}

.dw-mywitness__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 0;
}

.dw-mywitness__stats > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.025);
}

.dw-mywitness__wide {
  grid-column: 1 / -1;
}

.dw-mywitness__stats dt {
  color: #90a4ae;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.dw-mywitness__stats dd {
  margin: 0;
  color: #e4eaed;
  font-size: 0.84rem;
  font-weight: 600;
}

.dw-mywitness__bar {
  overflow: hidden;
  height: 6px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.08);
}

.dw-mywitness__bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4fc3f7, #81d4fa);
}

.dw-mywitness__note {
  margin: 0;
  color: #78909c;
  font-size: 0.7rem;
}
</style>

<script>
import moment from 'src/utils/time'
import DashboardWidgetState from 'components/dashboard/DashboardWidgetState.vue'
import { accountWidgetMixin } from 'components/dashboard/accountWidgetMixin'
import { fetchWitnessesByVote } from 'src/services/chainData'
import { formatHp } from 'src/services/witnesses'
import { myWitnessPosition } from 'src/services/dashboardWidgets'

export default {
  name: 'WidgetMyWitness',
  components: { DashboardWidgetState },
  mixins: [accountWidgetMixin],
  props: {
    account: { type: String, default: '' }
  },
  data () {
    return {
      witnesses: []
    }
  },
  computed: {
    witnessesLoaded () {
      return this.witnesses.length > 0
    },
    position () {
      if (!this.witnessesLoaded || !this.accountName) return { found: false, progress: 0 }
      return myWitnessPosition(this.witnesses, this.accountName, this.globalProps)
    },
    feedLabel () {
      const at = this.position.lastFeed
      return at ? moment.utc(at).fromNow() : 'unknown'
    },
    cutoffLabel () {
      return this.position.cutoffHp ? formatHp(this.position.cutoffHp) : '—'
    }
  },
  created () {
    fetchWitnessesByVote(200)
      .then(list => { this.witnesses = Array.isArray(list) ? list : [] })
      .catch(error => console.error('Failed to load witnesses for the my-witness widget', error))
  }
}
</script>
