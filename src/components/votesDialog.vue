<template>
  <q-card flat class="votes-dialog">
    <div class="votes-dialog__head">
      <div class="votes-dialog__intro">
        <div class="votes-dialog__eyebrow">Vote breakdown</div>
        <h2 class="votes-dialog__title">Who voted on this post</h2>
      </div>
      <q-btn flat dense round icon="close" aria-label="Close vote breakdown" title="Close" v-close-popup class="votes-dialog__close" />
    </div>

    <div class="votes-dialog__summary" role="list">
      <div class="votes-summary votes-summary--up" role="listitem">
        <q-icon name="thumb_up_alt" size="17px" aria-hidden="true" />
        <strong>{{ tidyNumber(upvotesOnly.length) }}</strong>
        <span>upvote{{ upvotesOnly.length === 1 ? '' : 's' }}</span>
      </div>
      <div v-if="downvotesOnly.length > 0" class="votes-summary votes-summary--down" role="listitem">
        <q-icon name="thumb_down_alt" size="17px" aria-hidden="true" />
        <strong>{{ tidyNumber(downvotesOnly.length) }}</strong>
        <span>downvote{{ downvotesOnly.length === 1 ? '' : 's' }}</span>
      </div>
      <div v-if="unvotesOnly.length > 0" class="votes-summary votes-summary--muted" role="listitem">
        <q-icon name="remove_circle_outline" size="17px" aria-hidden="true" />
        <strong>{{ tidyNumber(unvotesOnly.length) }}</strong>
        <span>unvote{{ unvotesOnly.length === 1 ? '' : 's' }}</span>
      </div>
      <div v-if="totalRshares > 0" class="votes-summary votes-summary--muted" role="listitem" title="Total rshares from upvotes">
        <q-icon name="insights" size="17px" aria-hidden="true" />
        <strong>{{ compactNumber(totalRshares) }}</strong>
        <span>rshares</span>
      </div>
    </div>

    <div v-if="downvotesOnly.length" class="votes-dialog__context" aria-label="Downvote context">
      <span><strong>{{ context.distinctDown }}</strong> distinct downvoters</span>
      <span><strong>{{ context.distinctUp }}</strong> distinct upvoters</span>
      <span>top stake share <strong>{{ context.stakeConcentration }}%</strong></span>
      <span>net direction <strong>{{ context.netDirection }}</strong></span>
    </div>

    <q-tabs
      v-model="view"
      dense
      no-caps
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="votes-dialog__tabs"
      aria-label="Vote view"
    >
      <q-tab name="influencers" icon="analytics" label="Top voters" />
      <q-tab name="table" icon="table_view" label="Full data" />
    </q-tabs>

    <div v-if="view === 'influencers'" class="votes-dialog__body">
      <section v-if="biggestUpvotes.length" aria-labelledby="votes-top-up">
        <h3 id="votes-top-up" class="votes-dialog__section-title">Largest upvotes</h3>
        <ul class="votes-grid">
          <li v-for="voter in biggestUpvotes" :key="voter.voter" class="votes-grid__item">
            <router-link :to="linkAccount(voter.voter)" class="votes-grid__link" :title="'@' + voter.voter + ' · ' + weightLabel(voter)">
              <q-avatar size="34px" class="votes-grid__avatar">
                <q-img :src="getHiveAvatarUrl(voter.voter)" :alt="'Avatar of @' + voter.voter" />
              </q-avatar>
              <span class="votes-grid__name">@{{ voter.voter }}</span>
              <span class="votes-grid__weight">{{ weightLabel(voter) }}</span>
            </router-link>
          </li>
        </ul>
      </section>

      <section v-if="biggestDownvotes.length" aria-labelledby="votes-top-down">
        <h3 id="votes-top-down" class="votes-dialog__section-title">Largest downvotes</h3>
        <ul class="votes-grid">
          <li v-for="voter in biggestDownvotes" :key="voter.voter" class="votes-grid__item">
            <router-link :to="linkAccount(voter.voter)" class="votes-grid__link votes-grid__link--down" :title="'@' + voter.voter + ' · ' + weightLabel(voter)">
              <q-avatar size="34px" class="votes-grid__avatar">
                <q-img :src="getHiveAvatarUrl(voter.voter)" :alt="'Avatar of @' + voter.voter" />
              </q-avatar>
              <span class="votes-grid__name">@{{ voter.voter }}</span>
              <span class="votes-grid__weight">{{ weightLabel(voter) }}</span>
            </router-link>
          </li>
        </ul>
      </section>

      <div v-if="!biggestUpvotes.length && !biggestDownvotes.length" class="votes-dialog__empty">
        <q-icon name="thumb_up_off_alt" size="22px" aria-hidden="true" />
        <span>No votes have been cast on this post yet.</span>
      </div>
    </div>

    <q-table
      v-else
      :rows="sortedVotes"
      :columns="voteColumns"
      row-key="voter"
      :rows-per-page-options="[0]"
      dense
      flat
      separator="horizontal"
      class="votes-dialog__table"
      aria-label="All votes"
    >
      <template #body-cell-voter="props">
        <q-td :props="props">
          <router-link :to="linkAccount(props.row.voter)" class="votes-dialog__voter">@{{ props.row.voter }}</router-link>
        </q-td>
      </template>
      <template #body-cell-percent="props">
        <q-td :props="props" class="votes-dialog__num">{{ percentLabel(props.row.percent) }}</q-td>
      </template>
      <template #body-cell-rshares="props">
        <q-td :props="props" class="votes-dialog__num" :title="props.row.rshares">{{ compactNumber(props.row.rshares) }}</q-td>
      </template>
      <template #body-cell-reputation="props">
        <q-td :props="props" class="votes-dialog__num">{{ reputationLabel(props.row.reputation) }}</q-td>
      </template>
      <template #body-cell-time="props">
        <q-td :props="props">{{ relativeTime(props.row.time) }}</q-td>
      </template>
    </q-table>
  </q-card>
</template>
<script>
import moment from 'src/utils/time'
import { formatReputation } from 'src/services/comments'
import { downvoteContext } from 'src/services/downvotes'
import { fetchActiveVotes } from 'src/services/accountDownvotes'
import { hiveAvatarUrl } from 'src/utils/avatar'
import { normalizeVotes, voteDirection } from 'src/services/voteBreakdown'

export default {
  name: 'votesDialog',
  components: {
  },
  data () {
    return {
      view: 'influencers',
      voteColumns: [
        { name: 'voter', label: 'Voter', field: 'voter', sortable: true, align: 'left' },
        { name: 'percent', label: 'Weight', field: 'percent', sortable: true, align: 'right' },
        { name: 'rshares', label: 'rshares', field: 'rshares', sortable: true, align: 'right' },
        { name: 'reputation', label: 'Reputation', field: 'reputation', sortable: true, align: 'right' },
        { name: 'time', label: 'When', field: 'time', sortable: true, align: 'right' }
      ],
      activeVotes: [],
      activeLoading: false,
      activeError: ''
    }
  },
  props: {
    // A post loaded from a partial cache/snapshot can arrive without vote
    // rows, so never require a populated array here.
    votes: { type: Array, required: false, default: () => [] },
    simple: { type: Boolean, required: false, default: false },
    author: { type: String, default: '' },
    permlink: { type: String, default: '' }
  },
  mounted () {
    if (!this.votes.length && this.author && this.permlink) this.loadActiveVotes()
  },
  computed: {
    safeVotes () {
      return normalizeVotes(this.votes.length ? this.votes : this.activeVotes)
    },
    sortedVotes () {
      return [...this.safeVotes].sort(this.sortByRshares)
    },
    upvotesOnly () { return this.safeVotes.filter(v => voteDirection(v) === 1) },
    downvotesOnly () { return this.safeVotes.filter(v => voteDirection(v) === -1) },
    unvotesOnly () { return this.safeVotes.filter(v => voteDirection(v) === 0) },
    context () { return downvoteContext(this.safeVotes) },
    totalRshares () {
      return this.upvotesOnly.reduce((sum, vote) => sum + (Number(vote.rshares) || 0), 0)
    },
    biggestUpvotes () {
      return [...this.upvotesOnly].sort(this.sortByRshares).slice(0, 10)
    },
    biggestDownvotes () {
      return [...this.downvotesOnly].sort(this.sortByRshares).slice(0, 10)
    }
  },
  methods: {
    async loadActiveVotes () {
      if (this.activeLoading) return
      this.activeLoading = true
      this.activeError = ''
      try {
        this.activeVotes = await fetchActiveVotes(this.author, this.permlink)
      } catch (error) {
        this.activeError = error?.message || 'Could not load active votes.'
      } finally {
        this.activeLoading = false
      }
    },
    sortByRshares (a, b) { return Math.abs(Number(b.rshares) || 0) - Math.abs(Number(a.rshares) || 0) },
    getHiveAvatarUrl (user) { return hiveAvatarUrl(user) },
    linkAccount (username) { return username ? '/@' + username : '/' },
    percentLabel (value) {
      const percent = Number(value)
      if (value === null || value === undefined || !Number.isFinite(percent)) return '—'
      return (percent / 100) + '%'
    },
    tidyNumber (value) {
      return Number(value || 0).toLocaleString('en-US')
    },
    compactNumber (value) {
      const number = Number(value) || 0
      if (number >= 1e12) return (number / 1e12).toFixed(1) + 'T'
      if (number >= 1e9) return (number / 1e9).toFixed(1) + 'B'
      if (number >= 1e6) return (number / 1e6).toFixed(1) + 'M'
      if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K'
      return String(number)
    },
    weightLabel (vote) {
      const raw = vote && vote.percent !== undefined && vote.percent !== null ? Number(vote.percent) : NaN
      if (!Number.isFinite(raw)) return ''
      const percent = raw / 100
      return (percent > 0 ? '+' : '') + percent + '%'
    },
    relativeTime (value) {
      if (!value) return '—'
      return moment.utc(value).fromNow()
    },
    reputationLabel (value) {
      // bridge/condenser expose reputation as an offset log score.
      const raw = Number(value)
      if (!Number.isFinite(raw) || raw === 0) return '—'
      return formatReputation(raw)
    }
  }
}
</script>

<style scoped>
.votes-dialog {
  width: min(720px, 96vw);
  max-height: min(84vh, 780px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--c-surface-2);
}

.votes-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-2);
}

.votes-dialog__eyebrow {
  color: var(--c-text-faint);
  font-size: 0.66rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.votes-dialog__title {
  margin: 0.1rem 0 0;
  color: var(--c-text);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.25;
}

.votes-dialog__close {
  color: var(--c-text-subtle);
}

.votes-dialog__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0 var(--space-4) var(--space-3);
}

.votes-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text-muted);
  font-size: 0.74rem;
  white-space: nowrap;
}

.votes-summary strong {
  color: var(--c-text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.votes-summary--up {
  border-color: color-mix(in srgb, var(--c-positive) 35%, transparent);
  color: var(--c-positive);
}

.votes-summary--up .q-icon,
.votes-summary--up strong {
  color: var(--c-positive);
}

.votes-summary--down {
  border-color: color-mix(in srgb, var(--c-negative) 35%, transparent);
}

.votes-summary--down .q-icon,
.votes-summary--down strong {
  color: var(--c-negative);
}

.votes-summary--muted .q-icon {
  color: var(--c-text-faint);
}

.votes-dialog__context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  padding: 0.45rem 0.75rem;
  color: var(--c-text-muted);
  font-size: 0.74rem;
}

.votes-dialog__context strong {
  color: var(--c-text);
}

.votes-dialog__tabs {
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.votes-dialog__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  overflow-y: auto;
}

.votes-dialog__section-title {
  margin: 0 0 var(--space-2);
  color: var(--c-text-faint);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.votes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.votes-grid__link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.35rem 0.5rem 0.35rem 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--c-text) 3%, transparent);
  color: var(--c-text);
  text-decoration: none;
}

.votes-grid__link:hover {
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
  text-decoration: none;
}

.votes-grid__avatar {
  flex: none;
  border: 1px solid color-mix(in srgb, var(--c-text) 10%, transparent);
}

.votes-grid__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.votes-grid__weight {
  flex: none;
  color: var(--c-positive);
  font-size: 0.7rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.votes-grid__link--down .votes-grid__weight {
  color: var(--c-negative);
}

.votes-dialog__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: var(--space-6) var(--space-4);
  color: var(--c-text-subtle);
  font-size: 0.84rem;
  text-align: center;
}

.votes-dialog__table {
  overflow-y: auto;
  font-size: 0.78rem;
}

.votes-dialog__voter {
  color: var(--c-link);
  text-decoration: none;
}

.votes-dialog__num {
  font-variant-numeric: tabular-nums;
}
</style>
