<template>
  <q-card flat bordered class="voter-segments">
    <q-card-section>
      <div class="voter-segments__head">
        <div>
          <div class="voter-segments__eyebrow">Voter segments</div>
          <h3 class="voter-segments__title">Who backs a witness</h3>
          <p class="voter-segments__hint">
            Sample a witness's voter list and group the sampled accounts by effective HP and account age.
          </p>
        </div>
        <div class="voter-segments__controls">
          <q-select
            v-model="selected"
            :options="witnessOptions"
            emit-value
            map-options
            dense
            outlined
            options-dense
            label="Witness"
            aria-label="Witness to sample voters for"
            class="voter-segments__select"
          />
          <q-btn
            no-caps
            color="primary"
            icon="groups"
            :label="segments ? 'Reload sample' : 'Load sample'"
            :loading="loading"
            :disable="!selected"
            @click="load"
          />
        </div>
      </div>

      <div v-if="error" class="voter-segments__state voter-segments__state--error">
        <q-icon name="error_outline" size="16px" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <div v-else-if="loading" class="voter-segments__state">
        <q-spinner-puff color="primary" size="1.4em" aria-label="Loading witness voters" />
        <span>Loading voters and a sample of accounts…</span>
      </div>

      <div v-else-if="!segments" class="voter-segments__state">
        <q-icon name="insights" size="18px" aria-hidden="true" />
        <span>Choose a witness and load a bounded sample. No request is made until you ask for it.</span>
      </div>

      <template v-else>
        <div class="voter-segments__metrics">
          <div>
            <span class="voter-segments__metric-value">{{ formatNumber(segments.totalVoters) }}</span>
            <span class="voter-segments__metric-label">voters returned</span>
          </div>
          <div>
            <span class="voter-segments__metric-value">{{ formatNumber(segments.knownCount) }}</span>
            <span class="voter-segments__metric-label">accounts sampled</span>
          </div>
          <div>
            <span class="voter-segments__metric-value">{{ formatHp(segments.medianHp) }}</span>
            <span class="voter-segments__metric-label">median sample HP</span>
          </div>
          <div>
            <span class="voter-segments__metric-value">{{ formatPercent(segments.topTenShare * 100) }}</span>
            <span class="voter-segments__metric-label">stake held by top 10%</span>
          </div>
        </div>

        <div class="voter-segments__grid">
          <div>
            <div class="voter-segments__band-title">Effective HP</div>
            <div v-for="band in segments.hpBands" :key="band.id" class="voter-segments__band">
              <div class="voter-segments__band-label">
                <span>{{ band.label }}</span>
                <span>{{ band.count }} · {{ formatPercent(band.share * 100) }}</span>
              </div>
              <q-linear-progress
                :value="band.share"
                color="teal"
                rounded
                size="7px"
                :aria-label="band.label + ': ' + band.count + ' sampled voters'"
              />
            </div>
          </div>

          <div>
            <div class="voter-segments__band-title">Account age</div>
            <div v-for="band in segments.ageBands" :key="band.id" class="voter-segments__band">
              <div class="voter-segments__band-label">
                <span>{{ band.label }}</span>
                <span>{{ band.count }} · {{ formatPercent(band.share * 100) }}</span>
              </div>
              <q-linear-progress
                :value="band.share"
                color="primary"
                rounded
                size="7px"
                :aria-label="band.label + ': ' + band.count + ' sampled voters'"
              />
            </div>
          </div>
        </div>

        <div class="voter-segments__top">
          <div class="voter-segments__band-title">Largest sampled voters</div>
          <ul>
            <li v-for="row in segments.topVoters" :key="row.voter">
              <router-link :to="'/@' + row.voter">@{{ row.voter }}</router-link>
              <span>{{ formatHp(row.hp) }}<template v-if="row.ageDays !== null"> · {{ ageLabel(row.ageDays) }}</template></span>
            </li>
            <li v-if="segments.topVoters.length === 0" class="voter-segments__muted">No voter accounts were resolved.</li>
          </ul>
        </div>

        <p class="voter-segments__note">
          Up to 1,000 voter records are returned; the first {{ formatNumber(sampledNames) }} are resolved to accounts for stake and age.
          Voters outside the sample still count in the returned total.
        </p>
      </template>
    </q-card-section>
  </q-card>
</template>

<script>
import {
  fetchWitnessVoterSample,
  voterSegments
} from 'src/services/witnessVoters'
import { formatHp, formatPercent } from 'src/services/witnesses'

export default {
  name: 'WitnessVoterSegments',
  props: {
    witnesses: { type: Array, default: () => [] },
    globalProps: { type: Object, default: null }
  },
  data () {
    const first = this.witnesses[0]?.owner || ''
    return {
      selected: first,
      voters: [],
      accounts: [],
      sampledNames: 0,
      loading: false,
      error: ''
    }
  },
  computed: {
    witnessOptions () {
      return this.witnesses
        .filter(witness => witness?.owner)
        .slice(0, 200)
        .map(witness => ({
          label: '@' + witness.owner + (witness.rank ? ' · rank ' + witness.rank : ''),
          value: witness.owner
        }))
    },
    segments () {
      if (!this.voters.length) return null
      return voterSegments(this.voters, this.accounts, this.globalProps)
    }
  },
  watch: {
    witnesses: {
      handler () {
        if (!this.selected && this.witnesses.length) this.selected = this.witnesses[0].owner
      }
    }
  },
  methods: {
    formatHp,
    formatPercent,
    formatNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '0'
      return number.toLocaleString('en-US', { maximumFractionDigits: 0 })
    },
    ageLabel (days) {
      if (days < 365) return Math.max(1, Math.round(days / 30)) + ' mo old'
      return (Math.round(days / 36.5) / 10).toFixed(1) + ' years old'
    },
    async load () {
      if (!this.selected) return
      this.loading = true
      this.error = ''
      try {
        const data = await fetchWitnessVoterSample(this.selected, { limit: 1000, accountLimit: 250 })
        this.voters = data.voters
        this.accounts = data.accounts
        this.sampledNames = data.sampledNames
      } catch {
        this.error = 'Could not load voters for @' + this.selected + '. Please try again.'
        this.voters = []
        this.accounts = []
        this.sampledNames = 0
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.voter-segments {
  margin-top: var(--space-3);
  background: rgba(255, 255, 255, 0.02);
}

.voter-segments__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.voter-segments__eyebrow {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.voter-segments__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
}

.voter-segments__hint {
  margin: 0.25rem 0 0;
  max-width: 62ch;
  color: #90a4ae;
  font-size: 0.75rem;
}

.voter-segments__controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.voter-segments__select {
  width: min(260px, 70vw);
}

.voter-segments__state {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.6rem;
  padding: 0.5rem 0.6rem;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  color: #90a4ae;
  font-size: 0.76rem;
}

.voter-segments__state--error {
  border-color: rgba(255, 183, 77, 0.4);
  color: #ffcc80;
}

.voter-segments__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: 0.7rem;
}

.voter-segments__metrics > div {
  min-width: 0;
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.02);
}

.voter-segments__metric-value {
  display: block;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.voter-segments__metric-label {
  display: block;
  color: #90a4ae;
  font-size: 0.64rem;
}

.voter-segments__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: 0.8rem;
}

.voter-segments__band-title {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 0.35rem;
}

.voter-segments__band {
  margin-bottom: 0.4rem;
}

.voter-segments__band-label {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 0.15rem;
  color: #b0bec5;
  font-size: 0.7rem;
}

.voter-segments__top {
  margin-top: 0.8rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.voter-segments__top ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.74rem;
}

.voter-segments__top li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.22rem 0;
  border-top: 1px solid var(--border-subtle);
}

.voter-segments__top li:first-child {
  border-top: 0;
}

.voter-segments__top a {
  color: #4fc3f7;
  text-decoration: none;
}

.voter-segments__top a:hover {
  text-decoration: underline;
}

.voter-segments__top span {
  color: #90a4ae;
  white-space: nowrap;
}

.voter-segments__muted {
  color: #90a4ae;
}

.voter-segments__note {
  margin: 0.55rem 0 0;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.4;
}

@media (max-width: 700px) {
  .voter-segments__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .voter-segments__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
