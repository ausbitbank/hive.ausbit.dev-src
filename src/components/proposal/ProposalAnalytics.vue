<template>
  <section class="prop-analytics" aria-labelledby="proposal-analytics-title">
    <div class="prop-analytics__head">
      <div>
        <div class="prop-analytics__eyebrow">DHF analytics</div>
        <h2 id="proposal-analytics-title" class="prop-analytics__title">Funding outlook and proposal mix</h2>
        <p class="prop-analytics__hint">
          Projections use the current proposal set and payment windows. They are estimates, not a settled payment ledger.
        </p>
      </div>
      <q-badge color="blue-grey-9">{{ analytics.totalProposals }} proposals</q-badge>
    </div>

    <div class="prop-analytics__grid">
      <q-card flat bordered class="prop-card">
        <q-card-section>
          <div class="prop-card__eyebrow">Funding outlook</div>
          <div class="prop-metric">
            <span class="prop-metric__value">{{ formatHbd(analytics.dailyCommitted) }}</span>
            <span class="prop-metric__unit">HBD/day</span>
          </div>
          <div class="prop-metric__hint">Committed to funded active proposals</div>

          <dl class="prop-pairs">
            <div>
              <dt>Next 30 days</dt>
              <dd>{{ formatHbd(analytics.projectedThirtyDays) }} HBD</dd>
            </div>
            <div>
              <dt>Next 90 days</dt>
              <dd>{{ formatHbd(analytics.projectedNinetyDays) }} HBD</dd>
            </div>
            <div>
              <dt>Remaining commitments</dt>
              <dd>{{ formatHbd(analytics.remainingCommitted) }} HBD</dd>
            </div>
            <div>
              <dt>Estimated paid to date</dt>
              <dd>{{ formatHbd(analytics.estimatedPaid) }} HBD</dd>
            </div>
          </dl>

          <div class="prop-unfunded">
            <q-icon name="info_outline" size="15px" aria-hidden="true" />
            <span>{{ formatHbd(analytics.dailyUnfunded) }} HBD/day requested by active proposals is currently below the return threshold.</span>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="prop-card">
        <q-card-section>
          <div class="prop-card__eyebrow">Monthly commitments</div>
          <div class="prop-bar-chart" role="img" :aria-label="'Projected daily funding by month for the next ' + analytics.monthlyOutlook.length + ' months'">
            <div v-for="month in analytics.monthlyOutlook" :key="month.start" class="prop-bar">
              <div class="prop-bar__track">
                <div class="prop-bar__fill" :style="{ height: barHeight(month.daily) }" />
              </div>
              <div class="prop-bar__label">{{ month.label }}</div>
              <div class="prop-bar__value">{{ formatHbd(month.daily) }}</div>
            </div>
          </div>
          <p class="prop-footnote">
            Bars show projected daily pay for funded proposals active during each month. Hover-free labels keep the chart readable at 390px.
          </p>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="prop-card">
        <q-card-section>
          <div class="prop-card__head">
            <div>
              <div class="prop-card__eyebrow">Who proposes</div>
              <h3 class="prop-card__title">Top creators</h3>
            </div>
            <router-link to="/proposals" class="prop-card__link">All proposals</router-link>
          </div>
          <ol class="prop-rank">
            <li v-for="row in analytics.creators.slice(0, 6)" :key="row.name">
              <router-link :to="'/@' + row.name">@{{ row.name }}</router-link>
              <span class="prop-rank__meta">{{ row.count }} proposal{{ row.count === 1 ? '' : 's' }} · {{ formatHbd(row.daily) }} HBD/day</span>
            </li>
            <li v-if="analytics.creators.length === 0" class="prop-muted">No proposals loaded.</li>
          </ol>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="prop-card">
        <q-card-section>
          <div class="prop-card__head">
            <div>
              <div class="prop-card__eyebrow">Funding mix</div>
              <h3 class="prop-card__title">Topics and receivers</h3>
            </div>
          </div>

          <div class="prop-chips" aria-label="Proposal topics">
            <span v-for="topic in analytics.topics.slice(0, 8)" :key="topic.topic" class="prop-chip">
              {{ topic.topic }} <b>{{ topic.count }}</b>
            </span>
            <span v-if="analytics.topics.length === 0" class="prop-muted">No topic signals yet.</span>
          </div>

          <ul class="prop-receivers" aria-label="Top proposal receivers">
            <li v-for="row in analytics.receivers.slice(0, 5)" :key="row.name">
              <router-link :to="'/@' + row.name">@{{ row.name }}</router-link>
              <span>{{ formatHbd(row.daily) }} HBD/day</span>
            </li>
          </ul>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="prop-card">
        <q-card-section>
          <div class="prop-card__eyebrow">Governance threshold</div>
          <div class="prop-metric">
            <span class="prop-metric__value">{{ formatHp(analytics.returnHp) }}</span>
            <span class="prop-metric__unit">HP</span>
          </div>
          <div class="prop-metric__hint">Return proposal #0 vote weight</div>

          <dl class="prop-pairs prop-pairs--single">
            <div>
              <dt>Active</dt>
              <dd>{{ analytics.activeCount }}</dd>
            </div>
            <div>
              <dt>Funded</dt>
              <dd>{{ analytics.fundedCount }}</dd>
            </div>
            <div>
              <dt>Upcoming</dt>
              <dd>{{ analytics.upcomingCount }}</dd>
            </div>
            <div>
              <dt>Expired</dt>
              <dd>{{ analytics.expiredCount }}</dd>
            </div>
          </dl>

          <p class="prop-footnote">
            A proposal is funded while its vote weight is at least the return proposal's. The return proposal itself sends unallocated DHF back to the DAO.
          </p>
        </q-card-section>
      </q-card>
    </div>
  </section>
</template>

<script>
import {
  proposalFundingAnalytics
} from 'src/services/governance'
import { formatHbd, formatHp } from 'src/services/proposals'

export default {
  name: 'ProposalAnalytics',
  props: {
    proposals: { type: Array, default: () => [] },
    globalProps: { type: Object, default: null },
    returnVotes: { type: Number, default: 0 }
  },
  computed: {
    analytics () {
      return proposalFundingAnalytics(this.proposals, this.globalProps, {
        returnVotes: this.returnVotes
      })
    }
  },
  methods: {
    formatHbd,
    formatHp,
    barHeight (value) {
      if (!this.analytics.peakDaily) return '2px'
      return Math.max(3, Math.round((value / this.analytics.peakDaily) * 100)) + '%'
    }
  }
}
</script>

<style scoped>
.prop-analytics {
  margin: 0 0 var(--space-5);
}

.prop-analytics__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.prop-analytics__eyebrow {
  color: #78909c;
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.prop-analytics__title {
  margin: 0.12rem 0 0;
  color: #e4eaed;
  font-size: 1.1rem;
  font-weight: 600;
}

.prop-analytics__hint {
  margin: 0.3rem 0 0;
  max-width: 70ch;
  color: #90a4ae;
  font-size: 0.8rem;
}

.prop-analytics__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: var(--space-3);
}

.prop-card {
  min-width: 0;
  background: rgba(255, 255, 255, 0.02);
}

.prop-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.prop-card__eyebrow {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.prop-card__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.95rem;
  font-weight: 600;
}

.prop-card__link {
  color: #4fc3f7;
  font-size: 0.74rem;
  text-decoration: none;
  white-space: nowrap;
}

.prop-card__link:hover {
  text-decoration: underline;
}

.prop-metric {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin: 0.55rem 0 0;
}

.prop-metric__value {
  color: #e4eaed;
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.1;
}

.prop-metric__unit {
  color: #90a4ae;
  font-size: 0.76rem;
}

.prop-metric__hint {
  color: #90a4ae;
  font-size: 0.74rem;
}

.prop-pairs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.8rem;
  margin: 0.75rem 0 0;
}

.prop-pairs--single {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.prop-pairs dt {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.prop-pairs dd {
  margin: 0;
  color: #cfd8dc;
  font-size: 0.8rem;
}

.prop-unfunded {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.7rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--border-subtle);
  color: #90a4ae;
  font-size: 0.72rem;
  line-height: 1.4;
}

.prop-bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.3rem;
  height: 150px;
  margin-top: 0.7rem;
  padding-top: 0.3rem;
}

.prop-bar {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  height: 100%;
}

.prop-bar__track {
  display: flex;
  flex: 1;
  align-items: flex-end;
  width: 100%;
  min-height: 40px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
}

.prop-bar__fill {
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #4fc3f7, #0288d1);
}

.prop-bar__label {
  color: #90a4ae;
  font-size: 0.56rem;
  white-space: nowrap;
}

.prop-bar__value {
  color: #cfd8dc;
  font-size: 0.56rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.prop-rank {
  margin: 0.5rem 0 0;
  padding: 0 0 0 1.1rem;
  color: #b0bec5;
  font-size: 0.76rem;
}

.prop-rank li {
  margin: 0.28rem 0;
}

.prop-rank a,
.prop-receivers a {
  color: #4fc3f7;
  text-decoration: none;
}

.prop-rank a:hover,
.prop-receivers a:hover {
  text-decoration: underline;
}

.prop-rank__meta {
  display: block;
  color: #78909c;
  font-size: 0.68rem;
}

.prop-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.55rem;
}

.prop-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.14rem 0.45rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  color: #b0bec5;
  font-size: 0.68rem;
  text-transform: capitalize;
}

.prop-chip b {
  color: #81d4fa;
  font-weight: 600;
}

.prop-receivers {
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.75rem;
}

.prop-receivers li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.25rem 0;
  border-top: 1px solid var(--border-subtle);
}

.prop-receivers li:first-child {
  border-top: 0;
}

.prop-receivers span {
  color: #90a4ae;
  white-space: nowrap;
}

.prop-muted {
  color: #90a4ae;
  font-size: 0.74rem;
}

.prop-footnote {
  margin: 0.55rem 0 0;
  color: #78909c;
  font-size: 0.7rem;
  line-height: 1.45;
}

@media (max-width: 599px) {
  .prop-pairs--single {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .prop-bar__value {
    display: none;
  }
}
</style>
