<template>
  <section class="community-insights" aria-labelledby="community-insights-title">
    <div class="community-insights__head">
      <div>
        <div class="community-insights__eyebrow">Community insights</div>
        <h2 id="community-insights-title" class="community-insights__title">Activity and moderation signals</h2>
        <p class="community-insights__hint">
          Recent posting cadence, top authors and visible moderation context for {{ communityInfo?.title || communityName }}.
        </p>
      </div>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Refresh" :loading="loading" @click="load" />
    </div>

    <q-card v-if="error" flat bordered class="community-insights__state community-insights__state--error">
      <q-icon name="error_outline" size="1.6em" aria-hidden="true" />
      <span>{{ error }}</span>
      <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="load" />
    </q-card>

    <div v-else class="community-insights__grid">
      <q-card flat bordered class="community-stat">
        <div class="community-stat__label">Subscribers</div>
        <div class="community-stat__value">{{ loading ? '—' : formatNumber(insights.subscribers) }}</div>
        <div class="community-stat__hint">on-chain subscriptions</div>
      </q-card>
      <q-card flat bordered class="community-stat">
        <div class="community-stat__label">Active authors</div>
        <div class="community-stat__value">{{ loading ? '—' : formatNumber(insights.activeAuthors7d) }}</div>
        <div class="community-stat__hint">posted in the last 7 days</div>
      </q-card>
      <q-card flat bordered class="community-stat">
        <div class="community-stat__label">Posts · 30 days</div>
        <div class="community-stat__value">{{ loading ? '—' : formatNumber(insights.posts30d) }}</div>
        <div class="community-stat__hint">{{ formatNumber(insights.posts7d) }} in the last 7 days</div>
      </q-card>
      <q-card flat bordered class="community-stat">
        <div class="community-stat__label">Pending payouts</div>
        <div class="community-stat__value">{{ loading ? '—' : formatHbd(insights.pendingRewards) }}</div>
        <div class="community-stat__hint">{{ insights.weeklyInteractions ? formatNumber(insights.weeklyInteractions) + ' weekly interactions' : 'community rewards' }}</div>
      </q-card>

      <q-card flat bordered class="community-insights__card community-insights__card--wide">
        <q-card-section>
          <div class="community-insights__card-head">
            <div>
              <div class="community-insights__card-eyebrow">Cadence</div>
              <h3 class="community-insights__card-title">Posts by day</h3>
            </div>
            <span class="community-insights__muted">last {{ insights.cadence.length }} days</span>
          </div>
          <div class="community-cadence" role="img" :aria-label="'Posts per day for the last ' + insights.cadence.length + ' days'">
            <div v-for="day in insights.cadence" :key="day.key" class="community-cadence__day">
              <div class="community-cadence__track">
                <div class="community-cadence__fill" :style="{ height: cadenceHeight(day.count) }" />
              </div>
              <span class="community-cadence__label">{{ day.label }}</span>
              <span class="community-cadence__count">{{ day.count }}</span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="community-insights__card">
        <q-card-section>
          <div class="community-insights__card-head">
            <div>
              <div class="community-insights__card-eyebrow">Authors</div>
              <h3 class="community-insights__card-title">Top recent authors</h3>
            </div>
          </div>
          <ol class="community-authors">
            <li v-for="row in insights.authors.slice(0, 6)" :key="row.author">
              <router-link :to="'/@' + row.author">@{{ row.author }}</router-link>
              <span>{{ row.posts }} post{{ row.posts === 1 ? '' : 's' }} · {{ formatHbd(row.payout) }}</span>
            </li>
            <li v-if="!insights.authors.length" class="community-insights__muted">No recent posts found.</li>
          </ol>
          <p v-if="insights.totalPayout > 0" class="community-insights__note">
            The top 10% of recent posts hold {{ formatPercent(insights.topTenShare * 100) }} of pending payouts.
          </p>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="community-insights__card">
        <q-card-section>
          <div class="community-insights__card-head">
            <div>
              <div class="community-insights__card-eyebrow">Moderation</div>
              <h3 class="community-insights__card-title">Visible signals</h3>
            </div>
            <q-badge
              :color="insights.moderationSignals ? 'orange-9' : 'green-9'"
              :text-color="insights.moderationSignals ? 'black' : 'white'"
            >
              {{ insights.moderationSignals }} signal{{ insights.moderationSignals === 1 ? '' : 's' }}
            </q-badge>
          </div>

          <ul class="community-moderation">
            <li>
              <q-icon name="volume_off" size="15px" aria-hidden="true" />
              <span>{{ insights.mutedCount }} muted post{{ insights.mutedCount === 1 ? '' : 's' }} in the current muted feed.</span>
            </li>
            <li v-if="insights.nsfw">
              <q-icon name="visibility_off" size="15px" aria-hidden="true" />
              <span>The community is marked NSFW.</span>
            </li>
            <li v-if="insights.restricted">
              <q-icon name="lock" size="15px" aria-hidden="true" />
              <span>Posting is restricted by community settings.</span>
            </li>
          </ul>

          <div v-if="insights.flagText" class="community-flag-text">
            <div class="community-flag-text__label">Flag text</div>
            <p>{{ insights.flagText }}</p>
          </div>
          <p v-else class="community-insights__note">No community flag text is published.</p>
        </q-card-section>
      </q-card>
    </div>
  </section>
</template>

<script>
import { communityInsights, fetchCommunityInsightData } from 'src/services/community'

export default {
  name: 'CommunityInsights',
  props: {
    communityName: { type: String, required: true },
    communityInfo: { type: Object, default: null }
  },
  data () {
    return {
      posts: [],
      mutedPosts: [],
      loading: false,
      error: ''
    }
  },
  computed: {
    insights () {
      return communityInsights(this.posts, {
        communityInfo: this.communityInfo,
        mutedPosts: this.mutedPosts
      })
    }
  },
  watch: {
    communityName: {
      immediate: true,
      handler () {
        this.load()
      }
    }
  },
  methods: {
    formatNumber (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '0'
      return number.toLocaleString('en-US', { maximumFractionDigits: 0 })
    },
    formatHbd (value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return '0 HBD'
      return number.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' HBD'
    },
    formatPercent (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(1) + '%' : '0%'
    },
    cadenceHeight (count) {
      if (!this.insights.peakCadence) return '2px'
      return Math.max(3, Math.round((count / this.insights.peakCadence) * 100)) + '%'
    },
    async load () {
      if (!this.communityName) return
      this.loading = true
      this.error = ''
      try {
        const data = await fetchCommunityInsightData(this.communityName)
        this.posts = data.posts
        this.mutedPosts = data.mutedPosts
      } catch {
        this.error = 'Could not load community insights.'
        this.posts = []
        this.mutedPosts = []
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.community-insights {
  margin-bottom: var(--space-4);
}

.community-insights__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.community-insights__eyebrow {
  color: #78909c;
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.community-insights__title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 1rem;
  font-weight: 600;
}

.community-insights__hint {
  margin: 0.25rem 0 0;
  max-width: 70ch;
  color: #90a4ae;
  font-size: 0.76rem;
}

.community-insights__state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: #b0bec5;
  font-size: 0.8rem;
}

.community-insights__state--error {
  color: #ffb74d;
}

.community-insights__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: var(--space-2);
}

.community-stat {
  min-width: 0;
  padding: 0.6rem 0.7rem;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02);
}

.community-stat__label {
  color: #90a4ae;
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.community-stat__value {
  color: #e4eaed;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.2;
}

.community-stat__hint {
  color: #78909c;
  font-size: 0.68rem;
}

.community-insights__card {
  min-width: 0;
  background: rgba(255, 255, 255, 0.02);
}

.community-insights__card--wide {
  grid-column: span 2;
}

.community-insights__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.community-insights__card-eyebrow {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.community-insights__card-title {
  margin: 0.1rem 0 0;
  color: #e4eaed;
  font-size: 0.9rem;
  font-weight: 600;
}

.community-insights__muted,
.community-insights__note {
  color: #90a4ae;
  font-size: 0.7rem;
}

.community-insights__note {
  margin: 0.45rem 0 0;
  line-height: 1.4;
}

.community-cadence {
  display: flex;
  align-items: flex-end;
  gap: 0.22rem;
  height: 120px;
  margin-top: 0.55rem;
}

.community-cadence__day {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
  height: 100%;
}

.community-cadence__track {
  display: flex;
  flex: 1;
  align-items: flex-end;
  width: 100%;
  min-height: 30px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.04);
}

.community-cadence__fill {
  width: 100%;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, #66bb6a, #2e7d32);
}

.community-cadence__label {
  color: #78909c;
  font-size: 0.52rem;
  white-space: nowrap;
}

.community-cadence__count {
  color: #b0bec5;
  font-size: 0.56rem;
  font-variant-numeric: tabular-nums;
}

.community-authors {
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.75rem;
}

.community-authors li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.25rem 0;
  border-top: 1px solid var(--border-subtle);
}

.community-authors li:first-child {
  border-top: 0;
}

.community-authors a {
  color: #4fc3f7;
  text-decoration: none;
}

.community-authors a:hover {
  text-decoration: underline;
}

.community-authors span {
  color: #90a4ae;
  white-space: nowrap;
}

.community-moderation {
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
  color: #b0bec5;
  font-size: 0.74rem;
}

.community-moderation li {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.22rem 0;
}

.community-flag-text {
  margin-top: 0.45rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border-subtle);
}

.community-flag-text__label {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.community-flag-text p {
  margin: 0.2rem 0 0;
  color: #b0bec5;
  font-size: 0.72rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .community-insights__card--wide {
    grid-column: span 1;
  }
}

@media (max-width: 599px) {
  .community-cadence__label {
    display: none;
  }
}
</style>
