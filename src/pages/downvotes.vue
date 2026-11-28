<template>
  <q-page class="dv-page">
    <profile-skin :account="account" :author="username" context="profile">
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
          <h1 class="dv-title">@{{ username }} downvotes</h1>
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
            <span>Total deducted</span>
            <strong>{{ valueLabel(summary.totalValueUsd) }}</strong>
            <small v-if="summary.totalRshares">{{ compactNumber(summary.totalRshares) }} rshares total (est.)</small>
            <small v-else>Estimate unavailable</small>
          </div>
          <div class="dv-stat">
            <span>Largest deduction</span>
            <strong>{{ valueLabel(summary.largestValueUsd) }}</strong>
            <small v-if="summary.totalValueUsd">{{ shareLabel(summary.topValueShare) }} of the total</small>
            <small v-else>{{ weightLabel(summary.largestWeight) }} largest weight</small>
          </div>
        </section>

        <p v-if="valuationLoading" class="dv-note">Estimating dollar impact from voter stake…</p>
        <p v-else-if="allDownvotes.length && !summary.totalValueUsd" class="dv-note">
          {{ valuationError || 'Dollar estimates need each voter\'s Hive Power, downvote mana, the post reward fund and a price feed. The weight column is exact chain data; the dollar estimate is unavailable right now.' }}
        </p>

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
          <q-select v-model="minWeight" :options="weightOptions" dense outlined emit-value map-options label="Minimum weight" class="dv-control" />
          <q-select v-model="groupBy" :options="groupOptions" dense outlined emit-value map-options label="Group by" class="dv-control" />
          <q-toggle v-model="showIgnored" label="Show locally ignored voters" dense class="dv-control" />
          <span class="dv-controls__count">{{ filtered.length }} of {{ allDownvotes.length }} loaded</span>
        </section>

        <details class="dv-help">
          <summary>How pattern hints work</summary>
          <p>
            A hint appears only when at least <strong>3 distinct voters</strong> each downvote at least
            <strong>3 shared targets</strong> inside a <strong>72-hour</strong> window, with
            <strong>60% or more pairwise target overlap</strong>. The card lists the voters, targets,
            count, window and overlap. It is evidence for human review, never an automatic hide,
            downvote or punishment.
          </p>
        </details>

        <details class="dv-help">
          <summary>How dollar estimates work</summary>
          <p>
            Each downvote's weight is applied to the voter's <strong>current</strong> Hive Power and
            downvote mana, then priced with the post reward fund and median price feed. The estimate
            shows the value the vote would deduct now; vote history stores the weight but not the
            stake or mana at the time of the vote, so old rows cannot be replayed exactly.
            The table's weight column remains the exact chain value.
          </p>
        </details>

        <div v-if="groupBy !== 'none' && grouped.length" class="dv-groups">
          <article v-for="group in grouped" :key="group.key" class="dv-group">
            <div>
              <router-link v-if="groupBy === 'voter'" :to="'/@' + group.key" class="dv-group__key">@{{ group.key }}</router-link>
              <router-link v-else-if="groupBy === 'target'" :to="targetLink(group.key)" class="dv-group__key">{{ group.key }}</router-link>
              <span v-else class="dv-group__key">{{ group.key }}</span>
              <div class="dv-group__meta">
                {{ group.count }} votes · {{ group.voters }} voters<span v-if="groupValueLabel(group)"> · {{ groupValueLabel(group) }}</span>
              </div>
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
            <caption class="sr-only">Downvotes with voter, weight, estimated value, target time and local relationship</caption>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Voter</th>
                <th scope="col">Relationship</th>
                <th scope="col" class="dv-num">Weight</th>
                <th scope="col" class="dv-num">Value</th>
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
                <td class="dv-num" :title="valueTitle(row)">{{ valueLabel(row.valueUsd) }}</td>
                <td><router-link :to="targetLink(row.target)">{{ row.target }}</router-link></td>
                <td class="dv-row-action">
                  <button type="button" class="dv-link" @click="toggleIgnored(row.voter)">
                    {{ isIgnored(row.voter) ? 'Unignore' : 'Ignore voter' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="groupBy === 'none' && filtered.length > visibleCount" class="dv-more">
          <q-btn flat no-caps color="primary" icon="expand_more" label="Show more rows" @click="showMoreRows" />
          <span>Showing {{ visibleRowCount }} of {{ filtered.length }} matching rows.</span>
        </div>
        <div v-if="hasMore || loadingOlder" class="dv-more">
          <template v-if="!loadAll">
            <q-btn outline no-caps color="primary" icon="expand_more" label="Load older" :loading="loadingOlder" :disable="loading" @click="loadMore()" />
            <q-btn flat no-caps color="primary" label="Load all older" :disable="loading || loadingOlder" @click="loadMore({ all: true })" />
          </template>
          <q-btn v-else flat no-caps color="negative" icon="stop" :label="stopLoading ? 'Stopping…' : 'Stop'" :disable="stopLoading" @click="stopLoading = true" />
          <span v-if="loadingOlder && loadAll">Scanned {{ scannedLabel }} operations · {{ allDownvotes.length }} downvotes…</span>
          <span v-else-if="loadingOlder">Loading older operations…</span>
          <span v-else>Scanned {{ scannedLabel }} operations · {{ allDownvotes.length }} downvotes</span>
        </div>
        <p v-else-if="scanned" class="dv-more__end">End of the filtered vote history reached · {{ scannedLabel }} operations scanned.</p>
        <p v-if="olderError" class="dv-more__error" role="alert">
          <span>{{ olderError }}</span>
          <q-btn v-if="hasMore" flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadMore()" />
        </p>

        <section v-if="ignoredVoters.length" class="dv-ignored" aria-labelledby="dv-ignored-title">
          <h3 id="dv-ignored-title" class="dv-subtitle">Ignored voters</h3>
          <p>Their rows are marked in this local view. The summary above still includes the raw chain impact.</p>
          <button v-for="voter in ignoredVoters" :key="'ignored-' + voter" type="button" class="dv-chip" @click="toggleIgnored(voter)">
            @{{ voter }} ×
          </button>
        </section>
      </template>
    </div>
    </profile-skin>
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
.dv-note { margin: var(--space-2) 0 0; color: var(--c-text-muted); font-size: 0.76rem; line-height: 1.5; }
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
.dv-help { margin-top: var(--space-2); color: var(--c-text-muted); font-size: 0.78rem; }
.dv-help summary { color: var(--c-link); font-weight: 600; cursor: pointer; }
.dv-help p { max-width: 820px; margin: 0.35rem 0 0; line-height: 1.55; }
.dv-groups { display: grid; gap: var(--space-2); margin-top: var(--space-3); }
.dv-group { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); }
.dv-group__key { color: var(--c-text); font-weight: 600; text-decoration: none; overflow-wrap: anywhere; }
.dv-group__meta { color: var(--c-text-muted); font-size: 0.74rem; }
.dv-table-wrap { margin-top: var(--space-3); overflow-x: auto; }
.dv-table { width: 100%; border-collapse: collapse; min-width: 780px; }
.dv-table th, .dv-table td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--c-border); text-align: left; font-size: 0.78rem; vertical-align: top; }
.dv-table thead th { color: var(--c-text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
.dv-num { text-align: right !important; white-space: nowrap; }
.dv-row-action { text-align: right !important; }
.dv-link { border: 0; background: none; color: var(--c-link); font: inherit; cursor: pointer; text-decoration: underline; }
.dv-more { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3); color: var(--c-text-muted); font-size: 0.76rem; }
.dv-more__end { margin-top: var(--space-3); color: var(--c-text-muted); font-size: 0.76rem; }
.dv-more__error { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); color: var(--c-negative); font-size: 0.76rem; }
.dv-ignored { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid var(--c-border); border-radius: var(--radius-card); background: var(--c-surface-2); color: var(--c-text-muted); font-size: 0.8rem; }
.dv-subtitle { margin: 0 0 0.25rem; color: var(--c-text); font-size: 0.9rem; }
</style>

<script>
import moment from 'src/utils/time'
import { markRaw } from 'vue'
import accountHeader from 'components/accountHeader.vue'
import ProfileSkin from 'components/theme/ProfileSkin.vue'
import {
  coordinationEvidence,
  downvotesFor,
  filterIgnoredVoters,
  groupDownvotes,
  relationshipFor,
  summarizeDownvotes,
  withDownvoteValues
} from 'src/services/downvotes'
import { VOTE_HISTORY_PAGES, fetchAccountVoteHistoryPage } from 'src/services/accountDownvotes'
import { fetchDownvoteValuation } from 'src/services/downvoteValuation'
import { setPageMeta } from 'src/utils/pageMeta'
import { useModerationStore } from 'src/stores/moderation'

const PAGE_ROWS = 40

export default {
  name: 'DownvotesPage',
  components: { accountHeader, ProfileSkin },
  data () {
    return {
      rows: [],
      cursor: -1,
      hasMore: true,
      scanned: 0,
      loading: false,
      loadingOlder: false,
      loadAll: false,
      stopLoading: false,
      error: '',
      olderError: '',
      historyRequest: 0,
      rowKeys: markRaw(new Set()),
      direction: 'received',
      range: '30',
      relationshipFilter: 'all',
      minWeight: '0',
      groupBy: 'none',
      showIgnored: false,
      visibleCount: PAGE_ROWS,
      voterAccounts: {},
      rewardFund: null,
      medianHistory: null,
      valuationLoading: false,
      valuationError: '',
      valuationRequest: 0,
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
        { label: 'Followed mute list', value: 'followed list' },
        { label: 'Followed blacklist', value: 'followed blacklist' },
        { label: 'Unknown', value: 'unknown' }
      ],
      weightOptions: [
        { label: 'Any weight', value: '0' },
        { label: 'At least 1%', value: '1' },
        { label: 'At least 5%', value: '5' },
        { label: 'At least 10%', value: '10' },
        { label: 'At least 25%', value: '25' },
        { label: 'At least 50%', value: '50' }
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
    valuedDownvotes () {
      return withDownvoteValues(this.allDownvotes, {
        accounts: this.voterAccounts,
        rewardFund: this.rewardFund,
        medianHistory: this.medianHistory
      })
    },
    summary () {
      return summarizeDownvotes(this.valuedDownvotes)
    },
    scannedLabel () {
      return Math.max(0, Number(this.scanned) || 0).toLocaleString('en-US')
    },
    coordination () {
      return coordinationEvidence(this.allDownvotes)
    },
    ignoredVoters () {
      return this.moderation.ignoredVoters
    },
    filtered () {
      let list = this.valuedDownvotes
      if (this.range !== 'all') {
        const cutoff = Date.now() - Number(this.range) * 24 * 60 * 60 * 1000
        list = list.filter(row => (Number(row.time) || 0) >= cutoff)
      }
      if (this.relationshipFilter !== 'all') {
        list = list.filter(row => relationshipFor(row.voter, this.moderation.context) === this.relationshipFilter)
      }
      const minWeight = Number(this.minWeight) * 100
      if (Number.isFinite(minWeight) && minWeight > 0) {
        list = list.filter(row => Math.abs(Number(row.weight) || 0) >= minWeight)
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
    },
    visibleRowCount () {
      return Math.min(this.visibleCount, this.filtered.length)
    }
  },
  watch: {
    '$route.params.username' () {
      this.load({ force: true })
    },
    direction () {
      this.visibleCount = PAGE_ROWS
      this.loadValuation()
    },
    range () {
      this.visibleCount = PAGE_ROWS
    },
    minWeight () {
      this.visibleCount = PAGE_ROWS
    },
    groupBy () {
      this.visibleCount = PAGE_ROWS
    }
  },
  mounted () {
    setPageMeta({
      title: '@' + this.username + ' downvotes — voter and target transparency — banksia.io',
      description: 'Public downvote activity for @' + this.username + ' on banksia.io, with voter, weight, estimated dollar impact, target, time and local relationship context.',
      url: '/@' + this.username + '/downvotes'
    })
    this.moderation.setScope(this.loggedInUser || 'guest')
    this.moderation.ensureContext()
    if (!this.account) this.$hiveStore.getAccount(this.username)
    this.load()
  },
  beforeUnmount () {
    // Stop any in-flight initial/older-history or valuation loop.
    this.historyRequest += 1
    this.valuationRequest += 1
  },
  methods: {
    resetHistory () {
      this.rows = []
      this.rowKeys = markRaw(new Set())
      this.cursor = -1
      this.hasMore = true
      this.scanned = 0
    },
    async appendHistoryPage ({ force = false, requestId = this.historyRequest } = {}) {
      const result = await fetchAccountVoteHistoryPage(this.username, { cursor: this.cursor, force })
      if (requestId !== this.historyRequest) return null
      this.applyHistoryPage(result)
      return result
    },
    applyHistoryPage (result) {
      if (!result) return
      for (const row of Array.isArray(result.rows) ? result.rows : []) {
        if (!row || Number(row.weight) >= 0) continue
        const key = this.rowKey(row)
        if (this.rowKeys.has(key)) continue
        this.rowKeys.add(key)
        this.rows.push(row)
      }
      this.scanned += Math.max(0, Number(result.scanned) || 0)
      const next = result.nextCursor === null || result.nextCursor === undefined
        ? null
        : Number(result.nextCursor)
      if (this.cursor >= 0 && result.hasMore && (next === null || !Number.isFinite(next) || next >= this.cursor)) {
        this.hasMore = false
        this.olderError = 'History stopped advancing; older loading was stopped to avoid a loop.'
        return
      }
      this.cursor = Number.isFinite(next) ? next : null
      this.hasMore = Boolean(result.hasMore && this.cursor !== null)
    },
    async load ({ force = false } = {}) {
      if (!this.username) return
      const requestId = ++this.historyRequest
      this.loading = true
      this.error = ''
      this.olderError = ''
      this.loadingOlder = false
      this.loadAll = false
      this.stopLoading = false
      this.resetHistory()
      try {
        for (let page = 0; page < VOTE_HISTORY_PAGES && this.hasMore; page++) {
          if (requestId !== this.historyRequest) return
          await this.appendHistoryPage({ force, requestId })
        }
      } catch (error) {
        if (requestId === this.historyRequest) this.error = error?.message || 'Could not load downvote history.'
      } finally {
        if (requestId === this.historyRequest) this.loading = false
      }
      if (requestId === this.historyRequest) this.loadValuation({ force })
    },
    async loadMore ({ all = false } = {}) {
      if (!this.username || !this.hasMore || this.loading || this.loadingOlder) return
      const requestId = this.historyRequest
      this.loadingOlder = true
      this.loadAll = all
      this.stopLoading = false
      this.olderError = ''
      let loaded = 0
      try {
        while (this.hasMore && !this.stopLoading && requestId === this.historyRequest && (all || loaded < 1)) {
          const before = this.cursor
          const result = await this.appendHistoryPage({ requestId })
          if (!result || requestId !== this.historyRequest) break
          loaded++
          if (all && this.hasMore && this.cursor === before) break
          if (all) await this.$nextTick()
        }
      } catch (error) {
        if (requestId === this.historyRequest) this.olderError = error?.message || 'Could not load older downvote history.'
      } finally {
        if (requestId === this.historyRequest) {
          this.loadingOlder = false
          this.loadAll = false
          this.stopLoading = false
        }
      }
      if (loaded && requestId === this.historyRequest) this.loadValuation()
    },
    showMoreRows () {
      this.visibleCount += PAGE_ROWS
    },
    async loadValuation ({ force = false } = {}) {      const voters = this.direction === 'given'
        ? [this.username]
        : [...new Set(this.allDownvotes.map(row => row.voter).filter(Boolean))]
      const requestId = ++this.valuationRequest
      if (!voters.length) {
        this.voterAccounts = {}
        this.valuationError = ''
        this.valuationLoading = false
        return
      }
      this.valuationLoading = true
      try {
        const valuation = await fetchDownvoteValuation(voters, { force })
        if (requestId !== this.valuationRequest) return
        this.voterAccounts = valuation.accounts
        this.rewardFund = valuation.rewardFund
        this.medianHistory = valuation.medianHistory
        this.valuationError = valuation.rewardFundUnavailable || valuation.priceUnavailable
          ? 'Dollar estimates are unavailable: the reward fund or price feed could not be read.'
          : ''
      } catch (error) {
        if (requestId !== this.valuationRequest) return
        this.valuationError = error?.message || 'Could not estimate the dollar impact.'
      } finally {
        if (requestId === this.valuationRequest) this.valuationLoading = false
      }
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
    valueLabel (value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '—'
      if (number < 0.01) return '≈ <$0.01'
      return '≈ ' + number.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    },
    groupValueLabel (group) {
      const value = Number(group.totalValueUsd)
      return Number.isFinite(value) && value > 0 ? this.valueLabel(value) : ''
    },
    valueTitle (row) {
      const rshares = Math.abs(Number(row.valueRshares) || 0)
      if (!rshares) return 'Voter stake, mana, reward fund or price feed unavailable'
      return 'Estimated ' + this.compactNumber(rshares) + ' rshares at current stake and mana'
    },
    compactNumber (value) {
      const number = Math.abs(Number(value) || 0)
      if (number >= 1e12) return (number / 1e12).toFixed(1) + 'T'
      if (number >= 1e9) return (number / 1e9).toFixed(1) + 'B'
      if (number >= 1e6) return (number / 1e6).toFixed(1) + 'M'
      if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K'
      return number.toFixed(0)
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
