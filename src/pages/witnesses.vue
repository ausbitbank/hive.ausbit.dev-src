<template>
  <q-page class="net-page">
    <div class="net-shell">
      <witness-header
        :logged-in="Boolean(loggedInUser)"
        :my-votes-only="myVotesOnly"
        :proxy="votingProxy"
        :my-votes="votedNames.size"
        :vote-limit="30"
        :total-witnesses="witnesses.length"
        :warning-count="healthSummary.warning + healthSummary.critical"
        :consensus-count="21"
        :hardfork-version="hardforkVersion"
        :account-hp="accountHp"
        :loading="loading"
        @refresh="loadWitnesses"
        @toggle-my-votes="toggleMyVotes"
        @manage-proxy="openProxy"
      />

      <witness-filters
        v-model:search="search"
        v-model:sort="sort"
        v-model:direction="direction"
        v-model:my-votes-only="myVotesOnly"
        v-model:warnings-only="warningsOnly"
        :logged-in="Boolean(loggedInUser)"
        :visible-count="filteredWitnesses.length"
        :total-count="witnessRows.length"
        :warning-count="healthSummary.warning + healthSummary.critical"
        @clear="clearFilters"
      />

      <nav class="witness-jump" aria-label="Witness page sections">
        <a href="#witness-directory">Directory</a>
        <a href="#witness-analytics">Governance analytics</a>
        <a href="#witness-voter-segments">Voter segments</a>
        <a href="#witness-calculator">Vote weight calculator</a>
      </nav>

      <section id="witness-directory" class="net-section" aria-labelledby="witness-list-title">
        <div class="net-section__head">
          <div>
            <h2 id="witness-list-title" class="net-section__title">
              {{ myVotesOnly ? 'My witness votes' : 'Witness directory' }}
            </h2>
            <span class="net-section__hint">
              Ranked by approval. Health checks cover missed blocks, price feeds, signing keys and versions.
            </span>
          </div>
          <q-btn
            v-if="loggedInUser"
            flat
            dense
            no-caps
            color="primary"
            icon="tune"
            label="Edit witness settings"
            to="/witness"
          />
        </div>

        <q-card v-if="loading" flat bordered class="witness-list-card">
          <div v-for="i in 8" :key="i" class="witness-skeleton">
            <q-skeleton type="circle" size="38px" />
            <div class="witness-skeleton__body">
              <q-skeleton type="text" width="38%" />
              <q-skeleton type="text" width="62%" />
            </div>
          </div>
        </q-card>

        <q-card v-else-if="loadError" flat bordered class="net-state net-state--error">
          <q-icon name="error_outline" size="2em" aria-hidden="true" />
          <div>{{ loadError }}</div>
          <q-btn flat dense no-caps color="primary" icon="refresh" label="Retry" @click="loadWitnesses" />
        </q-card>

        <q-card v-else-if="!filteredWitnesses.length" flat bordered class="net-state">
          <q-icon name="search_off" size="2em" color="grey" aria-hidden="true" />
          <div v-if="myVotesOnly && !votedNames.size">You have not voted for any witnesses yet.</div>
          <div v-else-if="warningsOnly">No witnesses match the current health filter.</div>
          <div v-else>No witnesses match “{{ search }}”.</div>
          <q-btn flat dense no-caps color="primary" icon="clear" label="Clear filters" @click="clearFilters" />
        </q-card>

        <q-card v-else flat bordered class="witness-list-card">
          <ul class="witness-list">
            <witness-row
              v-for="witness in visibleWitnesses"
              :key="witness.owner"
              :witness="witness"
              :rank="witness.rank"
              :global-props="globalProps"
              :hardfork-version="hardforkVersion"
              :warnings="witness.health"
              :status="witness.status"
              :voted="votedNames.has(witness.owner)"
              :logged-in="Boolean(loggedInUser)"
              :voting-blocked="Boolean(votingProxy)"
              :proxy="votingProxy"
              :expanded="Boolean(expanded[witness.owner])"
              @vote="toggleVote"
              @unvote="toggleVote"
              @toggle="toggleDetails"
            />
          </ul>
          <div v-if="visibleWitnesses.length < filteredWitnesses.length" class="witness-list__more">
            <span>Showing {{ visibleWitnesses.length }} of {{ filteredWitnesses.length }} witnesses</span>
            <q-btn
              outline
              no-caps
              color="primary"
              icon="expand_more"
              :label="'Show ' + Math.min(pageSize, filteredWitnesses.length - visibleWitnesses.length) + ' more'"
              @click="showMoreWitnesses"
            />
          </div>
        </q-card>
      </section>

      <witness-analytics
        id="witness-analytics"
        :witnesses="witnessRows"
        :global-props="globalProps"
        :hardfork-version="hardforkVersion"
      />

      <section id="witness-calculator" class="net-section" aria-labelledby="witness-calculator-title">
        <div class="net-section__head">
          <div>
            <h2 id="witness-calculator-title" class="net-section__title">Vote weight calculator</h2>
            <span class="net-section__hint">Estimate your influence before you queue a vote.</span>
          </div>
        </div>
        <witness-vote-calculator
          :account="votingAccount"
          :global-props="globalProps"
          :witnesses="witnessRows"
          :proxy="votingProxy"
        />
      </section>
    </div>

    <q-dialog v-model="proxyDialog">
      <q-card class="witness-proxy-dialog">
        <q-card-section>
          <h2 class="text-h6 q-my-none">Voting proxy</h2>
          <p class="witness-proxy-dialog__intro">
            A proxy votes for witnesses and proposals on your behalf with its own stake.
            Setting a proxy replaces your direct witness votes until you clear it.
          </p>
          <q-input
            v-model="newProxy"
            outlined
            dense
            label="Proxy account"
            hint="3–16 lowercase letters, numbers, dots or hyphens"
            :error="Boolean(proxyError)"
            :error-message="proxyError"
            autofocus
            @keyup.enter="setProxy"
          >
            <template #prepend>
              <q-icon name="alternate_email" aria-hidden="true" />
            </template>
          </q-input>
          <div class="witness-proxy-dialog__authority">
            <q-badge color="orange-9" text-color="black">active</q-badge>
            <span>Setting or clearing a proxy requires your active key.</span>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-if="votingProxy" flat no-caps color="red" icon="link_off" label="Clear proxy" @click="setProxy('')" />
          <q-btn flat no-caps label="Cancel" v-close-popup />
          <q-btn
            no-caps
            color="primary"
            icon="check"
            :label="newProxy ? 'Set proxy' : 'Save'"
            :disable="Boolean(proxyError)"
            @click="setProxy"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.witness-jump {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.witness-jump a {
  padding: 0.28rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  color: var(--c-text-subtle);
  font-size: 0.74rem;
  text-decoration: none;
}

.witness-jump a:hover,
.witness-jump a:focus-visible {
  color: var(--c-text);
  border-color: color-mix(in srgb, var(--c-link) 40%, transparent);
  background: color-mix(in srgb, var(--c-link) 8%, transparent);
}

.witness-list-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--c-text) 2%, transparent);
}

.witness-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.witness-list__more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  padding: 0.6rem 0.9rem;
  border-top: 1px solid var(--border-subtle);
  color: var(--c-text-subtle);
  font-size: 0.74rem;
}

.witness-skeleton {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 0.95rem;
  border-top: 1px solid var(--border-subtle);
}

.witness-skeleton:first-child {
  border-top: 0;
}

.witness-skeleton__body {
  flex: 1;
  min-width: 0;
}

.witness-proxy-dialog {
  width: 100%;
  max-width: 460px;
  border-radius: var(--radius-card);
}

.witness-proxy-dialog__intro {
  margin: 0.4rem 0 0.8rem;
  color: var(--c-text-subtle);
  font-size: 0.82rem;
  line-height: 1.5;
}

.witness-proxy-dialog__authority {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.65rem;
  color: var(--c-text-faint);
  font-size: 0.72rem;
}
</style>

<style>
#witness-directory,
#witness-analytics,
#witness-voter-segments,
#witness-calculator {
  scroll-margin-top: 84px;
}
</style>

<script>
import WitnessHeader from 'components/witness/WitnessHeader.vue'
import WitnessFilters from 'components/witness/WitnessFilters.vue'
import WitnessRow from 'components/witness/WitnessRow.vue'
import WitnessVoteCalculator from 'components/witness/WitnessVoteCalculator.vue'
import WitnessAnalytics from 'components/witness/WitnessAnalytics.vue'
import { setPageMeta } from 'src/utils/pageMeta'
import { fetchWitnessByAccount, fetchWitnessesByVote } from 'src/services/chainData'
import {
  accountVoteWeight,
  aggregateWitnessHealth,
  filterWitnesses,
  formatHp,
  SCHEDULED_WITNESSES,
  sortWitnesses,
  validateProxy,
  witnessHealth,
  witnessProxyQueueItem,
  witnessStatus,
  witnessVoteQueueItem,
  MAX_WITNESS_VOTES
} from 'src/services/witnesses'

export default {
  name: 'Witnesses',
  components: {
    WitnessHeader,
    WitnessFilters,
    WitnessRow,
    WitnessVoteCalculator,
    WitnessAnalytics
  },
  data () {
    const query = this.$route?.query || {}
    const sortOptions = ['rank', 'votes', 'missed', 'pricefeed', 'version', 'name', 'warnings']
    return {
      witnesses: [],
      rankMap: new Map(),
      hardforkVersion: '',
      loading: true,
      loadError: '',
      search: typeof query.search === 'string' ? query.search : '',
      sort: sortOptions.includes(query.sort) ? query.sort : 'rank',
      direction: query.direction === 'desc' ? 'desc' : 'asc',
      myVotesOnly: query.myVotes === '1',
      warningsOnly: query.warnings === '1',
      expanded: {},
      visibleLimit: 60,
      pageSize: 60,
      optimisticVotes: null,
      optimisticProxy: null,
      proxyDialog: false,
      newProxy: '',
      proxyError: ''
    }
  },
  computed: {
    loggedInUser () {
      return this.$hiveStore.user.username
    },
    globalProps () {
      return this.$hiveStore.globalProps
    },
    account () {
      return this.loggedInUser ? this.$hiveStore.accounts[this.loggedInUser] : undefined
    },
    votingProxy () {
      if (this.optimisticProxy !== null) return this.optimisticProxy
      return this.account?.proxy || ''
    },
    votingAccount () {
      if (!this.loggedInUser) return null
      if (this.votingProxy) {
        return this.$hiveStore.accounts[this.votingProxy] || { name: this.votingProxy, witness_votes: [] }
      }
      return this.account || null
    },
    votedNames () {
      if (this.optimisticVotes) return this.optimisticVotes
      return new Set(Array.isArray(this.votingAccount?.witness_votes) ? this.votingAccount.witness_votes : [])
    },
    witnessRows () {
      return this.witnesses.map(witness => {
        const rank = this.rankMap.get(witness.owner) || null
        const health = witnessHealth(witness, {
          globalProps: this.globalProps,
          hardforkVersion: this.hardforkVersion,
          headBlock: this.globalProps?.head_block_number,
          scheduled: rank !== null ? rank <= SCHEDULED_WITNESSES : false
        })
        return {
          ...witness,
          rank,
          health,
          status: witnessStatus(health),
          warningCount: health.filter(item => item.severity !== 'info').length
        }
      })
    },
    healthSummary () {
      return aggregateWitnessHealth(this.witnessRows, {
        globalProps: this.globalProps,
        hardforkVersion: this.hardforkVersion
      })
    },
    filteredWitnesses () {
      const rows = filterWitnesses(this.witnessRows, {
        search: this.search,
        myVotesOnly: this.myVotesOnly,
        warningsOnly: this.warningsOnly,
        votedNames: this.votedNames
      })
      return sortWitnesses(rows, this.sort, this.direction)
    },
    visibleWitnesses () {
      return this.filteredWitnesses.slice(0, this.visibleLimit)
    },
    accountHp () {
      if (!this.votingAccount) return null
      return formatHp(accountVoteWeight(this.votingAccount, this.globalProps).hp)
    }
  },
  watch: {
    search (value) {
      this.visibleLimit = this.pageSize
      this.syncQuery()
      if (value && this.myVotesOnly) this.myVotesOnly = false
    },
    sort () {
      this.visibleLimit = this.pageSize
      this.syncQuery()
    },
    direction () {
      this.visibleLimit = this.pageSize
      this.syncQuery()
    },
    myVotesOnly () {
      this.visibleLimit = this.pageSize
      this.syncQuery()
    },
    warningsOnly () {
      this.visibleLimit = this.pageSize
      this.syncQuery()
    },
    '$route.query.search' (value) {
      const next = typeof value === 'string' ? value : ''
      if (next !== this.search) this.search = next
    }
  },
  mounted () {
    setPageMeta({
      title: 'Hive witnesses — ranks, votes, health and vote weight',
      description: 'Browse Hive witnesses: approval ranks, missed blocks, price feeds, signing status, version health, proxies and vote-weight calculations.',
      url: '/witnesses'
    })
    this.loadWitnesses()
  },
  methods: {
    async loadWitnesses () {
      this.loading = true
      this.loadError = ''
      try {
        if (!this.globalProps || this.globalProps.empty) {
          await this.$hiveStore.getGlobalProps()
        }

        const [witnesses, hardforkVersion] = await Promise.all([
          fetchWitnessesByVote(200),
          this.$hive.api.callAsync('condenser_api.get_hardfork_version', []).catch(() => '')
        ])

        const list = Array.isArray(witnesses) ? witnesses : []
        this.witnesses = list
        this.rankMap = new Map(list.map((witness, index) => [witness.owner, index + 1]))
        this.hardforkVersion = hardforkVersion || ''

        await this.loadVotingAccounts()
        await this.ensureVotedWitnesses()
      } catch {
        this.loadError = 'Could not load the witness directory. Please try again.'
        this.$q.notify({ type: 'negative', message: 'Failed to load witnesses' })
      } finally {
        this.loading = false
      }
    },
    async loadVotingAccounts () {
      if (!this.loggedInUser) return
      if (this.account === undefined) await this.$hiveStore.getAccount(this.loggedInUser)
      const proxy = this.account?.proxy
      if (proxy && this.$hiveStore.accounts[proxy] === undefined) {
        await this.$hiveStore.getAccount(proxy)
      }
    },
    async ensureVotedWitnesses () {
      const known = new Set(this.witnesses.map(witness => witness.owner))
      const missing = [...this.votedNames].filter(owner => !known.has(owner))
      if (!missing.length) return

      const results = await Promise.allSettled(
        missing.map(owner => fetchWitnessByAccount(owner))
      )
      const extras = results
        .filter(result => result.status === 'fulfilled' && result.value?.owner)
        .map(result => result.value)
      if (extras.length) this.witnesses = this.witnesses.concat(extras)
    },
    toggleDetails (witness) {
      this.expanded = { ...this.expanded, [witness.owner]: !this.expanded[witness.owner] }
    },
    showMoreWitnesses () {
      this.visibleLimit += this.pageSize
    },
    toggleVote (witness) {
      if (!this.loggedInUser) {
        this.$q.notify({ type: 'warning', message: 'Log in via the account menu to vote for witnesses.' })
        return
      }
      if (this.votingProxy) {
        this.$q.notify({ type: 'warning', message: 'Your votes are controlled by proxy @' + this.votingProxy + '. Clear the proxy first.' })
        return
      }

      const approve = !this.votedNames.has(witness.owner)
      if (approve && this.votedNames.size >= MAX_WITNESS_VOTES) {
        this.$q.notify({ type: 'negative', message: 'You already use all 30 witness votes. Unvote a witness first.' })
        return
      }

      this.$hiveStore.addToQueue(witnessVoteQueueItem(this.loggedInUser, witness.owner, approve))
      const next = new Set(this.votedNames)
      if (approve) next.add(witness.owner)
      else next.delete(witness.owner)
      this.optimisticVotes = next

      this.$q.notify({
        type: approve ? 'positive' : 'info',
        message: (approve ? 'Vote for @' : 'Unvote for @') + witness.owner + ' queued. Requires your active key.'
      })
    },
    openProxy () {
      this.newProxy = this.votingProxy
      this.proxyError = ''
      this.proxyDialog = true
    },
    setProxy (value) {
      const proxyValue = typeof value === 'string' ? value : this.newProxy
      const result = validateProxy(proxyValue, this.loggedInUser)
      if (!result.valid) {
        this.proxyError = result.error
        return
      }

      this.$hiveStore.addToQueue(witnessProxyQueueItem(this.loggedInUser, result.value))
      this.optimisticProxy = result.value
      if (result.value && this.$hiveStore.accounts[result.value] === undefined) {
        this.$hiveStore.getAccount(result.value)
      }
      this.optimisticVotes = null
      this.proxyDialog = false
      this.proxyError = ''
      this.$q.notify({
        type: result.value ? 'positive' : 'info',
        message: result.value
          ? 'Proxy @' + result.value + ' queued. Requires your active key.'
          : 'Proxy removal queued. Requires your active key.'
      })
    },
    clearFilters () {
      this.search = ''
      this.myVotesOnly = false
      this.warningsOnly = false
    },
    syncQuery () {
      const query = { ...this.$route.query }
      if (this.search) query.search = this.search
      else delete query.search
      if (this.sort !== 'rank') query.sort = this.sort
      else delete query.sort
      if (this.direction !== 'asc') query.direction = this.direction
      else delete query.direction
      if (this.myVotesOnly) query.myVotes = '1'
      else delete query.myVotes
      if (this.warningsOnly) query.warnings = '1'
      else delete query.warnings
      this.$router.replace({ query }).catch(() => {})
    },
    toggleMyVotes () {
      this.myVotesOnly = !this.myVotesOnly
      this.syncQuery()
    }
  }
}
</script>
