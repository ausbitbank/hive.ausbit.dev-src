<template>
  <q-page class="proposals-page">
    <div class="proposals-wrap">
      <header class="proposals-header">
        <h1 class="page-title">Decentralized Hive Fund</h1>
        <p class="page-intro">
          Browse proposals funded by the Hive DAO. Daily pay is streamed from
          <router-link to="/@hive.fund">@hive.fund</router-link> while a proposal is above the return proposal and inside its payment window.
        </p>
      </header>

      <section class="funding-stats" aria-label="DHF funding summary">
        <div class="funding-stat">
          <div class="funding-stat__label">Daily funded</div>
          <div class="funding-stat__value">{{ loading ? '—' : formatHbd(summary.dailyFunded) }} <span>HBD</span></div>
          <div class="funding-stat__hint">Active funded proposals</div>
        </div>
        <div class="funding-stat">
          <div class="funding-stat__label">HBD Stabilizer</div>
          <div class="funding-stat__value">{{ loading ? '—' : formatHbd(summary.hbdStabilizerDaily) }} <span>HBD</span></div>
          <div class="funding-stat__hint">Daily HBD to @hbdstabilizer</div>
        </div>
        <div class="funding-stat">
          <div class="funding-stat__label">Max daily budget</div>
          <div class="funding-stat__value">{{ fundAccountReady ? formatHbd(summary.maxDailyBudget) : '—' }} <span>HBD</span></div>
          <div class="funding-stat__hint">1% of the hive.fund balance</div>
        </div>
        <div class="funding-stat">
          <div class="funding-stat__label">Total budget</div>
          <div class="funding-stat__value">{{ fundAccountReady ? formatHbd(summary.totalBudget) : '—' }} <span>HBD</span></div>
          <div class="funding-stat__hint">HBD held by @hive.fund</div>
        </div>
      </section>

      <q-card flat bordered class="proposals-controls">
        <q-tabs
          v-model="tab"
          dense
          align="left"
          narrow-indicator
          class="proposals-tabs"
          active-color="primary"
          indicator-color="primary"
          mobile-arrows
          aria-label="Filter proposals"
        >
          <q-tab name="all" label="All" />
          <q-tab name="active" label="Active" />
          <q-tab name="upcoming" label="Upcoming" />
          <q-tab name="expired" label="Expired" />
          <q-tab v-if="loggedInUser" name="voted" label="Voted" />
        </q-tabs>

        <q-card-section class="q-pt-none">
          <div class="row q-col-gutter-md items-center">
            <div class="col-12 col-sm-5 col-md-4">
              <q-select
                v-model="sort"
                :options="sortOptions"
                emit-value
                map-options
                outlined
                dense
                label="Sort proposals"
                options-dense
              />
            </div>
            <div class="col-12 col-sm-7 col-md-8">
              <q-input
                v-model="search"
                outlined
                dense
                clearable
                label="Search subject, creator, receiver, id or permlink"
                aria-label="Search proposals"
              >
                <template #prepend>
                  <q-icon name="search" aria-hidden="true" />
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <div class="proposals-count" aria-live="polite">
        <template v-if="!loading && !loadError">
          {{ visibleProposals.length }} of {{ proposals.length }} proposals shown
          <span v-if="returnProposalVotes > 0 && hpReady"> · Return proposal threshold ≈ {{ formatHp(returnVotesHp) }} HP</span>
        </template>
      </div>

      <div v-if="loading" class="proposals-state">
        <q-spinner-puff color="primary" size="2.4em" aria-label="Loading proposals" />
        <div class="q-mt-sm text-caption">Loading proposals…</div>
      </div>

      <q-card v-else-if="loadError" flat bordered class="proposals-state proposals-state--error">
        <q-icon name="error_outline" size="2em" color="orange" aria-hidden="true" />
        <div class="q-mt-sm">{{ loadError }}</div>
        <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" class="q-mt-sm" @click="load" />
      </q-card>

      <q-card v-else-if="visibleProposals.length === 0" flat bordered class="proposals-state">
        <q-icon name="search_off" size="2em" color="grey" aria-hidden="true" />
        <div class="q-mt-sm">
          {{ tab === 'voted' ? 'You have not voted for any proposals yet.' : 'No proposals match the current tab and search.' }}
        </div>
        <q-btn
          v-if="search || tab !== 'all'"
          flat
          dense
          no-caps
          color="primary"
          icon="clear"
          label="Clear filters"
          class="q-mt-sm"
          @click="clearFilters"
        />
      </q-card>

      <template v-else>
        <section v-if="fundedProposals.length" class="proposal-section" aria-labelledby="funded-heading">
          <h2 id="funded-heading" class="section-title proposal-section__title">Funded proposals</h2>
          <p class="proposal-section__note">
            At or above the return proposal — these are currently in line for DHF funding.
            <span v-if="returnProposalVotes > 0">The return proposal is included as the funding threshold.</span>
          </p>
          <div class="proposal-grid">
            <proposal-card
              v-for="proposal in fundedProposals"
              :key="proposal.id"
              :p="proposal"
              :return-proposal-votes="returnProposalVotes"
              :voted="isVoted(proposal.id)"
              @vote="onVote"
            />
          </div>
        </section>

        <section v-if="otherProposals.length" class="proposal-section" aria-labelledby="other-heading">
          <h2 id="other-heading" class="section-title proposal-section__title">Other proposals</h2>
          <p class="proposal-section__note">
            Below the return proposal — not currently funded.
          </p>
          <div class="proposal-grid">
            <proposal-card
              v-for="proposal in otherProposals"
              :key="proposal.id"
              :p="proposal"
              :return-proposal-votes="returnProposalVotes"
              :voted="isVoted(proposal.id)"
              @vote="onVote"
            />
          </div>
        </section>

        <section v-if="expiredProposals.length" class="proposal-section" aria-labelledby="expired-heading">
          <h2 id="expired-heading" class="section-title proposal-section__title">Expired proposals</h2>
          <p class="proposal-section__note">
            Payment windows that have ended. They are kept for historical reference.
          </p>
          <div class="proposal-grid">
            <proposal-card
              v-for="proposal in expiredVisible"
              :key="proposal.id"
              :p="proposal"
              :return-proposal-votes="returnProposalVotes"
              :voted="isVoted(proposal.id)"
              @vote="onVote"
            />
          </div>
          <div v-if="expiredProposals.length > expiredVisible.length || tab !== 'expired'" class="proposal-section__more">
            <q-btn
              v-if="tab === 'expired' && expiredLimit < expiredProposals.length"
              outline
              no-caps
              color="primary"
              icon="expand_more"
              :label="'Load more expired proposals (' + (expiredProposals.length - expiredVisible.length) + ' remaining)'"
              @click="expiredLimit += 24"
            />
            <q-btn
              v-else-if="tab !== 'expired'"
              flat
              no-caps
              color="primary"
              icon="history"
              :label="'View all ' + expiredProposals.length + ' expired proposals'"
              @click="tab = 'expired'"
            />
          </div>
        </section>
      </template>

      <proposal-analytics
        v-if="!loading && !loadError && proposals.length"
        :proposals="proposals"
        :global-props="globalProps"
        :return-votes="returnProposalVotes"
      />
    </div>
  </q-page>
</template>

<script>
import ProposalCard from 'components/proposal.vue'
import ProposalAnalytics from 'components/proposal/ProposalAnalytics.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import {
  listProposals,
  getVoterVoteIds,
  fundingSummary,
  filterProposals,
  sortProposals,
  proposalPhase,
  assetAmount,
  voteValueHp,
  formatHbd,
  formatHp
} from 'src/services/proposals'

const VALID_TABS = ['all', 'active', 'upcoming', 'expired', 'voted']
const VALID_SORTS = ['votes', 'daily', 'newest', 'ending']

export default {
  name: 'Proposals',
  components: { ProposalCard, ProposalAnalytics },
  data () {
    const query = this.$route?.query || {}
    return {
      proposals: [],
      votedIds: new Set(),
      voterVotesFor: null,
      loading: true,
      loadError: null,
      tab: VALID_TABS.includes(query.tab) ? query.tab : 'all',
      sort: VALID_SORTS.includes(query.sort) ? query.sort : 'votes',
      search: typeof query.search === 'string' ? query.search : '',
      expiredLimit: 24,
      sortOptions: [
        { label: 'Most votes', value: 'votes' },
        { label: 'Highest daily pay', value: 'daily' },
        { label: 'Newest', value: 'newest' },
        { label: 'Ending soon', value: 'ending' }
      ],
      queryTimer: null
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    globalProps () {
      return this.$hiveStore.globalProps
    },
    hpReady () {
      const props = this.globalProps
      return Boolean(props && props.total_vesting_shares && props.total_vesting_fund_hive)
    },
    daoAccount () {
      return this.$hiveStore.accounts['hive.fund']
    },
    fundAccountReady () {
      return this.daoAccount !== undefined
    },
    fundHbdBalance () {
      return assetAmount(this.daoAccount?.hbd_balance)
    },
    returnProposalVotes () {
      const proposal = this.proposals.find(item => Number(item.id) === 0)
      return proposal ? Number(proposal.total_votes) || 0 : 0
    },
    returnVotesHp () {
      return voteValueHp({ total_votes: this.returnProposalVotes }, this.globalProps)
    },
    summary () {
      return fundingSummary(this.proposals, this.globalProps, {
        fundHbdBalance: this.fundHbdBalance,
        returnVotes: this.returnProposalVotes
      })
    },
    visibleProposals () {
      const filtered = filterProposals(this.proposals, {
        tab: this.tab,
        search: this.search,
        votedIds: this.votedIds
      })
      return sortProposals(filtered, this.sort)
    },
    currentProposals () {
      return this.visibleProposals.filter(proposal => proposalPhase(proposal) !== 'expired')
    },
    fundedProposals () {
      return this.currentProposals.filter(proposal => {
        return Number(proposal.id) === 0 || Number(proposal.total_votes) >= this.returnProposalVotes
      })
    },
    otherProposals () {
      return this.currentProposals.filter(proposal => {
        return Number(proposal.id) !== 0 && Number(proposal.total_votes) < this.returnProposalVotes
      })
    },
    expiredProposals () {
      return this.visibleProposals.filter(proposal => proposalPhase(proposal) === 'expired')
    },
    expiredVisible () {
      const limit = this.tab === 'expired' ? this.expiredLimit : 12
      return this.expiredProposals.slice(0, limit)
    }
  },
  watch: {
    loggedInUser (username) {
      if (username) {
        this.loadVoterVotes(username)
      } else {
        this.votedIds = new Set()
        this.voterVotesFor = null
        if (this.tab === 'voted') this.tab = 'all'
      }
    },
    tab () {
      this.expiredLimit = 24
      this.syncQuery()
    },
    sort () {
      this.syncQuery()
    },
    search () {
      this.syncQuery()
    },
    '$route.query': {
      deep: true,
      handler (query) {
        const tab = VALID_TABS.includes(query.tab) ? query.tab : 'all'
        const sort = VALID_SORTS.includes(query.sort) ? query.sort : 'votes'
        const search = typeof query.search === 'string' ? query.search : ''
        if (tab !== this.tab) this.tab = tab
        if (sort !== this.sort) this.sort = sort
        if (search !== this.search) this.search = search
      }
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive proposals — Decentralized Hive Fund',
      description: 'Browse Decentralized Hive Fund (DHF) proposals: requested daily funding, votes, funding status, payment projections and the return proposal on the Hive blockchain.',
      url: this.$route.path
    })

    if (this.daoAccount === undefined) this.$hiveStore.getAccount('hive.fund')
    if (this.globalProps.empty) this.$hiveStore.getGlobalProps()
    if (!this.loggedInUser && this.tab === 'voted') this.tab = 'all'

    this.load()
  },
  beforeUnmount () {
    if (this.queryTimer) clearTimeout(this.queryTimer)
  },
  methods: {
    formatHbd,
    formatHp,
    async load () {
      this.loading = true
      this.loadError = null
      const username = this.loggedInUser

      try {
        const [proposals, votedIds] = await Promise.all([
          listProposals(),
          username ? getVoterVoteIds(username).catch(() => new Set()) : Promise.resolve(new Set())
        ])
        this.proposals = proposals
        this.votedIds = votedIds
        this.voterVotesFor = username || null
      } catch {
        this.loadError = 'Failed to load proposals. Please try again.'
        this.$q.notify({ type: 'negative', message: 'Failed to load proposals' })
      } finally {
        this.loading = false
      }
    },
    async loadVoterVotes (username) {
      if (this.voterVotesFor === username) return
      try {
        const ids = await getVoterVoteIds(username)
        if (this.loggedInUser !== username) return
        this.votedIds = ids
        this.voterVotesFor = username
      } catch {
        // Voting still works without the initial voted state; the queue is the
        // source of truth for newly queued votes.
      }
    },
    isVoted (id) {
      return this.votedIds.has(Number(id))
    },
    onVote ({ proposal, approve }) {
      const next = new Set(this.votedIds)
      const id = Number(proposal.id)
      if (approve) next.add(id)
      else next.delete(id)
      this.votedIds = next
    },
    clearFilters () {
      this.tab = 'all'
      this.search = ''
    },
    syncQuery () {
      if (this.queryTimer) clearTimeout(this.queryTimer)
      this.queryTimer = setTimeout(() => {
        const query = { ...this.$route.query }
        if (this.tab !== 'all') query.tab = this.tab
        else delete query.tab
        if (this.sort !== 'votes') query.sort = this.sort
        else delete query.sort
        if (this.search) query.search = this.search
        else delete query.search

        this.$router.replace({ query }).catch(() => {})
      }, 250)
    }
  }
}
</script>

<style scoped>
.proposals-page {
  padding: var(--space-5) var(--space-4) var(--space-6);
}

.proposals-wrap {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.proposals-header {
  text-align: center;
  margin-bottom: var(--space-5);
}

.funding-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.funding-stat {
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.035);
  min-width: 0;
}

.funding-stat__label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #90a4ae;
}

.funding-stat__value {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.funding-stat__value span {
  font-size: 0.8rem;
  font-weight: 400;
  color: #b0bec5;
}

.funding-stat__hint {
  font-size: 0.72rem;
  color: #78909c;
}

.proposals-controls {
  margin-bottom: var(--space-2);
}

.proposals-tabs {
  border-bottom: 1px solid var(--border-subtle);
}

.proposals-count {
  min-height: 1.4em;
  margin: var(--space-2) 0 var(--space-4);
  font-size: 0.8rem;
  color: #90a4ae;
  text-align: center;
}

.proposals-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: #b0bec5;
}

.proposals-state--error {
  color: #ffb74d;
}

.proposal-section {
  margin-top: var(--space-5);
}

.proposal-section__title {
  justify-content: flex-start;
  padding-left: 0;
  padding-right: 0;
  margin-bottom: var(--space-1);
}

.proposal-section__note {
  margin: 0 0 var(--space-3);
  color: #90a4ae;
  font-size: 0.82rem;
}

.proposal-section__more {
  display: flex;
  justify-content: center;
  margin-top: var(--space-4);
}

.proposal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  gap: var(--space-4);
  align-items: stretch;
}

@media (max-width: 600px) {
  .proposals-page {
    padding: var(--space-3) var(--space-2) var(--space-5);
  }
}
</style>
