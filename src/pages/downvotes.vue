<template>
  <q-page class="dv-page">
    <account-header
      v-if="account !== undefined && globalProps !== null"
      :globalProps="globalProps"
      :account="account"
      :showBalances="false"
    />

    <div class="dv-shell">
      <header class="dv-head">
        <div>
          <div class="dv-eyebrow">Downvote transparency</div>
          <h2 class="dv-title">@{{ username }} downvotes</h2>
          <p class="dv-intro">
            Public chain activity, grouped for review. A downvote is a signal,
            not a verdict; a local ignored voter changes the view, not the chain.
          </p>
        </div>
        <div class="dv-actions">
          <q-btn flat dense no-caps icon="refresh" label="Refresh" :loading="loading" @click="load({ force: true })" />
          <q-btn v-if="isOwn" flat dense no-caps :icon="direction === 'received' ? 'south' : 'north'" :label="direction === 'received' ? 'Received' : 'Given'" @click="toggleDirection" />
          <q-btn flat dense no-caps icon="person" label="Account" :to="'/@' + username" />
        </div>
      </header>

      <div v-if="error" class="dv-state dv-state--error" role="alert">
        <q-icon name="error_outline" size="1.4em" aria-hidden="true" />
        <span>{{ error }}</span>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="load({ force: true })" />
      </div>

      <div v-else-if="loading && !rows.length" class="dv-skeletons" aria-label="Loading downvotes">
        <q-skeleton type="rect" height="86px" />
        <q-skeleton type="rect" height="260px" />
      </div>

      <template v-else>
        <section class="dv-summary" aria-label="Downvote summary">
          <div class="dv-stat">
            <span>Downvotes {{ direction }}</span>
            <strong>{{ summary.count }}</strong>
            <small>{{ summary.distinctTargets }} target{{ summary.distinctTargets === 1 ? '' : 's' }}</small>
          </div>
          <div class="dv-stat">
            <span>Distinct voters</span>
            <strong>{{ summary.distinctVoters }}</strong>
            <small>Raw chain impact</small>
          </div>
          <div class="dv-stat">
            <span>Total weight</span>
            <strong>{{ weightLabel(summary.totalWeight) }}</strong>
            <small>Sum of downvote weight</small>
          </div>
          <div class="dv-stat">
            <span>Largest vote</span>
            <strong>{{ weightLabel(summary.largestWeight) }}</strong>
            <small>{{ shareLabel(summary.topVoterShare) }} of the total</small>
          </div>
        </section>

        <section v-if="coordination" class="dv-evidence" aria-labelledby="dv-evidence-title">
          <div class="dv-evidence__head">
            <div>
              <div class="dv-evidence__eyebrow">Possible pattern</div>
              <h3 id="dv-evidence-title" class="dv-evidence__title">{{ coordination.label }}</h3>
            </div>
            <q-badge color="orange-9">not a verdict</q-badge>
          </div>
          <p class="dv-evidence__text">
            {{ coordination.voterCount }} voters share {{ coordination.targetCount }} targets inside
            {{ coordination.windowHours }}h; pairwise target overlap is {{ Math.round(coordination.overlap * 100) }}%.
            This is evidence for human review, never an automatic hide or punishment.
          </p>
          <div class="dv-evidence__lists">
            <div>
              <span class="dv-evidence__label">Voters</span>
              <router-link v-for="voter in coordination.voters" :key="'ev-voter-' + voter" :to="'/@' + voter" class="dv-chip">@{{ voter }}</router-link>
            </div>
            <div>
              <span class="dv-evidence__label">Targets</span>
              <router-link v-for="target in coordination.targets.slice(0, 6)" :key="'ev-target-' + target" :to="targetLink(target)" class="dv-chip">{{ target }}</router-link>
            </div>
          </div>
        </section>

        <section class="dv-controls" aria-label="Downvote filters">
          <q-select v-model="range" :options="rangeOptions" dense outlined emit-value map-options label="Time range" class="dv-control" />
          <q-select v-model="relationshipFilter" :options="relationshipOptions" dense outlined emit-value map-options label="Voter relationship" class="dv-control" />
          <q-select v-model="groupBy" :options="groupOptions" dense outlined emit-value map-options label="Group by" class="dv-control" />
          <q-toggle v-model="showIgnored" label="Show locally ignored voters" dense class="dv-control" />
          <span class="dv-controls__count">{{ filtered.length }} of {{ allDownvotes.length }} loaded</span>
        </section>

        <div v-if="groupBy !== 'none' && grouped.length" class="dv-groups">
          <article v-for="group in grouped" :key="group.key" class="dv-group">
            <div>
              <router-link v-if="groupBy === 'voter'" :to="'/@' + group.key" class="dv-group__key">@{{ group.key }}</router-link>
              <router-link v-else-if="groupBy === 'target'" :to="targetLink(group.key)" class="dv-group__key">{{ group.key }}</router-link>
              <span v-else class="dv-group__key">{{ group.key }}</span>
              <div class="dv-group__meta">{{ group.count }} votes · {{ group.voters }} voters · {{ weightLabel(group.totalWeight) }}</div>
            </div>
            <div class="dv-group__actions">
              <q-btn v-if="groupBy === 'voter'" flat dense no-caps :label="isIgnored(group.key) ? 'Unignore voter' : 'Ignore voter'" @click="toggleIgnored(group.key)" />
            </div>
          </article>
        </div>

        <div v-else-if="!filtered.length" class="dv-state">
          <q-icon name="shield" size="1.6em" aria-hidden="true" />
          <span>{{ allDownvotes.length ? 'No downvotes match these filters.' : 'No ' + direction + ' downvotes in the loaded history.' }}</span>
        </div>

        <div v-else class="dv-table-wrap">
          <table class="dv-table">
            <caption class="sr-only">Downvotes with voter, weight, target time and local relationship</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Voter</th>
                <th scope="col">Relationship</th>
                <th scope="col" class="dv-num">Weight</th>
                <th scope="col">Target</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pagedRows" :key="rowKey(row)">
                <td><time :datetime="row.timestamp">{{ timeLabel(row.timestamp) }}</time></td>
                <td><router-link :to="'/@' + row.voter">@{{ row.voter }}</router-link></td>
                <td><q-badge :color="relationshipColor(row.voter)">{{ relationship(row.voter) }}</q-badge></td>
                <td class="dv-num">{{ weightLabel(row.weight) }}</td>
                <td><router-link :to="targetLink(row.target)">{{ row.target }}</router-link></td>
                <td class="dv-row-action">
                  <button type="button" class="dv-link" @click="toggleIgnored(row.voter)">
                    {{ isIgnored(row.voter) ? 'Unignore' : 'Ignore voter' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="truncated" class="dv-more">
            <q-btn outline no-caps color="primary" icon="expand_more" label="Load older" :loading="loading" @click="loadOlder" />
            <span>History is capped for performance.</span>
          </div>
        </div>

        <section v-if="ignoredVoters.length" class="dv-ignored" aria-labelledby="dv-ignored-title">
          <h3 id="dv-ignored-title" class="dv-subtitle">Ignored voters</h3>
          <p>Their rows are marked in this local view. The summary above still includes the raw chain impact.</p>
          <button v-for="voter in ignoredVoters" :key="'ignored-' + voter" type="button" class="dv-chip" @click="toggleIgnored(voter)">
            @{{ voter }} ×
          </button>
        </section>
      </template>
    </div>
  </q-page>
</template>

<style scoped>
.dv-page { min-width: 0; }
.dv-shell { width: 100%; max-width: 1120px; margin: 0 auto; padding: var(--space-4) var(--space-4) var(--space-6); }
.dv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); flex-wrap: wrap; }
.dv-eyebrow { color: var(--c-primary); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.dv-title { margin: 0.2rem 0 0.35rem; font-size: clamp(1.4rem, 3vw, 1.9rem); overflow-wrap: anywhere; }
.dv-intro { max-width: 760px; margin: 0; color: var(--c-text-muted); line-height: 1.55; }
.dv-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.dv-state { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-4); color: var(--c-text-muted); }
.dv-state--error { color: var(--c-negative); }
.dv-skeletons { display: grid; gap: var(--space-2); margin-top: var(--space-4); }
.dv-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-2); margin-top: var(--space-4); }
.dv-stat { display: flex; flex-direction: column; gap: 0.1rem; padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); color: var(--c-text-muted); font-size: 0.74rem; }
.dv-stat strong { color: var(--c-text); font-size: 1.25rem; }
.dv-evidence { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--c-warning) 35%, var(--c-border)); border-radius: var(--radius-card); background: color-mix(in srgb, var(--c-warning) 7%, var(--c-surface-2)); }
.dv-evidence__head { display: flex; justify-content: space-between; gap: var(--space-2); align-items: flex-start; }
.dv-evidence__eyebrow { color: var(--c-warning); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.dv-evidence__title { margin: 0.1rem 0 0.35rem; font-size: 1rem; }
.dv-evidence__text { margin: 0; color: var(--c-text-muted); font-size: 0.8rem; line-height: 1.5; }
.dv-evidence__lists { display: grid; gap: 0.35rem; margin-top: var(--space-2); font-size: 0.78rem; }
.dv-evidence__label { display: block; color: var(--c-text-muted); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.dv-chip { display: inline-block; margin: 0.1rem 0.25rem 0 0; padding: 0.05rem 0.45rem; border: 0; border-radius: var(--radius-pill); background: color-mix(in srgb, var(--c-text) 7%, transparent); color: var(--c-link); font: inherit; text-decoration: none; cursor: pointer; }
.dv-controls { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-4); }
.dv-control { min-width: 150px; }
.dv-controls__count { color: var(--c-text-muted); font-size: 0.76rem; margin-left: auto; }
.dv-groups { display: grid; gap: var(--space-2); margin-top: var(--space-3); }
.dv-group { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); }
.dv-group__key { color: var(--c-text); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.dv-group__meta { color: var(--c-text-muted); font-size: 0.74rem; }
.dv-table-wrap { margin-top: var(--space-3); overflow-x: auto; }
.dv-table { width: 100%; border-collapse: collapse; min-width: 720px; }
.dv-table th, .dv-table td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--c-border); text-align: left; font-size: 0.78rem; vertical-align: top; }
.dv-table thead th { color: var(--c-text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
.dv-num { text-align: right !important; white-space: nowrap; }
.dv-row-action { text-align: right !important; }
.dv-link { border: 0; background: none; color: var(--c-link); font: inherit; cursor: pointer; text-decoration: underline; }
.dv-more { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); color: var(--c-text-muted); font-size: 0.76rem; }
.dv-ignored { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); color: var(--c-text-muted); font-size: 0.8rem; }
.dv-subtitle { margin: 0 0 0.25rem; color: var(--c-text); font-size: 0.9rem; }
</style>

<script>
import moment from 'src/utils/time'
import accountHeader from 'components/accountHeader.vue'
import {
  coordinationEvidence,
  downvotesFor,
  filterIgnoredVoters,
  groupDownvotes,
  relationshipFor,
  summarizeDownvotes
} from 'src/services/downvotes'
import { fetchAccountVoteHistory } from 'src/services/accountDownvotes'
import { setPageMeta } from 'src/utils/pageMeta'
import { useModerationStore } from 'src/stores/moderation'

const PAGE_ROWS = 40

export default {
  name: 'DownvotesPage',
  components: { accountHeader },
  data () {
    return {
      rows: [],
      truncated: false,
      pages: 3,
      loading: false,
      error: '',
      direction: 'received',
      range: '30',
      relationshipFilter: 'all',
      groupBy: 'none',
      showIgnored: false,
      visibleCount: PAGE_ROWS,
      rangeOptions: [
        { label: 'Last 7 days', value: '7' },
        { label: 'Last 30 days', value: '30' },
        { label: 'Last 90 days', value: '90' },
        { label: 'All loaded', value: 'all' }
      ],
      relationshipOptions: [
        { label: 'Any relationship', value: 'all' },
        { label: 'Accounts I follow', value: 'follows' },
        { label: 'Accounts I mute', value: 'muted' },
        { label: 'My blacklist', value: 'blacklist' },
        { label: 'Unknown', value: 'unknown' }
      ],
      groupOptions: [
        { label: 'No grouping', value: 'none' },
        { label: 'By voter', value: 'voter' },
        { label: 'By target', value: 'target' },
        { label: 'By day', value: 'day' }
      ]
    }
  },
  computed: {
    username () {
      return String(this.$route.params.username || '').toLowerCase()
    },
    loggedInUser () {
      return this.$hiveStore.user.username || ''
    },
    isOwn () {
      return Boolean(this.loggedInUser) && this.loggedInUser === this.username
    },
    account () {
      return this.$hiveStore.accounts[this.username]
    },
    globalProps () {
      return this.$hiveStore.globalProps
    },
    moderation () {
      return useModerationStore()
    },
    allDownvotes () {
      return downvotesFor(this.rows, this.username, this.direction)
    },
    summary () {
      return summarizeDownvotes(this.allDownvotes)
    },
    coordination () {
      return coordinationEvidence(this.allDownvotes)
    },
    ignoredVoters () {
      return this.moderation.ignoredVoters
    },
    filtered () {
      let list = this.allDownvotes
      if (this.range !== 'all') {
        const cutoff = Date.now() - Number(this.range) * 24 * 60 * 60 * 1000
        list = list.filter(row => (Number(row.time) || 0) >= cutoff)
      }
      if (this.relationshipFilter !== 'all') {
        list = list.filter(row => relationshipFor(row.voter, this.moderation.context) === this.relationshipFilter)
      }
      if (!this.showIgnored && this.ignoredVoters.length) {
        list = filterIgnoredVoters(list, this.ignoredVoters)
      }
      return list
    },
    grouped () {
      if (this.groupBy === 'none') return []
      return groupDownvotes(this.filtered, this.groupBy)
    },
    pagedRows () {
      return this.filtered.slice(0, this.visibleCount)
    }
  },
  watch: {
    '$route.params.username' () {
      this.load({ force: true })
    },
    direction () {
      this.visibleCount = PAGE_ROWS
    },
    range () {
      this.visibleCount = PAGE_ROWS
    },
    groupBy () {
      this.visibleCount = PAGE_ROWS
    }
  },
  mounted () {
    setPageMeta({
      title: '@' + this.username + ' downvotes — voter and target transparency — hive.ausbit.dev',
      description: 'Public downvote activity for @' + this.username + ' on hive.ausbit.dev, with voter, weight, target, time and local relationship context.',
      url: '/@' + this.username + '/downvotes'
    })
    this.moderation.setScope(this.loggedInUser || 'guest')
    this.moderation.ensureContext()
    if (!this.account) this.$hiveStore.getAccount(this.username)
    this.load()
  },
  methods: {
    async load ({ force = false } = {}) {
      if (!this.username) return
      this.loading = true
      this.error = ''
      try {
        const result = await fetchAccountVoteHistory(this.username, { pages: this.pages, force })
        this.rows = result.rows
        this.truncated = result.truncated
      } catch (error) {
        this.error = error?.message || 'Could not load downvote history.'
      } finally {
        this.loading = false
      }
    },
    loadOlder () {
      this.pages = Math.min(5, this.pages + 1)
      this.load({ force: true })
    },
    toggleDirection () {
      this.direction = this.direction === 'received' ? 'given' : 'received'
    },
    relationship (voter) {
      return relationshipFor(voter, this.moderation.context)
    },
    relationshipColor (voter) {
      const value = this.relationship(voter)
      if (value === 'muted') return 'red-9'
      if (value === 'follows') return 'green-9'
      if (value === 'blacklist') return 'orange-9'
      if (value === 'followed list' || value === 'followed blacklist') return 'blue-grey-9'
      return 'grey-8'
    },
    isIgnored (voter) {
      return this.ignoredVoters.includes(String(voter || '').toLowerCase())
    },
    toggleIgnored (voter) {
      if (this.isIgnored(voter)) this.moderation.unignoreVoter(voter)
      else this.moderation.ignoreVoter(voter)
    },
    targetLink (target) {
      return '/@' + String(target || '')
    },
    rowKey (row) {
      return row.index !== null ? 'i:' + row.index : row.trxId + ':' + row.voter
    },
    weightLabel (weight) {
      const percent = Number(weight) / 100
      if (!Number.isFinite(percent)) return '—'
      return (percent > 0 ? '+' : '') + percent.toFixed(1) + '%'
    },
    shareLabel (value) {
      const percent = Number(value) * 100
      return Number.isFinite(percent) ? percent.toFixed(1) + '%' : '—'
    },
    timeLabel (value) {
      if (!value) return '—'
      const time = moment.utc(value)
      return time.isValid() ? time.fromNow() : value
    }
  }
}
</script>
