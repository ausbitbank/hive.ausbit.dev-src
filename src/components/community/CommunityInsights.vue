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

    <p v-if="!loading && !error && insights.postCount" class="community-insights__sample">
      Sample: {{ formatNumber(insights.postCount) }} most recent posts
      <template v-if="sample.truncated"> · 30-day counts may be partial for this high-volume community</template>
    </p>

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
        <div class="community-stat__hint">posted in the last 7 days · sampled</div>
      </q-card>
      <q-card flat bordered class="community-stat">
        <div class="community-stat__label">Posts · 30 days</div>
        <div class="community-stat__value">{{ loading ? '—' : formatNumber(insights.posts30d) }}</div>
        <div class="community-stat__hint">{{ formatNumber(insights.posts7d) }} in the last 7 days · sampled</div>
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

      <q-card
        id="moderation-context"
        flat
        bordered
        class="community-insights__card community-insights__card--wide"
      >
        <q-card-section aria-labelledby="community-moderation-title">
          <div class="community-insights__card-head">
            <div>
              <div class="community-insights__card-eyebrow">Moderation</div>
              <h3 id="community-moderation-title" class="community-insights__card-title">Community moderation context</h3>
            </div>
            <q-badge
              :color="moderation.mutedCount ? 'orange-9' : 'grey-7'"
              :text-color="moderation.mutedCount ? 'black' : 'white'"
            >
              {{ moderation.mutedCount }} in muted feed
            </q-badge>
          </div>

          <p class="community-insights__note">
            This is the community's current muted feed. It can include community moderator
            actions and bridge-level judgments such as low reputation, a muted parent or a
            muted role; the reason hints below name the source. All of it is separate from
            your personal mute list, lists you follow, and your local display policy.
          </p>

          <div class="community-moderation__section">
            <h4 class="community-moderation__subtitle">Muted posts by reason</h4>
            <ul v-if="moderation.reasons.length" class="community-moderation">
              <li v-for="reason in moderation.reasons" :key="reason.key" class="community-moderation__reason">
                <div>
                  <strong>{{ reason.label }}</strong>
                  <span class="community-moderation__hint">{{ reason.hint }}</span>
                </div>
                <q-badge color="grey-7">{{ reason.count }}</q-badge>
              </li>
            </ul>
            <p v-else class="community-insights__note">
              No muted posts were returned in the current bridge sample.
            </p>
            <p v-if="moderation.reasons.length" class="community-insights__note">
              A post can have more than one bridge reason. “Low reputation” is a bridge
              judgment, not a community moderator action.
            </p>
          </div>

          <div v-if="moderation.recent.length" class="community-moderation__section">
            <h4 class="community-moderation__subtitle">Recent muted posts</h4>
            <ul class="community-moderation__recent-list">
              <li v-for="row in moderation.recent" :key="row.author + '/' + row.permlink">
                <router-link :to="'/@' + row.author + '/' + row.permlink">{{ row.title }}</router-link>
                <span>@{{ row.author }} · {{ row.reasonLabel }}</span>
              </li>
            </ul>
          </div>

          <ul class="community-moderation">
            <li v-if="moderation.teamSize">
              <q-icon name="groups" size="15px" aria-hidden="true" />
              <span>{{ roleSummary }}.</span>
              <router-link :to="aboutLink">Rules and team</router-link>
            </li>
            <li v-if="moderation.nsfw">
              <q-icon name="visibility_off" size="15px" aria-hidden="true" />
              <span>The community is marked NSFW.</span>
            </li>
            <li v-if="moderation.restricted">
              <q-icon name="lock" size="15px" aria-hidden="true" />
              <span>Posting is restricted by community settings.</span>
            </li>
          </ul>

          <div v-if="moderation.flagText" class="community-flag-text">
            <div class="community-flag-text__label">Flag text</div>
            <p>{{ moderation.flagText }}</p>
          </div>
          <p v-else class="community-insights__note">No community flag text is published.</p>

          <div class="community-moderation__actions">
            <router-link v-if="moderation.mutedFeed" :to="moderation.mutedFeed">Open muted feed</router-link>
            <router-link to="/settings/moderation">Your moderation settings</router-link>
          </div>

          <p class="community-insights__note">
            This is the current bridge muted feed, not a complete moderation history.
            Per-post moderator notes are not exposed, so this view does not invent them.
          </p>
        </q-card-section>
      </q-card>
    </div>
  </section>
</template>

<script>
import { communityInsights, fetchCommunityInsightData } from 'src/services/community'
import { communityModerationContext } from 'src/services/communityModeration'

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
      sample: { pages: 0, truncated: false },
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
    },
    moderation () {
      return communityModerationContext({
        community: this.communityInfo,
        posts: this.mutedPosts
      })
    },
    aboutLink () {
      return '/c/' + this.communityName + '?tab=about'
    },
    roleSummary () {
      const rows = this.moderation.roles.map(row => {
        const label = row.role === 'mod' ? 'mod' : row.role
        return row.count + ' ' + label + (row.count === 1 ? '' : 's')
      })
      return 'Team: ' + rows.join(' · ')
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
        this.sample = { pages: data.pages, truncated: data.truncated }
      } catch {
        this.error = 'Could not load community insights.'
        this.posts = []
        this.mutedPosts = []
        this.sample = { pages: 0, truncated: false }
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
  color: var(--c-text-faint);
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.community-insights__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1rem;
  font-weight: 600;
}

.community-insights__hint {
  margin: 0.25rem 0 0;
  max-width: 70ch;
  color: var(--c-text-subtle);
  font-size: 0.76rem;
}

.community-insights__sample {
  margin: 0 0 var(--space-2);
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.community-insights__state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: var(--c-text-muted);
  font-size: 0.8rem;
}

.community-insights__state--error {
  color: var(--c-warning);
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
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.community-stat__label {
  color: var(--c-text-subtle);
  font-size: 0.64rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.community-stat__value {
  color: var(--c-text);
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.2;
}

.community-stat__hint {
  color: var(--c-text-faint);
  font-size: 0.68rem;
}

.community-insights__card {
  min-width: 0;
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
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
  color: var(--c-text-faint);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.community-insights__card-title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.community-insights__muted,
.community-insights__note {
  color: var(--c-text-subtle);
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
  background: color-mix(in srgb, var(--c-text) 4%, transparent);
}

.community-cadence__fill {
  width: 100%;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, var(--c-positive), var(--c-positive));
}

.community-cadence__label {
  color: var(--c-text-faint);
  font-size: 0.52rem;
  white-space: nowrap;
}

.community-cadence__count {
  color: var(--c-text-muted);
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
  color: var(--c-link);
  text-decoration: none;
}

.community-authors a:hover {
  text-decoration: underline;
}

.community-authors span {
  color: var(--c-text-subtle);
  white-space: nowrap;
}

.community-moderation {
  margin: 0.4rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--c-text-muted);
  font-size: 0.74rem;
}

.community-moderation li {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.22rem 0;
}

.community-moderation__section {
  margin-top: 0.55rem;
}

.community-moderation__subtitle {
  margin: 0;
  color: var(--c-text);
  font-size: 0.76rem;
  font-weight: 600;
}

.community-moderation__reason {
  justify-content: space-between;
  gap: 0.6rem;
}

.community-moderation__reason > div {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.community-moderation__hint {
  color: var(--c-text-subtle);
  font-size: 0.68rem;
  line-height: 1.35;
}

.community-moderation__recent-list {
  margin: 0.3rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.community-moderation__recent-list li {
  display: grid;
  gap: 0.1rem;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.72rem;
}

.community-moderation__recent-list li:last-child {
  border-bottom: 0;
}

.community-moderation__recent-list a {
  color: var(--c-link);
  text-decoration: none;
  overflow-wrap: anywhere;
}

.community-moderation__recent-list span {
  color: var(--c-text-subtle);
  overflow-wrap: anywhere;
}

.community-moderation__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.55rem;
  font-size: 0.72rem;
}

.community-moderation__actions a {
  color: var(--c-link);
  font-weight: 600;
}

.community-flag-text {
  margin-top: 0.45rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--border-subtle);
}

.community-flag-text__label {
  color: var(--c-text-faint);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.community-flag-text p {
  margin: 0.2rem 0 0;
  color: var(--c-text-muted);
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
