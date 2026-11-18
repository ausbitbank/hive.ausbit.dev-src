<template>
  <q-card v-if="proposalId !== 0" flat bordered class="voter-overlap">
    <q-card-section>
      <div class="voter-overlap__head">
        <h2 class="voter-overlap__title">Voter overlap</h2>
        <q-badge v-if="!loading && !error" color="blue-grey-9">{{ overlap.sharedCount }} shared</q-badge>
      </div>

      <div v-if="loading" class="voter-overlap__state">
        <q-spinner-puff color="primary" size="1.6em" aria-label="Loading return proposal voters" />
        <span>Comparing with the return proposal…</span>
      </div>

      <div v-else-if="error" class="voter-overlap__state">
        <q-icon name="info_outline" size="16px" aria-hidden="true" />
        <span>{{ error }}</span>
      </div>

      <template v-else>
        <p class="voter-overlap__lead">
          <strong>{{ formatPercent(overlap.overlapOfA * 100) }}</strong> of this proposal's
          {{ overlap.countA.toLocaleString('en-US') }} recorded voters also vote for the return proposal.
        </p>

        <dl class="voter-overlap__pairs">
          <div>
            <dt>Shared voters</dt>
            <dd>{{ overlap.sharedCount.toLocaleString('en-US') }}</dd>
          </div>
          <div>
            <dt>Jaccard</dt>
            <dd>{{ formatPercent(overlap.jaccard * 100) }}</dd>
          </div>
          <div>
            <dt>Return voters</dt>
            <dd>{{ overlap.countB.toLocaleString('en-US') }}</dd>
          </div>
          <div>
            <dt>Only this proposal</dt>
            <dd>{{ overlap.onlyACount.toLocaleString('en-US') }}</dd>
          </div>
        </dl>

        <div v-if="overlap.shared.length" class="voter-overlap__avatars" aria-label="Voters shared with the return proposal">
          <router-link
            v-for="voter in overlap.shared.slice(0, 12)"
            :key="voter"
            :to="'/@' + voter"
            :title="'@' + voter"
            :aria-label="'View shared voter @' + voter"
          >
            <q-avatar size="26px">
              <q-img :src="avatarUrl(voter)" :alt="'Avatar of @' + voter" />
            </q-avatar>
          </router-link>
          <span v-if="overlap.shared.length > 12" class="voter-overlap__more">+{{ overlap.shared.length - 12 }} more</span>
        </div>

        <p class="voter-overlap__note">
          Uses the first 1,000 recorded voters on each side. Overlap is a signal of how a proposal sits relative to the funding threshold,
          not a judgement about any voter.
        </p>
      </template>
    </q-card-section>
  </q-card>
</template>

<script>
import { listProposalVotes } from 'src/services/proposals'
import { voteOverlap } from 'src/services/governance'

export default {
  name: 'VoterOverlapCard',
  props: {
    proposalId: { type: Number, default: 0 },
    votes: { type: Array, default: () => [] }
  },
  data () {
    return {
      returnVotes: [],
      loading: false,
      error: ''
    }
  },
  computed: {
    overlap () {
      return voteOverlap(this.votes, this.returnVotes)
    }
  },
  watch: {
    proposalId: {
      immediate: true,
      handler () {
        this.load()
      }
    }
  },
  methods: {
    avatarUrl (user) {
      return 'https://images.hive.blog/u/' + user + '/avatar'
    },
    formatPercent (value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(1) + '%' : '—'
    },
    async load () {
      const id = Number(this.proposalId)
      this.returnVotes = []
      this.error = ''
      if (!Number.isInteger(id) || id === 0) return

      this.loading = true
      try {
        this.returnVotes = await listProposalVotes(0, { limit: 1000 })
      } catch {
        this.error = 'Could not load the return proposal voters for comparison.'
        this.returnVotes = []
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.voter-overlap__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 0.35rem;
}

.voter-overlap__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.voter-overlap__state {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #90a4ae;
  font-size: 0.76rem;
}

.voter-overlap__lead {
  margin: 0.2rem 0 0.55rem;
  color: #b0bec5;
  font-size: 0.78rem;
  line-height: 1.45;
}

.voter-overlap__lead strong {
  color: #81d4fa;
}

.voter-overlap__pairs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.7rem;
  margin: 0;
}

.voter-overlap__pairs dt {
  color: #78909c;
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.voter-overlap__pairs dd {
  margin: 0;
  color: #cfd8dc;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.voter-overlap__avatars {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  margin-top: 0.6rem;
}

.voter-overlap__more {
  color: #90a4ae;
  font-size: 0.72rem;
}

.voter-overlap__note {
  margin: 0.55rem 0 0;
  color: #78909c;
  font-size: 0.68rem;
  line-height: 1.4;
}
</style>
