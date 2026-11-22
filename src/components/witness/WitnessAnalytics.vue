<template>
  <section class="gov-analytics" aria-labelledby="witness-analytics-title">
    <div class="gov-analytics__head">
      <div>
        <div class="gov-analytics__eyebrow">Governance analytics</div>
        <h2 id="witness-analytics-title" class="gov-analytics__title">Witness concentration and health</h2>
        <p class="gov-analytics__hint">
          Approval stake, feed freshness, version drift and missed-block counters derived from the current witness set.
        </p>
      </div>
      <div class="gov-analytics__actions">
        <span v-if="trend.available" class="gov-analytics__trend-note">
          Tracking since {{ formatDate(trend.firstAt) }}
        </span>
        <q-btn flat dense no-caps color="primary" icon="insights" label="Refresh trend" @click="record" />
      </div>
    </div>

    <div class="gov-analytics__grid">
      <q-card flat bordered class="gov-card">
        <q-card-section>
          <div class="gov-card__head">
            <div>
              <div class="gov-card__eyebrow">Vote concentration</div>
              <h3 class="gov-card__title">Consensus stake share</h3>
            </div>
            <q-badge color="blue-grey-9">{{ concentration.witnessCount }} witnesses</q-badge>
          </div>

          <div class="gov-metric">
            <span class="gov-metric__value">{{ formatPercent(concentration.topConsensusShare * 100) }}</span>
            <span class="gov-metric__label">of approval stake held by the top {{ concentration.consensusCount }}</span>
          </div>

          <div class="gov-bar">
            <div class="gov-bar__label">
              <span>Top {{ concentration.consensusCount }} (consensus)</span>
              <span>{{ formatHp(concentration.topConsensusHp) }}</span>
            </div>
            <q-linear-progress
              :value="concentration.topConsensusShare"
              color="primary"
              rounded
              size="8px"
              :aria-label="'Top consensus witnesses hold ' + formatPercent(concentration.topConsensusShare * 100) + ' of approval stake'"
            />
          </div>
          <div class="gov-bar">
            <div class="gov-bar__label">
              <span>Top 50</span>
              <span>{{ formatHp(concentration.top50Hp) }}</span>
            </div>
            <q-linear-progress
              :value="concentration.top50Share"
              color="teal"
              rounded
              size="8px"
              :aria-label="'Top 50 witnesses hold ' + formatPercent(concentration.top50Share * 100) + ' of approval stake'"
            />
          </div>

          <dl class="gov-pairs">
            <div>
              <dt>HHI</dt>
              <dd>{{ Math.round(concentration.hhi).toLocaleString('en-US') }}</dd>
            </div>
            <div>
              <dt>Gini</dt>
              <dd>{{ concentration.gini.toFixed(3) }}</dd>
            </div>
            <div>
              <dt>#{{ concentration.consensusCount }} cutoff</dt>
              <dd>{{ formatHp(concentration.cutoffHp) }}</dd>
            </div>
            <div>
              <dt>Cutoff gap</dt>
              <dd>{{ formatHp(concentration.cutoffGapHp) }}</dd>
            </div>
          </dl>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="gov-card">
        <q-card-section>
          <div class="gov-card__head">
            <div>
              <div class="gov-card__eyebrow">Price feeds</div>
              <h3 class="gov-card__title">Feed freshness</h3>
            </div>
            <q-badge
              :color="freshness.stale + freshness.missing > 0 ? 'orange-9' : 'green-9'"
              :text-color="freshness.stale + freshness.missing > 0 ? 'black' : 'white'"
            >
              {{ freshness.stale + freshness.missing }} need attention
            </q-badge>
          </div>

          <div class="gov-feed-grid">
            <div class="gov-feed-stat gov-feed-stat--fresh">
              <span>{{ freshness.fresh }}</span>
              <small>&le; 6h</small>
            </div>
            <div class="gov-feed-stat gov-feed-stat--aging">
              <span>{{ freshness.aging }}</span>
              <small>6–24h</small>
            </div>
            <div class="gov-feed-stat gov-feed-stat--stale">
              <span>{{ freshness.stale }}</span>
              <small>&gt; 24h</small>
            </div>
            <div class="gov-feed-stat gov-feed-stat--missing">
              <span>{{ freshness.missing }}</span>
              <small>No feed</small>
            </div>
          </div>

          <ul class="gov-list" aria-label="Oldest price feeds">
            <li v-for="row in oldestFeeds" :key="row.owner">
              <router-link :to="'/@' + row.owner">@{{ row.owner }}</router-link>
              <span :class="'gov-severity gov-severity--' + row.bucket">
                {{ row.ageHours === null ? 'never' : relativeTime(row.updatedAt) }}
              </span>
            </li>
            <li v-if="oldestFeeds.length === 0" class="gov-list__empty">All feeds are within the freshness window.</li>
          </ul>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="gov-card">
        <q-card-section>
          <div class="gov-card__head">
            <div>
              <div class="gov-card__eyebrow">Versions</div>
              <h3 class="gov-card__title">Version drift</h3>
            </div>
            <q-badge
              :color="drift.mismatched.length ? 'orange-9' : 'green-9'"
              :text-color="drift.mismatched.length ? 'black' : 'white'"
            >
              {{ drift.matching }}/{{ drift.total }} aligned
            </q-badge>
          </div>

          <div class="gov-metric">
            <span class="gov-metric__value">{{ drift.groups.length }}</span>
            <span class="gov-metric__label">distinct running versions · consensus {{ drift.consensusVersion || 'unknown' }}</span>
          </div>

          <ul class="gov-list" aria-label="Witness versions">
            <li v-for="group in topVersions" :key="group.version">
              <span class="gov-version">v{{ group.version }}</span>
              <span class="gov-severity" :class="group.version === drift.consensusVersion.replace(/^v/i, '') ? 'gov-severity--fresh' : 'gov-severity--aging'">
                {{ group.count }} witness{{ group.count === 1 ? '' : 'es' }}
              </span>
            </li>
          </ul>

          <div v-if="drift.mismatched.length" class="gov-drift">
            <div class="gov-drift__title">Trailing the consensus version</div>
            <div class="gov-chips">
              <router-link
                v-for="row in drift.mismatched.slice(0, 8)"
                :key="row.owner"
                :to="'/@' + row.owner"
                class="gov-chip"
              >
                @{{ row.owner }} <span>v{{ row.version }}</span>
              </router-link>
              <span v-if="drift.mismatched.length > 8" class="gov-chip gov-chip--more">
                +{{ drift.mismatched.length - 8 }} more
              </span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="gov-card">
        <q-card-section>
          <div class="gov-card__head">
            <div>
              <div class="gov-card__eyebrow">Block production</div>
              <h3 class="gov-card__title">Missed-block counters</h3>
            </div>
            <q-badge color="blue-grey-9">{{ trend.available ? 'trend tracked' : 'since first visit' }}</q-badge>
          </div>

          <div class="gov-metric">
            <span class="gov-metric__value">{{ trend.missedDelta.toLocaleString('en-US') }}</span>
            <span class="gov-metric__label">
              newly missed across tracked witnesses{{ trend.available ? ' since ' + formatDate(trend.firstAt) : '' }}
            </span>
          </div>

          <table class="gov-table">
            <caption class="sr-only">Witnesses with the highest cumulative missed-block counters</caption>
            <thead>
              <tr>
                <th scope="col">Witness</th>
                <th scope="col" class="gov-table__num">Missed</th>
                <th scope="col" class="gov-table__num">Trend</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in missed" :key="row.owner">
                <th scope="row"><router-link :to="'/@' + row.owner">@{{ row.owner }}</router-link></th>
                <td class="gov-table__num">{{ row.missed.toLocaleString('en-US') }}</td>
                <td class="gov-table__num">
                  <span v-if="missedTrend(row.owner).available" :class="missedTrend(row.owner).missedDelta ? 'gov-severity--stale' : 'gov-severity--fresh'">
                    {{ missedTrend(row.owner).missedDelta ? '+' + missedTrend(row.owner).missedDelta : '0' }}
                  </span>
                  <span v-else class="gov-muted">—</span>
                </td>
              </tr>
              <tr v-if="missed.length === 0">
                <td colspan="3" class="gov-muted">No missed-block data is available.</td>
              </tr>
            </tbody>
          </table>

          <p class="gov-footnote">
            Counters are cumulative for the chain. The trend column compares the first recorded local snapshot with your latest visit,
            so it measures new misses rather than lifetime totals.
          </p>
        </q-card-section>
      </q-card>
    </div>

    <witness-voter-segments id="witness-voter-segments" :witnesses="witnesses" :global-props="globalProps" />
  </section>
</template>

<script>
import {
  feedFreshness,
  missedBlockLeaders,
  versionDrift,
  witnessVoteConcentration
} from 'src/services/governance'
import {
  loadHistory,
  networkTrend,
  recordSnapshot,
  witnessMissedTrend
} from 'src/services/governanceHistory'
import { formatHp, formatPercent, relativeTime } from 'src/services/witnesses'
import WitnessVoterSegments from 'components/witness/WitnessVoterSegments.vue'
import moment from 'src/utils/time'

export default {
  name: 'WitnessAnalytics',
  components: { WitnessVoterSegments },
  props: {
    witnesses: { type: Array, default: () => [] },
    globalProps: { type: Object, default: null },
    hardforkVersion: { type: String, default: '' }
  },
  data () {
    return {
      history: []
    }
  },
  computed: {
    concentration () {
      return witnessVoteConcentration(this.witnesses, this.globalProps)
    },
    freshness () {
      return feedFreshness(this.witnesses)
    },
    oldestFeeds () {
      return this.freshness.rows.filter(row => row.bucket !== 'fresh').slice(0, 6)
    },
    drift () {
      return versionDrift(this.witnesses, this.hardforkVersion)
    },
    topVersions () {
      return this.drift.groups.slice(0, 5)
    },
    missed () {
      return missedBlockLeaders(this.witnesses, 8)
    },
    trend () {
      return networkTrend(this.history)
    }
  },
  watch: {
    witnesses: {
      handler () {
        this.record()
      }
    }
  },
  mounted () {
    this.record()
  },
  methods: {
    formatHp,
    formatPercent,
    relativeTime,
    formatDate (timestamp) {
      if (!timestamp) return '—'
      return moment.utc(timestamp).format('D MMM YYYY')
    },
    missedTrend (owner) {
      return witnessMissedTrend(this.history, owner)
    },
    record () {
      if (!this.witnesses.length) {
        this.history = loadHistory()
        return
      }
      this.history = recordSnapshot(this.witnesses)
    }
  }
}
</script>

<style scoped>
.gov-analytics {
  margin-top: var(--space-5);
}

.gov-analytics__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.gov-analytics__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.gov-analytics__title {
  margin: 0.12rem 0 0;
  color: var(--c-text);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.25;
}

.gov-analytics__hint {
  margin: 0.3rem 0 0;
  max-width: 62ch;
  color: var(--c-text-subtle);
  font-size: 0.8rem;
}

.gov-analytics__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.gov-analytics__trend-note {
  color: var(--c-text-faint);
  font-size: 0.72rem;
}

.gov-analytics__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: var(--space-3);
}

.gov-card {
  min-width: 0;
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.gov-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.gov-card__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.gov-card__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.95rem;
  font-weight: 600;
}

.gov-metric {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0.6rem 0 0.7rem;
}

.gov-metric__value {
  color: var(--c-text);
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.1;
}

.gov-metric__label {
  color: var(--c-text-subtle);
  font-size: 0.75rem;
}

.gov-bar {
  margin-top: var(--space-2);
}

.gov-bar__label {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 0.25rem;
  color: var(--c-text-muted);
  font-size: 0.72rem;
}

.gov-pairs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.8rem 0 0;
}

.gov-pairs div {
  min-width: 0;
}

.gov-pairs dt {
  color: var(--c-text-faint);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.gov-pairs dd {
  margin: 0;
  color: var(--c-text-soft);
  font-size: 0.8rem;
}

.gov-feed-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  margin: 0.7rem 0;
}

.gov-feed-stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
}

.gov-feed-stat span {
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.gov-feed-stat small {
  color: var(--c-text-subtle);
  font-size: 0.62rem;
}

.gov-feed-stat--fresh { border-color: color-mix(in srgb, var(--c-positive) 35%, transparent); }
.gov-feed-stat--aging { border-color: color-mix(in srgb, var(--c-warning) 35%, transparent); }
.gov-feed-stat--stale { border-color: color-mix(in srgb, var(--c-warning) 40%, transparent); }
.gov-feed-stat--missing { border-color: color-mix(in srgb, var(--c-negative) 45%, transparent); }

.gov-list {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.gov-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.28rem 0;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.76rem;
}

.gov-list li:first-child {
  border-top: 0;
}

.gov-list a {
  color: var(--c-link);
  text-decoration: none;
}

.gov-list a:hover {
  text-decoration: underline;
}

.gov-list__empty {
  color: var(--c-text-subtle);
}

.gov-severity {
  padding: 0.08rem 0.35rem;
  border-radius: var(--radius-pill);
  font-size: 0.68rem;
  white-space: nowrap;
}

.gov-severity--fresh { background: color-mix(in srgb, var(--c-positive) 14%, transparent); color: var(--c-positive); }
.gov-severity--aging { background: color-mix(in srgb, var(--c-warning) 14%, transparent); color: var(--c-warning-soft); }
.gov-severity--stale { background: color-mix(in srgb, var(--c-warning) 16%, transparent); color: var(--c-warning-soft); }
.gov-severity--missing { background: color-mix(in srgb, var(--c-negative) 18%, transparent); color: var(--c-negative); }

.gov-version {
  color: var(--c-text-soft);
  font-family: monospace;
  font-size: 0.74rem;
}

.gov-drift {
  margin-top: 0.7rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
}

.gov-drift__title {
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.gov-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.35rem;
}

.gov-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: var(--c-link);
  font-size: 0.68rem;
  text-decoration: none;
}

.gov-chip span {
  color: var(--c-warning-soft);
}

.gov-chip--more {
  color: var(--c-text-subtle);
}

.gov-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.gov-table th,
.gov-table td {
  padding: 0.32rem 0.2rem;
  border-top: 1px solid var(--border-subtle);
  text-align: left;
  vertical-align: top;
}

.gov-table thead th {
  border-top: 0;
  color: var(--c-text-faint);
  font-size: 0.64rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.gov-table tbody th {
  font-weight: 500;
}

.gov-table a {
  color: var(--c-link);
  text-decoration: none;
}

.gov-table a:hover {
  text-decoration: underline;
}

.gov-table__num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.gov-muted {
  color: var(--c-text-subtle);
}

.gov-footnote {
  margin: 0.6rem 0 0;
  color: var(--c-text-faint);
  font-size: 0.7rem;
  line-height: 1.45;
}

@media (max-width: 599px) {
  .gov-feed-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gov-pairs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
